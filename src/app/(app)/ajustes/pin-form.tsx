"use client";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { changePin } from "./actions";

export function PinForm() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (next !== repeat) {
      toast.push("error", "Los PIN nuevos no coinciden.");
      return;
    }
    startTransition(async () => {
      const result = await changePin(current, next);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "PIN actualizado.");
      setCurrent("");
      setNext("");
      setRepeat("");
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-raised"
      >
        <KeyRound className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
        <span className="flex-1 text-[0.9375rem]">Cambiar mi PIN</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Cambiar PIN">
        <div className="space-y-4">
          <Field label="PIN actual">
            <Input
              inputMode="numeric"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              maxLength={6}
              autoComplete="off"
            />
          </Field>
          <Field label="PIN nuevo" hint="Entre 4 y 6 dígitos.">
            <Input
              inputMode="numeric"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              maxLength={6}
              autoComplete="off"
            />
          </Field>
          <Field label="Repetilo">
            <Input
              inputMode="numeric"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              maxLength={6}
              autoComplete="off"
            />
          </Field>
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={pending || !current || !next}
            onClick={submit}
          >
            {pending ? "Guardando…" : "Cambiar PIN"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
