"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Hoja inferior en teléfono, diálogo centrado en escritorio.
 * Es el contenedor de casi toda la captura de datos: en móvil un formulario que
 * sube desde abajo mantiene el pulgar donde ya estaba.
 */
const subscribeNever = () => () => {};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  // "¿ya estamos en el navegador?" sin efectos ni renders en cascada:
  // en el servidor devuelve false, en el cliente true desde el primer render.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        style={{ animation: "fade-in 180ms ease both" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col bg-surface",
          "rounded-t-[28px] sm:rounded-[24px]",
          "[html[data-theme=light]_&]:ring-1 [html[data-theme=light]_&]:ring-line",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        style={{ animation: "sheet-in 300ms cubic-bezier(0.2,0,0,1) both" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong sm:hidden" />

        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 sm:pt-5">
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-semibold">{title}</h2>
            {description ? (
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-soft">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="press -mt-1 grid size-9 shrink-0 place-items-center rounded-[11px] text-faint hover:bg-raised hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer ? (
          <div className="border-t border-line px-5 py-4 pb-safe [&>*]:w-full">{footer}</div>
        ) : (
          <div className="pb-safe" />
        )}
      </div>
    </div>,
    document.body,
  );
}
