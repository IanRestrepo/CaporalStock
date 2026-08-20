"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryError, registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { actor } from "@/lib/session";
import { round4 } from "@/lib/units";

const schema = z.object({
  recipeId: z.string().min(1),
  locationId: z.string().min(1, "Elegí de qué bodega salen los ingredientes."),
  portions: z.number().positive("Las porciones deben ser mayores a cero."),
  note: z.string().max(500).nullable().optional(),
});

export type ProduceResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Registra una producción: descuenta los ingredientes proporcionalmente a las
 * porciones hechas. Es la traducción de "hice 24 panes" a gramos de harina.
 */
export async function produceRecipe(input: unknown): Promise<ProduceResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor();
  if (!user) return { ok: false, error };

  const { recipeId, locationId, portions, note } = parsed.data;

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: {
        name: true,
        yieldPortions: true,
        items: { select: { productId: true, qtyBase: true } },
      },
    });

    if (!recipe || !recipe.items.length) {
      return { ok: false, error: "Esa receta no tiene ingredientes cargados." };
    }

    const yieldPortions = Number(recipe.yieldPortions);
    const factor = portions / yieldPortions;

    const movement = await registerMovement({
      type: "CONSUMO",
      createdById: user.id,
      fromLocationId: locationId,
      reason: `Producción · ${recipe.name}`,
      note: note ?? `${portions} porciones`,
      lines: recipe.items.map((item) => ({
        productId: item.productId,
        quantity: round4(Number(item.qtyBase) * factor),
      })),
    });

    revalidatePath("/", "layout");
    return { ok: true, id: movement.id };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo registrar la producción." };
  }
}

const recipeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Ponele nombre a la receta."),
  yieldPortions: z.number().positive("¿Cuántas porciones rinde?"),
  notes: z.string().max(500).nullable().optional(),
  active: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        /** Cantidad en unidad base para el rendimiento completo. */
        qtyBase: z.number().positive("Las cantidades deben ser mayores a cero."),
      }),
    )
    .min(1, "Una receta sin ingredientes no calcula nada."),
});

export type RecipeResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Crea o reescribe una receta.
 *
 * Los ingredientes se guardan para el rendimiento COMPLETO, no por porción: así
 * "600 g de harina rinden 12 panes" se escribe tal como lo dice el cocinero, y
 * la regla de tres la hace la app.
 */
export async function saveRecipe(input: unknown): Promise<RecipeResult> {
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { id, items, ...data } = parsed.data;

  const repetido = items.length !== new Set(items.map((i) => i.productId)).size;
  if (repetido) {
    return { ok: false, error: "Hay un ingrediente repetido: sumalos en un solo renglón." };
  }

  try {
    const recipe = id
      ? await prisma.recipe.update({
          where: { id },
          data: {
            ...data,
            // Reemplazo completo: es más simple y más seguro que reconciliar
            // renglón por renglón, y una receta no tiene historial que preservar.
            items: { deleteMany: {}, create: items },
          },
        })
      : await prisma.recipe.create({ data: { ...data, items: { create: items } } });

    revalidatePath("/cocina");
    return { ok: true, id: recipe.id };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Ya existe una receta con ese nombre." };
  }
}

export async function deleteRecipe(id: string): Promise<RecipeResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    await prisma.recipe.delete({ where: { id } });
    revalidatePath("/cocina");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se pudo eliminar la receta." };
  }
}
