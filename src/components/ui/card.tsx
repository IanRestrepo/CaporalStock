import { cn } from "@/lib/cn";
import type { ComponentProps, ReactNode } from "react";

/** Superficie base. Sin borde en oscuro; en claro una línea mínima da el canto. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface",
        "[html[data-theme=light]_&]:ring-1 [html[data-theme=light]_&]:ring-line",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[1.0625rem] leading-tight font-semibold">{title}</h2>
        {hint ? <p className="mt-1 text-[0.8125rem] text-soft">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Rótulo de sección. Discreto: el dato manda, no la etiqueta. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Lista de filas separadas por hairline, a sangre dentro de la tarjeta. */
export function RowList({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("divide-y divide-line", className)} {...props} />;
}
