"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { ACCENTS, THEMES } from "@/lib/appearance";
import { hashPin, isValidPin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actor, destroySession } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

const YEAR = 60 * 60 * 24 * 365;

/** La apariencia vive en cookie (aplica sin parpadeo) y en el usuario (lo sigue entre teléfonos). */
export async function setAppearance(accent: string, theme: string): Promise<Result> {
  if (!ACCENTS.some((a) => a.id === accent)) return { ok: false, error: "Ese color no existe." };
  if (!THEMES.includes(theme as never)) return { ok: false, error: "Ese tema no existe." };

  const jar = await cookies();
  jar.set("caporal_accent", accent, { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set("caporal_theme", theme, { path: "/", maxAge: YEAR, sameSite: "lax" });

  const { user } = await actor();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { accent } });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cierra la sesión borrando la cookie firmada.
 *
 * No redirige desde acá a propósito: `redirect()` dentro de una acción es una
 * excepción, y si quien la llama no espera la promesa, la navegación se pierde
 * en silencio y el usuario queda adentro creyendo que salió. El cliente navega
 * después de que esto resuelve, y aunque fallara, el layout de la app ya no
 * encuentra sesión y lo manda a /entrar igual.
 */
export async function logout(): Promise<void> {
  await destroySession();
}

export async function changePin(current: string, next: string): Promise<Result> {
  const { user, error } = await actor();
  if (!user) return { ok: false, error };

  if (!isValidPin(next)) return { ok: false, error: "El PIN nuevo debe tener 4 a 6 dígitos." };

  const { authenticate } = await import("@/lib/auth");
  const ok = await authenticate(user.username, current);
  if (!ok) return { ok: false, error: "El PIN actual no coincide." };

  await prisma.user.update({ where: { id: user.id }, data: { pinHash: await hashPin(next) } });
  return { ok: true };
}

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "El nombre es muy corto."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "El usuario es muy corto.")
    .regex(/^[a-z0-9._-]+$/, "Sólo letras, números, punto, guion y guion bajo."),
  role: z.enum(["ADMIN", "EMPLEADO"]),
  active: z.boolean(),
  pin: z.string().optional(),
});

export async function saveUser(input: unknown): Promise<Result> {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { id, pin, ...data } = parsed.data;

  if (!id && !isValidPin(pin ?? "")) {
    return { ok: false, error: "Asignale un PIN de 4 a 6 dígitos." };
  }
  if (pin && !isValidPin(pin)) {
    return { ok: false, error: "El PIN debe tener 4 a 6 dígitos." };
  }
  if (id === user.id && !data.active) {
    return { ok: false, error: "No podés desactivar tu propia cuenta." };
  }
  if (id === user.id && data.role !== "ADMIN") {
    return { ok: false, error: "No podés quitarte el rol de administrador." };
  }

  try {
    if (id) {
      await prisma.user.update({
        where: { id },
        data: { ...data, ...(pin ? { pinHash: await hashPin(pin) } : {}) },
      });
    } else {
      await prisma.user.create({ data: { ...data, pinHash: await hashPin(pin!) } });
    }
    revalidatePath("/ajustes/equipo");
    return { ok: true };
  } catch {
    return { ok: false, error: "Ese nombre de usuario ya está tomado." };
  }
}

const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "El nombre es muy corto."),
  kind: z.enum(["PRINCIPAL", "AREA", "MINIBAR"]),
  active: z.boolean().default(true),
});

export async function saveLocation(input: unknown): Promise<Result> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { id, ...data } = parsed.data;

  if (data.kind === "PRINCIPAL") {
    const existing = await prisma.location.findFirst({
      where: { kind: "PRINCIPAL", active: true, ...(id ? { NOT: { id } } : {}) },
      select: { name: true },
    });
    if (existing) {
      return {
        ok: false,
        error: `Ya existe una bodega principal (${existing.name}). Sólo puede haber una.`,
      };
    }
  }

  try {
    if (id) await prisma.location.update({ where: { id }, data });
    else await prisma.location.create({ data });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar la bodega." };
  }
}

const roomSchema = z.object({
  id: z.string().optional(),
  number: z.string().trim().min(1, "Falta el número."),
  floor: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().default(true),
});

/** Crear una habitación crea su minibar: nunca deberían existir por separado. */
export async function saveRoom(input: unknown): Promise<Result> {
  const parsed = roomSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { id, ...data } = parsed.data;

  try {
    if (id) {
      await prisma.room.update({ where: { id }, data });
    } else {
      const count = await prisma.room.count();
      const room = await prisma.room.create({ data: { ...data, sortOrder: count } });
      await prisma.location.create({
        data: {
          name: `Minibar ${room.number}`,
          kind: "MINIBAR",
          roomId: room.id,
          sortOrder: count,
        },
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "Ya existe una habitación con ese número." };
  }
}

const templateItemSchema = z.object({
  templateId: z.string().min(1),
  id: z.string().optional(),
  label: z.string().trim().min(2, "Escribí qué se revisa."),
  kind: z.enum(["DOTACION", "CONSUMIBLE"]),
  productId: z.string().nullable().optional(),
  expectedQty: z.number().min(0).nullable().optional(),
  requireNote: z.boolean().default(false),
});

export async function saveChecklistItem(input: unknown): Promise<Result> {
  const parsed = templateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { id, templateId, ...data } = parsed.data;

  if (data.kind === "CONSUMIBLE" && !data.productId) {
    return {
      ok: false,
      error: "Un consumible tiene que apuntar a un producto: si no, no puede descontar nada.",
    };
  }

  try {
    if (id) {
      await prisma.checklistTemplateItem.update({ where: { id }, data });
    } else {
      const count = await prisma.checklistTemplateItem.count({ where: { templateId } });
      await prisma.checklistTemplateItem.create({
        data: { ...data, templateId, sortOrder: count + 1 },
      });
    }
    revalidatePath("/ajustes/checklist");
    revalidatePath("/checklist");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo guardar el ítem." };
  }
}

export async function deleteChecklistItem(id: string): Promise<Result> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    await prisma.checklistTemplateItem.delete({ where: { id } });
    revalidatePath("/ajustes/checklist");
    revalidatePath("/checklist");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No se puede borrar: ya hay revisiones que lo usan. Editalo en vez de borrarlo.",
    };
  }
}
