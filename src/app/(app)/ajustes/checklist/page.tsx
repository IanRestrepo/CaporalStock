import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { ChecklistAdmin, type Item } from "./checklist-admin";

export const metadata = { title: "Checklist de suite" };

export default async function ChecklistAjustesPage({
  searchParams,
}: PageProps<"/ajustes/checklist">) {
  await requireAdminPage();

  const params = await searchParams;
  const pedida = typeof params.plantilla === "string" ? params.plantilla : null;

  const [templates, products] = await Promise.all([
    prisma.checklistTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            label: true,
            kind: true,
            expectedQty: true,
            requireNote: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { active: true, practice: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Hay una plantilla por tipo de alojamiento. Sin poder cambiar de una a otra,
  // tres de las cuatro quedan invisibles y nadie puede corregirlas.
  const template = templates.find((t) => t.id === pedida) ?? templates[0] ?? null;

  if (!template) {
    return (
      <Screen>
        <PageHeader back={{ href: "/ajustes" }} title="Checklist de suite" />
        <Card>
          <Empty
            icon={ClipboardList}
            title="No hay plantilla"
            body="Corré la semilla o creá una plantilla en la base de datos para empezar."
          />
        </Card>
      </Screen>
    );
  }

  const items: Item[] = template.items.map((item) => ({
    id: item.id,
    label: item.label,
    kind: item.kind,
    expectedQty: item.expectedQty ? num(item.expectedQty) : null,
    requireNote: item.requireNote,
    productId: item.product?.id ?? null,
    productName: item.product?.name ?? null,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        eyebrow={template.name}
        title="Checklist de suite"
        subtitle="Vos decidís qué debe haber en cada tipo de alojamiento."
      />
      <ChecklistAdmin
        templateId={template.id}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        items={items}
        products={products}
      />
    </Screen>
  );
}
