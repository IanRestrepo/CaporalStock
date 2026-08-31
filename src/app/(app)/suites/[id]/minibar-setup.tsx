"use client";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { parseNumber, UNITS } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import { Copy, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyMinibarPar, setMinibarPar } from "../actions";

export type CatalogItem = {
  productId: string;
  name: string;
  category: string;
  color: string;
  baseUnit: BaseUnit;
  parQty: number;
};

/**
 * Configuración del minibar: qué debe haber y cuánto.
 * Es lo que convierte una nevera vacía en algo que el ama de llaves puede cerrar.
 */
export function MinibarSetup({
  locationId,
  catalog,
  otherSuites,
  label,
}: {
  locationId: string;
  catalog: CatalogItem[];
  otherSuites: { locationId: string; number: string }[];
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [pars, setPars] = useState<Record<string, string>>(() =>
    Object.fromEntries(catalog.map((i) => [i.productId, i.parQty ? String(i.parQty) : ""])),
  );

  const chosen = catalog.filter((i) => (parseNumber(pars[i.productId] ?? "") ?? 0) > 0).length;

  const bump = (productId: string, delta: number) =>
    setPars((current) => {
      const value = Math.max(0, (parseNumber(current[productId] ?? "") ?? 0) + delta);
      return { ...current, [productId]: value ? String(value) : "" };
    });

  const save = () => {
    startTransition(async () => {
      const result = await setMinibarPar({
        locationId,
        items: catalog.map((item) => ({
          productId: item.productId,
          parQty: parseNumber(pars[item.productId] ?? "") ?? 0,
        })),
      });
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", `Minibar configurado con ${chosen} referencias.`);
      setOpen(false);
      router.refresh();
    });
  };

  const copy = () => {
    startTransition(async () => {
      const result = await copyMinibarPar(copyFrom, locationId);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Configuración copiada.");
      setOpen(false);
      router.refresh();
    });
  };

  const grouped = catalog.reduce<Record<string, CatalogItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      {label ? (
        <Button variant="accent" size="lg" className="w-full" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" />
          {label}
        </Button>
      ) : (
        <Button
          variant="quiet"
          size="icon"
          aria-label="Configurar el minibar"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal className="size-[18px]" />
        </Button>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="¿Qué debe haber en este minibar?"
        description="La cantidad es el nivel par: a eso se repone en cada cierre."
        size="lg"
        footer={
          <Button variant="accent" size="lg" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : `Guardar ${chosen} referencia${chosen === 1 ? "" : "s"}`}
          </Button>
        }
      >
        {otherSuites.length ? (
          <div className="mb-5 rounded-[18px] bg-raised p-3.5">
            <p className="mb-2.5 text-[0.8125rem] text-soft">
              O copialo de una suite que ya esté montada.
            </p>
            <div className="flex gap-2">
              <Select
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className="h-11 flex-1 text-[0.875rem]"
                aria-label="Copiar desde"
              >
                <option value="">Elige una suite</option>
                {otherSuites.map((suite) => (
                  <option key={suite.locationId} value={suite.locationId}>
                    Suite {suite.number}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                className="h-11 shrink-0"
                disabled={!copyFrom || pending}
                onClick={copy}
              >
                <Copy className="size-4" />
                Copiar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="mb-2 px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
                {category}
              </p>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const value = parseNumber(pars[item.productId] ?? "") ?? 0;
                  return (
                    <div
                      key={item.productId}
                      className={cn(
                        "flex items-center gap-3 rounded-[16px] px-3 py-2.5 transition-colors",
                        value > 0 ? "bg-accent-soft" : "bg-raised",
                      )}
                    >
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: categoryColor(item.color) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem]">{item.name}</span>
                        <span className="block text-[0.8125rem] text-faint">
                          en {UNITS[item.baseUnit].plural}
                        </span>
                      </span>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Menos ${item.name}`}
                          disabled={value === 0}
                          onClick={() => bump(item.productId, -1)}
                          className="press grid size-9 place-items-center rounded-[11px] bg-surface text-soft disabled:opacity-30"
                        >
                          <Minus className="size-4" />
                        </button>
                        <Input
                          inputMode="decimal"
                          value={pars[item.productId] ?? ""}
                          onChange={(e) =>
                            setPars({ ...pars, [item.productId]: e.target.value })
                          }
                          placeholder="0"
                          aria-label={`Nivel par de ${item.name}`}
                          className="h-9 w-14 px-0 text-center text-[0.9375rem] font-semibold"
                        />
                        <button
                          type="button"
                          aria-label={`Más ${item.name}`}
                          onClick={() => bump(item.productId, 1)}
                          className="press grid size-9 place-items-center rounded-[11px] bg-surface text-soft"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 px-1 text-[0.8125rem] text-faint">
          Poné 0 para sacar un producto del minibar. Lo que ya esté adentro no se borra.
        </p>
      </Sheet>
    </>
  );
}
