import Link from "next/link";
import { ChevronRight, Refrigerator, Warehouse } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { PageHeader, Screen } from "@/components/screen";
import { formatMoneyCompact } from "@/lib/format";
import { categoryIcon } from "@/lib/category-icons";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NuevaCategoria } from "./nueva-categoria";

export const metadata = { title: "Bodega" };

export default async function BodegasPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  /**
   * Una sola bodega guarda el inventario del hotel. Lo que antes eran áreas de
   * operación ahora son categorías: no otro depósito, sino un atajo al mismo
   * inventario. Los minibares siguen siendo lugares de verdad — son las suites.
   */
  const [locations, categories] = await Promise.all([
    prisma.$queryRaw<
      { id: string; name: string; kind: string; room: string | null; value: string; skus: bigint; low: bigint }[]
    >`
      SELECT l.id,
             l.name,
             l.kind::text AS kind,
             r.number     AS room,
             COALESCE(SUM(s.quantity * p."costPrice"), 0)::text AS value,
             CASE WHEN l.kind = 'PRINCIPAL'
                  THEN (SELECT COUNT(*) FROM "Product" WHERE active)
                  ELSE COUNT(*) FILTER (WHERE s.quantity > 0)
             END AS skus,
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
    `,
    prisma.$queryRaw<
      { id: string; name: string; icon: string; value: string; skus: bigint; low: bigint }[]
    >`
      SELECT c.id,
             c.name,
             c.icon,
             COALESCE(SUM(s.quantity * p."costPrice"), 0)::text AS value,
             COUNT(p.id)                                        AS skus,
             COUNT(*) FILTER (
               WHERE COALESCE(NULLIF(s."minQty", 0), p."minQty") > 0
                 AND COALESCE(s.quantity, 0) < COALESCE(NULLIF(s."minQty", 0), p."minQty")
             ) AS low
        FROM "Category" c
        LEFT JOIN "Product"  p ON p."categoryId" = c.id AND p.active
        LEFT JOIN "Location" b ON b.kind = 'PRINCIPAL' AND b.active
        LEFT JOIN "Stock"    s ON s."productId" = p.id AND s."locationId" = b.id
       GROUP BY c.id, c.name, c.icon, c."sortOrder"
       ORDER BY c."sortOrder", c.name
    `,
  ]);

  const central = locations.filter((l) => l.kind === "PRINCIPAL");
  const minibars = locations.filter((l) => l.kind === "MINIBAR");

  const detail = (value: string, skus: bigint, low: bigint) =>
    `${Number(skus)} ${Number(skus) === 1 ? "producto" : "productos"}` +
    (isAdmin ? ` · ${formatMoneyCompact(Number(value))}` : "") +
    (Number(low) > 0 ? ` · ${Number(low)} bajo mínimo` : "");

  return (
    <Screen>
      <PageHeader
        title="Bodega"
        subtitle="Todo el inventario vive en la bodega central."
        action={isAdmin ? <NuevaCategoria /> : null}
      />

      <div className="space-y-7">
        <section>
          <SectionLabel className="mb-2.5">Bodega central</SectionLabel>
          <div className="space-y-2">
            {central.map((row) => (
              <Card key={row.id} className="p-0">
                <Link
                  href={`/bodegas/${row.id}`}
                  className="press flex items-center gap-3.5 px-4 py-3.5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-raised text-soft">
                    <Warehouse className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-faint tnum">
                      {detail(row.value, row.skus, row.low)}
                    </span>
                  </span>
                  <ChevronRight className="size-4.5 shrink-0 text-faint" />
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {categories.length ? (
          <section>
            <SectionLabel className="mb-2.5">Categorías</SectionLabel>
            <div className="space-y-2">
              {categories.map((row) => {
                const Icon = categoryIcon(row.icon);
                return (
                  <Card key={row.id} className="p-0">
                    <Link
                      href={`/bodegas/categoria/${row.id}`}
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
                          {detail(row.value, row.skus, row.low)}
                        </span>
                      </span>
                      <ChevronRight className="size-4.5 shrink-0 text-faint" />
                    </Link>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {minibars.length ? (
          <section>
            <SectionLabel className="mb-2.5">Minibares</SectionLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {minibars.map((row) => (
                <Link
                  key={row.id}
                  href={`/bodegas/${row.id}`}
                  className="press rounded-[18px] bg-surface p-3.5 hover:bg-raised"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Refrigerator className="size-4 text-faint" strokeWidth={1.75} />
                    {Number(row.low) > 0 ? <span className="size-1.5 rounded-full bg-warn" /> : null}
                  </div>
                  <p className="text-[0.9375rem] font-semibold">Suite {row.room}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-faint tnum">
                    {Number(row.skus)} {Number(row.skus) === 1 ? "producto" : "productos"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Screen>
  );
}
