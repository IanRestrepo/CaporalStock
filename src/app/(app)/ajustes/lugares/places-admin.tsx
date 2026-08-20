"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/product-form";
import { useToast } from "@/components/ui/toast";
import { Plus, Refrigerator, Warehouse, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveLocation, saveRoom } from "../actions";

type Kind = "PRINCIPAL" | "AREA" | "MINIBAR";

export type Place = {
  id: string;
  name: string;
  kind: Kind;
  active: boolean;
  room: string | null;
  items: number;
};

export type RoomRow = { id: string; number: string; floor: string | null; active: boolean };

const ICON = { PRINCIPAL: Warehouse, AREA: Wrench, MINIBAR: Refrigerator } as const;

export function PlacesAdmin({ places, rooms }: { places: Place[]; rooms: RoomRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [location, setLocation] = useState<
    { id?: string; name: string; kind: Kind; active: boolean } | null
  >(null);
  const [room, setRoom] = useState<
    { id?: string; number: string; floor: string; active: boolean } | null
  >(null);

  const saveL = () => {
    if (!location) return;
    startTransition(async () => {
      const result = await saveLocation(location);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Bodega guardada.");
      setLocation(null);
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
        <div className="mb-2.5 flex items-center justify-between px-1">
          <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">Bodegas</p>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setLocation({ name: "", kind: "AREA", active: true })}
          >
            <Plus className="size-4" />
            Nueva
          </Button>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">
          {places
            .filter((p) => p.kind !== "MINIBAR")
            .map((place) => {
              const Icon = ICON[place.kind];
              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() =>
                    setLocation({
                      id: place.id,
                      name: place.name,
                      kind: place.kind,
                      active: place.active,
                    })
                  }
                  className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-raised"
                >
                  <Icon className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem]">{place.name}</span>
                    <span className="block text-[0.8125rem] text-faint tnum">
                      {place.items} productos
                    </span>
                  </span>
                  {place.kind === "PRINCIPAL" ? <Badge tone="accent">principal</Badge> : null}
                  {!place.active ? <Badge>inactiva</Badge> : null}
                </button>
              );
            })}
        </div>
        <p className="mt-2.5 px-1 text-[0.8125rem] text-faint">
          Los minibares no se crean acá: nacen con cada habitación.
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
      </section>

      <Sheet
        open={location !== null}
        onClose={() => setLocation(null)}
        title={location?.id ? "Editar bodega" : "Nueva bodega"}
      >
        {location ? (
          <div className="space-y-4">
            <Field label="Nombre">
              <Input
                value={location.name}
                onChange={(e) => setLocation({ ...location, name: e.target.value })}
                placeholder="p. ej. Lavandería"
              />
            </Field>
            <Field label="Tipo" hint="Sólo puede haber una bodega principal.">
              <Select
                value={location.kind}
                onChange={(e) => setLocation({ ...location, kind: e.target.value as Kind })}
              >
                <option value="AREA">Área de operación</option>
                <option value="PRINCIPAL">Bodega principal</option>
              </Select>
            </Field>
            {location.id ? (
              <Toggle
                label="Activa"
                value={location.active}
                onChange={(active) => setLocation({ ...location, active })}
              />
            ) : null}
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={pending || !location.name.trim()}
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
