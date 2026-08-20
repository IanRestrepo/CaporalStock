import "server-only";
import { prisma } from "@/lib/prisma";
import type { BaseUnit } from "@/generated/prisma/enums";

/** Ventana por defecto para avisar de un vencimiento. */
export const EXPIRY_WINDOW_DAYS = 30;

export type LowStockAlert = {
  productId: string;
  locationId: string;
  product: string;
  location: string;
  baseUnit: BaseUnit;
  color: string;
  quantity: number;
  threshold: number;
  ratio: number;
};

export type ExpiryAlert = {
  lotId: string;
  code: string;
  productId: string;
  product: string;
  baseUnit: BaseUnit;
  color: string;
  expiresAt: Date;
  quantity: number;
};

/**
 * Bajo mínimo. El umbral es el de la ubicación si existe, y si no el del
 * producto: así la bodega principal puede exigir 20 kg mientras el minibar de
 * la 204 se conforma con 3 unidades.
 */
export async function getLowStock(limit?: number): Promise<LowStockAlert[]> {
  const rows = await prisma.$queryRaw<
    {
      productId: string;
      locationId: string;
      product: string;
      location: string;
      baseUnit: BaseUnit;
      color: string;
      quantity: string;
      threshold: string;
    }[]
  >`
    SELECT s."productId",
           s."locationId",
           p.name          AS product,
           l.name          AS location,
           p."baseUnit"    AS "baseUnit",
           c.color         AS color,
           s.quantity::text AS quantity,
           COALESCE(NULLIF(s."minQty", 0), p."minQty")::text AS threshold
      FROM "Stock" s
      JOIN "Product"  p ON p.id = s."productId"
      JOIN "Location" l ON l.id = s."locationId"
      JOIN "Category" c ON c.id = p."categoryId"
     WHERE p.active AND l.active
       AND COALESCE(NULLIF(s."minQty", 0), p."minQty") > 0
       AND s.quantity < COALESCE(NULLIF(s."minQty", 0), p."minQty")
     ORDER BY s.quantity / COALESCE(NULLIF(s."minQty", 0), p."minQty") ASC,
              p.name ASC
  `;

  const mapped = rows.map((row) => {
    const quantity = Number(row.quantity);
    const threshold = Number(row.threshold);
    return {
      productId: row.productId,
      locationId: row.locationId,
      product: row.product,
      location: row.location,
      baseUnit: row.baseUnit,
      color: row.color,
      quantity,
      threshold,
      ratio: threshold > 0 ? quantity / threshold : 0,
    };
  });

  return limit ? mapped.slice(0, limit) : mapped;
}

/** Lotes por vencer o vencidos que todavía tienen existencias. */
export async function getExpiring(days = EXPIRY_WINDOW_DAYS): Promise<ExpiryAlert[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const lots = await prisma.lot.findMany({
    where: { expiresAt: { not: null, lte: cutoff } },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      code: true,
      expiresAt: true,
      product: {
        select: {
          id: true,
          name: true,
          baseUnit: true,
          active: true,
          category: { select: { color: true } },
          stock: { select: { quantity: true } },
        },
      },
    },
  });

  return lots
    .filter((lot) => lot.product.active)
    .map((lot) => ({
      lotId: lot.id,
      code: lot.code,
      productId: lot.product.id,
      product: lot.product.name,
      baseUnit: lot.product.baseUnit,
      color: lot.product.category.color,
      expiresAt: lot.expiresAt!,
      quantity: lot.product.stock.reduce((sum, s) => sum + Number(s.quantity), 0),
    }))
    .filter((alert) => alert.quantity > 0);
}

export async function countAlerts(): Promise<number> {
  const [low, expiring] = await Promise.all([getLowStock(), getExpiring()]);
  return low.length + expiring.length;
}
