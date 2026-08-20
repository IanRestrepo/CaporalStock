import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "Nueva compra" };

export default async function NuevaCompraPage() {
  await requireAdminPage();

  const [suppliers, locations, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: { active: true, kind: { in: ["PRINCIPAL", "AREA"] } },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        perishable: true,
        presentations: {
          orderBy: { factor: "desc" },
          select: { id: true, name: true, factor: true },
        },
      },
    }),
  ]);

  return (
    <Screen>
      <PageHeader
        back={{ href: "/compras" }}
        title="Nueva compra"
        subtitle="Cargá la factura tal como llegó; el sistema hace las conversiones."
      />
      <PurchaseForm
        suppliers={suppliers}
        locations={locations}
        defaultLocationId={locations[0]?.id ?? ""}
        products={products.map((p) => ({
          ...p,
          presentations: p.presentations.map((pr) => ({
            id: pr.id,
            name: pr.name,
            factor: num(pr.factor),
          })),
        }))}
      />
    </Screen>
  );
}
