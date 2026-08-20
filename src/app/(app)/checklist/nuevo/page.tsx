import { notFound, redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ChecklistRun, type TemplateItem } from "./checklist-run";

export const metadata = { title: "Revisar suite" };

export default async function NuevaRevisionPage({ searchParams }: PageProps<"/checklist/nuevo">) {
  await requireUser();
  const params = await searchParams;
  const roomId = typeof params.suite === "string" ? params.suite : null;

  if (!roomId) redirect("/suites");

  const [room, template, locations] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, select: { id: true, number: true } }),
    prisma.checklistTemplate.findFirst({
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
            product: { select: { id: true, name: true, baseUnit: true } },
          },
        },
      },
    }),
    prisma.location.findMany({
      where: { active: true, kind: { in: ["PRINCIPAL", "AREA"] } },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!room) notFound();

  if (!template || !template.items.length) {
    return (
      <Screen>
        <PageHeader back={{ href: `/suites/${room.id}` }} title={`Suite ${room.number}`} />
        <Card>
          <Empty
            icon={ClipboardList}
            title="No hay checklist configurado"
            body="El administrador todavía no definió qué debe revisarse en una suite."
          />
        </Card>
      </Screen>
    );
  }

  const items: TemplateItem[] = template.items.map((item) => ({
    id: item.id,
    label: item.label,
    kind: item.kind,
    expectedQty: item.expectedQty ? num(item.expectedQty) : null,
    requireNote: item.requireNote,
    product: item.product,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: `/suites/${room.id}` }}
        eyebrow={template.name}
        title={`Suite ${room.number}`}
      />
      <ChecklistRun
        roomId={room.id}
        roomNumber={room.number}
        templateId={template.id}
        items={items}
        locations={locations}
        defaultLocationId={locations[0]?.id ?? ""}
      />
    </Screen>
  );
}
