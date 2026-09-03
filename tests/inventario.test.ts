import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { InventoryError, adjustStock, registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * Pruebas de integración contra la base real.
 *
 * Se ejecutan sobre un producto de laboratorio creado y borrado por el propio
 * archivo, así que no ensucian el inventario del hotel. Cubren lo único que no
 * se puede permitir que falle: que el saldo nunca mienta.
 */

let adminId: string;
let bodegaA: string;
let bodegaB: string;
let productId: string;
let categoriaId: string;

const marca = `test-${Date.now()}`;

beforeAll(async () => {
  // Barrer lo que dejaron corridas que se cayeron antes de limpiar.
  const viejas = await prisma.category.findMany({
    where: { name: { startsWith: "Pruebas test-" } },
    select: { id: true, products: { select: { id: true } } },
  });
  const viejosProductos = viejas.flatMap((c) => c.products.map((p) => p.id));
  if (viejosProductos.length) {
    await prisma.movementLine.deleteMany({ where: { productId: { in: viejosProductos } } });
    await prisma.stock.deleteMany({ where: { productId: { in: viejosProductos } } });
    await prisma.presentation.deleteMany({ where: { productId: { in: viejosProductos } } });
    await prisma.lot.deleteMany({ where: { productId: { in: viejosProductos } } });
    await prisma.product.deleteMany({ where: { id: { in: viejosProductos } } });
  }
  if (viejas.length) {
    await prisma.category.deleteMany({ where: { id: { in: viejas.map((c) => c.id) } } });
  }
  const viejasBodegas = await prisma.location.findMany({
    where: { name: { startsWith: "Bodega A test-" } },
    select: { id: true },
  });
  const viejasB = await prisma.location.findMany({
    where: { name: { startsWith: "Bodega B test-" } },
    select: { id: true },
  });
  const ids = [...viejasBodegas, ...viejasB].map((l) => l.id);
  if (ids.length) {
    await prisma.movement.updateMany({
      where: { fromLocationId: { in: ids } },
      data: { fromLocationId: null },
    });
    await prisma.movement.updateMany({
      where: { toLocationId: { in: ids } },
      data: { toLocationId: null },
    });
    await prisma.stock.deleteMany({ where: { locationId: { in: ids } } });
    await prisma.location.deleteMany({ where: { id: { in: ids } } });
  }

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminId = admin.id;

  const categoria = await prisma.category.create({
    data: { name: `Pruebas ${marca}`, color: "slate", sortOrder: 999 },
  });
  categoriaId = categoria.id;

  // El laboratorio vive detrás de la misma marca que la práctica del tutorial.
  // Así, si una corrida se cae antes de limpiar, lo que quede es invisible para
  // el hotel en vez de aparecer como una bodega más en la pantalla.
  const [a, b] = await Promise.all([
    prisma.location.create({ data: { name: `Bodega A ${marca}`, kind: "PRINCIPAL", practice: true } }),
    prisma.location.create({ data: { name: `Bodega B ${marca}`, kind: "PRINCIPAL", practice: true } }),
  ]);
  bodegaA = a.id;
  bodegaB = b.id;

  const producto = await prisma.product.create({
    data: {
      name: `Harina de prueba ${marca}`,
      categoryId: categoria.id,
      baseUnit: "GRAMO",
      costPrice: 10,
      salePrice: 25,
      minQty: 100,
      practice: true,
    },
  });
  productId = producto.id;

  await registerMovement({
    type: "ENTRADA",
    createdById: adminId,
    toLocationId: bodegaA,
    reason: "Carga de prueba",
    lines: [{ productId: productId, quantity: 1000 }],
  });
});

/**
 * La limpieza no puede rendirse a la mitad.
 *
 * Si un paso falla —un producto todavía referenciado, una bodega con saldo— el
 * resto igual tiene que correr: lo que quede a medias aparece en el catálogo
 * del hotel, y una prueba que ensucia el inventario real es peor que ninguna.
 */
async function limpiar(paso: () => Promise<unknown>) {
  try {
    await paso();
  } catch (err) {
    console.error("limpieza incompleta:", err);
  }
}

afterAll(async () => {
  await prisma.movementLine.deleteMany({ where: { productId } });
  await prisma.movement.deleteMany({
    where: { OR: [{ fromLocationId: { in: [bodegaA, bodegaB] } }, { toLocationId: { in: [bodegaA, bodegaB] } }] },
  });
  await limpiar(() => prisma.stock.deleteMany({ where: { productId } }));
  await limpiar(() => prisma.presentation.deleteMany({ where: { productId } }));
  await limpiar(() => prisma.lot.deleteMany({ where: { productId } }));
  await limpiar(() => prisma.product.delete({ where: { id: productId } }));
  await limpiar(() => prisma.category.delete({ where: { id: categoriaId } }));
  await limpiar(() =>
    prisma.location.deleteMany({ where: { id: { in: [bodegaA, bodegaB] } } }),
  );
  await prisma.$disconnect();
});

/** Sólo los movimientos de estas bodegas de laboratorio. Contar la tabla
 *  entera se vuelve lento a medida que el hotel acumula historial. */
async function movimientosDePrueba() {
  return prisma.movement.count({
    where: {
      OR: [
        { fromLocationId: { in: [bodegaA, bodegaB] } },
        { toLocationId: { in: [bodegaA, bodegaB] } },
      ],
    },
  });
}

async function saldo(locationId: string) {
  const row = await prisma.stock.findUnique({
    where: { productId_locationId: { productId, locationId } },
  });
  return row ? Number(row.quantity) : 0;
}

describe("motor de movimientos", () => {
  test("la entrada deja el saldo cargado", async () => {
    expect(await saldo(bodegaA)).toBe(1000);
  });

  test("el traslado mueve el saldo sin crear ni destruir", async () => {
    const antesA = await saldo(bodegaA);
    const antesB = await saldo(bodegaB);

    await registerMovement({
      type: "TRASLADO",
      createdById: adminId,
      fromLocationId: bodegaA,
      toLocationId: bodegaB,
      lines: [{ productId, quantity: 400 }],
    });

    expect(await saldo(bodegaA)).toBe(antesA - 400);
    expect(await saldo(bodegaB)).toBe(antesB + 400);
    expect((await saldo(bodegaA)) + (await saldo(bodegaB))).toBe(antesA + antesB);
  });

  test("el consumo congela costo y precio del catálogo", async () => {
    const movement = await registerMovement({
      type: "CONSUMO",
      createdById: adminId,
      fromLocationId: bodegaB,
      reason: "Prueba",
      lines: [{ productId, quantity: 100 }],
    });

    const linea = await prisma.movementLine.findFirstOrThrow({
      where: { movementId: movement.id },
    });

    expect(Number(linea.unitCost)).toBe(10);
    expect(Number(linea.unitPrice)).toBe(25);
  });

  test("un cambio de precio no reescribe la historia", async () => {
    await prisma.product.update({ where: { id: productId }, data: { salePrice: 99 } });

    const anterior = await prisma.movementLine.findFirstOrThrow({
      where: { productId, movement: { type: "CONSUMO" } },
      orderBy: { movement: { occurredAt: "asc" } },
    });

    expect(Number(anterior.unitPrice)).toBe(25);
    await prisma.product.update({ where: { id: productId }, data: { salePrice: 25 } });
  });

  test("no se puede sacar más de lo que hay", async () => {
    const antes = await saldo(bodegaB);
    const movimientos = await movimientosDePrueba();

    await expect(
      registerMovement({
        type: "CONSUMO",
        createdById: adminId,
        fromLocationId: bodegaB,
        lines: [{ productId, quantity: antes + 1 }],
      }),
    ).rejects.toBeInstanceOf(InventoryError);

    expect(await saldo(bodegaB)).toBe(antes);
    expect(await movimientosDePrueba()).toBe(movimientos);
  });

  test("si un renglón falla, no entra ninguno", async () => {
    const otro = await prisma.product.create({
      data: {
        name: `Azúcar de prueba ${marca}`,
        categoryId: categoriaId,
        baseUnit: "GRAMO",
        costPrice: 5,
        minQty: 0,
      },
    });

    const antes = await saldo(bodegaA);

    await expect(
      registerMovement({
        type: "CONSUMO",
        createdById: adminId,
        fromLocationId: bodegaA,
        lines: [
          { productId, quantity: 10 },
          { productId: otro.id, quantity: 999 },
        ],
      }),
    ).rejects.toBeInstanceOf(InventoryError);

    expect(await saldo(bodegaA)).toBe(antes);

    await prisma.stock.deleteMany({ where: { productId: otro.id } });
    await prisma.product.delete({ where: { id: otro.id } });
  });

  test("rechaza trasladar a la misma bodega", async () => {
    await expect(
      registerMovement({
        type: "TRASLADO",
        createdById: adminId,
        fromLocationId: bodegaA,
        toLocationId: bodegaA,
        lines: [{ productId, quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  test("rechaza cantidades en cero o negativas", async () => {
    await expect(
      registerMovement({
        type: "CONSUMO",
        createdById: adminId,
        fromLocationId: bodegaA,
        lines: [{ productId, quantity: 0 }],
      }),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  test("dos renglones del mismo producto se suman antes de tocar el saldo", async () => {
    const antes = await saldo(bodegaA);

    await registerMovement({
      type: "CONSUMO",
      createdById: adminId,
      fromLocationId: bodegaA,
      lines: [
        { productId, quantity: 30 },
        { productId, quantity: 20 },
      ],
    });

    expect(await saldo(bodegaA)).toBe(antes - 50);
  });

  test("el ajuste lleva el saldo al conteo real y deja rastro", async () => {
    await adjustStock({
      productId,
      locationId: bodegaA,
      countedQty: 123,
      createdById: adminId,
      reason: "Conteo físico",
    });

    expect(await saldo(bodegaA)).toBe(123);

    const ajuste = await prisma.movement.findFirst({
      where: { type: "AJUSTE", reason: "Conteo físico" },
      orderBy: { createdAt: "desc" },
    });
    expect(ajuste).not.toBeNull();
  });

  test("ajustar al mismo valor no inventa un movimiento", async () => {
    await expect(
      adjustStock({
        productId,
        locationId: bodegaA,
        countedQty: 123,
        createdById: adminId,
        reason: "Conteo repetido",
      }),
    ).rejects.toBeInstanceOf(InventoryError);
  });
});
