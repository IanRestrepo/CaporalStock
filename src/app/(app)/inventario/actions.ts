"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryError, applyPhysicalCount } from "@/lib/inventory";
import { actor } from "@/lib/session";

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
    .min(1, "No contaste ningún producto todavía."),
});

export type CountResult =
  | { ok: true; sobrantes: number; faltantes: number }
  | { ok: false; error: string };

/**
 * Aplica el conteo físico.
 *
 * Sólo llegan acá los productos que la persona efectivamente contó. Un producto
 * que no se tocó no es un producto en cero: es un producto que nadie miró, y
 * ponerlo en cero por omisión sería inventar una merma.
 */
export async function applyCount(input: unknown): Promise<CountResult> {
  const parsed = countSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { locationId, counts, note } = parsed.data;

  try {
    const result = await applyPhysicalCount({
      locationId,
      createdById: user.id,
      note: note ?? null,
      counts,
    });

    revalidatePath("/", "layout");
    return { ok: true, sobrantes: result.sobrantes, faltantes: result.faltantes };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo aplicar el conteo." };
  }
}
