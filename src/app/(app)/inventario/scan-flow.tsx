"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { categoryColor } from "@/lib/appearance";
import { formatQty, parseNumber, UNITS } from "@/lib/units";
import type { BaseUnit, LocationKind } from "@/generated/prisma/enums";
import { Camera, Check, LoaderCircle, Search, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { applyCount, scanSheet } from "./actions";

export type ScanProduct = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  section: string;
  color: string;
};

type Row = {
  key: string;
  texto: string;
  productId: string | null;
  cantidad: string;
  confianza: "alta" | "media" | "baja";
  nota: string | null;
};

/** Ancho máximo de la foto que se sube. Una hoja se lee perfecto a 1600 px, y
 *  bajar de 4 MB a ~300 KB es la diferencia entre esperar y no esperar. */
const MAX_EDGE = 1600;

export function ScanFlow({
  locations,
  products,
  onHand,
}: {
  locations: { id: string; name: string; kind: LocationKind }[];
  products: ScanProduct[];
  onHand: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, startApply] = useTransition();

  const [locationId, setLocationId] = useState(
    locations.find((l) => l.kind === "PRINCIPAL")?.id ?? locations[0]?.id ?? "",
  );
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const stockOf = (productId: string) => onHand[`${productId}:${locationId}`] ?? 0;

  const takePhoto = async (file: File) => {
    setScanning(true);
    try {
      const shrunk = await downscale(file);
      const body = new FormData();
      body.set("foto", shrunk);

      const result = await scanSheet(body);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }

      setRows(
        result.lineas.map((line, i) => ({
          key: `${i}-${Date.now()}`,
          texto: line.texto,
          productId: line.productoId,
          cantidad: line.cantidad !== null ? String(line.cantidad) : "",
          confianza: line.confianza,
          nota: line.nota,
        })),
      );

      const dudosos = result.lineas.filter((l) => l.confianza !== "alta" || !l.productoId).length;
      toast.push(
        dudosos ? "info" : "ok",
        dudosos
          ? `Se leyeron ${result.lineas.length} renglones. ${dudosos} necesitan tu revisión.`
          : `Se leyeron ${result.lineas.length} renglones.`,
      );
    } catch {
      toast.push("error", "No se pudo procesar la foto.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = (key: string, values: Partial<Row>) =>
    setRows((current) =>
      current ? current.map((r) => (r.key === key ? { ...r, ...values } : r)) : current,
    );

  const ready = (rows ?? []).filter(
    (r) => r.productId && parseNumber(r.cantidad) !== null,
  );
  const pending = (rows ?? []).length - ready.length;

  const apply = () => {
    startApply(async () => {
      const result = await applyCount({
        locationId,
        note: note || null,
        counts: ready.map((r) => ({
          productId: r.productId as string,
          countedQty: parseNumber(r.cantidad) as number,
        })),
      });

      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }

      toast.push(
        "ok",
        `Conteo aplicado: ${result.sobrantes} sobrantes y ${result.faltantes} faltantes.`,
      );
      setRows(null);
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Field label="¿Qué bodega contaste?" htmlFor="bodega-conteo">
        <Select
          id="bodega-conteo"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={rows !== null}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>

      {rows === null ? (
        <>
          <button
            type="button"
            disabled={scanning || !locationId}
            onClick={() => fileRef.current?.click()}
            className="press flex w-full flex-col items-center justify-center gap-3 rounded-card bg-surface py-14 hover:bg-raised disabled:opacity-60"
          >
            {scanning ? (
              <>
                <LoaderCircle className="size-7 animate-spin text-accent" />
                <span className="text-[0.9375rem] font-medium">Leyendo la hoja…</span>
                <span className="text-[0.8125rem] text-faint">Puede tardar unos segundos</span>
              </>
            ) : (
              <>
                <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-ink">
                  <Camera className="size-6" strokeWidth={2} />
                </span>
                <span className="text-[0.9375rem] font-medium">Fotografiar la hoja</span>
                <span className="max-w-xs px-6 text-center text-[0.8125rem] leading-relaxed text-faint">
                  Que se vea completa, derecha y con luz pareja.
                </span>
              </>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void takePhoto(file);
            }}
          />

          <p className="px-1 text-center text-[0.8125rem] leading-relaxed text-faint">
            Lo que se lea es una propuesta. Nada toca el inventario hasta que lo revises
            y lo apliques vos.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">
              {rows.length} renglones
            </p>
            <button
              type="button"
              onClick={() => setRows(null)}
              className="press text-[0.8125rem] text-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
            >
              Descartar y repetir
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((row) => {
              const product = row.productId ? productById.get(row.productId) : null;
              const counted = parseNumber(row.cantidad);
              const system = product ? stockOf(product.id) : 0;
              const delta = product && counted !== null ? counted - system : null;

              return (
                <div
                  key={row.key}
                  className={cn(
                    "rounded-[20px] bg-surface p-4",
                    !product && "ring-1 ring-warn/40",
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 font-mono text-[0.8125rem] leading-snug text-faint">
                      {row.texto}
                    </p>
                    <button
                      type="button"
                      aria-label="Quitar renglón"
                      onClick={() =>
                        setRows((current) =>
                          current ? current.filter((r) => r.key !== row.key) : current,
                        )
                      }
                      className="press grid size-7 shrink-0 place-items-center rounded-[9px] text-faint hover:bg-raised hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPicking(row.key)}
                    className="press mb-2.5 flex w-full items-center gap-2.5 rounded-[14px] bg-raised px-3 py-2.5 text-left"
                  >
                    {product ? (
                      <>
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: categoryColor(product.color) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[0.9375rem]">
                          {product.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <TriangleAlert className="size-4 shrink-0 text-warn" />
                        <span className="min-w-0 flex-1 text-[0.9375rem] text-warn">
                          Elegí a qué producto corresponde
                        </span>
                      </>
                    )}
                    <Search className="size-4 shrink-0 text-faint" />
                  </button>

                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      value={row.cantidad}
                      onChange={(e) => patch(row.key, { cantidad: e.target.value })}
                      placeholder="Cantidad contada"
                      aria-label="Cantidad contada"
                      className="h-11 flex-1 text-[0.9375rem] font-semibold"
                    />
                    {product ? (
                      <span className="shrink-0 text-[0.8125rem] text-faint">
                        {UNITS[product.baseUnit].symbol}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {row.confianza !== "alta" ? (
                      <Badge tone={row.confianza === "baja" ? "danger" : "warn"}>
                        lectura {row.confianza}
                      </Badge>
                    ) : null}

                    {product && delta !== null ? (
                      delta === 0 ? (
                        <span className="flex items-center gap-1 text-[0.8125rem] text-ok">
                          <Check className="size-3.5" strokeWidth={2.5} />
                          coincide con el sistema
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "text-[0.8125rem] tnum",
                            delta > 0 ? "text-info" : "text-danger",
                          )}
                        >
                          sistema {formatQty(system, product.baseUnit)} ·{" "}
                          {delta > 0 ? "sobran " : "faltan "}
                          {formatQty(Math.abs(delta), product.baseUnit)}
                        </span>
                      )
                    ) : null}

                    {row.nota ? (
                      <span className="text-[0.8125rem] text-faint">{row.nota}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <Field label="Nota del conteo">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quién contó, en qué condiciones (opcional)"
              rows={2}
            />
          </Field>

          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={applying || ready.length === 0}
            onClick={apply}
          >
            {applying
              ? "Aplicando…"
              : `Aplicar conteo de ${ready.length} producto${ready.length === 1 ? "" : "s"}`}
          </Button>

          {pending > 0 ? (
            <p className="px-1 text-center text-[0.8125rem] text-warn">
              {pending} renglón{pending === 1 ? "" : "es"} sin resolver. Se van a omitir.
            </p>
          ) : null}

          <p className="px-1 text-center text-[0.8125rem] leading-relaxed text-faint">
            Al aplicar queda registrado como ajuste por conteo físico, con tu nombre.
          </p>
        </>
      )}

      <ProductPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        products={products}
        onPick={(productId) => {
          if (picking) patch(picking, { productId });
          setPicking(null);
        }}
      />
    </div>
  );
}

function ProductPicker({
  open,
  onClose,
  products,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  products: ScanProduct[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Sheet open={open} onClose={onClose} title="¿Qué producto es?" size="lg">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar"
        type="search"
        className="mb-3"
      />
      <div className="space-y-1">
        {results.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onPick(product.id)}
            className="press flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left hover:bg-raised"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: categoryColor(product.color) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem]">{product.name}</span>
              <span className="block text-[0.8125rem] text-faint">{product.section}</span>
            </span>
            <span className="shrink-0 text-[0.8125rem] text-faint">
              {UNITS[product.baseUnit].symbol}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * Reduce la foto antes de subirla. Una cámara de teléfono entrega 4-6 MB; a
 * 1600 px de lado mayor la hoja se sigue leyendo perfecto y el archivo baja a
 * unos cientos de kilobytes, que en datos móviles es la diferencia entre
 * esperar diez segundos y esperar uno.
 */
async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size < 1_500_000 && file.type === "image/jpeg") {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );

  if (!blob) return file;
  return new File([blob], "hoja.jpg", { type: "image/jpeg" });
}
