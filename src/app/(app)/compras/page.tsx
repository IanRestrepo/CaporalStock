import Link from "next/link";
import { Paperclip, Plus, Receipt } from "lucide-react";
import { Card, RowList } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Screen } from "@/components/screen";
import { StatRow } from "@/components/stat-row";
import { Button } from "@/components/ui/button";
import { formatMoney, formatMoneyCompact, formatShortDate, num } from "@/lib/format";
import { monthRange } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Compras" };

export default async function ComprasPage() {
  await requireAdminPage();
  const month = monthRange();

  const [purchases, monthTotal, pending] = await Promise.all([
    prisma.purchase.findMany({
      take: 40,
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        number: true,
        issuedAt: true,
        total: true,
        status: true,
        attachmentUrl: true,
        supplier: { select: { name: true } },
        location: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchase.aggregate({
      where: { issuedAt: { gte: month.start, lt: month.end }, status: "CONFIRMADA" },
      _sum: { total: true },
      _count: true,
    }),
    prisma.purchase.count({ where: { status: "BORRADOR" } }),
  ]);

  return (
    <Screen>
      <PageHeader
        title="Compras"
        subtitle="Facturas de proveedor y entrada de mercancía."
        action={
          <Button asChild variant="accent" size="icon" aria-label="Nueva compra">
            <Link href="/compras/nueva">
              <Plus className="size-5" strokeWidth={2.5} />
            </Link>
          </Button>
        }
      />

      <Card className="mb-4 px-5 py-4">
        <StatRow
          items={[
            { label: "Comprado este mes", value: formatMoneyCompact(num(monthTotal._sum.total)) },
            { label: "Facturas del mes", value: monthTotal._count },
            { label: "En borrador", value: pending, hint: pending > 0 ? "sin dar entrada" : undefined },
          ]}
        />
      </Card>

      {purchases.length ? (
        <Card className="overflow-hidden">
          <RowList>
            {purchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/compras/${purchase.id}`}
                className="press flex items-center gap-3.5 px-5 py-3.5 hover:bg-raised"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-raised text-soft">
                  <Receipt className="size-[18px]" strokeWidth={1.75} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[0.9375rem] font-medium">
                      {purchase.supplier.name}
                    </span>
                    {purchase.attachmentUrl ? (
                      <Paperclip className="size-3.5 shrink-0 text-faint" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-faint tnum">
                    {purchase.number} · {formatShortDate(purchase.issuedAt)} ·{" "}
                    {purchase._count.items} renglones
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-[0.9375rem] font-semibold tnum">
                    {formatMoney(num(purchase.total))}
                  </span>
                  {purchase.status === "BORRADOR" ? (
                    <Badge tone="warn" className="mt-1">
                      borrador
                    </Badge>
                  ) : null}
                </span>
              </Link>
            ))}
          </RowList>
        </Card>
      ) : (
        <Card>
          <Empty
            icon={Receipt}
            title="Sin compras registradas"
            body="Cargá la primera factura para que la mercancía entre con su costo real."
            action={
              <Button asChild variant="accent">
                <Link href="/compras/nueva">Registrar factura</Link>
              </Button>
            }
          />
        </Card>
      )}
    </Screen>
  );
}
