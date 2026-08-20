import { notFound } from "next/navigation";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Card, RowList, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Screen } from "@/components/screen";
import { formatDate, formatMoney, num } from "@/lib/format";
import { formatQty } from "@/lib/units";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { ConfirmButton } from "./confirm-button";

export default async function CompraPage({ params }: PageProps<"/compras/[id]">) {
  const { id } = await params;
  await requireAdminPage();

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      issuedAt: true,
      receivedAt: true,
      status: true,
      subtotal: true,
      tax: true,
      total: true,
      notes: true,
      attachmentUrl: true,
      attachmentName: true,
      supplier: { select: { name: true, taxId: true } },
      location: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        select: {
          id: true,
          qtyPresentation: true,
          qtyBase: true,
          unitCost: true,
          lineTotal: true,
          expiresAt: true,
          presentation: { select: { name: true } },
          product: { select: { id: true, name: true, baseUnit: true } },
        },
      },
    },
  });

  if (!purchase) notFound();

  const draft = purchase.status === "BORRADOR";

  return (
    <Screen>
      <PageHeader
        back={{ href: "/compras" }}
        eyebrow={purchase.supplier.name}
        title={`Factura ${purchase.number}`}
        subtitle={`${formatDate(purchase.issuedAt)} · entra a ${purchase.location.name}`}
      />

      {draft ? (
        <Card className="mb-4 p-4">
          <p className="mb-3 text-[0.875rem] leading-relaxed text-soft">
            Esta factura está en borrador: la mercancía todavía no existe en el inventario.
          </p>
          <ConfirmButton purchaseId={purchase.id} />
        </Card>
      ) : null}

      <SectionLabel className="mb-2.5">Renglones</SectionLabel>
      <Card className="mb-4 overflow-hidden">
        <RowList>
          {purchase.items.map((item) => (
            <Link
              key={item.id}
              href={`/productos/${item.product.id}`}
              className="press block px-5 py-3.5 hover:bg-raised"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[0.9375rem] font-medium">
                  {item.product.name}
                </span>
                <span className="shrink-0 text-[0.9375rem] font-semibold tnum">
                  {formatMoney(num(item.lineTotal))}
                </span>
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-faint tnum">
                {num(item.qtyPresentation)} × {item.presentation?.name ?? "unidad"} ={" "}
                {formatQty(num(item.qtyBase), item.product.baseUnit, { exact: true })}
                {" · "}
                {formatMoney(num(item.unitCost), true)} c/u
                {item.expiresAt ? ` · vence ${formatDate(item.expiresAt)}` : ""}
              </p>
            </Link>
          ))}
        </RowList>
      </Card>

      <Card className="mb-4 space-y-2.5 px-5 py-4">
        <Row label="Subtotal" value={formatMoney(num(purchase.subtotal))} />
        <Row label="Impuestos" value={formatMoney(num(purchase.tax))} />
        <div className="flex items-center justify-between border-t border-line pt-2.5 text-[1.0625rem]">
          <span className="font-medium">Total</span>
          <span className="font-semibold tnum">{formatMoney(num(purchase.total))}</span>
        </div>
      </Card>

      {purchase.attachmentUrl ? (
        <a
          href={purchase.attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="press mb-4 flex items-center gap-3 rounded-[18px] bg-surface px-4 py-3.5 hover:bg-raised"
        >
          <Paperclip className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
            {purchase.attachmentName ?? "Ver factura"}
          </span>
        </a>
      ) : null}

      <Card className="space-y-2.5 px-5 py-4">
        <Row label="Estado" value={<Badge tone={draft ? "warn" : "ok"}>{draft ? "Borrador" : "Confirmada"}</Badge>} />
        <Row label="Registró" value={purchase.createdBy.name} />
        {purchase.receivedAt ? (
          <Row label="Ingresó" value={formatDate(purchase.receivedAt)} />
        ) : null}
        {purchase.supplier.taxId ? <Row label="NIT" value={purchase.supplier.taxId} /> : null}
        {purchase.notes ? <Row label="Notas" value={purchase.notes} /> : null}
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[0.9375rem]">
      <span className="shrink-0 text-soft">{label}</span>
      <span className="min-w-0 text-right font-medium tnum">{value}</span>
    </div>
  );
}
