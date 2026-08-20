/** Paleta de acentos y temas. Compartida por el selector y el layout raíz. */

export const ACCENTS = [
  { id: "clay", name: "Arcilla", swatch: "oklch(0.62 0.155 28)" },
  { id: "amber", name: "Ámbar", swatch: "oklch(0.76 0.16 68)" },
  { id: "moss", name: "Musgo", swatch: "oklch(0.72 0.15 152)" },
  { id: "ocean", name: "Océano", swatch: "oklch(0.62 0.15 248)" },
  { id: "indigo", name: "Índigo", swatch: "oklch(0.58 0.19 274)" },
  { id: "orchid", name: "Orquídea", swatch: "oklch(0.65 0.19 315)" },
  { id: "quartz", name: "Cuarzo", swatch: "oklch(0.76 0.09 342)" },
  { id: "bone", name: "Hueso", swatch: "oklch(0.9 0.012 80)" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export const THEMES = ["dark", "light"] as const;
export type ThemeId = (typeof THEMES)[number];

export const DEFAULT_ACCENT: AccentId = "clay";
export const DEFAULT_THEME: ThemeId = "dark";

/** Colores de categoría: el color se usa como dato, no como adorno. */
export const CATEGORY_COLORS = [
  { id: "amber", name: "Ámbar", css: "var(--cat-amber)" },
  { id: "sky", name: "Cielo", css: "var(--cat-sky)" },
  { id: "coral", name: "Coral", css: "var(--cat-coral)" },
  { id: "violet", name: "Violeta", css: "var(--cat-violet)" },
  { id: "mint", name: "Menta", css: "var(--cat-mint)" },
  { id: "rose", name: "Rosa", css: "var(--cat-rose)" },
  { id: "slate", name: "Pizarra", css: "var(--cat-slate)" },
] as const;

export type CategoryColorId = (typeof CATEGORY_COLORS)[number]["id"];

export function categoryColor(id: string): string {
  return CATEGORY_COLORS.find((c) => c.id === id)?.css ?? "var(--cat-slate)";
}
