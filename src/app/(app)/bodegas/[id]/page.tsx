import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, PackageMinus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { StockExplorer, type StockItem } from "@/components/stock-explorer";
import { formatMoneyCompact } from "@/lib/format";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { centralStock } from "@/lib/warehouse";

export default async function BodegaPage({ params }: PageProps<"/bodegas/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      kind: true,
      room: { select: { number: true } },
      stock: {
        where: { product: { active: true } },
        select: {
          quantity: true,
          minQty: true,
          parQty: true,
          product: {
            select: {
              id: true,
              name: true,
              baseUnit: true,
              minQty: true,
              costPrice: true,
              category: { select: { name: true, color: true } },
            },
          },
        },
      },
    },
  });

  if (!location) notFound();

  const isAdmin = user.role === "ADMIN";
  const isCentral = location.kind === "PRINCIPAL";

  /**
   * La bodega central muestra el catálogo entero: un producto recién creado
   * todavía no tiene saldo, y si no apareciera acá no habría dónde cargarlo.
   * Un minibar, en cambio, sólo muestra lo que se le montó.
   */
  const { items, categories, sections } = isCentral
    ? await centralStock(location.id)
    : {
        items: location.stock.map((row) => ({
          productId: row.product.id,
          name: row.product.name,
          category: row.product.category.name,
          color: row.product.category.color,
          baseUnit: row.product.baseUnit,
          quantity: num(row.quantity),
          threshold: num(row.minQty) || num(row.product.minQty),
          par: row.parQty ? num(row.parQty) : null,
        })) satisfies StockItem[],
        categories: [] as { id: string; name: string }[],
        sections: [] as { id: string; name: string }[],
      };

  const value = location.stock.reduce(
    (sum, row) => sum + num(row.quantity) * num(row.product.costPrice),
    0,
  );
  const withStock = items.filter((i) => i.quantity > 0).length;
  const low = items.filter((i) => i.threshold > 0 && i.quantity < i.threshold).length;

  return (
    <Screen>
      <PageHeader
        back={{ href: "/bodegas" }}
        eyebrow={location.room ? `Suite ${location.room.number}` : undefined}
        title={location.name}
      />

      <Card className="mb-4 px-5 py-4">
        <StatRow
          items={[
            { label: "Productos", value: withStock },
            { label: "Bajo mínimo", value: low, hint: low === 0 ? "todo en orden" : undefined },
            isAdmin
              ? { label: "Valor a costo", value: formatMoneyCompact(value) }
              : { label: "Tipo", value: isCentral ? "Bodega" : "Minibar" },
          ]}
        />
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-2.5">
        <Link
          href={`/movimientos/nuevo?tipo=CONSUMO&desde=${location.id}`}
          className="press flex items-center gap-2.5 rounded-[16px] bg-surface px-4 py-3.5 text-[0.9375rem] font-medium hover:bg-raised"
        >
          <PackageMinus className="size-[18px] text-faint" strokeWidth={1.75} />
          Sacar
        </Link>
        <Link
          href={`/movimientos/nuevo?tipo=TRASLADO&hacia=${location.id}`}
          className="press flex items-center gap-2.5 rounded-[16px] bg-surface px-4 py-3.5 text-[0.9375rem] font-medium hover:bg-raised"
        >
          <ArrowLeftRight className="size-[18px] text-faint" strokeWidth={1.75} />
          Traer
        </Link>
      </div>

      <StockExplorer
        items={items}
        hrefBase="/productos"
        admin={isAdmin && isCentral ? { categories, sections } : undefined}
        emptyBody={
          isCentral
            ? "La bodega arranca vacía. Creá el primer producto y decile en qué categoría se usa."
            : "Este minibar todavía no tiene nada. Trasladá productos desde la bodega central."
        }
      />
    </Screen>
  );
}
