"use client";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_COLORS } from "@/lib/appearance";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/cn";
import { saveCategory } from "@/app/(app)/ajustes/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

export type CategoryDraft = { id?: string; name: string; color: string; icon: string };

export const BLANK_CATEGORY: CategoryDraft = { name: "", color: "slate", icon: "package" };

/**
 * Nombre, color e ícono. Los tres importan: en una lista larga el disco de
 * color es lo que hace que la categoría se encuentre sin leer.
 */
export function CategoryForm({
  draft,
  submitLabel,
  onDone,
  children,
}: {
  draft: CategoryDraft;
  submitLabel: string;
  onDone?: () => void;
  children?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(draft);

  const submit = () => {
    startTransition(async () => {
      const result = await saveCategory(form);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", form.id ? "Categoría guardada." : "Categoría creada.");
      router.refresh();
      onDone?.();
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Nombre" htmlFor="categoria-nombre">
        <Input
          id="categoria-nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="p. ej. Decoración"
        />
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              aria-label={color.name}
              aria-pressed={form.color === color.id}
              onClick={() => setForm({ ...form, color: color.id })}
              className={cn(
                "press size-9 rounded-full",
                form.color === color.id && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
              )}
              style={{ background: color.css }}
            />
          ))}
        </div>
      </Field>

      <Field label="Ícono">
        <div className="grid grid-cols-6 gap-2">
          {CATEGORY_ICONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={option.name}
              aria-pressed={form.icon === option.id}
              onClick={() => setForm({ ...form, icon: option.id })}
              className={cn(
                "press grid aspect-square place-items-center rounded-[12px] bg-raised text-soft",
                form.icon === option.id && "bg-ink text-canvas",
              )}
            >
              <option.icon className="size-[18px]" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </Field>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || !form.name.trim()}
        onClick={submit}
      >
        {pending ? "Guardando…" : submitLabel}
      </Button>

      {children}
    </div>
  );
}
