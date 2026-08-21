import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { CategoriesAdmin, type CategoryAdminRow } from "./categories-admin";

export const metadata = { title: "Categorías" };

export default async function CategoriasPage() {
  await requireAdminPage();

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      _count: { select: { products: true } },
    },
  });

  const rows: CategoryAdminRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    products: c._count.products,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        title="Categorías"
        subtitle="Con qué se ordena la bodega por dentro."
      />
      <CategoriesAdmin categories={rows} />
    </Screen>
  );
}
