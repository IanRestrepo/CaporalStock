import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Tres cifras en fila, separadas por hairline vertical.
 * Rótulo arriba en pequeño, cifra abajo con peso: el ojo cae en el número.
 */
export function StatRow({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; hint?: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-3 divide-x divide-line", className)}>
      {items.map((item, i) => (
        <div key={item.label} className={cn("min-w-0 px-3 py-1 sm:px-4", i === 0 && "pl-0")}>
          {/* Alto fijo de dos líneas: así las tres cifras comparten línea base
              aunque un rótulo envuelva y otro no. */}
          <p className="mb-1 flex min-h-[2.4em] items-start text-[0.75rem] leading-tight text-balance text-faint sm:text-[0.8125rem]">
            {item.label}
          </p>
          <p className="text-[1.0625rem] leading-tight font-semibold tnum">{item.value}</p>
          {item.hint ? <p className="mt-0.5 text-2xs text-faint tnum">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
