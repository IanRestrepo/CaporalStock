"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { formatQty } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeMinibar } from "../actions";

export type MinibarItem = {
  productId: string;
  name: string;
  color: string;
  baseUnit: BaseUnit;
  quantity: number;
  par: number;
};

/**
 * Cierre de minibar. Se cuenta lo consumido, no lo que queda: es lo que el ama
 * de llaves ve al abrir la nevera y evita restar de cabeza.
 */
export function MinibarPanel({
  locationId,
  roomId,
  items,
}: {
  locationId: string;
  roomId: string;
  items: MinibarItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState("");

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const missing = items.reduce((sum, i) => sum + Math.max(0, i.par - i.quantity), 0);

  const bump = (item: MinibarItem, delta: number) => {
    setCounts((current) => {
      const next = Math.max(0, Math.min(item.quantity, (current[item.productId] ?? 0) + delta));
      return { ...current, [item.productId]: next };
    });
  };

  const submit = () => {
    startTransition(async () => {
      const result = await closeMinibar({
        locationId,
        roomId,
        restock,
        note: note || null,
        consumed: Object.entries(counts)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => ({ productId, quantity })),
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }

      setCounts({});
      setNote("");
      toast.push(
        "ok",
        result.restocked > 0
          ? `Listo. Se repusieron ${result.restocked} referencia${result.restocked > 1 ? "s" : ""}.`
          : "Minibar cerrado.",
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {items.map((item) => {
          const consumed = counts[item.productId] ?? 0;
          const short = item.quantity < item.par;
          return (
            <div
              key={item.productId}
              className="flex items-center gap-3 rounded-[18px] bg-raised px-3 py-2.5"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: categoryColor(item.color) }}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.875rem]">{item.name}</p>
                <p
                  className={cn(
                    "text-[0.8125rem] tnum",
                    short ? "text-warn" : "text-faint",
                  )}
                >
                  {/* la unidad se dice una sola vez: "3 de 4 u", no "3 u de 4 u" */}
                  {formatQty(item.quantity, item.baseUnit, { bare: true })} de{" "}
                  {formatQty(item.par, item.baseUnit)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`Quitar uno de ${item.name}`}
                  disabled={consumed === 0}
                  onClick={() => bump(item, -1)}
                  className="press grid size-9 place-items-center rounded-[11px] bg-surface text-soft disabled:opacity-30"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className={cn(
                    "w-7 text-center text-[1.0625rem] font-semibold tnum",
                    consumed > 0 ? "text-ink" : "text-faint",
                  )}
                >
                  {consumed}
                </span>
                <button
                  type="button"
                  aria-label={`Agregar uno de ${item.name}`}
                  disabled={consumed >= item.quantity}
                  onClick={() => bump(item, 1)}
                  className="press grid size-9 place-items-center rounded-[11px] bg-surface text-soft disabled:opacity-30"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setRestock((v) => !v)}
        className="press flex w-full items-center gap-3 rounded-[18px] bg-raised px-4 py-3.5 text-left"
      >
        <RotateCcw className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-medium">Reponer a nivel par</span>
          <span className="block text-[0.8125rem] text-faint tnum">
            {missing + total > 0
              ? `Faltarían ${missing + total} unidades desde bodega`
              : "El minibar ya está completo"}
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-10 shrink-0 rounded-full transition-colors",
            restock ? "bg-accent" : "bg-line-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-1 size-4 rounded-full bg-canvas transition-[left]",
              restock ? "left-5" : "left-1",
            )}
          />
        </span>
      </button>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota para el turno siguiente (opcional)"
        rows={2}
      />

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || (total === 0 && !restock)}
        onClick={submit}
      >
        {pending
          ? "Guardando…"
          : total > 0
            ? `Registrar ${total} consumo${total > 1 ? "s" : ""}${restock ? " y reponer" : ""}`
            : "Reponer minibar"}
      </Button>
    </div>
  );
}
