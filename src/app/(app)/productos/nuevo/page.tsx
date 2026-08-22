import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { NewProduct } from "./new-product";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  await requireAdminPage();

  const [categories, sections] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.section.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <Screen>
      <PageHeader
        back={{ href: "/productos" }}
        title="Nuevo producto"
        subtitle="Elegí bien la unidad de medida: no se puede cambiar después."
      />
      <div className="rounded-card bg-surface p-4">
        <NewProduct categories={categories} sections={sections} />
      </div>
    </Screen>
  );
}
