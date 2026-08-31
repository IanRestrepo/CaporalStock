"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryError, registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { actor } from "@/lib/session";

const schema = z.object({
  locationId: z.string().min(1),
  roomId: z.string().min(1),
  consumed: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().positive() }))
    .default([]),
  restock: z.boolean().default(true),
  note: z.string().max(500).nullable().optional(),
});

export type CloseResult =
  | { ok: true; consumed: number; restocked: number }
  | { ok: false; error: string };

/**
 * Cierre de minibar: el ama de llaves cuenta lo que falta, no lo que queda.
 * En un solo gesto se registra el consumo (que carga a la suite) y se repone
 * hasta el nivel par desde la bodega principal.
 */
export async function closeMinibar(input: unknown): Promise<CloseResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor();
  if (!user) return { ok: false, error };

  const { locationId, roomId, consumed, restock, note } = parsed.data;

  try {
    if (consumed.length) {
      await registerMovement({
        type: "CONSUMO",
        createdById: user.id,
        fromLocationId: locationId,
        roomId,
        reason: "Consumo de minibar",
        note: note ?? null,
        lines: consumed,
      });
    }

    let restocked = 0;

    if (restock) {
      const principal = await prisma.location.findFirst({
        where: { kind: "PRINCIPAL", active: true },
        select: { id: true },
      });

      if (!principal) {
        return { ok: false, error: "No hay una bodega principal configurada." };
      }

      const rows = await prisma.stock.findMany({
        where: { locationId, parQty: { not: null } },
        select: { productId: true, quantity: true, parQty: true },
      });

      const deficits = rows
        .map((row) => ({
          productId: row.productId,
          quantity: Number(row.parQty) - Number(row.quantity),
        }))
        .filter((line) => line.quantity > 0);

      if (deficits.length) {
        // Sólo se repone lo que la bodega principal realmente tiene: es
        // preferible un minibar a medio llenar que un saldo inventado.
        const supply = await prisma.stock.findMany({
          where: {
            locationId: principal.id,
            productId: { in: deficits.map((d) => d.productId) },
          },
          select: { productId: true, quantity: true },
        });
        const onHand = new Map(supply.map((s) => [s.productId, Number(s.quantity)]));

        const lines = deficits
          .map((line) => ({
            productId: line.productId,
            quantity: Math.min(line.quantity, onHand.get(line.productId) ?? 0),
          }))
          .filter((line) => line.quantity > 0);

        if (lines.length) {
          await registerMovement({
            type: "TRASLADO",
            createdById: user.id,
            fromLocationId: principal.id,
            toLocationId: locationId,
            roomId,
            reason: "Reposición de minibar",
            lines,
          });
          restocked = lines.length;
        }
      }
    }

    revalidatePath("/", "layout");
    return { ok: true, consumed: consumed.length, restocked };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo cerrar el minibar. Intentá de nuevo." };
  }
}

const parSchema = z.object({
  locationId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      parQty: z.number().min(0),
    }),
  ),
});

/**
 * Define qué debe contener un minibar y en qué cantidad.
 *
 * Sin esto una suite recién creada tiene nevera pero nadie sabe qué va adentro,
 * y el cierre de minibar no tiene contra qué comparar. El mínimo se deriva del
 * par: por debajo de la mitad, la suite entra en alertas.
 */
export async function setMinibarPar(input: unknown): Promise<CloseResult> {
  const parsed = parSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { locationId, items } = parsed.data;

  try {
    for (const item of items) {
      if (item.parQty > 0) {
        await prisma.stock.upsert({
          where: { productId_locationId: { productId: item.productId, locationId } },
          create: {
            productId: item.productId,
            locationId,
            quantity: 0,
            parQty: item.parQty,
            minQty: Math.max(1, Math.floor(item.parQty / 2)),
          },
          update: {
            parQty: item.parQty,
            minQty: Math.max(1, Math.floor(item.parQty / 2)),
          },
        });
      } else {
        // Sacarlo del minibar es quitarle el par, no borrar el saldo:
        // si todavía quedan tres cervezas adentro, siguen existiendo.
        await prisma.stock.updateMany({
          where: { productId: item.productId, locationId },
          data: { parQty: null, minQty: null },
        });
      }
    }

    revalidatePath("/", "layout");
    return { ok: true, consumed: 0, restocked: items.filter((i) => i.parQty > 0).length };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo guardar la configuración del minibar." };
  }
}

/** Copia la configuración de otra suite: montar la 207 igual que la 101. */
export async function copyMinibarPar(
  fromLocationId: string,
  toLocationId: string,
): Promise<CloseResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  if (fromLocationId === toLocationId) {
    return { ok: false, error: "Elige una suite distinta para copiar." };
  }

  try {
    const source = await prisma.stock.findMany({
      where: { locationId: fromLocationId, parQty: { not: null } },
      select: { productId: true, parQty: true },
    });

    if (!source.length) {
      return { ok: false, error: "Esa suite tampoco tiene el minibar configurado." };
    }

    return await setMinibarPar({
      locationId: toLocationId,
      items: source.map((row) => ({
        productId: row.productId,
        parQty: Number(row.parQty),
      })),
    });
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo copiar la configuración." };
  }
}
