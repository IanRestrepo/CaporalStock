"use client";

import { cn } from "@/lib/cn";
import { ArrowLeft, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

export const TUTORIAL_KEY = "caporal_tutorial_paso";

/**
 * Píldora para volver al tutorial.
 *
 * Cuando alguien sale del tutorial a mirar una pantalla, queda en la app sin
 * ninguna señal de dónde estaba. Esto lo devuelve al paso exacto.
 *
 * El marcador vive en sessionStorage y se lee con useSyncExternalStore, que es
 * la forma de mirar algo que no controla React sin encadenar renders.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string | null {
  try {
    return sessionStorage.getItem(TUTORIAL_KEY);
  } catch {
    return null;
  }
}

/** En el servidor no hay marcador: la píldora aparece ya en el cliente. */
const serverSnapshot = () => null;

export function marcarPaso(paso: number) {
  try {
    sessionStorage.setItem(TUTORIAL_KEY, String(paso));
  } catch {
    /* modo privado: se pierde el marcador, no la app */
  }
  listeners.forEach((l) => l());
}

export function olvidarPaso() {
  try {
    sessionStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignorado */
  }
  listeners.forEach((l) => l());
}

export function TutorialReturn() {
  const pathname = usePathname();
  const router = useRouter();
  const saved = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const step = Number(saved);
  if (!saved || !Number.isFinite(step) || step < 1) return null;
  if (pathname.startsWith("/tutorial")) return null;

  return (
    <div
      className={cn(
        "rise pointer-events-none fixed inset-x-0 z-45 flex justify-center px-3",
        "bottom-[calc(env(safe-area-inset-bottom)+84px)] lg:bottom-5 lg:left-[76px]",
      )}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-raised/95 py-1.5 pr-1.5 pl-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.75)] ring-1 ring-line backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.push(`/tutorial?paso=${step}`)}
          className="press flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-hover"
        >
          <ArrowLeft className="size-3.5 shrink-0 text-accent" />
          Volver al tutorial
          <span className="text-faint tnum">paso {step}</span>
        </button>
        <button
          type="button"
          onClick={olvidarPaso}
          aria-label="No volver al tutorial"
          className="press grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-hover hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
