"use client";

import { LevelRow } from "@/components/level-row";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import type { BaseUnit } from "@/generated/prisma/enums";
import { PackageSearch, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type StockItem = {
  productId: string;
  name: string;
  category: string;
  color: string;
  baseUnit: BaseUnit;
  quantity: number;
  threshold: number;
  par: number | null;
};

/**
 * Buscador de existencias. Filtra en el cliente porque un hotel no tiene miles
 * de referencias: es más rápido y funciona mientras el pulgar sigue escribiendo.
 */
export function StockExplorer({
  items,
  hrefBase,
  emptyBody,
}: {
  items: StockItem[];
  hrefBase?: string;
  emptyBody?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) seen.set(item.category, item.color);
    return [...seen.entries()].map(([name, color]) => ({ name, color }));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (needle ? item.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => {
        const aLow = a.threshold > 0 && a.quantity < a.threshold;
        const bLow = b.threshold > 0 && b.quantity < b.threshold;
        if (aLow !== bLow) return aLow ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      });
  }, [items, query, category]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto"
          className="pl-11"
          type="search"
          autoComplete="off"
        />
      </div>

      {categories.length > 1 ? (
        <div data-scroll-x className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Todo
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.name}
              active={category === c.name}
              color={categoryColor(c.color)}
              onClick={() => setCategory(category === c.name ? null : c.name)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      ) : null}

      {filtered.length ? (
        <div className="space-y-1.5">
          {filtered.map((item) => {
            const target = item.par ?? (item.threshold > 0 ? item.threshold : null);
            const low = item.threshold > 0 && item.quantity < item.threshold;
            return (
              <LevelRow
                key={item.productId}
                name={item.name}
                color={categoryColor(item.color)}
                quantity={item.quantity}
                target={target}
                unit={item.baseUnit}
                href={hrefBase ? `${hrefBase}/${item.productId}` : undefined}
                tone={item.quantity === 0 ? "danger" : low ? "warn" : undefined}
              />
            );
          })}
        </div>
      ) : (
        <Empty
          icon={PackageSearch}
          title={query ? "Nada coincide" : "Sin existencias"}
          body={query ? `No hay productos que digan “${query}” acá.` : emptyBody}
        />
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  color,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
        active ? "bg-ink text-canvas" : "bg-raised text-soft hover:text-ink",
      )}
    >
      {color && !active ? (
        <span className="size-1.5 rounded-full" style={{ background: color }} />
      ) : null}
      {children}
    </button>
  );
}
