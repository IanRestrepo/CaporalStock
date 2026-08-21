import Link from "next/link";
import { ArrowLeftRight, PackageMinus, Warehouse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import {
  WarehouseExplorer,
  type CategoryRow,
  type WarehouseItem,
} from "@/components/warehouse-explorer";
import { formatMoneyCompact, num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Bodega" };

export default async function BodegaPage() {
  const user = await requireUser();

  /**
   * El hotel tiene una sola bodega. Los minibares también guardan producto,
   * pero se manejan desde la suite a la que pertenecen, no desde acá.
   */
  const central = await prisma.location.findFirst({
    where: { kind: "PRINCIPAL", active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  if (!central) {
    return (
      <Screen>
        <PageHeader title="Bodega" />
        <Card>
          <Empty
            icon={Warehouse}
            title="No hay bodega central"
            body="Creala desde Ajustes › Bodega y habitaciones para poder guardar inventario."
          />
        </Card>
      </Screen>
    );
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true, icon: true },
    }),
    prisma.product.findMany({
      where: { active: true },
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
        category: { select: { name: true, color: true } },
        stock: {
          where: { locationId: central.id },
          select: { quantity: true, minQty: true },
        },
      },
    }),
  ]);

  const items: WarehouseItem[] = products.map((product) => {
    const row = product.stock[0];
    return {
      productId: product.id,
      name: product.name,
      categoryId: product.categoryId,
      category: product.category.name,
      color: product.category.color,
      baseUnit: product.baseUnit,
      quantity: row ? num(row.quantity) : 0,
      threshold: (row ? num(row.minQty) : 0) || num(product.minQty),
      draft: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
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
    (sum, product) => sum + (product.stock[0] ? num(product.stock[0].quantity) : 0) * num(product.costPrice),
    0,
  );
  const withStock = items.filter((i) => i.quantity > 0).length;
  const low = items.filter((i) => i.threshold > 0 && i.quantity < i.threshold).length;

  return (
    <Screen>
      <PageHeader
        title={central.name}
        subtitle="Todo el inventario del hotel, ordenado por categoría."
      />

      <Card className="mb-4 px-5 py-4">
        <StatRow
          items={[
            { label: "Con existencia", value: withStock, hint: `de ${items.length}` },
            { label: "Bajo mínimo", value: low, hint: low === 0 ? "todo en orden" : undefined },
            user.role === "ADMIN"
              ? { label: "Valor a costo", value: formatMoneyCompact(value) }
              : { label: "Categorías", value: categories.length },
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

      <WarehouseExplorer
        items={items}
        categories={categories as CategoryRow[]}
        canEdit={user.role === "ADMIN"}
      />
    </Screen>
  );
}
