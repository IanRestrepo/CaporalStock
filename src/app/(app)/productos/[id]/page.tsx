import { notFound } from "next/navigation";
import { Boxes, Package } from "lucide-react";
import { Card, CardHeader, RowList, SectionLabel } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { MovementRow } from "@/components/movement-row";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { categoryColor } from "@/lib/appearance";
import { daysUntil, formatDate, formatMoney, formatPercent, num } from "@/lib/format";
import { formatQty, presentationHint } from "@/lib/units";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ProductAdmin } from "./product-admin";

export default async function ProductoPage({ params }: PageProps<"/productos/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const [product, categories, sections] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        costPrice: true,
        salePrice: true,
        minQty: true,
        perishable: true,
        active: true,
        sectionId: true,
        category: { select: { id: true, name: true, color: true } },
        section: { select: { name: true } },
        presentations: {
          orderBy: { factor: "asc" },
          select: { id: true, name: true, factor: true },
        },
        lots: {
          where: { expiresAt: { not: null } },
          orderBy: { expiresAt: "asc" },
          take: 6,
          select: { id: true, code: true, expiresAt: true },
        },
        stock: {
          orderBy: { location: { sortOrder: "asc" } },
          select: {
            quantity: true,
            minQty: true,
            parQty: true,
            location: { select: { id: true, name: true, kind: true } },
          },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.section.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const movements = await prisma.movement.findMany({
    where: { lines: { some: { productId: product.id } } },
    take: 10,
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
        where: { productId: product.id },
        select: {
          quantity: true,
          product: {
            select: { name: true, baseUnit: true, category: { select: { color: true } } },
          },
        },
      },
    },
  });

  const total = product.stock.reduce((sum, s) => sum + num(s.quantity), 0);
  const cost = num(product.costPrice);
  const sale = num(product.salePrice);
  const margin = sale > 0 ? (sale - cost) / sale : 0;
  const isAdmin = user.role === "ADMIN";

  return (
    <Screen>
      <PageHeader
        back={{ href: "/productos" }}
        eyebrow={
          product.section ? `${product.section.name} · ${product.category.name}` : product.category.name
        }
        title={product.name}
        action={
          isAdmin ? (
            <ProductAdmin
              product={{
                id: product.id,
                name: product.name,
                categoryId: product.category.id,
                sectionId: product.sectionId,
                baseUnit: product.baseUnit,
                costPrice: cost,
                salePrice: sale,
                minQty: num(product.minQty),
                perishable: product.perishable,
                active: product.active,
              }}
              categories={categories}
              sections={sections}
            />
          ) : null
        }
      />

      <Card className="mb-4 px-5 py-4">
        <StatRow
          items={
            isAdmin
              ? [
                  { label: "Existencias", value: formatQty(total, product.baseUnit) },
                  {
                    label: "Costo por " + unitWord(product.baseUnit),
                    value: formatMoney(cost, cost < 100),
                  },
                  {
                    label: "Utilidad",
                    value: sale > 0 ? formatPercent(margin) : "—",
                    hint: sale > 0 ? `venta ${formatMoney(sale, sale < 100)}` : "no se vende",
                  },
                ]
              : [
                  { label: "Existencias", value: formatQty(total, product.baseUnit) },
                  { label: "Mínimo", value: formatQty(num(product.minQty), product.baseUnit) },
                  { label: "Bodegas", value: product.stock.filter((s) => num(s.quantity) > 0).length },
                ]
          }
        />
      </Card>

      <SectionLabel className="mb-2.5">Dónde está</SectionLabel>
      <Card className="mb-6 overflow-hidden">
        {product.stock.length ? (
          <RowList>
            {product.stock.map((row) => {
              const qty = num(row.quantity);
              const threshold = num(row.minQty) || num(product.minQty);
              const low = threshold > 0 && qty < threshold;
              return (
                <div
                  key={row.location.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: categoryColor(product.category.color) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem]">
                    {row.location.name}
                  </span>
                  {low ? <Badge tone={qty === 0 ? "danger" : "warn"}>bajo</Badge> : null}
                  <span className="shrink-0 text-[0.9375rem] font-semibold tnum">
                    {formatQty(qty, product.baseUnit)}
                  </span>
                </div>
              );
            })}
          </RowList>
        ) : (
          <Empty icon={Boxes} title="Sin existencias" body="Este producto no está en ninguna bodega." />
        )}
      </Card>

      {product.presentations.length > 1 ? (
        <>
          <SectionLabel className="mb-2.5">Presentaciones</SectionLabel>
          <Card className="mb-6 overflow-hidden">
            <RowList>
              {product.presentations.map((presentation) => (
                <div key={presentation.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem]">
                    {presentation.name}
                  </span>
                  <span className="shrink-0 text-[0.8125rem] text-faint tnum">
                    {presentationHint(num(presentation.factor), product.baseUnit)}
                  </span>
                </div>
              ))}
            </RowList>
          </Card>
        </>
      ) : null}

      {product.lots.length ? (
        <>
          <SectionLabel className="mb-2.5">Lotes y vencimiento</SectionLabel>
          <Card className="mb-6 overflow-hidden">
            <RowList>
              {product.lots.map((lot) => {
                const days = lot.expiresAt ? daysUntil(lot.expiresAt) : null;
                return (
                  <div key={lot.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[0.8125rem]">{lot.code}</span>
                      <span className="block text-[0.8125rem] text-faint">
                        {lot.expiresAt ? formatDate(lot.expiresAt) : "Sin fecha"}
                      </span>
                    </span>
                    {days !== null ? (
                      <Badge tone={days < 0 ? "danger" : days <= 15 ? "warn" : "neutral"}>
                        {days < 0 ? `vencido hace ${Math.abs(days)} d` : `faltan ${days} d`}
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </RowList>
          </Card>
        </>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="Historial" />
        {movements.length ? (
          <RowList className="border-t border-line">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </RowList>
        ) : (
          <Empty icon={Package} title="Sin movimientos" body="Nadie ha movido este producto aún." />
        )}
      </Card>
    </Screen>
  );
}

function unitWord(unit: "GRAMO" | "MILILITRO" | "UNIDAD") {
  return unit === "GRAMO" ? "gramo" : unit === "MILILITRO" ? "ml" : "unidad";
}
