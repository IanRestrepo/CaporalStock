import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { SuppliersAdmin, type SupplierRow } from "./suppliers-admin";

export const metadata = { title: "Proveedores" };

export default async function ProveedoresPage() {
  await requireAdminPage();

  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      taxId: true,
      phone: true,
      email: true,
      notes: true,
      active: true,
      _count: { select: { purchases: true } },
    },
  });

  const rows: SupplierRow[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    taxId: s.taxId,
    phone: s.phone,
    email: s.email,
    notes: s.notes,
    active: s.active,
    purchases: s._count.purchases,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        title="Proveedores"
        subtitle="A quién le compra el hotel."
      />
      <SuppliersAdmin suppliers={rows} />
    </Screen>
  );
}
