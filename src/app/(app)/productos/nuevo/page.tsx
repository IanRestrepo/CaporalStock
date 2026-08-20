import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { NewProduct } from "./new-product";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  await requireAdminPage();

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <Screen>
      <PageHeader
        back={{ href: "/productos" }}
        title="Nuevo producto"
        subtitle="Elegí bien la unidad base: no se puede cambiar después."
      />
      <div className="rounded-card bg-surface p-4">
        <NewProduct categories={categories} />
      </div>
    </Screen>
  );
}
