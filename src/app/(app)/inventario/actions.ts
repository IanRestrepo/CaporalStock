"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryError, applyPhysicalCount } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { ScanError, readInventorySheet, type ScannedLine } from "@/lib/scan";
import { actor } from "@/lib/session";

export type ScanResult =
  | { ok: true; lineas: ScannedLine[] }
  | { ok: false; error: string };

const MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Lee una foto de la hoja de conteo. No toca el inventario: sólo propone
 * renglones para que una persona los revise.
 */
export async function scanSheet(formData: FormData): Promise<ScanResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const file = formData.get("foto");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No llegó ninguna foto." };
  }
  if (!MEDIA.has(file.type)) {
    return { ok: false, error: "La foto debe ser JPG, PNG o WEBP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "La foto pesa demasiado. Tomala de nuevo con menos resolución." };
  }

  try {
    const catalog = await prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        section: { select: { name: true } },
      },
    });

    const lineas = await readInventorySheet(
      {
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType: file.type as "image/jpeg" | "image/png" | "image/webp",
      },
      catalog.map((p) => ({
        id: p.id,
        name: p.name,
        baseUnit: p.baseUnit,
        section: p.section?.name ?? "Sin sección",
      })),
    );

    if (!lineas.length) {
      return {
        ok: false,
        error: "No se reconoció ningún renglón. Revisá que la hoja se vea completa y con luz.",
      };
    }

    return { ok: true, lineas };
  } catch (err) {
    if (err instanceof ScanError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo leer la hoja. Volvé a intentar." };
  }
}

const countSchema = z.object({
  locationId: z.string().min(1, "Elegí la bodega que contaste."),
  note: z.string().max(500).nullable().optional(),
  counts: z
    .array(
      z.object({
        productId: z.string().min(1),
        countedQty: z.number().min(0),
      }),
    )
    .min(1, "No hay renglones para aplicar."),
});

export type CountResult =
  | { ok: true; sobrantes: number; faltantes: number }
  | { ok: false; error: string };

/** Aplica el conteo revisado. Acá sí se mueve el saldo, y queda como AJUSTE. */
export async function applyCount(input: unknown): Promise<CountResult> {
  const parsed = countSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { locationId, counts, note } = parsed.data;

  // Dos renglones del mismo producto en la hoja se suman: contar en dos tandas
  // es normal cuando el producto está en dos estantes.
  const merged = new Map<string, number>();
  for (const row of counts) {
    merged.set(row.productId, (merged.get(row.productId) ?? 0) + row.countedQty);
  }

  try {
    const result = await applyPhysicalCount({
      locationId,
      createdById: user.id,
      note: note ?? null,
      counts: [...merged.entries()].map(([productId, countedQty]) => ({
        productId,
        countedQty,
      })),
    });

    revalidatePath("/", "layout");
    return { ok: true, sobrantes: result.sobrantes, faltantes: result.faltantes };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo aplicar el conteo." };
  }
}
