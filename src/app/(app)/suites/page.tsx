import Link from "next/link";
import { BedDouble, ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LevelBar } from "@/components/level-row";
import { PageHeader, Screen } from "@/components/screen";
import { formatRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Suites" };

export default async function SuitesPage() {
  await requireUser();

  const rooms = await prisma.room.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      number: true,
      floor: true,
      minibar: {
        select: {
          id: true,
          stock: {
            where: { parQty: { not: null } },
            select: { quantity: true, parQty: true },
          },
        },
      },
      checklistRuns: {
        take: 1,
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, completedAt: true },
      },
    },
  });

  const floors = [...new Set(rooms.map((r) => r.floor ?? "Sin piso"))];

  return (
    <Screen>
      <PageHeader
        title="Suites"
        subtitle="Minibar y dotación, habitación por habitación."
      />

      {rooms.length ? (
        <div className="space-y-7">
          {floors.map((floor) => (
            <section key={floor}>
              <p className="mb-2.5 px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
                {floor}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {rooms
                  .filter((r) => (r.floor ?? "Sin piso") === floor)
                  .map((room) => {
                    const stock = room.minibar?.stock ?? [];
                    const par = stock.reduce((sum, s) => sum + Number(s.parQty), 0);
                    const have = stock.reduce(
                      (sum, s) => sum + Math.min(Number(s.quantity), Number(s.parQty)),
                      0,
                    );
                    const ratio = par > 0 ? have / par : 1;
                    const run = room.checklistRuns[0];

                    return (
                      <Link
                        key={room.id}
                        href={`/suites/${room.id}`}
                        className="press rounded-[20px] bg-surface p-4 hover:bg-raised"
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <span className="text-[1.375rem] leading-none font-semibold tracking-[-0.01em] tnum">
                            {room.number}
                          </span>
                          {run?.completedAt ? (
                            <ClipboardCheck className="size-4 text-ok" strokeWidth={2} />
                          ) : null}
                        </div>

                        <LevelBar
                          ratio={ratio}
                          tone={ratio >= 0.99 ? "ok" : ratio >= 0.5 ? "warn" : "danger"}
                        />

                        <p className="mt-2.5 text-[0.8125rem] text-soft tnum">
                          Minibar {Math.round(ratio * 100)}%
                        </p>
                        <p className="mt-0.5 text-2xs text-faint">
                          {run ? `Revisada ${formatRelative(run.startedAt)}` : "Sin revisar"}
                        </p>
                      </Link>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon={BedDouble}
            title="No hay habitaciones"
            body="Creá las habitaciones desde Ajustes para poder manejar sus minibares."
          />
        </Card>
      )}
    </Screen>
  );
}
