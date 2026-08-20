"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { parseNumber, UNITS, UNIT_OPTIONS } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProduct } from "@/app/(app)/productos/actions";

export type ProductDraft = {
  id?: string;
  name: string;
  categoryId: string;
  baseUnit: BaseUnit;
  costPrice: number;
  salePrice: number;
  minQty: number;
  perishable: boolean;
  active: boolean;
};

export function ProductForm({
  draft,
  categories,
  onDone,
  submitLabel,
}: {
  draft: ProductDraft;
  categories: { id: string; name: string }[];
  onDone?: (id: string) => void;
  submitLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(draft);
  const [cost, setCost] = useState(String(draft.costPrice || ""));
  const [sale, setSale] = useState(String(draft.salePrice || ""));
  const [min, setMin] = useState(String(draft.minQty || ""));

  const unit = UNITS[form.baseUnit];
  const editing = Boolean(draft.id);

  const submit = () => {
    startTransition(async () => {
      const result = await saveProduct({
        ...form,
        costPrice: parseNumber(cost) ?? 0,
        salePrice: parseNumber(sale) ?? 0,
        minQty: parseNumber(min) ?? 0,
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", editing ? "Producto actualizado." : "Producto creado.");
      router.refresh();
      onDone?.(result.id);
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Nombre" htmlFor="nombre">
        <Input
          id="nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="p. ej. Detergente en polvo"
        />
      </Field>

      <Field label="Categoría" htmlFor="categoria">
        <Select
          id="categoria"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        >
          <option value="">Elegí una</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Unidad base"
        htmlFor="unidad"
        hint={
          editing
            ? "No se puede cambiar: todas las existencias ya están guardadas en esta unidad."
            : "En qué se mide. Todo el inventario de este producto vivirá en esta unidad."
        }
      >
        <Select
          id="unidad"
          disabled={editing}
          value={form.baseUnit}
          onChange={(e) => setForm({ ...form, baseUnit: e.target.value as BaseUnit })}
        >
          {UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={`Costo por ${unit.label}`}
          htmlFor="costo"
          hint={editing ? "Se recalcula solo con cada compra." : undefined}
        >
          <Input
            id="costo"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0"
          />
        </Field>

        <Field label={`Venta por ${unit.label}`} htmlFor="venta" hint="0 si no se vende.">
          <Input
            id="venta"
            inputMode="decimal"
            value={sale}
            onChange={(e) => setSale(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>

      {(parseNumber(sale) ?? 0) > 0 ? (
        <p className="px-1 text-[0.8125rem] text-soft">
          Utilidad bruta{" "}
          <span className="font-semibold text-ink tnum">
            {formatMoney((parseNumber(sale) ?? 0) - (parseNumber(cost) ?? 0), true)}
          </span>{" "}
          por {unit.label}.
        </p>
      ) : null}

      <Field
        label="Stock mínimo"
        htmlFor="minimo"
        hint={`En ${unit.plural}. Por debajo de esto, el sistema avisa.`}
      >
        <Input
          id="minimo"
          inputMode="decimal"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="0"
        />
      </Field>

      <Toggle
        label="Es perecedero"
        hint="Se le controla fecha de vencimiento por lote."
        value={form.perishable}
        onChange={(perishable) => setForm({ ...form, perishable })}
      />

      {editing ? (
        <Toggle
          label="Activo"
          hint="Los inactivos desaparecen de los formularios pero conservan su historial."
          value={form.active}
          onChange={(active) => setForm({ ...form, active })}
        />
      ) : null}

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || !form.name.trim() || !form.categoryId}
        onClick={submit}
      >
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </div>
  );
}

export function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="press flex w-full items-center gap-3 rounded-[16px] bg-raised px-4 py-3.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-medium">{label}</span>
        {hint ? <span className="block text-[0.8125rem] text-faint">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          value ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-4 rounded-full bg-canvas transition-[left]",
            value ? "left-5" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

/** Botón + hoja para editar un producto existente sin salir de su ficha. */
export function ProductSheet({
  open,
  onClose,
  draft,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  draft: ProductDraft;
  categories: { id: string; name: string }[];
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Editar producto">
      <ProductForm
        draft={draft}
        categories={categories}
        submitLabel="Guardar cambios"
        onDone={onClose}
      />
    </Sheet>
  );
}
