import "server-only";
import { prisma } from "@/lib/prisma";

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export function dayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Valor del inventario a costo, por bodega y total. */
export async function inventoryValue() {
  const rows = await prisma.$queryRaw<
    { locationId: string; location: string; kind: string; value: string }[]
  >`
    SELECT l.id AS "locationId",
           l.name AS location,
           l.kind::text AS kind,
           COALESCE(SUM(s.quantity * p."costPrice"), 0)::text AS value
      FROM "Location" l
      LEFT JOIN "Stock"   s ON s."locationId" = l.id
      LEFT JOIN "Product" p ON p.id = s."productId" AND p.active AND NOT p.practice
     WHERE l.active AND NOT l.practice
     GROUP BY l.id, l.name, l.kind
     ORDER BY 4 DESC
  `;

  const byLocation = rows.map((r) => ({
    locationId: r.locationId,
    location: r.location,
    kind: r.kind,
    value: Number(r.value),
  }));

  /**
   * Doce minibares casi idénticos empujan la información útil fuera de la
   * pantalla. En un reporte pesan como grupo, no uno por uno.
   */
  const minibars = byLocation.filter((r) => r.kind === "MINIBAR");
  const grouped = byLocation.filter((r) => r.kind !== "MINIBAR");

  if (minibars.length > 1) {
    grouped.push({
      locationId: "minibares",
      location: `Minibares · ${minibars.length}`,
      kind: "MINIBAR",
      value: minibars.reduce((sum, r) => sum + r.value, 0),
    });
  } else {
    grouped.push(...minibars);
  }

  grouped.sort((a, b) => b.value - a.value);

  return {
    byLocation: grouped,
    total: byLocation.reduce((sum, r) => sum + r.value, 0),
  };
}

/**
 * Consumo del período: lo que salió por venta o uso, valorado a costo y a
 * precio de venta. La diferencia es la utilidad bruta.
 */
export async function periodFlow(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<
    { type: string; cost: string; revenue: string; lines: bigint }[]
  >`
    SELECT m.type::text                                        AS type,
           COALESCE(SUM(ml.quantity * ml."unitCost"), 0)::text  AS cost,
           COALESCE(SUM(ml.quantity * ml."unitPrice"), 0)::text AS revenue,
           COUNT(ml.id)                                         AS lines
      FROM "Movement" m
      JOIN "MovementLine" ml ON ml."movementId" = m.id
     WHERE m."occurredAt" >= ${start} AND m."occurredAt" < ${end}
     GROUP BY m.type
  `;

  const get = (type: string) => rows.find((r) => r.type === type);
  const consumo = get("CONSUMO");
  const danio = get("DANIO");
  const entrada = get("ENTRADA");

  const cost = Number(consumo?.cost ?? 0);
  const revenue = Number(consumo?.revenue ?? 0);

  return {
    cost,
    revenue,
    margin: revenue - cost,
    marginRate: revenue > 0 ? (revenue - cost) / revenue : 0,
    waste: Number(danio?.cost ?? 0),
    purchases: Number(entrada?.cost ?? 0),
    movements: rows.reduce((sum, r) => sum + Number(r.lines), 0),
  };
}

export async function recentMovements(limit = 8) {
  return prisma.movement.findMany({
    take: limit,
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      type: true,
      occurredAt: true,
      reason: true,
      note: true,
      createdBy: { select: { name: true } },
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
      room: { select: { number: true } },
      lines: {
        select: {
          quantity: true,
          product: {
            select: { name: true, baseUnit: true, category: { select: { color: true } } },
          },
        },
      },
    },
  });
}

/** Consumo por suite en el período — responde "qué habitación gasta más". */
export async function consumptionByRoom(start: Date, end: Date, limit = 12) {
  const rows = await prisma.$queryRaw<
    { roomId: string; number: string; cost: string; revenue: string; units: string }[]
  >`
    SELECT r.id                                                  AS "roomId",
           r.number                                              AS number,
           COALESCE(SUM(ml.quantity * ml."unitCost"), 0)::text   AS cost,
           COALESCE(SUM(ml.quantity * ml."unitPrice"), 0)::text  AS revenue,
           COALESCE(SUM(ml.quantity), 0)::text                   AS units
      FROM "Room" r
      LEFT JOIN "Location" loc ON loc."roomId" = r.id
      LEFT JOIN "Movement" m
             ON (m."roomId" = r.id OR m."fromLocationId" = loc.id)
            AND m.type IN ('CONSUMO', 'DANIO')
            AND m."occurredAt" >= ${start} AND m."occurredAt" < ${end}
      LEFT JOIN "MovementLine" ml ON ml."movementId" = m.id
     WHERE r.active
     GROUP BY r.id, r.number
     ORDER BY r.number ASC
     LIMIT ${limit}
  `;

  return rows.map((r) => ({
    roomId: r.roomId,
    number: r.number,
    cost: Number(r.cost),
    revenue: Number(r.revenue),
    units: Number(r.units),
  }));
}

export async function userActivity(userId: string, start: Date, end: Date) {
  const [movements, checklists] = await Promise.all([
    prisma.movement.count({
      where: { createdById: userId, occurredAt: { gte: start, lt: end } },
    }),
    prisma.checklistRun.count({
      where: { userId, startedAt: { gte: start, lt: end }, completedAt: { not: null } },
    }),
  ]);
  return { movements, checklists };
}
