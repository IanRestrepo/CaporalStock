import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { SectionsAdmin, type SectionAdminRow } from "./sections-admin";

export const metadata = { title: "Secciones" };

export default async function SeccionesPage() {
  await requireAdminPage();

  const sections = await prisma.section.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      _count: { select: { products: true } },
    },
  });

  const rows: SectionAdminRow[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    icon: s.icon,
    products: s._count.products,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        title="Secciones"
        subtitle="Por dónde se entra a la bodega."
      />
      <SectionsAdmin sections={rows} />
    </Screen>
  );
}
