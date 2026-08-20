import Link from "next/link";
import { BellOff, CalendarClock, TrendingDown } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { LevelRow } from "@/components/level-row";
import { PageHeader, Screen } from "@/components/screen";
import { categoryColor } from "@/lib/appearance";
import { EXPIRY_WINDOW_DAYS, getExpiring, getLowStock } from "@/lib/alerts";
import { daysUntil, formatDate } from "@/lib/format";
import { formatQty } from "@/lib/units";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Alertas" };

export default async function AlertasPage() {
  await requireUser();
  const [lowStock, expiring] = await Promise.all([getLowStock(), getExpiring()]);

  const empty = lowStock.length === 0 && expiring.length === 0;
  const expired = expiring.filter((e) => daysUntil(e.expiresAt) < 0);
  const soon = expiring.filter((e) => daysUntil(e.expiresAt) >= 0);

  return (
    <Screen>
      <PageHeader
        title="Alertas"
        subtitle={
          empty
            ? "Nada que corregir por ahora."
            : `${lowStock.length} bajo mínimo · ${expiring.length} con vencimiento`
        }
      />

      {empty ? (
        <Card>
          <Empty
            icon={BellOff}
            title="Todo en orden"
            body={`Ningún producto está por debajo de su mínimo ni vence en los próximos ${EXPIRY_WINDOW_DAYS} días.`}
          />
        </Card>
      ) : (
        <div className="space-y-7">
          {expired.length ? (
            <section>
              <SectionLabel className="mb-2.5">Ya vencidos</SectionLabel>
              <div className="space-y-1.5">
                {expired.map((alert) => (
                  <ExpiryRow key={alert.lotId} alert={alert} />
                ))}
              </div>
              <p className="mt-2.5 px-1 text-[0.8125rem] text-faint">
                Registrálos como daño con motivo “Vencido” para que salgan del inventario.
              </p>
            </section>
          ) : null}

          {lowStock.length ? (
            <section>
              <SectionLabel className="mb-2.5">Bajo mínimo</SectionLabel>
              <div className="space-y-1.5">
                {lowStock.map((alert) => (
                  <LevelRow
                    key={`${alert.productId}-${alert.locationId}`}
                    name={`${alert.product} · ${alert.location}`}
                    color={categoryColor(alert.color)}
                    quantity={alert.quantity}
                    target={alert.threshold}
                    unit={alert.baseUnit}
                    href={`/productos/${alert.productId}`}
                    tone={alert.quantity === 0 ? "danger" : "warn"}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {soon.length ? (
            <section>
              <SectionLabel className="mb-2.5">Por vencer</SectionLabel>
              <div className="space-y-1.5">
                {soon.map((alert) => (
                  <ExpiryRow key={alert.lotId} alert={alert} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </Screen>
  );
}

function ExpiryRow({
  alert,
}: {
  alert: Awaited<ReturnType<typeof getExpiring>>[number];
}) {
  const days = daysUntil(alert.expiresAt);
  const overdue = days < 0;

  return (
    <Link
      href={`/productos/${alert.productId}`}
      className="press flex items-center gap-3.5 rounded-[18px] bg-raised px-3 py-2.5 hover:bg-hover"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full"
        style={{ background: categoryColor(alert.color), color: "oklch(0.18 0.01 60)" }}
      >
        {overdue ? (
          <TrendingDown className="size-[18px]" strokeWidth={2.25} />
        ) : (
          <CalendarClock className="size-[18px]" strokeWidth={2.25} />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] text-soft">
          {alert.product} · lote {alert.code}
        </span>
        <span className="block text-[0.9375rem] leading-tight font-semibold tnum">
          {formatQty(alert.quantity, alert.baseUnit)}
          <span className="font-normal text-faint"> · {formatDate(alert.expiresAt)}</span>
        </span>
      </span>

      <Badge tone={overdue ? "danger" : days <= 7 ? "warn" : "neutral"}>
        {overdue ? `−${Math.abs(days)} d` : `${days} d`}
      </Badge>
    </Link>
  );
}
