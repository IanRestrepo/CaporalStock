import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Card, RowList } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { MovementRow } from "@/components/movement-row";
import { PageHeader, Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { MOVEMENT_LABEL } from "@/lib/movements";
import type { MovementType } from "@/generated/prisma/enums";

export const metadata = { title: "Movimientos" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todo" },
  { value: "CONSUMO", label: "Salidas" },
  { value: "TRASLADO", label: "Traslados" },
  { value: "ENTRADA", label: "Entradas" },
  { value: "DANIO", label: "Daños" },
  { value: "AJUSTE", label: "Ajustes" },
];

export default async function MovimientosPage({ searchParams }: PageProps<"/movimientos">) {
  await requireUser();
  const params = await searchParams;
  const raw = typeof params.tipo === "string" ? params.tipo : "";
  const type = FILTERS.some((f) => f.value === raw && f.value) ? (raw as MovementType) : null;

  const movements = await prisma.movement.findMany({
    where: type ? { type } : undefined,
    take: 80,
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      type: true,
      occurredAt: true,
      reason: true,
      createdBy: { select: { name: true } },
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
      room: { select: { number: true } },
      lines: {
        select: {
          quantity: true,
          product: {
            select: { name: true, baseUnit: true, category: { select: { color: true } } },
          },
        },
      },
    },
  });

  const groups = groupByDay(movements);

  return (
    <Screen>
      <PageHeader
        title="Movimientos"
        subtitle="Cada gramo que entró, se movió o salió."
        action={
          <Button asChild variant="accent" size="icon" aria-label="Registrar movimiento">
            <Link href="/movimientos/nuevo">
              <Plus className="size-5" strokeWidth={2.5} />
            </Link>
          </Button>
        }
      />

      <div data-scroll-x className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
        {FILTERS.map((filter) => {
          const active = (filter.value || null) === type;
          return (
            <Link
              key={filter.value}
              href={filter.value ? `/movimientos?tipo=${filter.value}` : "/movimientos"}
              className={cn(
                "press shrink-0 rounded-full px-3.5 py-2 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
                active ? "bg-ink text-canvas" : "bg-raised text-soft hover:text-ink",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {movements.length ? (
        <div className="space-y-5">
          {groups.map(([day, items]) => (
            <section key={day}>
              <p className="mb-2 px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
                {day}
              </p>
              <Card className="overflow-hidden">
                <RowList>
                  {items.map((movement) => (
                    <MovementRow key={movement.id} movement={movement} />
                  ))}
                </RowList>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon={ArrowLeftRight}
            title={type ? `Sin ${MOVEMENT_LABEL[type].toLowerCase()}s` : "Sin movimientos"}
            body="Cuando alguien registre algo, va a quedar acá con su nombre y la hora."
          />
        </Card>
      )}
    </Screen>
  );
}

function groupByDay<T extends { occurredAt: Date }>(items: T[]): [string, T[]][] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const long = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const map = new Map<string, T[]>();
  for (const item of items) {
    const day = startOfDay(item.occurredAt);
    const label =
      day.getTime() === today.getTime()
        ? "Hoy"
        : day.getTime() === yesterday.getTime()
          ? "Ayer"
          : long.format(day);
    const bucket = map.get(label);
    if (bucket) bucket.push(item);
    else map.set(label, [item]);
  }
  return [...map.entries()];
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
