import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getExpiring, getLowStock } from "@/lib/alerts";
import { registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * Las alertas deciden a quién se manda a reponer.
 *
 * Lo que se prueba es el umbral: el mínimo de la ubicación manda sobre el del
 * producto, porque la bodega puede exigir 20 y el minibar 2 del mismo producto.
 * Equivocarse acá manda a alguien a cargar un carro para nada, o peor, deja una
 * suite vacía sin avisar.
 *
 * Estos datos NO pueden ir marcados como práctica: las alertas la excluyen a
 * propósito, y un laboratorio invisible no probaría nada. Por eso el nombre
 * lleva prefijo y la limpieza corre pase lo que pase.
 */

const PREFIJO = "ZZ-alerta";
const marca = `${PREFIJO}-${Date.now()}`;

let adminId = "";
let bodegaId = "";
let productoId = "";
let categoriaId = "";

/** Que un paso que falla no impida los siguientes: lo que queda a medias es visible en el hotel. */
async function limpiar(paso: () => Promise<unknown>) {
  try {
    await paso();
  } catch (err) {
    console.error("limpieza incompleta:", err);
  }
}

async function borrarRastro(where: { productos: string[]; bodegas: string[]; categorias: string[] }) {
  const { productos, bodegas, categorias } = where;
  if (productos.length) {
    await limpiar(() => prisma.movementLine.deleteMany({ where: { productId: { in: productos } } }));
  }
  if (bodegas.length) {
    await limpiar(() =>
      prisma.movement.deleteMany({
        where: { OR: [{ fromLocationId: { in: bodegas } }, { toLocationId: { in: bodegas } }] },
      }),
    );
  }
  if (productos.length) {
    await limpiar(() => prisma.lot.deleteMany({ where: { productId: { in: productos } } }));
    await limpiar(() => prisma.stock.deleteMany({ where: { productId: { in: productos } } }));
    await limpiar(() => prisma.presentation.deleteMany({ where: { productId: { in: productos } } }));
    await limpiar(() => prisma.product.deleteMany({ where: { id: { in: productos } } }));
  }
  if (categorias.length) {
    await limpiar(() => prisma.category.deleteMany({ where: { id: { in: categorias } } }));
  }
  if (bodegas.length) {
    await limpiar(() => prisma.location.deleteMany({ where: { id: { in: bodegas } } }));
  }
}

beforeAll(async () => {
  // Barrer lo que dejaron corridas que se cayeron antes de limpiar.
  const [viejosProductos, viejasCategorias, viejasBodegas] = await Promise.all([
    prisma.product.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } }),
    prisma.category.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } }),
    prisma.location.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } }),
  ]);
  await borrarRastro({
    productos: viejosProductos.map((p) => p.id),
    categorias: viejasCategorias.map((c) => c.id),
    bodegas: viejasBodegas.map((l) => l.id),
  });

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminId = admin.id;

  const categoria = await prisma.category.create({
    data: { name: `${marca} categoría`, color: "slate", sortOrder: 999 },
  });
  categoriaId = categoria.id;

  const location = await prisma.location.create({
    data: { name: `${marca} bodega`, kind: "PRINCIPAL", sortOrder: 999 },
  });
  bodegaId = location.id;

  const producto = await prisma.product.create({
    data: {
      name: `${marca} cerveza`,
      categoryId: categoria.id,
      baseUnit: "UNIDAD",
      costPrice: 2000,
      salePrice: 8000,
      minQty: 10,
    },
  });
  productoId = producto.id;
});

afterAll(async () => {
  await borrarRastro({ productos: [productoId], categorias: [categoriaId], bodegas: [bodegaId] });
});

async function alerta() {
  const todas = await getLowStock(500);
  return todas.find((a) => a.productId === productoId) ?? null;
}

describe("alertas de bajo mínimo", () => {
  test("un saldo por encima del mínimo no alerta", async () => {
    await registerMovement({
      type: "ENTRADA",
      createdById: adminId,
      toLocationId: bodegaId,
      reason: "Carga",
      lines: [{ productId: productoId, quantity: 24 }],
    });

    expect(await alerta()).toBeNull();
  });

  test("por debajo del mínimo del producto, alerta", async () => {
    await registerMovement({
      type: "CONSUMO",
      createdById: adminId,
      fromLocationId: bodegaId,
      reason: "Venta",
      lines: [{ productId: productoId, quantity: 20 }],
    });

    const a = await alerta();
    expect(a).not.toBeNull();
    expect(a!.quantity).toBe(4);
    expect(a!.threshold).toBe(10);
  });

  test("el mínimo de la ubicación manda sobre el del producto", async () => {
    // El producto exige 10, pero acá con 2 alcanza: deja de alertar.
    await prisma.stock.update({
      where: { productId_locationId: { productId: productoId, locationId: bodegaId } },
      data: { minQty: 2 },
    });
    expect(await alerta()).toBeNull();

    // Y si la ubicación exige más, alerta aunque al producto le baste.
    await prisma.stock.update({
      where: { productId_locationId: { productId: productoId, locationId: bodegaId } },
      data: { minQty: 50 },
    });
    expect((await alerta())!.threshold).toBe(50);

    await prisma.stock.update({
      where: { productId_locationId: { productId: productoId, locationId: bodegaId } },
      data: { minQty: null },
    });
  });

  test("un mínimo en cero nunca alerta", async () => {
    await prisma.product.update({ where: { id: productoId }, data: { minQty: 0 } });
    expect(await alerta()).toBeNull();
    await prisma.product.update({ where: { id: productoId }, data: { minQty: 10 } });
  });

  test("un producto inactivo deja de pedir reposición", async () => {
    expect(await alerta()).not.toBeNull();

    await prisma.product.update({ where: { id: productoId }, data: { active: false } });
    expect(await alerta()).toBeNull();

    await prisma.product.update({ where: { id: productoId }, data: { active: true } });
  });
});

describe("alertas de vencimiento", () => {
  test("avisa del lote que vence y calla el que está lejos", async () => {
    const pronto = new Date();
    pronto.setDate(pronto.getDate() + 3);
    const lejos = new Date();
    lejos.setDate(lejos.getDate() + 400);

    await prisma.lot.create({
      data: { productId: productoId, code: `${marca}-vence`, expiresAt: pronto },
    });
    await prisma.lot.create({
      data: { productId: productoId, code: `${marca}-lejano`, expiresAt: lejos },
    });

    const codigos = (await getExpiring()).map((a) => a.code);
    expect(codigos).toContain(`${marca}-vence`);
    expect(codigos).not.toContain(`${marca}-lejano`);
  });

  test("un lote sin fecha no vence nunca", async () => {
    await prisma.lot.create({ data: { productId: productoId, code: `${marca}-sinfecha` } });
    const codigos = (await getExpiring()).map((a) => a.code);
    expect(codigos).not.toContain(`${marca}-sinfecha`);
  });
});
