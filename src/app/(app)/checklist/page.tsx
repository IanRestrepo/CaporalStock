import Link from "next/link";
import { ClipboardCheck, ClipboardList, TriangleAlert } from "lucide-react";
import { Card, CardHeader, RowList, SectionLabel } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Screen } from "@/components/screen";
import { formatRelative, initials } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Checklist" };

export default async function ChecklistPage() {
  await requireUser();

  const [rooms, runs] = await Promise.all([
    prisma.room.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        number: true,
        checklistRuns: {
          take: 1,
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        },
      },
    }),
    prisma.checklistRun.findMany({
      take: 15,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        note: true,
        room: { select: { number: true } },
        user: { select: { name: true } },
        items: { select: { status: true } },
      },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pending = rooms.filter(
    (r) => !r.checklistRuns[0] || r.checklistRuns[0].startedAt < today,
  );

  return (
    <Screen>
      <PageHeader
        title="Checklist"
        subtitle="Lo que debe estar en cada suite, verificado y firmado."
      />

      <SectionLabel className="mb-2.5">
        {pending.length ? `Pendientes hoy · ${pending.length}` : "Todo revisado hoy"}
      </SectionLabel>

      {pending.length ? (
        <div className="mb-7 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {pending.map((room) => (
            <Link
              key={room.id}
              href={`/checklist/nuevo?suite=${room.id}`}
              className="press grid place-items-center rounded-[16px] bg-surface py-5 text-[1.125rem] font-semibold tnum hover:bg-raised"
            >
              {room.number}
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mb-7">
          <Empty
            icon={ClipboardCheck}
            title="Las 12 suites al día"
            body="Todas fueron revisadas hoy. Buen turno."
          />
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Revisiones recientes" />
        {runs.length ? (
          <RowList className="border-t border-line">
            {runs.map((run) => {
              const issues = run.items.filter(
                (i) => i.status === "FALTANTE" || i.status === "DANIADO",
              ).length;
              const replaced = run.items.filter((i) => i.status === "REPUESTO").length;

              return (
                <div key={run.id} className="flex items-center gap-3.5 px-5 py-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-raised text-2xs font-semibold text-soft">
                    {initials(run.user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] font-medium">
                      Suite {run.room.number}
                      <span className="ml-2 text-[0.8125rem] font-normal text-faint">
                        {formatRelative(run.startedAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[0.8125rem] text-soft">
                      {run.user.name}
                      {run.note ? ` · ${run.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {replaced > 0 ? <Badge tone="accent">{replaced} repuesto</Badge> : null}
                    {issues > 0 ? (
                      <Badge tone="warn">
                        <TriangleAlert className="size-3" />
                        {issues}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </RowList>
        ) : (
          <Empty
            icon={ClipboardList}
            title="Sin revisiones"
            body="Cuando alguien revise una suite, el registro queda acá con su nombre."
          />
        )}
      </Card>
    </Screen>
  );
}
