"use client";

import { LevelRow } from "@/components/level-row";
import { ProductForm, type ProductDraft } from "@/components/product-form";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { deleteProduct } from "@/app/(app)/productos/actions";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import type { BaseUnit } from "@/generated/prisma/enums";
import { PackageSearch, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type StockItem = {
  productId: string;
  name: string;
  category: string;
  color: string;
  baseUnit: BaseUnit;
  quantity: number;
  threshold: number;
  par: number | null;
  /** Sólo se manda cuando la lista deja editar: es lo que llena la hoja. */
  draft?: ProductDraft;
};

/** Lo que hace falta para crear o corregir un producto sin salir de la lista. */
export type StockAdmin = {
  categories: { id: string; name: string }[];
  sections: { id: string; name: string }[];
  /** Al crear desde una sección, ya viene puesta. */
  defaultSectionId?: string;
};

/**
 * Buscador de existencias. Filtra en el cliente porque un hotel no tiene miles
 * de referencias: es más rápido y funciona mientras el pulgar sigue escribiendo.
 */
export function StockExplorer({
  items,
  hrefBase,
  emptyBody,
  admin,
}: {
  items: StockItem[];
  hrefBase?: string;
  emptyBody?: string;
  admin?: StockAdmin;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  const [removing, setRemoving] = useState<StockItem | null>(null);

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

  const blank: ProductDraft | null = admin
    ? {
        name: "",
        categoryId: admin.categories[0]?.id ?? "",
        sectionId: admin.defaultSectionId ?? null,
        baseUnit: "UNIDAD",
        costPrice: 0,
        salePrice: 0,
        minQty: 0,
        perishable: false,
        active: true,
      }
    : null;

  const confirmRemove = () => {
    if (!removing) return;
    startTransition(async () => {
      const result = await deleteProduct(removing.productId);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push(
        "ok",
        result.archived
          ? `${removing.name} se archivó: ya tenía historial o saldo.`
          : `${removing.name} se borró.`,
      );
      setRemoving(null);
      router.refresh();
    });
  };

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

      {admin && filtered.length ? (
        <div className="mb-2.5 flex justify-end">
          <Button size="sm" variant="quiet" onClick={() => setEditing(blank)}>
            <Plus className="size-4" />
            Producto
          </Button>
        </div>
      ) : null}

      {filtered.length ? (
        <div className="space-y-1.5">
          {filtered.map((item) => {
            const target = item.par ?? (item.threshold > 0 ? item.threshold : null);
            const low = item.threshold > 0 && item.quantity < item.threshold;
            const row = (
              <LevelRow
                className={admin ? "min-w-0 flex-1" : undefined}
                name={item.name}
                color={categoryColor(item.color)}
                quantity={item.quantity}
                target={target}
                unit={item.baseUnit}
                href={hrefBase ? `${hrefBase}/${item.productId}` : undefined}
                tone={item.quantity === 0 ? "danger" : low ? "warn" : undefined}
              />
            );

            if (!admin) return <div key={item.productId}>{row}</div>;

            return (
              <div key={item.productId} className="flex items-center gap-1.5">
                {row}
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label={`Editar ${item.name}`}
                    onClick={() => item.draft && setEditing(item.draft)}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton label={`Borrar ${item.name}`} danger onClick={() => setRemoving(item)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={PackageSearch}
          title={query ? "Nada coincide" : "Sin existencias"}
          body={query ? `No hay productos que digan “${query}” acá.` : emptyBody}
          action={
            admin && !query ? (
              <Button variant="accent" onClick={() => setEditing(blank)}>
                <Plus className="size-4" />
                Nuevo producto
              </Button>
            ) : null
          }
        />
      )}

      {admin ? (
        <>
          <Sheet
            open={editing !== null}
            onClose={() => setEditing(null)}
            title={editing?.id ? "Editar producto" : "Nuevo producto"}
            description={
              editing?.id ? undefined : "Elegí bien la unidad base: no se puede cambiar después."
            }
          >
            {editing ? (
              <ProductForm
                draft={editing}
                categories={admin.categories}
                sections={admin.sections}
                submitLabel={editing.id ? "Guardar cambios" : "Crear producto"}
                onDone={() => setEditing(null)}
              />
            ) : null}
          </Sheet>

          <Sheet
            open={removing !== null}
            onClose={() => setRemoving(null)}
            title="¿Borrar el producto?"
            description={
              removing
                ? `${removing.name} desaparece de la bodega y de los formularios. Si ya tiene movimientos o saldo, se archiva en vez de borrarse para no romper el historial.`
                : undefined
            }
          >
            <div className="flex gap-2.5">
              <Button size="lg" className="flex-1" onClick={() => setRemoving(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                disabled={pending}
                onClick={confirmRemove}
              >
                {pending ? "Borrando…" : "Borrar"}
              </Button>
            </div>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}

function IconButton({
  children,
  label,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "press grid size-9 place-items-center rounded-[12px] bg-raised text-faint",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
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
