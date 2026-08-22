"use client";

import { BLANK_TAXONOMY, TaxonomyForm, type TaxonomyDraft } from "@/components/taxonomy-form";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { categoryColor } from "@/lib/appearance";
import { categoryIcon } from "@/lib/category-icons";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCategory, saveCategory } from "../actions";

export type CategoryAdminRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  products: number;
};

export function CategoriesAdmin({ categories }: { categories: CategoryAdminRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<TaxonomyDraft | null>(null);
  const [removing, setRemoving] = useState<CategoryAdminRow | null>(null);

  const remove = () => {
    if (!removing) return;
    startTransition(async () => {
      const result = await deleteCategory(removing.id);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", `${removing.name} se borró.`);
      setRemoving(null);
      setDraft(null);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">
          Subcategorías · {categories.length}
        </p>
        <Button size="sm" variant="quiet" onClick={() => setDraft(BLANK_TAXONOMY)}>
          <Plus className="size-4" />
          Nueva
        </Button>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {categories.map((category) => {
          const Icon = categoryIcon(category.icon);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() =>
                setDraft({
                  id: category.id,
                  name: category.name,
                  color: category.color,
                  icon: category.icon,
                })
              }
              className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-raised"
            >
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-[12px]"
                style={{
                  background: categoryColor(category.color),
                  color: "oklch(0.18 0.01 60)",
                }}
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem]">{category.name}</span>
                <span className="block text-[0.8125rem] text-faint tnum">
                  {category.products} producto{category.products === 1 ? "" : "s"}
                </span>
              </span>
            </button>
          );
        })}
        {categories.length === 0 ? (
          <p className="px-5 py-4 text-[0.8125rem] text-faint">
            Sin subcategorías. Creá al menos una para poder cargar productos.
          </p>
        ) : null}
      </div>

      <p className="mt-2.5 px-1 text-[0.8125rem] text-faint">
        La subcategoría dice QUÉ es el producto y le da el color con el que se reconoce en una
        lista. Dónde se usa lo dice la categoría, que es otra cosa.
      </p>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Editar subcategoría" : "Nueva subcategoría"}
      >
        {draft ? (
          <TaxonomyForm
            draft={draft}
            submitLabel="Guardar"
            placeholder="p. ej. Bebidas"
            save={saveCategory}
            onDone={() => setDraft(null)}
          >
            {draft.id ? (
              <Button
                variant="ghost"
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={() => {
                  const row = categories.find((c) => c.id === draft.id);
                  if (row) setRemoving(row);
                }}
              >
                <Trash2 className="size-4" />
                Borrar subcategoría
              </Button>
            ) : null}
          </TaxonomyForm>
        ) : null}
      </Sheet>

      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="¿Borrar la subcategoría?"
        description={
          removing
            ? `${removing.name} desaparece de la bodega. Sólo se puede borrar si no le queda ningún producto.`
            : undefined
        }
      >
        <div className="flex gap-2.5">
          <Button size="lg" className="flex-1" onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
          <Button variant="danger" size="lg" className="flex-1" disabled={pending} onClick={remove}>
            {pending ? "Borrando…" : "Borrar"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
