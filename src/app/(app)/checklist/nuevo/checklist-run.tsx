"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { UNITS } from "@/lib/units";
import type { BaseUnit, ChecklistItemStatus } from "@/generated/prisma/enums";
import { Check, PackagePlus, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitChecklist } from "../actions";

export type TemplateItem = {
  id: string;
  label: string;
  kind: "DOTACION" | "CONSUMIBLE";
  expectedQty: number | null;
  requireNote: boolean;
  product: { id: string; name: string; baseUnit: BaseUnit } | null;
};

type ItemState = { status: ChecklistItemStatus; qty: number | null; note: string };

const OPTIONS: {
  status: ChecklistItemStatus;
  label: string;
  icon: React.ElementType;
  tone: string;
}[] = [
  { status: "OK", label: "Bien", icon: Check, tone: "data-[on=true]:bg-ok data-[on=true]:text-canvas" },
  {
    status: "FALTANTE",
    label: "Falta",
    icon: X,
    tone: "data-[on=true]:bg-warn data-[on=true]:text-canvas",
  },
  {
    status: "DANIADO",
    label: "Dañado",
    icon: TriangleAlert,
    tone: "data-[on=true]:bg-danger data-[on=true]:text-canvas",
  },
];

const REPUESTO: ChecklistItemStatus = "REPUESTO";

export function ChecklistRun({
  roomNumber,
  roomId,
  templateId,
  items,
  locations,
  defaultLocationId,
}: {
  roomNumber: string;
  roomId: string;
  templateId: string;
  items: TemplateItem[];
  locations: { id: string; name: string }[];
  defaultLocationId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [source, setSource] = useState(defaultLocationId);
  const [note, setNote] = useState("");
  const [state, setState] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { status: "PENDIENTE", qty: null, note: "" }]),
    ),
  );

  const set = (id: string, patch: Partial<ItemState>) =>
    setState((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const done = items.filter((i) => state[i.id].status !== "PENDIENTE").length;
  const toDiscount = items.filter(
    (i) => state[i.id].status === REPUESTO && (state[i.id].qty ?? 0) > 0,
  ).length;

  const submit = () => {
    startTransition(async () => {
      const result = await submitChecklist({
        roomId,
        templateId,
        sourceLocationId: source,
        note: note || null,
        items: items.map((item) => ({
          templateItemId: item.id,
          status: state[item.id].status,
          qty: state[item.id].qty,
          note: state[item.id].note,
        })),
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push(
        "ok",
        result.discounted > 0
          ? `Suite ${roomNumber} revisada. Se descontaron ${result.discounted} referencias.`
          : `Suite ${roomNumber} revisada.`,
      );
      router.push(`/suites/${roomId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-[16px] bg-surface px-4 py-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[0.8125rem] text-faint tnum">
          {done}/{items.length}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const current = state[item.id];
          const needsNote =
            item.requireNote ||
            current.status === "FALTANTE" ||
            current.status === "DANIADO";

          return (
            <div key={item.id} className="rounded-[20px] bg-surface p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] leading-tight font-medium">{item.label}</p>
                  {item.expectedQty ? (
                    <p className="mt-0.5 text-[0.8125rem] text-faint tnum">
                      Deben ser {Number(item.expectedQty)}
                      {item.product ? ` ${UNITS[item.product.baseUnit].plural}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {OPTIONS.map((option) => (
                  <button
                    key={option.status}
                    type="button"
                    data-on={current.status === option.status}
                    onClick={() =>
                      set(item.id, {
                        status: current.status === option.status ? "PENDIENTE" : option.status,
                        qty: null,
                      })
                    }
                    className={cn(
                      "press flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[0.8125rem] font-medium text-soft transition-colors",
                      option.tone,
                    )}
                  >
                    <option.icon className="size-3.5" strokeWidth={2.5} />
                    {option.label}
                  </button>
                ))}

                {item.kind === "CONSUMIBLE" && item.product ? (
                  <button
                    type="button"
                    data-on={current.status === REPUESTO}
                    onClick={() =>
                      set(item.id, {
                        status: current.status === REPUESTO ? "PENDIENTE" : REPUESTO,
                        qty:
                          current.status === REPUESTO
                            ? null
                            : (item.expectedQty ?? 1),
                      })
                    }
                    className="press flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[0.8125rem] font-medium text-soft transition-colors data-[on=true]:bg-accent data-[on=true]:text-accent-ink"
                  >
                    <PackagePlus className="size-3.5" strokeWidth={2.5} />
                    Repuse
                  </button>
                ) : null}
              </div>

              {current.status === REPUESTO && item.product ? (
                <div className="mt-3">
                  <Field label={`¿Cuántos ${UNITS[item.product.baseUnit].plural}?`}>
                    <Input
                      inputMode="decimal"
                      value={current.qty ?? ""}
                      onChange={(e) =>
                        set(item.id, { qty: e.target.value ? Number(e.target.value) : null })
                      }
                      placeholder="0"
                    />
                  </Field>
                </div>
              ) : null}

              {needsNote && current.status !== "PENDIENTE" ? (
                <div className="mt-3">
                  <Input
                    value={current.note}
                    onChange={(e) => set(item.id, { note: e.target.value })}
                    placeholder={
                      current.status === "DANIADO"
                        ? "¿Qué le pasó?"
                        : current.status === "FALTANTE"
                          ? "¿Qué falta exactamente?"
                          : "Observación"
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {toDiscount > 0 ? (
        <Field
          label="La dotación sale de"
          hint="De esta bodega se descuenta lo que repusiste."
          htmlFor="origen-dotacion"
        >
          <Select id="origen-dotacion" value={source} onChange={(e) => setSource(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Observaciones generales">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opcional"
          rows={2}
        />
      </Field>

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={pending || done === 0}
        onClick={submit}
      >
        {pending ? "Guardando…" : `Cerrar revisión de la ${roomNumber}`}
      </Button>

      {done < items.length ? (
        <p className="px-1 text-center text-[0.8125rem] text-faint">
          Quedan {items.length - done} sin marcar. Podés cerrar igual.
        </p>
      ) : null}
    </div>
  );
}
