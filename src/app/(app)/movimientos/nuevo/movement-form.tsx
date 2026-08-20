"use client";

import { Button } from "@/components/ui/button";
import { Field, QuantityInput, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { DAMAGE_REASONS } from "@/lib/movements";
import { formatQty, parseNumber, toBase, UNITS } from "@/lib/units";
import type { BaseUnit, LocationKind, MovementType } from "@/generated/prisma/enums";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  PackageMinus,
  PackageSearch,
  Plus,
  Scale,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createMovement } from "../actions";

type Location = { id: string; name: string; kind: LocationKind; room: string | null };
type Presentation = { id: string; name: string; factor: number };
type Product = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  category: string;
  color: string;
  presentations: Presentation[];
};
type Line = { productId: string; quantity: number };

const TYPES: {
  value: MovementType;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  hint: string;
}[] = [
  { value: "CONSUMO", label: "Sacar", icon: PackageMinus, hint: "Se consumió o se vendió." },
  { value: "TRASLADO", label: "Trasladar", icon: ArrowLeftRight, hint: "Cambia de bodega, no sale del hotel." },
  { value: "DANIO", label: "Daño", icon: TriangleAlert, hint: "Se rompió, se venció o se perdió." },
  { value: "ENTRADA", label: "Entrada", icon: ArrowDownLeft, adminOnly: true, hint: "Ingreso de mercancía." },
  { value: "AJUSTE", label: "Ajuste", icon: Scale, adminOnly: true, hint: "Corrección tras un conteo." },
];

const NEEDS = {
  CONSUMO: { from: true, to: false },
  TRASLADO: { from: true, to: true },
  DANIO: { from: true, to: false },
  ENTRADA: { from: false, to: true },
  AJUSTE: { from: false, to: true },
} as const;

