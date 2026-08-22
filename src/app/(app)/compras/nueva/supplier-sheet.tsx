"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { saveSupplier } from "../actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type SupplierDraft = {
  id?: string;
  name: string;
  taxId: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
};

export const BLANK_SUPPLIER: SupplierDraft = {
  name: "",
  taxId: "",
  phone: "",
  email: "",
  notes: "",
  active: true,
};

/**
 * Alta de proveedor sin salir de donde estés. Nadie tiene la carnicería creada
 * antes de que llegue la primera remisión, y mandar al usuario a otra pantalla
 * en mitad de la factura es perder lo que ya escribió.
 */
export function SupplierSheet({
  open,
  onClose,
  draft,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: SupplierDraft;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(draft);
  const [seed, setSeed] = useState(draft);

  // Al reabrir la hoja con otro proveedor, el formulario se pone al día.
  if (seed !== draft) {
    setSeed(draft);
    setForm(draft);
  }

  const submit = () => {
    startTransition(async () => {
      const result = await saveSupplier(form);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", draft.id ? "Proveedor guardado." : "Proveedor creado.");
      router.refresh();
      onSaved?.(result.id);
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={draft.id ? "Editar proveedor" : "Nuevo proveedor"}
      description={draft.id ? undefined : "Con el nombre alcanza. Lo demás se puede completar después."}
    >
      <div className="space-y-4">
        <Field label="Nombre" htmlFor="proveedor-nombre">
          <Input
            id="proveedor-nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="p. ej. Carnicería El Novillo"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="NIT o cédula" htmlFor="proveedor-nit">
            <Input
              id="proveedor-nit"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="900123456-7"
              autoComplete="off"
            />
          </Field>
          <Field label="Teléfono" htmlFor="proveedor-tel">
            <Input
              id="proveedor-tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="313 555 0142"
              inputMode="tel"
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Correo" htmlFor="proveedor-mail">
          <Input
            id="proveedor-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Opcional"
            inputMode="email"
            autoComplete="off"
          />
        </Field>

        <Field label="Notas" htmlFor="proveedor-notas">
          <Textarea
            id="proveedor-notas"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Qué trae, cada cuánto, con quién se habla"
            rows={2}
          />
        </Field>

        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={pending || !form.name.trim()}
          onClick={submit}
        >
          {pending ? "Guardando…" : draft.id ? "Guardar cambios" : "Crear proveedor"}
        </Button>
      </div>
    </Sheet>
  );
}
