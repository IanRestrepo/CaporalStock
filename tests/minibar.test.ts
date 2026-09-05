import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { inventoryValue, monthRange, periodFlow } from "@/lib/dashboard";
import { registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

/**
 * El ciclo diario del hotel, de punta a punta: entra a la bodega, sube al
 * minibar, el huésped consume, se repone al par.
 *
 * Se prueba sobre todo la plata. El consumo congela costo y precio del
 * catálogo, y de esa resta salen la utilidad y el valor del inventario: si el
 * traslado o la reposición contaran como venta, el reporte diría que el hotel
 * gana el doble de lo que gana.
 */

const PREFIJO = "ZZ-minibar";
const marca = `${PREFIJO}-${Date.now()}`;

let adminId = "";
let bodegaId = "";
let minibarId = "";
let roomId = "";
let productoId = "";
let categoriaId = "";

const COSTO = 1500;
const VENTA = 6000;

async function limpiar(paso: () => Promise<unknown>) {
  try {
    await paso();
  } catch (err) {
    console.error("limpieza incompleta:", err);
  }
}

async function borrar(productos: string[], bodegas: string[], categorias: string[], rooms: string[]) {
  if (productos.length)
    await limpiar(() => prisma.movementLine.deleteMany({ where: { productId: { in: productos } } }));
  if (bodegas.length)
    await limpiar(() =>
      prisma.movement.deleteMany({
        where: { OR: [{ fromLocationId: { in: bodegas } }, { toLocationId: { in: bodegas } }] },
      }),
    );
  if (rooms.length) await limpiar(() => prisma.movement.deleteMany({ where: { roomId: { in: rooms } } }));
  if (productos.length) {
    await limpiar(() => prisma.stock.deleteMany({ where: { productId: { in: productos } } }));
    await limpiar(() => prisma.presentation.deleteMany({ where: { productId: { in: productos } } }));
    await limpiar(() => prisma.product.deleteMany({ where: { id: { in: productos } } }));
  }
  if (categorias.length)
    await limpiar(() => prisma.category.deleteMany({ where: { id: { in: categorias } } }));
  if (bodegas.length)
    await limpiar(() => prisma.location.deleteMany({ where: { id: { in: bodegas } } }));
  if (rooms.length) await limpiar(() => prisma.room.deleteMany({ where: { id: { in: rooms } } }));
}

async function saldo(locationId: string) {
  const row = await prisma.stock.findUnique({
    where: { productId_locationId: { productId: productoId, locationId } },
  });
  return row ? Number(row.quantity) : 0;
}

beforeAll(async () => {
  const [vp, vc, vl, vr] = await Promise.all([
    prisma.product.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } }),
    prisma.category.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } }),
    prisma.location.findMany({ where: { name: { startsWith: PREFIJO } }, select: { id: true } }),
    prisma.room.findMany({ where: { number: { startsWith: PREFIJO } }, select: { id: true } }),
  ]);
  await borrar(vp.map((x) => x.id), vl.map((x) => x.id), vc.map((x) => x.id), vr.map((x) => x.id));

  adminId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;

  categoriaId = (
    await prisma.category.create({ data: { name: `${marca} categoría`, sortOrder: 999 } })
  ).id;

  bodegaId = (
    await prisma.location.create({
      data: { name: `${marca} bodega`, kind: "PRINCIPAL", sortOrder: 999 },
    })
  ).id;

  const room = await prisma.room.create({ data: { number: `${marca} suite`, sortOrder: 999 } });
  roomId = room.id;

  minibarId = (
    await prisma.location.create({
      data: { name: `${marca} minibar`, kind: "MINIBAR", roomId: room.id, sortOrder: 999 },
    })
  ).id;

  productoId = (
    await prisma.product.create({
      data: {
        name: `${marca} cerveza`,
        categoryId: categoriaId,
        baseUnit: "UNIDAD",
        costPrice: COSTO,
        salePrice: VENTA,
        minQty: 0,
      },
    })
  ).id;
});

afterAll(async () => {
  await borrar([productoId], [bodegaId, minibarId], [categoriaId], [roomId]);
});

describe("ciclo del minibar", () => {
  test("la compra deja el saldo en la bodega y nada en el minibar", async () => {
    await registerMovement({
      type: "ENTRADA",
      createdById: adminId,
      toLocationId: bodegaId,
      reason: "Compra",
      lines: [{ productId: productoId, quantity: 24 }],
    });

    expect(await saldo(bodegaId)).toBe(24);
    expect(await saldo(minibarId)).toBe(0);
  });

  test("montar el minibar mueve el saldo, no lo crea", async () => {
    await registerMovement({
      type: "TRASLADO",
      createdById: adminId,
      fromLocationId: bodegaId,
      toLocationId: minibarId,
      roomId,
      reason: "Montaje de minibar",
      lines: [{ productId: productoId, quantity: 2 }],
    });

    expect(await saldo(bodegaId)).toBe(22);
    expect(await saldo(minibarId)).toBe(2);
  });

  test("el consumo del huésped sale del minibar y deja la utilidad", async () => {
    const mes = monthRange();
    const antes = await periodFlow(mes.start, mes.end);

    await registerMovement({
      type: "CONSUMO",
      createdById: adminId,
      fromLocationId: minibarId,
      roomId,
      reason: "Consumo de minibar",
      lines: [{ productId: productoId, quantity: 2 }],
    });

    expect(await saldo(minibarId)).toBe(0);

    const despues = await periodFlow(mes.start, mes.end);
    expect(despues.cost - antes.cost).toBe(2 * COSTO);
    expect(despues.revenue - antes.revenue).toBe(2 * VENTA);
    expect(despues.margin - antes.margin).toBe(2 * (VENTA - COSTO));
  });

  test("reponer al par no cuenta como venta", async () => {
    const mes = monthRange();
    const antes = await periodFlow(mes.start, mes.end);

    await registerMovement({
      type: "TRASLADO",
      createdById: adminId,
      fromLocationId: bodegaId,
      toLocationId: minibarId,
      roomId,
      reason: "Reposición de minibar",
      lines: [{ productId: productoId, quantity: 2 }],
    });

    const despues = await periodFlow(mes.start, mes.end);
    expect(despues.revenue).toBe(antes.revenue);
    expect(despues.cost).toBe(antes.cost);
    expect(await saldo(minibarId)).toBe(2);
    expect(await saldo(bodegaId)).toBe(20);
  });

  test("la merma pesa como costo y no como venta", async () => {
    const mes = monthRange();
    const antes = await periodFlow(mes.start, mes.end);

    await registerMovement({
      type: "DANIO",
      createdById: adminId,
      fromLocationId: bodegaId,
      reason: "Se quebró",
      lines: [{ productId: productoId, quantity: 1 }],
    });

    const despues = await periodFlow(mes.start, mes.end);
    expect(despues.waste - antes.waste).toBe(COSTO);
    expect(despues.revenue).toBe(antes.revenue);
    expect(await saldo(bodegaId)).toBe(19);
  });

  test("el valor del inventario suma lo que hay, a costo", async () => {
    const { byLocation } = await inventoryValue();
    const bodega = byLocation.find((l) => l.locationId === bodegaId);
    expect(bodega?.value).toBe(19 * COSTO);
  });

  test("el minibar no puede quedar en negativo", async () => {
    await expect(
      registerMovement({
        type: "CONSUMO",
        createdById: adminId,
        fromLocationId: minibarId,
        roomId,
        reason: "Consumo imposible",
        lines: [{ productId: productoId, quantity: 99 }],
      }),
    ).rejects.toThrow();

    expect(await saldo(minibarId)).toBe(2);
  });
});
