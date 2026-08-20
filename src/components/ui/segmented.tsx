"use client";

import { cn } from "@/lib/cn";

/** Alternador de vistas. Fondo hundido, píldora activa elevada: sin bordes. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex gap-1 rounded-[15px] bg-sunken p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "press h-9 rounded-[11px] px-3.5 text-[0.8125rem] font-medium transition-colors",
              active ? "bg-raised text-ink" : "text-soft hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
