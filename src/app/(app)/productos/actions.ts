"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { borrarProducto, guardarProducto, type DatosProducto } from "@/lib/productos";
import { actor } from "@/lib/session";

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "El nombre es muy corto."),
  categoryId: z.string().min(1, "Elige una subcategoría."),
  sectionId: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value || null),
  baseUnit: z.enum(["GRAMO", "KILO", "MILILITRO", "LITRO", "UNIDAD"]),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0),
  minQty: z.number().min(0),
  perishable: z.boolean(),
  active: z.boolean().default(true),
});

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveProduct(input: unknown): Promise<SaveResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    const product = await guardarProducto(parsed.data as DatosProducto);
    revalidatePath("/", "layout");
    return { ok: true, id: product.id };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo guardar el producto." };
  }
}

const presentationSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1, "Ponle nombre a la presentación."),
  factor: z.number().positive("El contenido debe ser mayor a cero."),
});

export async function addPresentation(input: unknown): Promise<SaveResult> {
  const parsed = presentationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    const created = await prisma.presentation.create({ data: parsed.data });
    revalidatePath("/", "layout");
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: "Ya existe una presentación con ese nombre." };
  }
}

const thresholdSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  minQty: z.number().min(0).nullable(),
  parQty: z.number().min(0).nullable(),
});

/** Mínimo y nivel par por ubicación: el minibar no exige lo mismo que la bodega. */
export async function setThresholds(input: unknown): Promise<SaveResult> {
  const parsed = thresholdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { productId, locationId, minQty, parQty } = parsed.data;

  try {
    const row = await prisma.stock.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: 0, minQty, parQty },
      update: { minQty, parQty },
    });
    revalidatePath("/", "layout");
    return { ok: true, id: row.id };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo guardar el mínimo." };
  }
}

export type DeleteResult =
  | { ok: true; archived: boolean }
  | { ok: false; error: string };

/**
 * Borra un producto desde la bodega, sin entrar a su ficha.
 *
 * Si nunca se movió, se va de verdad (con sus presentaciones y saldos en
 * cero). Si ya tiene historial, se archiva: borrarlo dejaría movimientos,
 * compras y checklists apuntando al vacío, y el pasado del inventario no se
 * reescribe.
 */
export async function deleteProduct(id: string): Promise<DeleteResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    const { archivado } = await borrarProducto(id);
    revalidatePath("/", "layout");
    return { ok: true, archived: archivado };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo borrar el producto." };
  }
}
