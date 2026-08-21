"use client";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Toggle } from "@/components/product-form";
import { useToast } from "@/components/ui/toast";
import { Plus, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameLocation, saveRoom } from "../actions";

export type Place = { id: string; name: string; items: number };

export type RoomRow = { id: string; number: string; floor: string | null; active: boolean };

export function PlacesAdmin({ central, rooms }: { central: Place | null; rooms: RoomRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState<string | null>(null);
  const [room, setRoom] = useState<
    { id?: string; number: string; floor: string; active: boolean } | null
  >(null);

  const saveL = () => {
    if (!central || name === null) return;
    startTransition(async () => {
      const result = await renameLocation({ id: central.id, name });
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Bodega guardada.");
      setName(null);
      router.refresh();
    });
  };

  const saveR = () => {
    if (!room) return;
    startTransition(async () => {
      const result = await saveRoom({ ...room, floor: room.floor || null });
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", room.id ? "Habitación guardada." : "Habitación creada con su minibar.");
      setRoom(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <p className="mb-2.5 px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
          Bodega central
        </p>

        <div className="overflow-hidden rounded-card bg-surface">
          {central ? (
            <button
              type="button"
              onClick={() => setName(central.name)}
              className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-raised"
            >
              <Warehouse className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem]">{central.name}</span>
                <span className="block text-[0.8125rem] text-faint tnum">
                  {central.items} producto{central.items === 1 ? "" : "s"} con saldo
                </span>
              </span>
            </button>
          ) : (
            <p className="px-5 py-4 text-[0.8125rem] text-faint">
              No hay bodega central. Corré el seed para crearla.
            </p>
          )}
        </div>
        <p className="mt-2.5 px-1 text-[0.8125rem] text-faint">
          El hotel tiene una sola bodega: lo que la ordena por dentro son las categorías. Los
          minibares no se crean acá, nacen con cada habitación.
        </p>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">
            Habitaciones · {rooms.length}
          </p>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setRoom({ number: "", floor: "", active: true })}
          >
            <Plus className="size-4" />
            Nueva
          </Button>
        </div>

        {rooms.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  setRoom({ id: r.id, number: r.number, floor: r.floor ?? "", active: r.active })
                }
                className="press rounded-[16px] bg-surface py-4 text-center hover:bg-raised"
              >
                <span className="block text-[1.125rem] font-semibold tnum">{r.number}</span>
                <span className="mt-0.5 block text-2xs text-faint">
                  {r.active ? (r.floor ?? "—") : "inactiva"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-card bg-surface px-5 py-4 text-[0.8125rem] text-faint">
            Todavía no hay habitaciones. Cada una nace con su minibar.
          </p>
        )}
      </section>

      <Sheet open={name !== null} onClose={() => setName(null)} title="Editar bodega">
        {name !== null ? (
          <div className="space-y-4">
            <Field label="Nombre">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej. Bodega central"
              />
            </Field>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={pending || !name.trim()}
              onClick={saveL}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={room !== null}
        onClose={() => setRoom(null)}
        title={room?.id ? "Editar habitación" : "Nueva habitación"}
        description={room?.id ? undefined : "Se le crea automáticamente su minibar."}
      >
        {room ? (
          <div className="space-y-4">
            <Field label="Número o nombre">
              <Input
                value={room.number}
                onChange={(e) => setRoom({ ...room, number: e.target.value })}
                placeholder="207"
              />
            </Field>
            <Field label="Piso" hint="Opcional. Agrupa las suites en la lista.">
              <Input
                value={room.floor}
                onChange={(e) => setRoom({ ...room, floor: e.target.value })}
                placeholder="Piso 2"
              />
            </Field>
            {room.id ? (
              <Toggle
                label="Activa"
                value={room.active}
                onChange={(active) => setRoom({ ...room, active })}
              />
            ) : null}
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={pending || !room.number.trim()}
              onClick={saveR}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
