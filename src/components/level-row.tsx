import { cn } from "@/lib/cn";
import { formatQty } from "@/lib/units";
import type { BaseUnit } from "@/generated/prisma/enums";
import type { LucideIcon } from "lucide-react";

/**
 * Fila de nivel: disco de color con la inicial o el ícono de la categoría,
 * nombre, saldo sobre objetivo y el porcentaje a la derecha.
 * El disco de color es el ancla visual — se reconoce el producto sin leer.
 */
export function LevelRow({
  name,
  color,
  quantity,
  target,
  unit,
  icon: Icon,
  href,
  meta,
  tone,
  className,
}: {
  name: string;
  color: string;
  quantity: number;
  target?: number | null;
  unit: BaseUnit;
  icon?: LucideIcon;
  href?: string;
  meta?: string;
  tone?: "ok" | "warn" | "danger";
  className?: string;
}) {
  const ratio = target && target > 0 ? Math.min(quantity / target, 1) : null;
  const Wrapper = (href ? "a" : "div") as "a";

  return (
    <Wrapper
      href={href}
      className={cn(
        "flex items-center gap-3.5 rounded-[18px] bg-raised px-3 py-2.5",
        href && "press hover:bg-hover",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold"
        style={{ background: color, color: "oklch(0.18 0.01 60)" }}
      >
        {Icon ? <Icon className="size-[18px]" strokeWidth={2.25} /> : name.slice(0, 1).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] text-soft">{name}</span>
        <span className="block text-[0.9375rem] leading-tight font-semibold tnum">
          {formatQty(quantity, unit)}
          {target ? (
            <span className="font-normal text-faint"> / {formatQty(target, unit)}</span>
          ) : null}
          {meta ? <span className="ml-2 text-[0.8125rem] font-normal text-faint">{meta}</span> : null}
        </span>
      </span>

      {ratio !== null ? (
        <span
          className={cn(
            "shrink-0 text-[0.9375rem] font-semibold tnum",
            tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-faint",
          )}
        >
          {Math.round(ratio * 100)}%
        </span>
      ) : null}
    </Wrapper>
  );
}

/** Barra de nivel plana — sin degradados ni sombras, sólo proporción. */
export function LevelBar({
  ratio,
  tone = "accent",
  className,
}: {
  ratio: number;
  tone?: "accent" | "ok" | "warn" | "danger";
  className?: string;
}) {
  const color =
    tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : tone === "ok" ? "var(--ok)" : "var(--accent)";
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}>
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, background: color }}
      />
    </span>
  );
}
