import Link from "next/link";
import { ChevronRight, Plus, Refrigerator, Warehouse, Wrench } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { PageHeader, Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { formatMoneyCompact } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { LocationKind } from "@/generated/prisma/enums";

export const metadata = { title: "Bodegas" };

const KIND_ICON = {
  PRINCIPAL: Warehouse,
  AREA: Wrench,
  MINIBAR: Refrigerator,
} as const;

const KIND_TITLE: Record<LocationKind, string> = {
  PRINCIPAL: "Bodega central",
  AREA: "Áreas de operación",
  MINIBAR: "Minibares",
};

export default async function BodegasPage() {
  const user = await requireUser();

  const rows = await prisma.$queryRaw<
    { id: string; name: string; kind: LocationKind; room: string | null; value: string; skus: bigint; low: bigint }[]
  >`
    SELECT l.id,
           l.name,
           l.kind::text AS kind,
           r.number     AS room,
           COALESCE(SUM(s.quantity * p."costPrice"), 0)::text AS value,
           COUNT(*) FILTER (WHERE s.quantity > 0)             AS skus,
           COUNT(*) FILTER (
             WHERE COALESCE(NULLIF(s."minQty", 0), p."minQty") > 0
               AND s.quantity < COALESCE(NULLIF(s."minQty", 0), p."minQty")
           ) AS low
      FROM "Location" l
      LEFT JOIN "Room"    r ON r.id = l."roomId"
      LEFT JOIN "Stock"   s ON s."locationId" = l.id
      LEFT JOIN "Product" p ON p.id = s."productId" AND p.active
     WHERE l.active
     GROUP BY l.id, l.name, l.kind, r.number
     ORDER BY l.kind, l."sortOrder", l.name
  `;

  const groups: LocationKind[] = ["PRINCIPAL", "AREA", "MINIBAR"];

  return (
    <Screen>
      <PageHeader
        title="Bodegas"
        subtitle="Todo lugar que guarda producto es una bodega."
        action={
          user.role === "ADMIN" ? (
            <Button asChild variant="quiet" size="icon" aria-label="Crear bodega">
              <Link href="/bodegas/nueva">
                <Plus className="size-5" />
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-7">
        {groups.map((kind) => {
          const items = rows.filter((r) => r.kind === kind);
          if (!items.length) return null;
          const Icon = KIND_ICON[kind];

          return (
            <section key={kind}>
              <SectionLabel className="mb-2.5">{KIND_TITLE[kind]}</SectionLabel>
              <div className={kind === "MINIBAR" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "space-y-2"}>
                {items.map((row) =>
                  kind === "MINIBAR" ? (
                    <Link
                      key={row.id}
                      href={`/bodegas/${row.id}`}
                      className="press rounded-[18px] bg-surface p-3.5 hover:bg-raised"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Icon className="size-4 text-faint" strokeWidth={1.75} />
                        {Number(row.low) > 0 ? (
                          <span className="size-1.5 rounded-full bg-warn" />
                        ) : null}
                      </div>
                      <p className="text-[0.9375rem] font-semibold">Suite {row.room}</p>
                      <p className="mt-0.5 text-[0.8125rem] text-faint tnum">
                        {Number(row.skus)} productos
                      </p>
                    </Link>
                  ) : (
                    <Card key={row.id} className="p-0">
                      <Link
                        href={`/bodegas/${row.id}`}
                        className="press flex items-center gap-3.5 px-4 py-3.5"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-raised text-soft">
                          <Icon className="size-[18px]" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.9375rem] font-medium">
                            {row.name}
                          </span>
                          <span className="mt-0.5 block text-[0.8125rem] text-faint tnum">
                            {Number(row.skus)} productos
                            {user.role === "ADMIN" ? ` · ${formatMoneyCompact(Number(row.value))}` : ""}
                            {Number(row.low) > 0 ? ` · ${Number(row.low)} bajo mínimo` : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-4.5 shrink-0 text-faint" />
                      </Link>
                    </Card>
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
    </Screen>
  );
}
