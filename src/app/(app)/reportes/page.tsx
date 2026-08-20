import Link from "next/link";
import { Card, SectionLabel } from "@/components/ui/card";
import { LevelBar } from "@/components/level-row";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { formatMoney, formatMoneyCompact, formatPercent } from "@/lib/format";
import { formatQty } from "@/lib/units";
import { consumptionByRoom, inventoryValue, periodFlow } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import type { BaseUnit } from "@/generated/prisma/enums";

export const metadata = { title: "Reportes" };

const PERIODS = [
  { value: "mes", label: "Este mes" },
  { value: "anterior", label: "Mes pasado" },
  { value: "trimestre", label: "90 días" },
] as const;

function rangeFor(period: string) {
  const now = new Date();
  if (period === "anterior") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  if (period === "trimestre") {
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export default async function ReportesPage({ searchParams }: PageProps<"/reportes">) {
  await requireAdminPage();
  const params = await searchParams;
  const period = typeof params.periodo === "string" ? params.periodo : "mes";
  const { start, end } = rangeFor(period);

  const [value, flow, rooms, top, waste, byUser] = await Promise.all([
    inventoryValue(),
    periodFlow(start, end),
    consumptionByRoom(start, end),
    topProducts(start, end),
    wasteByReason(start, end),
    activityByUser(start, end),
  ]);

  const maxRoom = Math.max(...rooms.map((r) => r.revenue), 1);

  return (
    <Screen>
      <PageHeader title="Reportes" subtitle="Lo que entró, lo que salió y lo que quedó." />

      <div data-scroll-x className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
        {PERIODS.map((option) => (
          <Link
            key={option.value}
            href={`/reportes?periodo=${option.value}`}
            className={cn(
              "press shrink-0 rounded-full px-3.5 py-2 text-[0.8125rem] font-medium whitespace-nowrap",
              option.value === period ? "bg-ink text-canvas" : "bg-raised text-soft hover:text-ink",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <Card className="mb-3 px-5 py-4">
        <StatRow
          items={[
            { label: "Ventas", value: formatMoneyCompact(flow.revenue) },
            { label: "Costo de lo vendido", value: formatMoneyCompact(flow.cost) },
            {
              label: "Utilidad bruta",
              value: formatMoneyCompact(flow.margin),
              hint: flow.revenue > 0 ? formatPercent(flow.marginRate) : undefined,
            },
          ]}
        />
      </Card>

      <Card className="mb-7 px-5 py-4">
        <StatRow
          items={[
            { label: "Compras del período", value: formatMoneyCompact(flow.purchases) },
            { label: "Mermas", value: formatMoneyCompact(flow.waste) },
            { label: "Inventario hoy", value: formatMoneyCompact(value.total) },
          ]}
        />
      </Card>

      <SectionLabel className="mb-2.5">Inventario por bodega</SectionLabel>
      <Card className="mb-7 space-y-3 px-5 py-4">
        {value.byLocation
          .filter((row) => row.value > 0)
          .map((row) => (
            <div key={row.locationId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[0.875rem]">{row.location}</span>
                <span className="shrink-0 text-[0.875rem] font-semibold tnum">
                  {formatMoney(row.value)}
                </span>
              </div>
              <LevelBar ratio={value.total > 0 ? row.value / value.total : 0} />
            </div>
          ))}
      </Card>

      <SectionLabel className="mb-2.5">Lo que más sale</SectionLabel>
      <Card className="mb-7 divide-y divide-line">
        {top.length ? (
          top.map((row) => (
            <Link
              key={row.productId}
              href={`/productos/${row.productId}`}
              className="press flex items-center gap-3 px-5 py-3 hover:bg-raised"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: categoryColor(row.color) }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{row.name}</span>
              <span className="shrink-0 text-right">
                <span className="block text-[0.875rem] font-semibold tnum">
                  {formatQty(row.quantity, row.baseUnit)}
                </span>
                <span className="block text-2xs text-faint tnum">{formatMoney(row.cost)}</span>
              </span>
            </Link>
          ))
        ) : (
          <p className="px-5 py-6 text-center text-[0.875rem] text-faint">
            Sin salidas en este período.
          </p>
        )}
      </Card>

      <SectionLabel className="mb-2.5">Consumo por suite</SectionLabel>
      <Card className="mb-7 space-y-3 px-5 py-4">
        {rooms.map((room) => (
          <div key={room.roomId}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <Link
                href={`/suites/${room.roomId}`}
                className="text-[0.875rem] hover:underline"
              >
                Suite {room.number}
              </Link>
              <span className="shrink-0 text-[0.875rem] font-semibold tnum">
                {room.revenue > 0 ? formatMoney(room.revenue) : "—"}
              </span>
            </div>
            <LevelBar ratio={room.revenue / maxRoom} tone="accent" />
          </div>
        ))}
      </Card>

      {waste.length ? (
        <>
          <SectionLabel className="mb-2.5">Mermas por motivo</SectionLabel>
          <Card className="mb-7 divide-y divide-line">
            {waste.map((row) => (
              <div key={row.reason} className="flex items-center justify-between px-5 py-3">
                <span className="text-[0.9375rem]">{row.reason}</span>
                <span className="text-[0.875rem] font-semibold tnum">{formatMoney(row.cost)}</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel className="mb-2.5">Actividad del equipo</SectionLabel>
      <Card className="divide-y divide-line">
        {byUser.map((row) => (
          <div key={row.userId} className="flex items-center justify-between px-5 py-3">
            <span className="min-w-0 truncate text-[0.9375rem]">{row.name}</span>
            <span className="shrink-0 text-[0.875rem] text-soft tnum">
              {row.movements} movimiento{row.movements === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </Card>
    </Screen>
  );
}

async function topProducts(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; baseUnit: BaseUnit; color: string; quantity: string; cost: string }[]
  >`
    SELECT p.id                                              AS "productId",
           p.name                                            AS name,
           p."baseUnit"                                      AS "baseUnit",
           c.color                                           AS color,
           SUM(ml.quantity)::text                            AS quantity,
           SUM(ml.quantity * ml."unitCost")::text            AS cost
      FROM "MovementLine" ml
      JOIN "Movement" m  ON m.id = ml."movementId"
      JOIN "Product"  p  ON p.id = ml."productId"
      JOIN "Category" c  ON c.id = p."categoryId"
     WHERE m.type IN ('CONSUMO', 'DANIO')
       AND m."occurredAt" >= ${start} AND m."occurredAt" < ${end}
     GROUP BY p.id, p.name, p."baseUnit", c.color
     ORDER BY SUM(ml.quantity * ml."unitCost") DESC
     LIMIT 8
  `;

  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    baseUnit: r.baseUnit,
    color: r.color,
    quantity: Number(r.quantity),
    cost: Number(r.cost),
  }));
}

async function wasteByReason(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ reason: string | null; cost: string }[]>`
    SELECT m.reason                                AS reason,
           SUM(ml.quantity * ml."unitCost")::text  AS cost
      FROM "Movement" m
      JOIN "MovementLine" ml ON ml."movementId" = m.id
     WHERE m.type = 'DANIO'
       AND m."occurredAt" >= ${start} AND m."occurredAt" < ${end}
     GROUP BY m.reason
     ORDER BY 2 DESC
  `;

  return rows.map((r) => ({ reason: r.reason ?? "Sin motivo", cost: Number(r.cost) }));
}

async function activityByUser(start: Date, end: Date) {
  const rows = await prisma.movement.groupBy({
    by: ["createdById"],
    where: { occurredAt: { gte: start, lt: end } },
    _count: { _all: true },
    orderBy: { _count: { createdById: "desc" } },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.createdById) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((row) => ({
    userId: row.createdById,
    name: nameById.get(row.createdById) ?? "—",
    movements: row._count._all,
  }));
}
