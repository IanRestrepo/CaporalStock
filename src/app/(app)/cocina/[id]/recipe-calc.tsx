"use client";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { formatQty, round4 } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { produceRecipe } from "../actions";

export type Ingredient = {
  productId: string;
  name: string;
  color: string;
  baseUnit: BaseUnit;
  perYield: number;
  available: number;
};

/**
 * La calculadora de porciones. Se mueve el número de porciones y toda la lista
 * se recalcula: es exactamente la pregunta "¿cuánto necesito para 30?".
 */
export function RecipeCalc({
  recipeId,
  yieldPortions,
  ingredients,
  locations,
  defaultLocationId,
}: {
  recipeId: string;
  yieldPortions: number;
  ingredients: Ingredient[];
  locations: { id: string; name: string }[];
  defaultLocationId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [portions, setPortions] = useState(yieldPortions);
  const [source, setSource] = useState(defaultLocationId);
  const [note, setNote] = useState("");

  const factor = portions / yieldPortions;
  const rows = ingredients.map((item) => {
    const needed = round4(item.perYield * factor);
    return { ...item, needed, short: needed > item.available };
  });
  const missing = rows.filter((r) => r.short);

  const produce = () => {
    startTransition(async () => {
      const result = await produceRecipe({
        recipeId,
        locationId: source,
        portions,
        note: note || null,
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", `Producción registrada: ${portions} porciones.`);
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-card bg-surface p-5">
        <p className="mb-4 text-[0.8125rem] text-faint">¿Cuántas porciones vas a sacar?</p>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            aria-label="Menos porciones"
            onClick={() => setPortions((p) => Math.max(1, p - 1))}
            className="press grid size-12 shrink-0 place-items-center rounded-[15px] bg-raised text-soft"
          >
            <Minus className="size-5" />
          </button>

          <input
            inputMode="numeric"
            value={portions}
            onChange={(e) => setPortions(Math.max(1, Number(e.target.value) || 1))}
            className="min-w-0 flex-1 bg-transparent text-center text-[2.75rem] leading-none font-semibold tracking-[-0.03em] outline-none tnum"
            aria-label="Porciones"
          />

          <button
            type="button"
            aria-label="Más porciones"
            onClick={() => setPortions((p) => p + 1)}
            className="press grid size-12 shrink-0 place-items-center rounded-[15px] bg-raised text-soft"
          >
            <Plus className="size-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {[yieldPortions, yieldPortions * 2, yieldPortions * 4, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPortions(preset)}
              className={cn(
                "press rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors tnum",
                portions === preset ? "bg-ink text-canvas" : "bg-raised text-soft hover:text-ink",
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2.5 px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
          Necesitás
        </p>
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.productId}
              className="flex items-center gap-3 rounded-[18px] bg-surface px-4 py-3"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: categoryColor(row.color) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem]">{row.name}</span>
                <span
                  className={cn(
                    "block text-[0.8125rem] tnum",
                    row.short ? "text-danger" : "text-faint",
                  )}
                >
                  hay {formatQty(row.available, row.baseUnit)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-[1.0625rem] font-semibold tnum",
                  row.short && "text-danger",
                )}
              >
                {formatQty(row.needed, row.baseUnit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Field label="Los ingredientes salen de" htmlFor="origen-cocina">
        <Select id="origen-cocina" value={source} onChange={(e) => setSource(e.target.value)}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nota">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opcional"
          rows={2}
        />
      </Field>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || missing.length > 0}
        onClick={produce}
      >
        {pending
          ? "Registrando…"
          : missing.length
            ? `Falta ${missing[0].name.toLowerCase()}`
            : `Registrar producción de ${portions}`}
      </Button>

      <p className="px-1 text-center text-[0.8125rem] text-faint">
        Al registrar, los ingredientes se descuentan del inventario.
      </p>
    </div>
  );
}
