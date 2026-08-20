"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { formatQty, parseNumber, toBase } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import { FileUp, Paperclip, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { createPurchase } from "../actions";

type Presentation = { id: string; name: string; factor: number };
type Product = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  perishable: boolean;
  presentations: Presentation[];
};

type Line = {
  key: string;
  productId: string;
  presentationId: string;
  qty: string;
  lineTotal: string;
  expiresAt: string;
};

export function PurchaseForm({
  suppliers,
  locations,
  products,
  defaultLocationId,
}: {
  suppliers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  products: Product[];
  defaultLocationId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const subtotal = lines.reduce((sum, line) => sum + (parseNumber(line.lineTotal) ?? 0), 0);
  const total = subtotal + (parseNumber(tax) ?? 0);

  const addLine = (productId: string) => {
    const product = productById.get(productId)!;
    const preferred =
      product.presentations.find((p) => p.factor > 1) ?? product.presentations[0];
    setLines((current) => [
      ...current,
      {
        key: `${productId}-${current.length}-${Date.now()}`,
        productId,
        presentationId: preferred?.id ?? "",
        qty: "",
        lineTotal: "",
        expiresAt: "",
      },
    ]);
    setPicker(false);
  };

  const patch = (key: string, values: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...values } : l)));

  const submit = (confirm: boolean) => {
    const payload = {
      supplierId,
      number,
      locationId,
      issuedAt,
      tax: parseNumber(tax) ?? 0,
      notes: notes || null,
      confirm,
      lines: lines.map((line) => {
        const product = productById.get(line.productId)!;
        const presentation = product.presentations.find((p) => p.id === line.presentationId);
        return {
          productId: line.productId,
          presentationId: presentation?.id ?? null,
          qtyPresentation: parseNumber(line.qty) ?? 0,
          factor: presentation?.factor ?? 1,
          lineTotal: parseNumber(line.lineTotal) ?? 0,
          expiresAt: line.expiresAt || null,
        };
      }),
    };

    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    if (attachment) formData.set("factura", attachment);

    startTransition(async () => {
      const result = await createPurchase(formData);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", confirm ? "Factura registrada y mercancía ingresada." : "Borrador guardado.");
      router.push(`/compras/${result.id}`);
      router.refresh();
    });
  };

  const ready = supplierId && number.trim() && locationId && lines.length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-card bg-surface p-4">
        <Field label="Proveedor" htmlFor="proveedor">
          <Select
            id="proveedor"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Elegí uno</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="N° de factura" htmlFor="numero">
            <Input
              id="numero"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="FE-1042"
              autoComplete="off"
            />
          </Field>
          <Field label="Fecha" htmlFor="fecha">
            <Input
              id="fecha"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Entra a" htmlFor="destino-compra">
          <Select
            id="destino-compra"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-card bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[0.9375rem] font-semibold">Renglones</h2>
          <Button size="sm" variant="quiet" onClick={() => setPicker(true)}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>

        {lines.length ? (
          <div className="space-y-2">
            {lines.map((line) => {
              const product = productById.get(line.productId)!;
              const presentation = product.presentations.find((p) => p.id === line.presentationId);
              const qty = parseNumber(line.qty) ?? 0;
              const base = toBase(qty, presentation?.factor ?? 1);
              const lineTotal = parseNumber(line.lineTotal) ?? 0;

              return (
                <div key={line.key} className="rounded-[18px] bg-raised p-3">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
                      {product.name}
                    </p>
                    <button
                      type="button"
                      aria-label="Quitar renglón"
                      onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                      className="press grid size-7 shrink-0 place-items-center rounded-[9px] text-faint hover:bg-hover hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={line.presentationId}
                      onChange={(e) => patch(line.key, { presentationId: e.target.value })}
                      className="h-11 text-[0.875rem]"
                      aria-label="Presentación"
                    >
                      {product.presentations.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      inputMode="decimal"
                      value={line.qty}
                      onChange={(e) => patch(line.key, { qty: e.target.value })}
                      placeholder="Cantidad"
                      className="h-11 text-[0.875rem]"
                      aria-label="Cantidad"
                    />
                    <Input
                      inputMode="decimal"
                      value={line.lineTotal}
                      onChange={(e) => patch(line.key, { lineTotal: e.target.value })}
                      placeholder="Total del renglón"
                      className="col-span-2 h-11 text-[0.875rem]"
                      aria-label="Total del renglón"
                    />
                    {product.perishable ? (
                      <Input
                        type="date"
                        value={line.expiresAt}
                        onChange={(e) => patch(line.key, { expiresAt: e.target.value })}
                        className="col-span-2 h-11 text-[0.875rem]"
                        aria-label="Vence"
                      />
                    ) : null}
                  </div>

                  {base > 0 ? (
                    <p className="mt-2.5 text-[0.8125rem] text-soft tnum">
                      Ingresan{" "}
                      <span className="font-semibold text-ink">
                        {formatQty(base, product.baseUnit, { exact: true })}
                      </span>
                      {lineTotal > 0
                        ? ` · ${formatMoney(lineTotal / base, true)} por ${unitWord(product.baseUnit)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="press w-full rounded-[16px] bg-sunken py-7 text-[0.875rem] text-faint hover:text-soft"
          >
            Agregá lo que trae la factura
          </button>
        )}
      </div>

      <div className="space-y-3 rounded-card bg-surface p-4">
        <div className="flex items-center justify-between text-[0.9375rem]">
          <span className="text-soft">Subtotal</span>
          <span className="font-semibold tnum">{formatMoney(subtotal)}</span>
        </div>

        <Field label="Impuestos" htmlFor="impuestos">
          <Input
            id="impuestos"
            inputMode="decimal"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            placeholder="0"
          />
        </Field>

        <div className="flex items-center justify-between border-t border-line pt-3 text-[1.0625rem]">
          <span className="font-medium">Total</span>
          <span className="font-semibold tnum">{formatMoney(total)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={cn(
          "press flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left",
          attachment ? "bg-accent-soft text-accent" : "bg-surface hover:bg-raised",
        )}
      >
        {attachment ? (
          <Paperclip className="size-[18px] shrink-0" strokeWidth={1.75} />
        ) : (
          <FileUp className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium">
            {attachment ? attachment.name : "Adjuntar la factura"}
          </span>
          <span className="block text-[0.8125rem] opacity-70">
            {attachment ? "Tocá para cambiarla" : "PDF o foto, hasta 8 MB"}
          </span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
      />

      <Field label="Notas">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
          rows={2}
        />
      </Field>

      <div className="space-y-2">
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={pending || !ready}
          onClick={() => submit(true)}
        >
          {pending ? "Guardando…" : "Registrar y dar entrada"}
        </Button>
        <Button
          variant="quiet"
          size="lg"
          className="w-full"
          disabled={pending || !ready}
          onClick={() => submit(false)}
        >
          Guardar como borrador
        </Button>
      </div>

      <p className="px-1 text-center text-[0.8125rem] text-faint">
        Al dar entrada, el costo promedio de cada producto se recalcula con esta factura.
      </p>

      <Sheet open={picker} onClose={() => setPicker(false)} title="¿Qué trae la factura?" size="lg">
        <ProductList products={products} onPick={addLine} />
      </Sheet>
    </div>
  );
}

function ProductList({
  products,
  onPick,
}: {
  products: Product[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar producto"
        type="search"
        className="mb-3"
      />
      <div className="space-y-1">
        {results.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onPick(product.id)}
            className="press flex w-full items-center justify-between gap-3 rounded-[16px] px-3 py-3 text-left hover:bg-raised"
          >
            <span className="min-w-0 truncate text-[0.9375rem]">{product.name}</span>
            <span className="shrink-0 text-[0.8125rem] text-faint">
              {product.presentations.length} presentaciones
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function unitWord(unit: BaseUnit) {
  return unit === "GRAMO" ? "g" : unit === "MILILITRO" ? "ml" : "unidad";
}
