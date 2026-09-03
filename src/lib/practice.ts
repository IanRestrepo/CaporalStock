import "server-only";
import { registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * La bodega de práctica del tutorial.
 *
 * El tutorial manda a la gente a las pantallas reales, porque apretar el botón
 * de verdad es la mitad de lo que hay que aprender. Pero un movimiento de
 * práctica es indistinguible de uno real: el saldo se deriva de los
 * movimientos, y una entrada recalcula el costo promedio del producto. Sacar
 * dos cervezas "para ver" dejaría el conteo mintiendo para siempre.
 *
 * Por eso la práctica tiene su propia bodega y sus propios productos, marcados
 * con `practice`. Se pueden mover, contar y comprar como cualquier otro, no
 * aparecen en nada que cuente plata, y se borran enteros al salir — sin tener
 * que adivinar después qué era de mentira.
 */

export const PRACTICE_LOCATION = "Bodega de práctica";

const SEED = [
  { name: "Agua de práctica", unit: "UNIDAD" as const, cost: 1200, sale: 5000, min: 12, qty: 24 },
  { name: "Toalla de práctica", unit: "UNIDAD" as const, cost: 22000, sale: 0, min: 6, qty: 10 },
  { name: "Detergente de práctica", unit: "GRAMO" as const, cost: 9.4, sale: 0, min: 2000, qty: 5000 },
];

/**
 * Deja la práctica lista.
 *
 * Es idempotente a propósito: volver al tutorial desde la píldora remonta el
 * reproductor, y si esto reiniciara la práctica se perdería justo lo que la
 * persona acaba de hacer. Se monta una vez y vive hasta que se vaya.
 */
export async function prepararPractica(userId: string) {
  const existing = await prisma.location.findFirst({
    where: { practice: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const category = await prisma.category.findFirst({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!category) return null;

  const location = await prisma.location.create({
    data: { name: PRACTICE_LOCATION, kind: "PRINCIPAL", practice: true, sortOrder: 900 },
  });

  const products = await Promise.all(
    SEED.map((seed) =>
      prisma.product.create({
        data: {
          name: seed.name,
          categoryId: category.id,
          baseUnit: seed.unit,
          costPrice: seed.cost,
          salePrice: seed.sale,
          minQty: seed.min,
          practice: true,
          presentations: { create: [{ name: "Unidad", factor: 1, isDefaultConsume: true }] },
        },
        select: { id: true },
      }),
    ),
  );

  // El saldo entra por donde entra siempre: un movimiento. Que la práctica se
  // comporte distinto al sistema real la volvería una mentira útil a nadie.
  await registerMovement({
    type: "ENTRADA",
    createdById: userId,
    toLocationId: location.id,
    reason: "Práctica del tutorial",
    lines: products.map((product, i) => ({ productId: product.id, quantity: SEED[i].qty })),
  });

  return location.id;
}

/**
 * Borra la práctica entera.
 *
 * En orden de dependencia: las líneas antes que los movimientos, los
 * movimientos antes que los productos. Es seguro correrla cuando no hay nada.
 */
export async function limpiarPractica() {
  const products = await prisma.product.findMany({
    where: { practice: true },
    select: { id: true },
  });
  const locations = await prisma.location.findMany({
    where: { practice: true },
    select: { id: true },
  });

  if (!products.length && !locations.length) return;

  const productIds = products.map((p) => p.id);
  const locationIds = locations.map((l) => l.id);

  await prisma.$transaction(async (tx) => {
    const movements = await tx.movement.findMany({
      where: {
        OR: [
          { lines: { some: { productId: { in: productIds } } } },
          { fromLocationId: { in: locationIds } },
          { toLocationId: { in: locationIds } },
        ],
      },
      select: { id: true },
    });
    const movementIds = movements.map((m) => m.id);

    await tx.movementLine.deleteMany({ where: { movementId: { in: movementIds } } });
    await tx.movement.deleteMany({ where: { id: { in: movementIds } } });

    await tx.purchaseItem.deleteMany({ where: { productId: { in: productIds } } });
    await tx.purchase.deleteMany({ where: { locationId: { in: locationIds } } });

    await tx.checklistTemplateItem.deleteMany({ where: { productId: { in: productIds } } });
    await tx.lot.deleteMany({ where: { productId: { in: productIds } } });
    await tx.stock.deleteMany({
      where: { OR: [{ productId: { in: productIds } }, { locationId: { in: locationIds } }] },
    });
    await tx.presentation.deleteMany({ where: { productId: { in: productIds } } });
    await tx.product.deleteMany({ where: { id: { in: productIds } } });
    await tx.location.deleteMany({ where: { id: { in: locationIds } } });
  });
}
