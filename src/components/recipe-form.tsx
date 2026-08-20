"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { formatQty, parseNumber, toBase, UNITS } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteRecipe, saveRecipe } from "@/app/(app)/cocina/actions";

export type RecipeProduct = {
  id: string;
  name: string;
  category: string;
  color: string;
  baseUnit: BaseUnit;
  presentations: { id: string; name: string; factor: number }[];
};

export type RecipeDraft = {
  id?: string;
  name: string;
  yieldPortions: string;
  notes: string;
  items: { productId: string; qty: string; presentationId: string }[];
};

export function RecipeForm({
  draft: initial,
  products,
  submitLabel,
}: {
  draft: RecipeDraft;
  products: RecipeProduct[];
  submitLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(initial);
  const [picker, setPicker] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const portions = parseNumber(draft.yieldPortions) ?? 0;

  const baseOf = (item: RecipeDraft["items"][number]) => {
    const product = productById.get(item.productId);
    const presentation = product?.presentations.find((p) => p.id === item.presentationId);
    return toBase(parseNumber(item.qty) ?? 0, presentation?.factor ?? 1);
  };

  const add = (productId: string) => {
    const product = productById.get(productId)!;
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId,
          qty: "",
          presentationId: product.presentations[0]?.id ?? "",
        },
      ],
    }));
    setPicker(false);
  };

  const patch = (index: number, values: Partial<RecipeDraft["items"][number]>) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...values } : item)),
    }));

  const submit = () => {
    startTransition(async () => {
      const result = await saveRecipe({
        id: draft.id,
        name: draft.name,
        yieldPortions: portions,
        notes: draft.notes || null,
        active: true,
        items: draft.items.map((item) => ({
          productId: item.productId,
          qtyBase: baseOf(item),
        })),
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", draft.id ? "Receta actualizada." : "Receta creada.");
      router.push(`/cocina/${result.id}`);
      router.refresh();
    });
  };

  const remove = () => {
    if (!draft.id) return;
    startTransition(async () => {
      const result = await deleteRecipe(draft.id!);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Receta eliminada.");
      router.push("/cocina");
      router.refresh();
    });
  };

  const ready =
    draft.name.trim().length > 1 &&
    portions > 0 &&
    draft.items.length > 0 &&
    draft.items.every((item) => baseOf(item) > 0);

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-card bg-surface p-4">
        <Field label="Nombre" htmlFor="receta-nombre">
          <Input
            id="receta-nombre"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="p. ej. Pan de desayuno"
          />
        </Field>

        <Field
          label="¿Cuántas porciones rinde?"
          htmlFor="receta-rinde"
          hint="Las cantidades de abajo son para esta cantidad de porciones."
        >
          <Input
            id="receta-rinde"
            inputMode="decimal"
            value={draft.yieldPortions}
            onChange={(e) => setDraft({ ...draft, yieldPortions: e.target.value })}
            placeholder="12"
          />
        </Field>
      </div>

      <div className="rounded-card bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[0.9375rem] font-semibold">Ingredientes</h2>
          <Button size="sm" variant="quiet" onClick={() => setPicker(true)}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>

        {draft.items.length ? (
          <div className="space-y-2">
            {draft.items.map((item, index) => {
              const product = productById.get(item.productId);
              if (!product) return null;
              const base = baseOf(item);
              const perPortion = portions > 0 ? base / portions : 0;

              return (
                <div key={`${item.productId}-${index}`} className="rounded-[18px] bg-raised p-3">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: categoryColor(product.color) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium">
                      {product.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Quitar ${product.name}`}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter((_, i) => i !== index),
                        })
                      }
                      className="press grid size-7 shrink-0 place-items-center rounded-[9px] text-faint hover:bg-hover hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      inputMode="decimal"
                      value={item.qty}
                      onChange={(e) => patch(index, { qty: e.target.value })}
                      placeholder="0"
                      aria-label={`Cantidad de ${product.name}`}
                      className="h-11 flex-1 text-[0.875rem]"
                    />
                    {product.presentations.length > 1 ? (
                      <div data-scroll-x className="flex gap-1.5 overflow-x-auto">
                        {product.presentations.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => patch(index, { presentationId: option.id })}
                            className={cn(
                              "press shrink-0 rounded-[11px] px-3 text-[0.8125rem] font-medium transition-colors",
                              item.presentationId === option.id
                                ? "bg-ink text-canvas"
                                : "bg-surface text-soft",
                            )}
                          >
                            {option.factor === 1 ? UNITS[product.baseUnit].symbol : option.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="grid h-11 shrink-0 place-items-center px-3 text-[0.875rem] text-faint">
                        {UNITS[product.baseUnit].symbol}
                      </span>
                    )}
                  </div>

                  {base > 0 && portions > 0 ? (
                    <p className="mt-2.5 text-[0.8125rem] text-soft tnum">
                      {formatQty(base, product.baseUnit, { exact: true })} en total ·{" "}
                      <span className="font-semibold text-ink">
                        {formatQty(perPortion, product.baseUnit, { exact: true })}
                      </span>{" "}
                      por porción
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
            Agregá lo que lleva la receta
          </button>
        )}
      </div>

      <Field label="Notas">
        <Textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Preparación, temperatura, lo que haga falta"
          rows={3}
        />
      </Field>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || !ready}
        onClick={submit}
      >
        {pending ? "Guardando…" : submitLabel}
      </Button>

      {draft.id ? (
        <Button variant="danger" size="lg" className="w-full" disabled={pending} onClick={remove}>
          <Trash2 className="size-4" />
          Eliminar receta
        </Button>
      ) : null}

      <Sheet open={picker} onClose={() => setPicker(false)} title="¿Qué lleva?" size="lg">
        <IngredientPicker
          products={products}
          chosen={new Set(draft.items.map((i) => i.productId))}
          onPick={add}
        />
      </Sheet>
    </div>
  );
}

function IngredientPicker({
  products,
  chosen,
  onPick,
}: {
  products: RecipeProduct[];
  chosen: Set<string>;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ingrediente"
          className="pl-11"
          type="search"
        />
      </div>

      <div className="space-y-1">
        {results.map((product) => (
          <button
            key={product.id}
            type="button"
            disabled={chosen.has(product.id)}
            onClick={() => onPick(product.id)}
            className={cn(
              "press flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left",
              chosen.has(product.id) ? "opacity-40" : "hover:bg-raised",
            )}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: categoryColor(product.color) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem]">{product.name}</span>
              <span className="block text-[0.8125rem] text-faint">{product.category}</span>
            </span>
            {chosen.has(product.id) ? (
              <span className="shrink-0 text-[0.8125rem] text-faint">ya está</span>
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
}
