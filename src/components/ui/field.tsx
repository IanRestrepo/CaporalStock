"use client";

import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

const CONTROL =
  "w-full bg-sunken text-ink placeholder:text-faint rounded-control px-4 " +
  "outline-none transition-[background-color,box-shadow] " +
  "focus:bg-raised focus:ring-2 focus:ring-accent-line " +
  "disabled:opacity-50 " +
  "[html[data-theme=light]_&]:bg-raised";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block px-1 text-[0.8125rem] font-medium text-soft">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="px-1 text-[0.8125rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="px-1 text-[0.8125rem] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, "h-12 appearance-none pr-11", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

/**
 * Entrada de cantidad. Teclado numérico obligado, unidad visible dentro del
 * campo: el empleado nunca debe adivinar si escribe gramos o kilos.
 */
export function QuantityInput({
  unit,
  className,
  ...props
}: ComponentProps<"input"> & { unit: string }) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className={cn(CONTROL, "h-14 pr-16 text-[1.375rem] font-semibold", className)}
        {...props}
      />
      <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-faint">
        {unit}
      </span>
    </div>
  );
}
