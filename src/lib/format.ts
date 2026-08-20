const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const moneyPrecise = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
});

const moneyCompact = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number, precise = false): string {
  return (precise ? moneyPrecise : money).format(value || 0);
}

/**
 * "$ 5,8 M" en vez de "$ 5.827.320".
 * En una ficha de 110 px de ancho, la cifra exacta se corta y deja de informar;
 * la compacta cabe entera. El valor exacto vive en Reportes.
 */
export function formatMoneyCompact(value: number): string {
  if (Math.abs(value) < 100000) return money.format(value || 0);
  return moneyCompact.format(value || 0);
}

export function formatPercent(value: number, decimals = 0): string {
  return new Intl.NumberFormat("es-CO", {
    style: "percent",
    maximumFractionDigits: decimals,
  }).format(value || 0);
}

const dayMonth = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });
const timeOnly = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

export function formatDate(d: Date | string): string {
  return fullDate.format(new Date(d));
}

export function formatShortDate(d: Date | string): string {
  return dayMonth.format(new Date(d));
}

export function formatTime(d: Date | string): string {
  return timeOnly.format(new Date(d));
}

/** "hace 5 min", "ayer", "hace 3 d" — para el feed de movimientos. */
export function formatRelative(d: Date | string): string {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} d`;
  return formatShortDate(date);
}

/** Días hasta el vencimiento; negativo si ya venció. */
export function daysUntil(d: Date | string): number {
  const target = new Date(d);
  target.setHours(23, 59, 59, 999);
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Prisma devuelve Decimal; la UI quiere number. Un único punto de conversión. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}
