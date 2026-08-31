"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { formatQty, parseNumber, UNITS } from "@/lib/units";
import type { BaseUnit, LocationKind } from "@/generated/prisma/enums";
import { Check, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { applyCount } from "./actions";

export type CountProduct = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  section: string;
  category: string;
  color: string;
};

/**
 * Hoja de conteo.
 *
 * Está pensada para recorrer un estante con el teléfono en una mano: se escribe
 * la cantidad, se aprieta "siguiente" y el foco salta solo al producto de abajo.
 * Nunca hay que buscar un botón entre número y número.
 *
 * Un campo vacío significa "no lo conté", no "hay cero". Es la distinción que
 * evita inventar mermas por los productos que nadie miró, y por eso el cero hay
 * que escribirlo a propósito.
 */
export function CountSheet({
  locations,
  products,
  onHand,
}: {
  locations: { id: string; name: string; kind: LocationKind }[];
  products: CountProduct[];
  onHand: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [applying, startApply] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const [locationId, setLocationId] = useState(
    locations.find((l) => l.kind === "PRINCIPAL")?.id ?? locations[0]?.id ?? "",
  );
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");

  const stockOf = (productId: string) => onHand[`${productId}:${locationId}`] ?? 0;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? products.filter((p) => p.name.toLowerCase().includes(needle))
      : products;
  }, [products, query]);

  /**
   * Dos niveles: el área donde se cuenta y, dentro, el tipo de producto.
   * Un bar con treinta y cinco renglones seguidos es una pila; separado en
   * licores, vinos, cervezas y gaseosas es el orden en que están los estantes.
   * El índice plano se conserva para que el foco siga saltando en orden.
   */
  const groups = useMemo(() => {
    const map = new Map<string, Map<string, { product: CountProduct; index: number }[]>>();
    visible.forEach((product, index) => {
      const bySection = map.get(product.section) ?? new Map();
      const rows = bySection.get(product.category) ?? [];
      rows.push({ product, index });
      bySection.set(product.category, rows);
      map.set(product.section, bySection);
    });
    return [...map.entries()].map(
      ([section, bySection]) => [section, [...bySection.entries()]] as const,
    );
  }, [visible]);

  const ready = useMemo(
    () =>
      products
        .map((p) => ({ product: p, value: parseNumber(counted[p.id] ?? "") }))
        .filter((row): row is { product: CountProduct; value: number } => row.value !== null),
    [products, counted],
  );

  const conDiferencia = ready.filter((r) => r.value !== stockOf(r.product.id)).length;

  const focusNext = (index: number) => {
    for (let i = index + 1; i < inputs.current.length; i++) {
      const next = inputs.current[i];
      if (next) {
        next.focus();
        next.select();
        return;
      }
    }
    inputs.current[index]?.blur();
  };

  const apply = () => {
    startApply(async () => {
      const result = await applyCount({
        locationId,
        note: note || null,
        counts: ready.map((r) => ({ productId: r.product.id, countedQty: r.value })),
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }

      toast.push(
        "ok",
        result.sobrantes + result.faltantes === 0
          ? "Todo coincidía con el sistema."
          : `Conteo aplicado: ${result.sobrantes} sobrantes y ${result.faltantes} faltantes.`,
      );
      setCounted({});
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 pb-28">
      <Field label="¿Qué bodega estás contando?" htmlFor="bodega-conteo">
        <Select
          id="bodega-conteo"
          value={locationId}
          onChange={(e) => {
            setLocationId(e.target.value);
            setCounted({});
          }}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Saltar a un producto"
          className="pl-11"
          type="search"
          autoComplete="off"
        />
      </div>

      <div className="space-y-7">
        {groups.map(([section, categories]) => (
          <section key={section}>
            <p className="mb-3 px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
              {section}
            </p>

            <div className="space-y-4">
              {categories.map(([category, rows]) => (
                <div key={category}>
                  <p className="mb-1.5 flex items-center gap-2 px-1 text-[0.8125rem] text-soft">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: categoryColor(rows[0].product.color) }}
                    />
                    {category}
                    <span className="text-faint tnum">{rows.length}</span>
                  </p>

                  <div className="overflow-hidden rounded-card bg-surface">
                    <div className="divide-y divide-line">
                      {rows.map(({ product, index }) => {
                        const raw = counted[product.id] ?? "";
                        const value = parseNumber(raw);
                        const system = stockOf(product.id);
                        const delta = value !== null ? value - system : null;

                        return (
                          <div key={product.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[0.9375rem] leading-tight">
                                {product.name}
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 truncate text-[0.8125rem] tnum",
                                  delta === null
                                    ? "text-faint"
                                    : delta === 0
                                      ? "text-ok"
                                      : delta > 0
                                        ? "text-info"
                                        : "text-danger",
                                )}
                              >
                                {delta === null ? (
                                  `sistema ${formatQty(system, product.baseUnit)}`
                                ) : delta === 0 ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="size-3" strokeWidth={3} />
                                    coincide
                                  </span>
                                ) : (
                                  `${delta > 0 ? "sobran" : "faltan"} ${formatQty(Math.abs(delta), product.baseUnit)}`
                                )}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <input
                                ref={(el) => {
                                  inputs.current[index] = el;
                                }}
                                inputMode="decimal"
                                enterKeyHint="next"
                                autoComplete="off"
                                value={raw}
                                aria-label={`Cantidad contada de ${product.name}`}
                                onChange={(e) =>
                                  setCounted((c) => ({ ...c, [product.id]: e.target.value }))
                                }
                                onFocus={(e) => e.currentTarget.select()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    focusNext(index);
                                  }
                                }}
                                placeholder="—"
                                className={cn(
                                  "h-11 w-20 rounded-[12px] bg-sunken px-2 text-center text-[1.0625rem] font-semibold tnum",
                                  "outline-none transition-colors placeholder:font-normal placeholder:text-faint",
                                  "focus:bg-raised focus:ring-2 focus:ring-accent-line",
                                  "[html[data-theme=light]_&]:bg-raised",
                                  value !== null && "text-ink",
                                )}
                              />
                              <span className="w-6 shrink-0 text-[0.8125rem] text-faint">
                                {UNITS[product.baseUnit].symbol}
                              </span>
                              {raw ? (
                                <button
                                  type="button"
                                  aria-label={`Borrar el conteo de ${product.name}`}
                                  onClick={() =>
                                    setCounted((c) => {
                                      const next = { ...c };
                                      delete next[product.id];
                                      return next;
                                    })
                                  }
                                  className="press grid size-7 place-items-center rounded-[9px] text-faint hover:bg-raised hover:text-ink"
                                >
                                  <X className="size-3.5" />
                                </button>
                              ) : (
                                <span className="size-7" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-[0.875rem] text-faint">
          Ningún producto dice “{query}”.
        </p>
      ) : null}

      <Field label="Nota del conteo">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quién contó, en qué condiciones (opcional)"
          rows={2}
        />
      </Field>

      <p className="px-1 text-center text-[0.8125rem] leading-relaxed text-faint">
        Un campo vacío significa que no lo contaste, y ese producto no se toca.
        Para decir que no queda nada, escribí 0.
      </p>

      {/* Barra fija: el resumen y el botón siempre al alcance del pulgar,
          por encima de la barra de navegación. */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] lg:left-[76px] lg:pb-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-[20px] bg-raised/95 p-2.5 pl-4 shadow-[0_16px_44px_-16px_rgba(0,0,0,0.75)] ring-1 ring-line backdrop-blur-xl lg:max-w-5xl">
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-tight text-soft tnum">
            <span className="font-semibold text-ink">{ready.length}</span> de {products.length}{" "}
            contados
            {conDiferencia > 0 ? (
              <span className="block text-warn">{conDiferencia} con diferencia</span>
            ) : null}
          </p>
          <Button
            variant="accent"
            className="shrink-0"
            disabled={applying || ready.length === 0}
            onClick={apply}
          >
            {applying ? "Aplicando…" : "Aplicar conteo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
