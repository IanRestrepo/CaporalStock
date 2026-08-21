import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, PackageMinus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { StockExplorer } from "@/components/stock-explorer";
import { formatMoneyCompact } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { centralLocation, centralStock } from "@/lib/warehouse";

export default async function SeccionPage({ params }: PageProps<"/bodegas/seccion/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  /**
   * Una sección no es otra bodega: es la bodega central mirada por una rendija.
   * Por eso la pantalla es la de una bodega, con el mismo encabezado y las
   * mismas acciones — sólo cambia qué entra en la lista.
   */
  const [section, central] = await Promise.all([
    prisma.section.findUnique({ where: { id }, select: { id: true, name: true } }),
    centralLocation(),
  ]);

  if (!section || !central) notFound();

  const isAdmin = user.role === "ADMIN";
  const { items, categories, sections, value } = await centralStock(central.id, section.id);

  const withStock = items.filter((i) => i.quantity > 0).length;
  const low = items.filter((i) => i.threshold > 0 && i.quantity < i.threshold).length;

  return (
    <Screen>
      <PageHeader back={{ href: "/bodegas" }} eyebrow={central.name} title={section.name} />

      <Card className="mb-4 px-5 py-4">
        <StatRow
          items={[
            { label: "Productos", value: items.length, hint: `${withStock} con existencia` },
            { label: "Bajo mínimo", value: low, hint: low === 0 ? "todo en orden" : undefined },
            isAdmin
              ? { label: "Valor a costo", value: formatMoneyCompact(value) }
              : { label: "Con existencia", value: withStock },
          ]}
        />
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-2.5">
        <Link
          href={`/movimientos/nuevo?tipo=CONSUMO&desde=${central.id}`}
          className="press flex items-center gap-2.5 rounded-[16px] bg-surface px-4 py-3.5 text-[0.9375rem] font-medium hover:bg-raised"
        >
          <PackageMinus className="size-[18px] text-faint" strokeWidth={1.75} />
          Sacar
        </Link>
        <Link
          href={`/movimientos/nuevo?tipo=TRASLADO&desde=${central.id}`}
          className="press flex items-center gap-2.5 rounded-[16px] bg-surface px-4 py-3.5 text-[0.9375rem] font-medium hover:bg-raised"
        >
          <ArrowLeftRight className="size-[18px] text-faint" strokeWidth={1.75} />
          Trasladar
        </Link>
      </div>

      <StockExplorer
        items={items}
        hrefBase="/productos"
        admin={isAdmin ? { categories, sections, defaultSectionId: section.id } : undefined}
        emptyBody={`Todavía no hay nada en ${section.name}. Creá un producto y asignalo a esta sección.`}
      />
    </Screen>
  );
}
