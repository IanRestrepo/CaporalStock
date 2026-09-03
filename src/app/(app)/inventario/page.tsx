import { PackageSearch } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { CountSheet, type CountProduct } from "./count-sheet";

export const metadata = { title: "Conteo" };

export default async function InventarioPage() {
  await requireAdminPage();

  const [locations, products, stock] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, kind: true, practice: true, room: { select: { number: true } } },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ section: { sortOrder: "asc" } }, { category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        baseUnit: true,
        practice: true,
        section: { select: { name: true, sortOrder: true } },
        category: { select: { name: true, color: true } },
      },
    }),
    prisma.stock.findMany({ select: { productId: true, locationId: true, quantity: true } }),
  ]);

  if (!products.length) {
    return (
      <Screen>
        <PageHeader back={{ href: "/bodegas" }} title="Conteo" />
        <Card>
          <Empty
            icon={PackageSearch}
            title="Todavía no hay productos"
            body="El conteo compara lo que cuentas contra tu catálogo. Carga los productos y vuelve."
            action={
              <Button asChild variant="accent">
                <Link href="/productos/nuevo">Crear el primer producto</Link>
              </Button>
            }
          />
        </Card>
      </Screen>
    );
  }

  const onHand: Record<string, number> = {};
  for (const row of stock) {
    onHand[`${row.productId}:${row.locationId}`] = num(row.quantity);
  }

  return (
    <Screen>
      <PageHeader
        back={{ href: "/bodegas" }}
        title="Conteo"
        subtitle="Recorre el estante y escribe lo que ves. Lo que no toques queda como está."
      />
      <CountSheet
        locations={locations.map((l) => ({
          id: l.id,
          name: l.room ? `${l.name} · Suite ${l.room.number}` : l.name,
          kind: l.kind,
          practice: l.practice,
        }))}
        products={products.map<CountProduct>((p) => ({
          id: p.id,
          name: p.name,
          baseUnit: p.baseUnit,
          practice: p.practice,
          section: p.section?.name ?? "Sin sección",
          category: p.category?.name ?? "Sin categoría",
          color: p.category?.color ?? "slate",
        }))}
        onHand={onHand}
      />
    </Screen>
  );
}
