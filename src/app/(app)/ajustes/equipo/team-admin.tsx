"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/product-form";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/format";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveUser } from "../actions";

export type TeamMember = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "EMPLEADO";
  active: boolean;
  movements: number;
};

type Draft = {
  id?: string;
  name: string;
  username: string;
  role: "ADMIN" | "EMPLEADO";
  active: boolean;
};

const BLANK: Draft = { name: "", username: "", role: "EMPLEADO", active: true };

export function TeamAdmin({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pin, setPin] = useState("");

  const open = (member?: TeamMember) => {
    setPin("");
    setDraft(
      member
        ? {
            id: member.id,
            name: member.name,
            username: member.username,
            role: member.role,
            active: member.active,
          }
        : { ...BLANK },
    );
  };

  const submit = () => {
    if (!draft) return;
    startTransition(async () => {
      const result = await saveUser({ ...draft, pin: pin || undefined });
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", draft.id ? "Cambios guardados." : "Persona agregada al equipo.");
      setDraft(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="accent" onClick={() => open()}>
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => open(member)}
            className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-raised"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-raised text-[0.8125rem] font-semibold text-soft">
              {initials(member.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-medium">{member.name}</span>
              <span className="block truncate text-[0.8125rem] text-faint tnum">
                @{member.username} · {member.movements} movimientos
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              {member.role === "ADMIN" ? <Badge tone="accent">admin</Badge> : null}
              {!member.active ? <Badge tone="neutral">inactivo</Badge> : null}
            </span>
          </button>
        ))}
      </div>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Editar persona" : "Nueva persona"}
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="Nombre completo">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Marcela Ruiz"
              />
            </Field>

            <Field label="Usuario" hint="Con esto entra a la app. Sin espacios ni tildes.">
              <Input
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                placeholder="marcela"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>

            <Field label="Rol">
              <Select
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as "ADMIN" | "EMPLEADO" })
                }
              >
                <option value="EMPLEADO">Empleado — registra salidas y traslados</option>
                <option value="ADMIN">Administrador — todo, incluido dinero</option>
              </Select>
            </Field>

            <Field
              label={draft.id ? "Nuevo PIN" : "PIN"}
              hint={draft.id ? "Dejalo vacío para no cambiarlo." : "4 a 6 dígitos."}
            >
              <Input
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                placeholder="••••"
                autoComplete="off"
              />
            </Field>

            {draft.id ? (
              <Toggle
                label="Activo"
                hint="Un inactivo no puede entrar, pero su historial se conserva."
                value={draft.active}
                onChange={(active) => setDraft({ ...draft, active })}
              />
            ) : null}

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={pending || !draft.name.trim() || !draft.username.trim()}
              onClick={submit}
            >
              {pending ? "Guardando…" : draft.id ? "Guardar cambios" : "Agregar al equipo"}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
