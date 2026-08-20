"use client";

import { cn } from "@/lib/cn";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "ok" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<{ push: (tone: ToastTone, message: string) => void } | null>(
  null,
);

const ICONS = { ok: CircleCheck, error: CircleAlert, info: Info } as const;
const TONE_CLASS: Record<ToastTone, string> = {
  ok: "text-ok",
  error: "text-danger",
  info: "text-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Sobre la barra de navegación flotante, nunca debajo */}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-60 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className="rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[16px] bg-raised px-4 py-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] ring-1 ring-line"
            >
              <Icon className={cn("size-4.5 shrink-0", TONE_CLASS[toast.tone])} strokeWidth={2} />
              <p className="text-[0.875rem] leading-snug">{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
