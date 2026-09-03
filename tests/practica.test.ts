import { afterAll, describe, expect, test } from "vitest";
import { getExpiring, getLowStock } from "@/lib/alerts";
import { limpiarPractica, prepararPractica } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

/**
 * La práctica del tutorial se borra entera o no sirve.
 *
 * Lo que se prueba acá no es que la bodega aparezca, es que al salir no quede
 * nada: un producto de práctica olvidado en el catálogo o un movimiento suelto
 * en los reportes es exactamente lo que la práctica existe para evitar.
 */

async function rastro() {
  const [locations, products, stock, lines, movements, presentations] = await Promise.all([
    prisma.location.count({ where: { practice: true } }),
    prisma.product.count({ where: { practice: true } }),
    prisma.stock.count({ where: { OR: [{ location: { practice: true } }, { product: { practice: true } }] } }),
    prisma.movementLine.count({ where: { product: { practice: true } } }),
    prisma.movement.count({ where: { reason: "Práctica del tutorial" } }),
    prisma.presentation.count({ where: { product: { practice: true } } }),
  ]);
  return locations + products + stock + lines + movements + presentations;
}

afterAll(async () => {
  await limpiarPractica();
});

describe("práctica del tutorial", () => {
  test("borrar sin práctica montada no rompe nada", async () => {
    await limpiarPractica();
    expect(await rastro()).toBe(0);
  });

  test("monta bodega, productos y saldo por movimiento", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const locationId = await prepararPractica(admin.id);
    expect(locationId).toBeTruthy();

    const stock = await prisma.stock.findMany({
      where: { locationId: locationId! },
      select: { quantity: true },
    });
    expect(stock.length).toBeGreaterThan(0);
    // El saldo entró por un movimiento, no escrito a mano.
    expect(stock.every((s) => Number(s.quantity) > 0)).toBe(true);
    expect(
      await prisma.movement.count({ where: { reason: "Práctica del tutorial" } }),
    ).toBe(1);
  });

  test("volver al tutorial no reinicia lo que ya se hizo", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const primera = await prepararPractica(admin.id);
    const segunda = await prepararPractica(admin.id);
    expect(segunda).toBe(primera);
    expect(await prisma.location.count({ where: { practice: true } })).toBe(1);
  });

  test("salir no deja rastro", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    await prepararPractica(admin.id);
    expect(await rastro()).toBeGreaterThan(0);

    await limpiarPractica();
    expect(await rastro()).toBe(0);
  });

  test("las alertas no miran la práctica", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    await prepararPractica(admin.id);

    // Estas dos consultas filtran por la relación con el producto: si el
    // filtro estuviera mal escrito, revientan en vez de devolver de más.
    const [bajos, vencen] = await Promise.all([getLowStock(50), getExpiring()]);

    expect(bajos.every((a) => !a.product.includes("de práctica"))).toBe(true);
    expect(vencen.every((a) => !a.product.includes("de práctica"))).toBe(true);

    await limpiarPractica();
  });

  test("no se lleva por delante el inventario real", async () => {
    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const antes = await Promise.all([
      prisma.product.count({ where: { practice: false } }),
      prisma.location.count({ where: { practice: false } }),
      prisma.movement.count({ where: { reason: { not: "Práctica del tutorial" } } }),
    ]);

    await prepararPractica(admin.id);
    await limpiarPractica();

    const despues = await Promise.all([
      prisma.product.count({ where: { practice: false } }),
      prisma.location.count({ where: { practice: false } }),
      prisma.movement.count({ where: { reason: { not: "Práctica del tutorial" } } }),
    ]);

    expect(despues).toEqual(antes);
  });
});
