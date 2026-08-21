"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, PackageSearch, Pencil, Plus, Trash2 } from "lucide-react";
import { LevelRow } from "@/components/level-row";
import { BLANK_CATEGORY, CategoryForm } from "@/components/category-form";
import { ProductForm, type ProductDraft } from "@/components/product-form";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { deleteProduct } from "@/app/(app)/productos/actions";
import { categoryColor } from "@/lib/appearance";
import { categoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/cn";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { BaseUnit } from "@/generated/prisma/enums";

export type WarehouseItem = {
  productId: string;
  name: string;
  categoryId: string;
  category: string;
  color: string;
  baseUnit: BaseUnit;
  quantity: number;
  threshold: number;
  /** Datos que sólo hacen falta al abrir la hoja de edición. */
  draft: ProductDraft;
};

export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

/**
 * La bodega central.
 *
 * Hay una sola bodega, así que las categorías dejan de ser una etiqueta y pasan
 * a ser la navegación: cada una es un atajo al mismo inventario, filtrado.
 * Y el producto se crea, edita y borra sin salir de acá — entrar a la ficha
 * para corregir un mínimo era un viaje de ida y vuelta por nada.
 */
export function WarehouseExplorer({
  items,
  categories,
  canEdit,
}: {
  items: WarehouseItem[];
  categories: CategoryRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  const [removing, setRemoving] = useState<WarehouseItem | null>(null);
  const [newCategory, setNewCategory] = useState(false);

  const formCategories = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name })),
    [categories],
  );

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;

  const counts = useMemo(() => {
    const map = new Map<string, { total: number; low: number }>();
    for (const item of items) {
      const row = map.get(item.categoryId) ?? { total: 0, low: 0 };
      row.total += 1;
      if (item.threshold > 0 && item.quantity < item.threshold) row.low += 1;
      map.set(item.categoryId, row);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((item) => (categoryId ? item.categoryId === categoryId : true))
      .filter((item) => (needle ? item.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => {
        const aLow = a.threshold > 0 && a.quantity < a.threshold;
        const bLow = b.threshold > 0 && b.quantity < b.threshold;
        if (aLow !== bLow) return aLow ? -1 : 1;
        return a.name.localeCompare(b.name, "es");
      });
  }, [items, categoryId, needle]);

  const current = categories.find((c) => c.id === categoryId) ?? null;
  const showCategories = !current && !searching;

  const blank: ProductDraft = {
    name: "",
    categoryId: categoryId ?? categories[0]?.id ?? "",
    baseUnit: "UNIDAD",
    costPrice: 0,
    salePrice: 0,
    minQty: 0,
    perishable: false,
    active: true,
  };

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

      {showCategories ? (
        <>
          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel>Categorías</SectionLabel>
            {canEdit ? (
              <Button size="sm" variant="quiet" onClick={() => setNewCategory(true)}>
                <Plus className="size-4" />
                Categoría
              </Button>
            ) : null}
          </div>
          <div className="mb-7 space-y-2">
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon);
              const count = counts.get(category.id) ?? { total: 0, low: 0 };
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className="press flex w-full items-center gap-3.5 rounded-card bg-surface px-4 py-3.5 text-left hover:bg-raised"
                >
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-[13px]"
                    style={{
                      background: categoryColor(category.color),
                      color: "oklch(0.18 0.01 60)",
                    }}
                  >
                    <Icon className="size-[18px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium">
                      {category.name}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-faint tnum">
                      {count.total} producto{count.total === 1 ? "" : "s"}
                      {count.low > 0 ? ` · ${count.low} bajo mínimo` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4.5 shrink-0 text-faint" />
                </button>
              );
            })}
            {categories.length === 0 ? (
              <p className="rounded-card bg-surface px-5 py-4 text-[0.8125rem] text-faint">
                Todavía no hay categorías. Creá la primera para poder cargar productos.
              </p>
            ) : null}
          </div>

          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel>Todo el inventario</SectionLabel>
            {canEdit ? (
              <Button size="sm" variant="quiet" onClick={() => setEditing(blank)}>
                <Plus className="size-4" />
                Producto
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2">
          {current ? (
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className="press -ml-1.5 flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-[0.8125rem] font-medium text-soft hover:text-ink"
            >
              <ChevronLeft className="size-4" />
              {current.name}
            </button>
          ) : (
            <SectionLabel>Resultados</SectionLabel>
          )}
          {canEdit ? (
            <Button size="sm" variant="quiet" onClick={() => setEditing(blank)}>
              <Plus className="size-4" />
              Producto
            </Button>
          ) : null}
        </div>
      )}

      {filtered.length ? (
        <div className="space-y-1.5">
          {filtered.map((item) => {
            const low = item.threshold > 0 && item.quantity < item.threshold;
            return (
              <div key={item.productId} className="flex items-center gap-1.5">
                <LevelRow
                  className="min-w-0 flex-1"
                  name={item.name}
                  color={categoryColor(item.color)}
                  quantity={item.quantity}
                  target={item.threshold > 0 ? item.threshold : null}
                  unit={item.baseUnit}
                  href={`/productos/${item.productId}`}
                  tone={item.quantity === 0 ? "danger" : low ? "warn" : undefined}
                />
                {canEdit ? (
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label={`Editar ${item.name}`}
                      onClick={() => setEditing(item.draft)}
                    >
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Borrar ${item.name}`}
                      danger
                      onClick={() => setRemoving(item)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={PackageSearch}
          title={searching ? "Nada coincide" : "Sin productos"}
          body={
            searching
              ? `No hay productos que digan “${query}” en la bodega.`
              : current
                ? `Todavía no hay nada en ${current.name}.`
                : "La bodega arranca vacía. Creá el primer producto."
          }
          action={
            canEdit && !searching ? (
              <Button variant="accent" onClick={() => setEditing(blank)}>
                <Plus className="size-4" />
                Nuevo producto
              </Button>
            ) : null
          }
        />
      )}

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
            categories={formCategories}
            submitLabel={editing.id ? "Guardar cambios" : "Crear producto"}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={newCategory}
        onClose={() => setNewCategory(false)}
        title="Nueva categoría"
        description="Se puede editar o borrar después desde Ajustes › Categorías."
      >
        <CategoryForm
          draft={BLANK_CATEGORY}
          submitLabel="Crear categoría"
          onDone={() => setNewCategory(false)}
        />
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
