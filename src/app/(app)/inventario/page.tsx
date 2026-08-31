import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { ScanFlow, type ScanProduct } from "./scan-flow";

export const metadata = { title: "Conteo con cámara" };

export default async function InventarioPage() {
  await requireAdminPage();

  const [locations, products, stock] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, kind: true, room: { select: { number: true } } },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        section: { select: { name: true } },
        category: { select: { color: true } },
      },
    }),
    prisma.stock.findMany({ select: { productId: true, locationId: true, quantity: true } }),
  ]);

  const onHand: Record<string, number> = {};
  for (const row of stock) {
    onHand[`${row.productId}:${row.locationId}`] = num(row.quantity);
  }

  return (
    <Screen>
      <PageHeader
        back={{ href: "/bodegas" }}
        title="Conteo con cámara"
        subtitle="Fotografiá la hoja y revisá lo que se leyó antes de aplicarlo."
      />
      <ScanFlow
        locations={locations.map((l) => ({
          id: l.id,
          name: l.room ? `${l.name} · Suite ${l.room.number}` : l.name,
          kind: l.kind,
        }))}
        products={products.map<ScanProduct>((p) => ({
          id: p.id,
          name: p.name,
          baseUnit: p.baseUnit,
          section: p.section?.name ?? "Sin sección",
          color: p.category?.color ?? "slate",
        }))}
        onHand={onHand}
      />
    </Screen>
  );
}
