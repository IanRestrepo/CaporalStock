import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { StockExplorer, type StockItem } from "@/components/stock-explorer";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Productos" };

export default async function ProductosPage() {
  const user = await requireUser();

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      baseUnit: true,
      minQty: true,
      category: { select: { name: true, color: true } },
      stock: { select: { quantity: true } },
    },
  });

  const items: StockItem[] = products.map((product) => ({
    productId: product.id,
    name: product.name,
    category: product.category.name,
    color: product.category.color,
    baseUnit: product.baseUnit,
    quantity: product.stock.reduce((sum, s) => sum + num(s.quantity), 0),
    threshold: num(product.minQty),
    par: null,
  }));

  return (
    <Screen>
      <PageHeader
        title="Productos"
        subtitle="Existencias sumadas de todas las bodegas."
        action={
          user.role === "ADMIN" ? (
            <Button asChild variant="quiet" size="icon" aria-label="Nuevo producto">
              <Link href="/productos/nuevo">
                <Plus className="size-5" />
              </Link>
            </Button>
          ) : null
        }
      />

      <StockExplorer
        items={items}
        hrefBase="/productos"
        emptyBody="Todavía no hay productos en el catálogo."
      />
    </Screen>
  );
}
