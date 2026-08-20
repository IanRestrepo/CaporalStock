import type { BaseUnit } from "@/generated/prisma/enums";

/**
 * Todo el inventario vive en la unidad base del producto.
 * Las presentaciones ("Bolsa 500 g", "Caja x12") sólo son lentes de entrada:
 * se convierten a base al guardar y se deshacen al mostrar.
 */

export const UNITS: Record<
  BaseUnit,
  { symbol: string; label: string; plural: string; step: number; decimals: number }
> = {
  GRAMO: { symbol: "g", label: "gramo", plural: "gramos", step: 1, decimals: 0 },
  MILILITRO: { symbol: "ml", label: "mililitro", plural: "mililitros", step: 1, decimals: 0 },
  UNIDAD: { symbol: "u", label: "unidad", plural: "unidades", step: 1, decimals: 0 },
};

export const UNIT_OPTIONS = (Object.keys(UNITS) as BaseUnit[]).map((value) => ({
  value,
  label: `${UNITS[value].plural} (${UNITS[value].symbol})`,
}));

/** Convierte una cantidad expresada en presentaciones a unidad base. */
export function toBase(qty: number, factor: number): number {
  return round4(qty * factor);
}

/** Deshace la conversión: cuántas presentaciones representa una cantidad base. */
export function fromBase(qtyBase: number, factor: number): number {
  if (!factor) return 0;
  return round4(qtyBase / factor);
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

/** Acepta "1.250,5" y "1250.5" — los empleados escriben de las dos formas. */
export function parseNumber(input: string): number | null {
  if (typeof input !== "string") return null;
  const clean = input.trim().replace(/\s/g, "");
  if (!clean) return null;
  const normalized =
    clean.includes(",") && clean.lastIndexOf(",") > clean.lastIndexOf(".")
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

type FormatOptions = {
  /** Fuerza la unidad base sin escalar a kg / L. Útil en tablas comparativas. */
  exact?: boolean;
  /** Omite el símbolo, para cuando la columna ya lo declara. */
  bare?: boolean;
};

/**
 * 850 g · 1,25 kg · 700 ml · 2,4 L · 12 u
 * Escala automáticamente porque "25000 g" es ilegible de un vistazo.
 */
export function formatQty(
  qtyBase: number,
  unit: BaseUnit,
  { exact = false, bare = false }: FormatOptions = {},
): string {
  const abs = Math.abs(qtyBase);

  if (!exact && unit === "GRAMO" && abs >= 1000) {
    return join(decimal(qtyBase / 1000, 2), "kg", bare);
  }
  if (!exact && unit === "MILILITRO" && abs >= 1000) {
    return join(decimal(qtyBase / 1000, 2), "L", bare);
  }
  return join(decimal(qtyBase, unit === "UNIDAD" ? 0 : 1), UNITS[unit].symbol, bare);
}

function join(value: string, symbol: string, bare: boolean) {
  return bare ? value : `${value} ${symbol}`;
}

function decimal(n: number, max: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  }).format(n);
}

/** Etiqueta corta de una presentación: "Bolsa 500 g" -> "500 g c/u" */
export function presentationHint(factor: number, unit: BaseUnit): string {
  return `${formatQty(factor, unit)} c/u`;
}

/**
 * Cuántas porciones completas alcanzo con lo disponible.
 * El corazón del módulo de cocina: receta -> porciones reales.
 */
export function portionsAvailable(
  available: number,
  perFullYield: number,
  yieldPortions: number,
): number {
  if (perFullYield <= 0 || yieldPortions <= 0) return Infinity;
  const perPortion = perFullYield / yieldPortions;
  return Math.floor(available / perPortion);
}
