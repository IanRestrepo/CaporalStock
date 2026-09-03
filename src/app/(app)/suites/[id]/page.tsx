import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, Refrigerator } from "lucide-react";
import { Card, CardHeader, RowList, SectionLabel } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { MovementRow } from "@/components/movement-row";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { formatMoneyCompact, formatRelative, num } from "@/lib/format";
import { monthRange } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { MinibarPanel, type MinibarItem } from "./minibar-panel";
import { MinibarSetup, type CatalogItem } from "./minibar-setup";

export default async function SuitePage({ params }: PageProps<"/suites/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const month = monthRange();

  const room = await prisma.room.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      floor: true,
      minibar: {
        select: {
          id: true,
          stock: {
            where: { parQty: { not: null }, product: { active: true } },
            select: {
              quantity: true,
              parQty: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  baseUnit: true,
                  category: { select: { color: true } },
                },
              },
            },
          },
        },
      },
      checklistRuns: {
        take: 3,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          user: { select: { name: true } },
          template: { select: { name: true } },
        },
      },
    },
  });

  if (!room) notFound();

  const isAdmin = user.role === "ADMIN";

  const [catalog, siblings] = isAdmin
    ? await Promise.all([
        prisma.product.findMany({
          where: { active: true, practice: false },
          orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            baseUnit: true,
            category: { select: { name: true, color: true } },
          },
        }),
        prisma.location.findMany({
          where: {
            kind: "MINIBAR",
            active: true,
            NOT: { roomId: room.id },
            stock: { some: { parQty: { not: null } } },
          },
          orderBy: { sortOrder: "asc" },
          select: { id: true, room: { select: { number: true } } },
        }),
      ])
    : [[], []];

  const movements = await prisma.movement.findMany({
    where: { roomId: room.id },
    take: 8,
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      type: true,
      occurredAt: true,
      reason: true,
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

  const consumption = await prisma.$queryRaw<{ revenue: string; cost: string }[]>`
    SELECT COALESCE(SUM(ml.quantity * ml."unitPrice"), 0)::text AS revenue,
           COALESCE(SUM(ml.quantity * ml."unitCost"), 0)::text  AS cost
      FROM "Movement" m
      JOIN "MovementLine" ml ON ml."movementId" = m.id
     WHERE m."roomId" = ${room.id}
       AND m.type = 'CONSUMO'
       AND m."occurredAt" >= ${month.start} AND m."occurredAt" < ${month.end}
  `;

  const revenue = Number(consumption[0]?.revenue ?? 0);
  const cost = Number(consumption[0]?.cost ?? 0);

  const items: MinibarItem[] = (room.minibar?.stock ?? []).map((row) => ({
    productId: row.product.id,
    name: row.product.name,
    color: row.product.category.color,
    baseUnit: row.product.baseUnit,
    quantity: num(row.quantity),
    par: num(row.parQty),
  }));

  const complete = items.every((i) => i.quantity >= i.par);
  const lastRun = room.checklistRuns[0];

  const parById = new Map(items.map((i) => [i.productId, i.par]));
  const setupCatalog: CatalogItem[] = catalog.map((product) => ({
    productId: product.id,
    name: product.name,
    category: product.category.name,
    color: product.category.color,
    baseUnit: product.baseUnit,
    parQty: parById.get(product.id) ?? 0,
  }));
  const otherSuites = siblings.map((s) => ({
    locationId: s.id,
    number: s.room?.number ?? "",
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/suites" }}
        eyebrow={room.floor ?? undefined}
        title={`Suite ${room.number}`}
        action={
          isAdmin && room.minibar ? (
            <MinibarSetup
              locationId={room.minibar.id}
              catalog={setupCatalog}
              otherSuites={otherSuites}
            />
          ) : null
        }
      />

      <Card className="mb-4 px-5 py-4">
        <StatRow
          items={[
            { label: "Minibar", value: complete ? "Completo" : "Incompleto" },
            {
              label: "Última revisión",
              value: lastRun ? formatRelative(lastRun.startedAt) : "Nunca",
            },
            user.role === "ADMIN"
              ? {
                  label: "Consumo del mes",
                  value: formatMoneyCompact(revenue),
                  hint: revenue > 0 ? `${formatMoneyCompact(revenue - cost)} de utilidad` : undefined,
                }
              : { label: "Referencias", value: items.length },
          ]}
        />
      </Card>

      <Link
        href={`/checklist/nuevo?suite=${room.id}`}
        className="press mb-6 flex items-center gap-3 rounded-[18px] bg-surface px-4 py-3.5 hover:bg-raised"
      >
        <ClipboardCheck className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium">Revisar la suite</span>
          <span className="block text-[0.8125rem] text-faint">
            {lastRun
              ? `Última: ${lastRun.user.name}, ${formatRelative(lastRun.startedAt)}`
              : "Todavía no se ha revisado"}
          </span>
        </span>
      </Link>

      <SectionLabel className="mb-2.5">Cierre de minibar</SectionLabel>
      {room.minibar && items.length ? (
        <div className="mb-7 rounded-card bg-surface p-4">
          <MinibarPanel locationId={room.minibar.id} roomId={room.id} items={items} />
        </div>
      ) : (
        <Card className="mb-7">
          <Empty
            icon={Refrigerator}
            title="Este minibar todavía no está montado"
            body={
              isAdmin
                ? "Definí qué debe contener y en qué cantidad, o copiá la configuración de otra suite."
                : "El administrador todavía no dijo qué debe haber acá."
            }
            action={
              isAdmin && room.minibar ? (
                <MinibarSetup
                  locationId={room.minibar.id}
                  catalog={setupCatalog}
                  otherSuites={otherSuites}
                  label="Montar el minibar"
                />
              ) : null
            }
          />
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Historial de la suite" />
        {movements.length ? (
          <RowList className="border-t border-line">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </RowList>
        ) : (
          <Empty
            icon={Refrigerator}
            title="Sin movimientos"
            body="Nada se ha sacado ni repuesto en esta suite todavía."
          />
        )}
      </Card>
    </Screen>
  );
}
