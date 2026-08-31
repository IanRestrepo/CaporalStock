"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/product-form";
import { useToast } from "@/components/ui/toast";
import { parseNumber } from "@/lib/units";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteChecklistItem, saveChecklistItem } from "../actions";

type Kind = "DOTACION" | "CONSUMIBLE";

export type Item = {
  id: string;
  label: string;
  kind: Kind;
  expectedQty: number | null;
  requireNote: boolean;
  productId: string | null;
  productName: string | null;
};

type Draft = {
  id?: string;
  label: string;
  kind: Kind;
  productId: string;
  expectedQty: string;
  requireNote: boolean;
};

export function ChecklistAdmin({
  templateId,
  items,
  products,
}: {
  templateId: string;
  items: Item[];
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  const submit = () => {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveChecklistItem({
        templateId,
        id: draft.id,
        label: draft.label,
        kind: draft.kind,
        productId: draft.kind === "CONSUMIBLE" ? draft.productId || null : null,
        expectedQty: parseNumber(draft.expectedQty),
        requireNote: draft.requireNote,
      });
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Checklist actualizado.");
      setDraft(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteChecklistItem(id);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Ítem eliminado.");
      setDraft(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="accent"
          onClick={() =>
            setDraft({
              label: "",
              kind: "DOTACION",
              productId: "",
              expectedQty: "",
              requireNote: false,
            })
          }
        >
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              setDraft({
                id: item.id,
                label: item.label,
                kind: item.kind,
                productId: item.productId ?? "",
                expectedQty: item.expectedQty ? String(item.expectedQty) : "",
                requireNote: item.requireNote,
              })
            }
            className="press flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-raised"
          >
            <GripVertical className="size-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem]">{item.label}</span>
              <span className="block truncate text-[0.8125rem] text-faint tnum">
                {item.kind === "CONSUMIBLE"
                  ? `Descuenta ${item.productName ?? "—"}`
                  : "Sólo se verifica"}
                {item.expectedQty ? ` · ${item.expectedQty}` : ""}
              </span>
            </span>
            {item.kind === "CONSUMIBLE" ? <Badge tone="accent">consumible</Badge> : null}
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-[0.8125rem] leading-relaxed text-faint">
        Los ítems de <strong className="font-medium text-soft">dotación</strong> sólo se verifican
        (control de TV, persianas, aire). Los de{" "}
        <strong className="font-medium text-soft">consumible</strong> descuentan del inventario
        cuando el empleado marca “Repuse”.
      </p>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Editar ítem" : "Nuevo ítem"}
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="¿Qué se revisa?">
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="p. ej. Control de aire acondicionado"
              />
            </Field>

            <Field label="Tipo">
              <Select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
              >
                <option value="DOTACION">Dotación — sólo se verifica</option>
                <option value="CONSUMIBLE">Consumible — descuenta del inventario</option>
              </Select>
            </Field>

            {draft.kind === "CONSUMIBLE" ? (
              <Field label="Producto que descuenta">
                <Select
                  value={draft.productId}
                  onChange={(e) => setDraft({ ...draft, productId: e.target.value })}
                >
                  <option value="">Elige uno</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Cantidad esperada" hint="Opcional. Ej. 4 almohadas, 2 toallas.">
              <Input
                inputMode="decimal"
                value={draft.expectedQty}
                onChange={(e) => setDraft({ ...draft, expectedQty: e.target.value })}
                placeholder="—"
              />
            </Field>

            <Toggle
              label="Pedir siempre una nota"
              hint="Para ítems donde el estado importa más que el sí/no."
              value={draft.requireNote}
              onChange={(requireNote) => setDraft({ ...draft, requireNote })}
            />

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={pending || !draft.label.trim()}
              onClick={submit}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>

            {draft.id ? (
              <Button
                variant="danger"
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={() => remove(draft.id!)}
              >
                <Trash2 className="size-4" />
                Eliminar ítem
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
