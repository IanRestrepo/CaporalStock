"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { stepsFor } from "./steps";

/**
 * Reproductor del tutorial.
 *
 * Es un paso a la vez y a pantalla completa a propósito: explicarle el sistema
 * a alguien mientras la app entera compite por su atención no funciona. Cada
 * paso que invita a probar algo lleva un botón que abre esa pantalla de verdad,
 * en vez de una captura.
 */
export function Tutorial({
  role,
  name,
  start,
}: {
  role: "ADMIN" | "EMPLEADO";
  name: string;
  start: number;
}) {
  const router = useRouter();
  const steps = stepsFor(role);
  const total = steps.length;

  const [index, setIndex] = useState(() => Math.min(Math.max(start, 1), total) - 1);
  const touch = useRef<number | null>(null);

  const step = steps[index];
  const first = index === 0;
  const last = index === total - 1;

  const go = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), total - 1);
      setIndex(clamped);
      // La URL sigue el paso: el botón atrás del teléfono hace lo esperable
      // y se puede compartir "mira el paso 4".
      window.history.replaceState(null, "", `/tutorial?paso=${clamped + 1}`);
    },
    [total],
  );

  const salir = useCallback(() => router.push("/ajustes"), [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "Escape") salir();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, salir]);

  const Icon = step.icon;

  return (
    <div
      className="flex min-h-dvh flex-col pt-safe"
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 60) go(dx < 0 ? index + 1 : index - 1);
        touch.current = null;
      }}
    >
      {/* Progreso y salida */}
      <div className="flex items-center gap-3 px-4 pt-4 lg:px-8">
        <div className="flex flex-1 gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Paso ${i + 1}`}
              onClick={() => go(i)}
              className="group h-6 flex-1"
            >
              <span
                className={cn(
                  "block h-1 rounded-full transition-colors",
                  i < index ? "bg-accent/45" : i === index ? "bg-accent" : "bg-line-strong",
                )}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={salir}
          aria-label="Salir del tutorial"
          className="press -mr-1 grid size-9 shrink-0 place-items-center rounded-[11px] text-faint hover:bg-raised hover:text-ink"
        >
          <X className="size-4.5" />
        </button>
      </div>

      {/* Contenido */}
      <div key={step.id} className="rise mx-auto w-full max-w-lg flex-1 px-5 pt-8 lg:px-8">
        <span className="grid size-12 place-items-center rounded-[16px] bg-accent-soft text-accent">
          <Icon className="size-5" strokeWidth={2} />
        </span>

        <p className="mt-5 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
          {step.eyebrow}
        </p>
        <h1 className="mt-1.5 text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">
          {step.title}
        </h1>

        <div className="mt-4 text-[0.9375rem] leading-relaxed text-soft">{step.body}</div>

        {step.visual ? <div className="mt-6">{step.visual}</div> : null}

        {step.go ? (
          <Link
            href={step.go.href}
            className="press mt-5 inline-flex items-center gap-2 rounded-control bg-raised px-4 py-3 text-[0.875rem] font-medium hover:bg-hover"
          >
            {step.go.label}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>

      {/* Navegación */}
      {/* La barra de navegación flota sobre el contenido: el pie del tutorial
          tiene que quedar por encima o el botón queda debajo del pulgar. */}
      <div className="sticky bottom-0 mt-8 bg-gradient-to-t from-canvas via-canvas to-transparent px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+80px)] lg:px-8 lg:pb-4">
        <div className="mx-auto flex max-w-lg items-center gap-3 pb-3">
          <Button
            variant="quiet"
            size="lg"
            className="shrink-0"
            disabled={first}
            onClick={() => go(index - 1)}
            aria-label="Paso anterior"
          >
            <ArrowLeft className="size-4" />
          </Button>

          {last ? (
            <Button variant="accent" size="lg" className="flex-1" onClick={salir}>
              <Check className="size-4" strokeWidth={2.5} />
              Entendido
            </Button>
          ) : (
            <Button variant="accent" size="lg" className="flex-1" onClick={() => go(index + 1)}>
              Siguiente
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        <p className="text-center text-2xs text-faint tnum">
          {index + 1} de {total} · {name}, puedes volver a esto desde Ajustes
        </p>
      </div>
    </div>
  );
}
