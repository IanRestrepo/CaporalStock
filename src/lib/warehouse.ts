import "server-only";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { StockItem } from "@/components/stock-explorer";

/** La bodega central: hay una sola y todo el inventario del hotel vive ahí. */
export function centralLocation() {
  return prisma.location.findFirst({
    where: { kind: "PRINCIPAL", active: true, practice: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * El catálogo con su saldo en la bodega central.
 *
 * Va sobre productos y no sobre existencias a propósito: un producto recién
 * creado todavía no tiene fila en Stock, y si la lista se armara desde ahí
 * desaparecería justo después de crearlo.
 */
export async function centralStock(locationId: string, sectionId?: string) {
  const [products, categories, sections] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, practice: false, ...(sectionId ? { sectionId } : {}) },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        minQty: true,
        costPrice: true,
        salePrice: true,
        perishable: true,
        categoryId: true,
        sectionId: true,
        category: { select: { name: true, color: true } },
        stock: { where: { locationId }, select: { quantity: true, minQty: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.section.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const items: StockItem[] = products.map((product) => {
    const row = product.stock[0];
    return {
      productId: product.id,
      name: product.name,
      category: product.category.name,
      color: product.category.color,
      baseUnit: product.baseUnit,
      quantity: row ? num(row.quantity) : 0,
      threshold: (row ? num(row.minQty) : 0) || num(product.minQty),
      par: null,
      draft: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        sectionId: product.sectionId,
        baseUnit: product.baseUnit,
        costPrice: num(product.costPrice),
        salePrice: num(product.salePrice),
        minQty: num(product.minQty),
        perishable: product.perishable,
        active: true,
      },
    };
  });

  const value = products.reduce(
    (sum, product) =>
      sum + (product.stock[0] ? num(product.stock[0].quantity) : 0) * num(product.costPrice),
    0,
  );

  return { items, categories, sections, value };
}
