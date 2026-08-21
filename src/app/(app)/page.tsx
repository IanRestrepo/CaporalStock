import Link from "next/link";
import {
  ArrowUpRight,
  BedDouble,
  Bell,
  ChevronRight,
  ClipboardCheck,
  PackageMinus,
  Refrigerator,
  Warehouse,
} from "lucide-react";
import { Card, CardHeader, RowList, SectionLabel } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LevelRow } from "@/components/level-row";
import { MovementRow } from "@/components/movement-row";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { categoryColor } from "@/lib/appearance";
import { getExpiring, getLowStock } from "@/lib/alerts";
import { formatMoneyCompact, formatPercent } from "@/lib/format";
import {
  dayRange,
  inventoryValue,
  monthRange,
  periodFlow,
  recentMovements,
  userActivity,
} from "@/lib/dashboard";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/cn";

export default async function InicioPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const month = monthRange();
  const today = dayRange();

  const [value, flow, movements, lowStock, expiring, activity] = await Promise.all([
    isAdmin ? inventoryValue() : null,
    isAdmin ? periodFlow(month.start, month.end) : null,
    recentMovements(6),
    getLowStock(3),
    getExpiring(),
    userActivity(user.id, today.start, today.end),
  ]);

  const alertTotal = lowStock.length + expiring.length;

  return (
    <Screen>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("es-CO", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={
          isAdmin
            ? "Resumen del hotel al día de hoy."
            : "Esto es lo que tenés a la mano hoy."
        }
      />

      <Card className="mb-4 px-5 py-4">
        {isAdmin && value && flow ? (
          <StatRow
            items={[
              { label: "Inventario", value: formatMoneyCompact(value.total) },
              {
                label: "Consumo del mes",
                value: formatMoneyCompact(flow.cost),
                hint: flow.waste > 0 ? `${formatMoneyCompact(flow.waste)} en mermas` : undefined,
              },
              {
                label: "Utilidad bruta",
                value: formatMoneyCompact(flow.margin),
                hint: flow.revenue > 0 ? formatPercent(flow.marginRate) : undefined,
              },
            ]}
          />
        ) : (
          <StatRow
            items={[
              { label: "Registros hoy", value: activity.movements },
              { label: "Suites revisadas", value: activity.checklists },
              {
                label: "Alertas",
                value: alertTotal,
                hint: alertTotal > 0 ? "requieren atención" : "todo en orden",
              },
            ]}
          />
        )}
      </Card>

      <SectionLabel className="mb-2.5">Acciones</SectionLabel>
      <div className="mb-7 grid grid-cols-2 gap-2.5">
        <Action
          href="/movimientos/nuevo?tipo=CONSUMO"
          icon={PackageMinus}
          title="Sacar producto"
          body="Consumo o daño"
          accent
        />
        <Action
          href="/movimientos/nuevo?tipo=TRASLADO"
          icon={Warehouse}
          title="Trasladar"
          body="Bodega a minibar"
        />
        <Action href="/suites" icon={Refrigerator} title="Reponer minibar" body="Nivel par" />
        <Action href="/checklist" icon={ClipboardCheck} title="Revisar suite" body="Checklist" />
      </div>

      {alertTotal > 0 ? (
        <Card className="mb-4 overflow-hidden">
          <CardHeader
            title="Necesita atención"
            hint={`${lowStock.length} bajo mínimo · ${expiring.length} por vencer`}
            action={
              <Link
                href="/alertas"
                className="press grid size-9 place-items-center rounded-[11px] bg-raised text-soft hover:text-ink"
                aria-label="Ver todas las alertas"
              >
                <ChevronRight className="size-4.5" />
              </Link>
            }
          />
          <div className="space-y-1.5 px-3 pb-3">
            {lowStock.map((alert) => (
              <LevelRow
                key={`${alert.productId}-${alert.locationId}`}
                name={`${alert.product} · ${alert.location}`}
                color={categoryColor(alert.color)}
                quantity={alert.quantity}
                target={alert.threshold}
                unit={alert.baseUnit}
                tone={alert.quantity === 0 ? "danger" : "warn"}
              />
            ))}
            {lowStock.length === 0 ? (
              <Link
                href="/alertas"
                className="press flex items-center gap-3.5 rounded-[18px] bg-raised px-3 py-3.5 hover:bg-hover"
              >
                <span className="grid size-10 place-items-center rounded-full bg-warn-soft text-warn">
                  <Bell className="size-[18px]" strokeWidth={2} />
                </span>
                <span className="text-[0.9375rem] font-medium">
                  {expiring.length} producto{expiring.length > 1 ? "s" : ""} por vencer
                </span>
                <ArrowUpRight className="ml-auto size-4 text-faint" />
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Últimos movimientos"
          action={
            <Link
              href="/movimientos"
              className="press grid size-9 place-items-center rounded-[11px] bg-raised text-soft hover:text-ink"
              aria-label="Ver todos los movimientos"
            >
              <ChevronRight className="size-4.5" />
            </Link>
          }
        />
        {movements.length ? (
          <RowList className="border-t border-line">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </RowList>
        ) : (
          <Empty
            icon={BedDouble}
            title="Todavía no hay movimientos"
            body="Cuando alguien saque o traslade un producto, aparecerá acá con su nombre."
          />
        )}
      </Card>
    </Screen>
  );
}

function Action({
  href,
  icon: Icon,
  title,
  body,
  accent,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "press flex flex-col justify-between rounded-[20px] p-4 pt-3.5",
        accent ? "bg-accent text-accent-ink" : "bg-surface hover:bg-raised",
      )}
    >
      <Icon
        className={cn("mb-6 size-5", accent ? "opacity-90" : "text-faint")}
        strokeWidth={1.75}
      />
      <span className="text-[0.9375rem] leading-tight font-semibold">{title}</span>
      <span className={cn("mt-0.5 text-[0.8125rem]", accent ? "opacity-70" : "text-faint")}>
        {body}
      </span>
    </Link>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
