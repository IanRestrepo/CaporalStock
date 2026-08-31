import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { MovementType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { round4 } from "@/lib/units";

/**
 * Motor de movimientos.
 *
 * Regla única e innegociable: el saldo de Stock jamás se escribe desde la UI.
 * Se mueve exclusivamente aquí, dentro de la misma transacción que crea el
 * Movement. Si algo falla a mitad de camino, no queda ni el saldo ni el papel.
 */

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export type MovementLineInput = {
  productId: string;
  /** Siempre positiva y en unidad base. La dirección la decide el tipo. */
  quantity: number;
  lotId?: string | null;
  unitCost?: number;
  unitPrice?: number;
};

export type MovementInput = {
  type: MovementType;
  createdById: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  roomId?: string | null;
  reason?: string | null;
  note?: string | null;
  purchaseId?: string | null;
  checklistRunId?: string | null;
  occurredAt?: Date;
  lines: MovementLineInput[];
};

type Tx = Prisma.TransactionClient;

/**
 * Qué extremos exige cada tipo de movimiento.
 * El AJUSTE no exige ninguno en particular: sube por el lado del destino y baja
 * por el del origen, según el conteo. Se valida aparte que traiga uno de los dos.
 */
const SHAPE: Record<MovementType, { from: boolean; to: boolean }> = {
  ENTRADA: { from: false, to: true },
  TRASLADO: { from: true, to: true },
  CONSUMO: { from: true, to: false },
  DANIO: { from: true, to: false },
  AJUSTE: { from: false, to: false },
};

export async function registerMovement(input: MovementInput) {
  const shape = SHAPE[input.type];

  if (shape.from && !input.fromLocationId) {
    throw new InventoryError("Falta indicar de qué bodega sale el producto.");
  }
  if (shape.to && !input.toLocationId) {
    throw new InventoryError("Falta indicar a qué bodega entra el producto.");
  }
  if (input.type === "TRASLADO" && input.fromLocationId === input.toLocationId) {
    throw new InventoryError("El origen y el destino no pueden ser la misma bodega.");
  }
  if (input.type === "AJUSTE" && !input.fromLocationId && !input.toLocationId) {
    throw new InventoryError("Falta indicar en qué bodega se está ajustando.");
  }
  if (!input.lines.length) {
    throw new InventoryError("El movimiento no tiene productos.");
  }

  const lines = mergeLines(input.lines);
  for (const line of lines) {
    if (!(line.quantity > 0)) {
      throw new InventoryError("Las cantidades deben ser mayores a cero.");
    }
  }

  // Congelamos costo y precio del catálogo si el llamador no los trajo: un
  // reporte de utilidad del mes pasado no puede cambiar porque hoy subió un precio.
  const catalog = await prisma.product.findMany({
    where: { id: { in: [...new Set(lines.map((l) => l.productId))] } },
    select: { id: true, costPrice: true, salePrice: true },
  });
  const priceOf = new Map(catalog.map((p) => [p.id, p]));

  for (const line of lines) {
    const prices = priceOf.get(line.productId);
    if (!prices) throw new InventoryError("Hay un producto que ya no existe en el catálogo.");
    line.unitCost = line.unitCost ?? Number(prices.costPrice);
    line.unitPrice = line.unitPrice ?? Number(prices.salePrice);
  }

  return prisma.$transaction(async (tx) => {
    const movement = await tx.movement.create({
      data: {
        type: input.type,
        createdById: input.createdById,
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        roomId: input.roomId ?? null,
        reason: input.reason ?? null,
        note: input.note ?? null,
        purchaseId: input.purchaseId ?? null,
        checklistRunId: input.checklistRunId ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        lines: {
          create: lines.map((line) => ({
            productId: line.productId,
            lotId: line.lotId ?? null,
            quantity: new Prisma.Decimal(line.quantity),
            unitCost: new Prisma.Decimal(line.unitCost ?? 0),
            unitPrice: new Prisma.Decimal(line.unitPrice ?? 0),
          })),
        },
      },
    });

    // Los renglones ya vienen sin productos repetidos, así que ninguna de
    // estas consultas toca la fila que toca otra. En fila, un traslado de doce
    // productos son veinticuatro viajes a la base uno tras otro; en paralelo es
    // uno. Con la base en otro país, esa diferencia es la que hacía que la
    // transacción se venciera a mitad de camino.
    await Promise.all(
      lines.flatMap((line) => {
        const trabajo: Promise<unknown>[] = [];
        if (input.fromLocationId) {
          trabajo.push(shiftStock(tx, line.productId, input.fromLocationId, -line.quantity));
        }
        if (input.toLocationId) {
          trabajo.push(shiftStock(tx, line.productId, input.toLocationId, line.quantity));
        }
        return trabajo;
      }),
    );

    // El costo promedio sí va después y de a uno: lee el total del producto,
    // que las líneas anteriores acaban de cambiar.
    if (input.type === "ENTRADA" && input.purchaseId) {
      for (const line of lines) {
        if (line.unitCost) {
          await recalcAverageCost(tx, line.productId, line.quantity, line.unitCost);
        }
      }
    }

    return movement;
  },
  {
    // Cinco segundos alcanzan con la base al lado; con la base en São Paulo y
    // un movimiento de muchos renglones, no.
    timeout: 20000,
    maxWait: 10000,
  });
}

/**
 * Ajuste de conteo: el admin declara el saldo real y el sistema deduce la
 * diferencia. Queda registrada como movimiento, no como una edición silenciosa.
 */
export async function adjustStock(params: {
  productId: string;
  locationId: string;
  countedQty: number;
  createdById: string;
  reason: string;
  note?: string | null;
}) {
  const current = await prisma.stock.findUnique({
    where: {
      productId_locationId: {
        productId: params.productId,
        locationId: params.locationId,
      },
    },
  });

  const currentQty = current ? Number(current.quantity) : 0;
  const delta = round4(params.countedQty - currentQty);

  if (delta === 0) {
    throw new InventoryError("El conteo coincide con el sistema; no hay nada que ajustar.");
  }

  return registerMovement({
    type: "AJUSTE",
    createdById: params.createdById,
    fromLocationId: delta < 0 ? params.locationId : null,
    toLocationId: delta > 0 ? params.locationId : null,
    reason: params.reason,
    note: params.note ?? null,
    lines: [{ productId: params.productId, quantity: Math.abs(delta) }],
  });
}

/**
 * Mueve el saldo y verifica en el mismo paso que no quede en rojo.
 * Se incrementa primero y se valida después: así dos empleados registrando a la
 * vez no pueden colarse por la ventana entre "leer" y "escribir".
 */
async function shiftStock(tx: Tx, productId: string, locationId: string, delta: number) {
  const row = await tx.stock.upsert({
    where: { productId_locationId: { productId, locationId } },
    create: {
      productId,
      locationId,
      quantity: new Prisma.Decimal(delta),
    },
    update: {
      quantity: { increment: new Prisma.Decimal(delta) },
    },
    select: {
      quantity: true,
      product: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  if (Number(row.quantity) < 0) {
    throw new InventoryError(
      `No hay suficiente ${row.product.name} en ${row.location.name}.`,
    );
  }
}

/**
 * Costo promedio ponderado sobre las existencias totales del producto.
 * Es el método que no castiga al hotel cuando el proveedor sube el precio a
 * mitad de mes, y el que hace que la utilidad bruta del reporte sea creíble.
 */
async function recalcAverageCost(
  tx: Tx,
  productId: string,
  incomingQty: number,
  incomingCost: number,
) {
  const [product, totals] = await Promise.all([
    tx.product.findUniqueOrThrow({
      where: { id: productId },
      select: { costPrice: true },
    }),
    tx.stock.aggregate({
      where: { productId },
      _sum: { quantity: true },
    }),
  ]);

  const totalAfter = Number(totals._sum.quantity ?? 0);
  const previousQty = round4(totalAfter - incomingQty);
  const previousCost = Number(product.costPrice);

  if (previousQty <= 0) {
    await tx.product.update({
      where: { id: productId },
      data: { costPrice: new Prisma.Decimal(incomingCost) },
    });
    return;
  }

  const weighted =
    (previousQty * previousCost + incomingQty * incomingCost) / (previousQty + incomingQty);

  await tx.product.update({
    where: { id: productId },
    data: { costPrice: new Prisma.Decimal(weighted.toFixed(6)) },
  });
}

/** Dos renglones del mismo producto y lote se suman antes de tocar el saldo. */
function mergeLines(lines: MovementLineInput[]): MovementLineInput[] {
  const map = new Map<string, MovementLineInput>();
  for (const line of lines) {
    const key = `${line.productId}::${line.lotId ?? ""}`;
    const found = map.get(key);
    if (found) {
      found.quantity = round4(found.quantity + line.quantity);
      found.unitCost = line.unitCost ?? found.unitCost;
      found.unitPrice = line.unitPrice ?? found.unitPrice;
    } else {
      map.set(key, { ...line, quantity: round4(line.quantity) });
    }
  }
  return [...map.values()];
}

/**
 * Aplica un conteo físico completo de una bodega.
 *
 * Agrupa las diferencias en dos movimientos —lo que sobró y lo que faltó— en
 * vez de uno por producto: así el kardex cuenta la historia de un conteo, no de
 * cuarenta correcciones sueltas. Los productos cuyo conteo coincide con el
 * sistema no generan nada, porque no pasó nada.
 */
export async function applyPhysicalCount(params: {
  locationId: string;
  createdById: string;
  counts: { productId: string; countedQty: number }[];
  note?: string | null;
}) {
  const { locationId, createdById, counts, note } = params;

  if (!counts.length) {
    throw new InventoryError("El conteo no tiene productos.");
  }

  const current = await prisma.stock.findMany({
    where: { locationId, productId: { in: counts.map((c) => c.productId) } },
    select: { productId: true, quantity: true },
  });
  const onHand = new Map(current.map((row) => [row.productId, Number(row.quantity)]));

  const surplus: { productId: string; quantity: number }[] = [];
  const shortfall: { productId: string; quantity: number }[] = [];

  for (const count of counts) {
    const delta = round4(count.countedQty - (onHand.get(count.productId) ?? 0));
    if (delta > 0) surplus.push({ productId: count.productId, quantity: delta });
    else if (delta < 0) shortfall.push({ productId: count.productId, quantity: -delta });
  }

  if (!surplus.length && !shortfall.length) {
    throw new InventoryError("El conteo coincide con el sistema; no hay nada que ajustar.");
  }

  const reason = "Conteo físico";
  const movements = [];

  if (surplus.length) {
    movements.push(
      await registerMovement({
        type: "AJUSTE",
        createdById,
        toLocationId: locationId,
        reason,
        note: note ?? null,
        lines: surplus,
      }),
    );
  }

  if (shortfall.length) {
    movements.push(
      await registerMovement({
        type: "AJUSTE",
        createdById,
        fromLocationId: locationId,
        reason,
        note: note ?? null,
        lines: shortfall,
      }),
    );
  }

  return { movements, sobrantes: surplus.length, faltantes: shortfall.length };
}
