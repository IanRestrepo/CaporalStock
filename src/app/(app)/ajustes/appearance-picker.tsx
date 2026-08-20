"use client";

import { cn } from "@/lib/cn";
import { ACCENTS, THEMES, type ThemeId } from "@/lib/appearance";
import { Check, Moon, Sun } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { setAppearance } from "./actions";

const THEME_META: Record<ThemeId, { label: string; icon: React.ElementType }> = {
  dark: { label: "Oscuro", icon: Moon },
  light: { label: "Claro", icon: Sun },
};

/**
 * El cambio se aplica al instante sobre <html> y se persiste después.
 * Esperar al servidor para ver un color es una espera que nadie tolera.
 */
export function AppearancePicker({
  accent: initialAccent,
  theme: initialTheme,
}: {
  accent: string;
  theme: ThemeId;
}) {
  const [accent, setAccent] = useState(initialAccent);
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.dataset.theme = theme;
  }, [accent, theme]);

  const persist = (nextAccent: string, nextTheme: ThemeId) => {
    startTransition(() => {
      void setAppearance(nextAccent, nextTheme);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2.5 text-[0.8125rem] text-soft">Color de acento</p>
        <div className="grid grid-cols-8 gap-2">
          {ACCENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={option.name}
              aria-pressed={accent === option.id}
              onClick={() => {
                setAccent(option.id);
                persist(option.id, theme);
              }}
              className={cn(
                "press grid aspect-square place-items-center rounded-full transition-transform",
                accent === option.id && "ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]",
              )}
              style={{ background: option.swatch }}
            >
              {accent === option.id ? (
                <Check className="size-4 text-canvas mix-blend-difference" strokeWidth={3} />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[0.8125rem] text-soft">Tema</p>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((option) => {
            const meta = THEME_META[option];
            const active = theme === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTheme(option);
                  persist(accent, option);
                }}
                className={cn(
                  "press flex items-center gap-2.5 rounded-[16px] px-4 py-3.5 text-[0.9375rem] font-medium transition-colors",
                  active ? "bg-accent text-accent-ink" : "bg-raised text-soft hover:text-ink",
                )}
              >
                <meta.icon className="size-[18px]" strokeWidth={1.75} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