export function MovementForm({
  role,
  locations,
  rooms,
  products,
  available,
  initialType,
  initialFrom,
  initialTo,
  initialRoom,
}: {
  role: "ADMIN" | "EMPLEADO";
  locations: Location[];
  rooms: { id: string; number: string }[];
  products: Product[];
  available: Record<string, number>;
  initialType?: string;
  initialFrom?: string;
  initialTo?: string;
  initialRoom?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const types = TYPES.filter((t) => !t.adminOnly || role === "ADMIN");
  const [type, setType] = useState<MovementType>(
    (types.find((t) => t.value === initialType)?.value ?? "CONSUMO") as MovementType,
  );
  const [from, setFrom] = useState(initialFrom ?? defaultFrom(locations));
  const [to, setTo] = useState(initialTo ?? "");
  const [roomId, setRoomId] = useState(initialRoom ?? "");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const needs = NEEDS[type];
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sourceId = needs.from ? from : null;

  const stockOf = (productId: string) =>
    sourceId ? (available[`${productId}:${sourceId}`] ?? 0) : Infinity;

  const addLine = (productId: string, quantity: number) => {
    setLines((current) => {
      const found = current.find((l) => l.productId === productId);
      if (found) {
        return current.map((l) => (l.productId === productId ? { ...l, quantity } : l));
      }
      return [...current, { productId, quantity }];
    });
  };

  const problem = validate();

  function validate(): string | null {
    if (needs.from && !from) return "Elegí de dónde sale.";
    if (needs.to && !to) return "Elegí a dónde entra.";
    if (type === "TRASLADO" && from === to) return "El origen y el destino son la misma bodega.";
    if (!lines.length) return "Agregá al menos un producto.";
    if (type === "DANIO" && !reason) return "Elegí el motivo del daño.";
    for (const line of lines) {
      if (sourceId && line.quantity > stockOf(line.productId)) {
        return `No hay tanto ${productById.get(line.productId)?.name} en esa bodega.`;
      }
    }
    return null;
  }

  const submit = () => {
    if (problem) {
      toast.push("error", problem);
      return;
    }
    startTransition(async () => {
      const result = await createMovement({
        type,
        fromLocationId: needs.from ? from : null,
        toLocationId: needs.to ? to : null,
        roomId: roomId || null,
        reason: reason || null,
        note: note || null,
        lines,
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      toast.push("ok", "Movimiento registrado.");
      router.push("/movimientos");
      router.refresh();
    });
  };

  const active = types.find((t) => t.value === type)!;

  return (
    <div className="space-y-5">
      {/* Tipo de movimiento */}
      <div>
        <div data-scroll-x className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {types.map((option) => {
            const isActive = option.value === type;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setType(option.value);
                  setReason("");
                }}
                className={cn(
                  "press flex shrink-0 items-center gap-2 rounded-[15px] px-4 py-3 text-[0.875rem] font-medium whitespace-nowrap transition-colors",
                  isActive ? "bg-accent text-accent-ink" : "bg-surface text-soft hover:text-ink",
                )}
              >
                <option.icon className="size-4" strokeWidth={2} />
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 px-1 text-[0.8125rem] text-faint">{active.hint}</p>
      </div>

      {/* Origen y destino */}
      <div className="space-y-3 rounded-card bg-surface p-4">
        {needs.from ? (
          <Field label="Sale de" htmlFor="origen">
            <Select id="origen" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Elegí una bodega</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {needs.to ? (
          <Field label="Entra a" htmlFor="destino">
            <Select id="destino" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Elegí una bodega</option>
              {locations
                .filter((l) => l.id !== from)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : null}

        {type === "CONSUMO" || type === "DANIO" ? (
          <Field
            label="¿Para qué suite?"
            hint="Opcional, pero es lo que después responde “quién gastó en la 204”."
            htmlFor="suite"
          >
            <Select id="suite" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Sin suite / uso general</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Suite {r.number}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {type === "DANIO" ? (
          <Field label="Motivo">
            <div className="flex flex-wrap gap-1.5">
              {DAMAGE_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(option)}
                  className={cn(
                    "press rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors",
                    reason === option ? "bg-danger text-canvas" : "bg-raised text-soft hover:text-ink",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>
        ) : null}
      </div>

      {/* Productos */}
      <div className="rounded-card bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[0.9375rem] font-semibold">Productos</h2>
          <Button size="sm" variant="quiet" onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>

        {lines.length ? (
          <div className="space-y-1.5">
            {lines.map((line) => {
              const product = productById.get(line.productId)!;
              const excess = sourceId ? line.quantity > stockOf(line.productId) : false;
              return (
                <div
                  key={line.productId}
                  className={cn(
                    "flex items-center gap-3 rounded-[16px] bg-raised px-3 py-2.5",
                    excess && "ring-1 ring-danger/60",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: categoryColor(product.color) }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditing(line.productId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[0.875rem]">{product.name}</span>
                    <span
                      className={cn(
                        "block text-[0.9375rem] font-semibold tnum",
                        excess && "text-danger",
                      )}
                    >
                      {formatQty(line.quantity, product.baseUnit)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Quitar ${product.name}`}
                    onClick={() =>
                      setLines((current) => current.filter((l) => l.productId !== line.productId))
                    }
                    className="press grid size-8 shrink-0 place-items-center rounded-[10px] text-faint hover:bg-hover hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="press w-full rounded-[16px] bg-sunken py-7 text-[0.875rem] text-faint hover:text-soft"
          >
            Todavía no agregaste nada
          </button>
        )}
      </div>

      <Field label="Nota" hint="Cualquier cosa que el próximo turno deba saber.">
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
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Guardando…" : `Registrar ${active.label.toLowerCase()}`}
      </Button>

      {problem && lines.length > 0 ? (
        <p className="px-1 text-center text-[0.8125rem] text-warn">{problem}</p>
      ) : null}

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        products={products}
        stockOf={stockOf}
        showStock={Boolean(sourceId)}
        chosen={new Set(lines.map((l) => l.productId))}
        onPick={(productId) => {
          setPickerOpen(false);
          setEditing(productId);
        }}
      />

      {editing ? (
        <QuantitySheet
          product={productById.get(editing)!}
          available={stockOf(editing)}
          showStock={Boolean(sourceId)}
          initial={lines.find((l) => l.productId === editing)?.quantity ?? null}
          onClose={() => setEditing(null)}
          onSave={(quantity) => {
            addLine(editing, quantity);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ProductPicker({
  open,
  onClose,
  products,
  stockOf,
  showStock,
  chosen,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  stockOf: (id: string) => number;
  showStock: boolean;
  chosen: Set<string>;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter((p) => (needle ? p.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => {
        if (showStock) {
          const diff = Number(stockOf(b.id) > 0) - Number(stockOf(a.id) > 0);
          if (diff) return diff;
        }
        return a.name.localeCompare(b.name, "es");
      });
  }, [products, query, showStock, stockOf]);

  return (
    <Sheet open={open} onClose={onClose} title="Elegí el producto" size="lg">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          className="pl-11"
          type="search"
        />
      </div>

      {results.length ? (
        <div className="space-y-1">
          {results.map((product) => {
            const stock = stockOf(product.id);
            const empty = showStock && stock <= 0;
            return (
              <button
                key={product.id}
                type="button"
                disabled={empty}
                onClick={() => onPick(product.id)}
                className={cn(
                  "press flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left",
                  empty ? "opacity-40" : "hover:bg-raised",
                  chosen.has(product.id) && "bg-accent-soft",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: categoryColor(product.color) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem]">{product.name}</span>
                  <span className="block text-[0.8125rem] text-faint">{product.category}</span>
                </span>
                {showStock ? (
                  <span className="shrink-0 text-[0.8125rem] text-soft tnum">
                    {formatQty(stock, product.baseUnit)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty icon={PackageSearch} title="Nada coincide" body={`Ningún producto dice “${query}”.`} />
      )}
    </Sheet>
  );
}

function QuantitySheet({
  product,
  available,
  showStock,
  initial,
  onClose,
  onSave,
}: {
  product: Product;
  available: number;
  showStock: boolean;
  initial: number | null;
  onClose: () => void;
  onSave: (quantity: number) => void;
}) {
  const [presentation, setPresentation] = useState<Presentation>(
    product.presentations[0] ?? { id: "base", name: UNITS[product.baseUnit].symbol, factor: 1 },
  );
  const [raw, setRaw] = useState(
    initial !== null ? String(initial / (product.presentations[0]?.factor ?? 1)) : "",
  );

  const parsed = parseNumber(raw);
  const quantity = parsed !== null ? toBase(parsed, presentation.factor) : 0;
  const excess = showStock && quantity > available;

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      description={
        showStock ? `Disponible: ${formatQty(available, product.baseUnit)}` : undefined
      }
      footer={
        <Button
          variant="accent"
          size="lg"
          disabled={!quantity || excess}
          onClick={() => onSave(quantity)}
        >
          {excess ? "No hay tanto" : "Listo"}
        </Button>
      }
    >
      <div className="space-y-4">
        <QuantityInput
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          unit={presentation.factor === 1 ? UNITS[product.baseUnit].symbol : presentation.name}
          placeholder="0"
        />

        {product.presentations.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {product.presentations.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPresentation(option)}
                className={cn(
                  "press rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors",
                  presentation.id === option.id
                    ? "bg-ink text-canvas"
                    : "bg-raised text-soft hover:text-ink",
                )}
              >
                {option.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* La traducción a unidad base, visible: nadie debería hacerla de cabeza. */}
        {presentation.factor !== 1 && quantity > 0 ? (
          <p className="px-1 text-[0.875rem] text-soft">
            Equivale a{" "}
            <span className="font-semibold text-ink tnum">
              {formatQty(quantity, product.baseUnit, { exact: true })}
            </span>
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function defaultFrom(locations: Location[]) {
  return locations.find((l) => l.kind === "PRINCIPAL")?.id ?? "";
}
