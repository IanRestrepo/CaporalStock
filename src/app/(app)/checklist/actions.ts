"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryError, registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { actor } from "@/lib/session";

const schema = z.object({
  roomId: z.string().min(1),
  templateId: z.string().min(1),
  sourceLocationId: z.string().min(1, "Elegí de qué bodega sale la dotación."),
  note: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        templateItemId: z.string().min(1),
        status: z.enum(["PENDIENTE", "OK", "FALTANTE", "DANIADO", "REPUESTO"]),
        qty: z.number().min(0).nullable().optional(),
        note: z.string().max(300).nullable().optional(),
      }),
    )
    .min(1),
});

export type ChecklistResult =
  | { ok: true; id: string; discounted: number }
  | { ok: false; error: string };

/**
 * Cierra una revisión de suite.
 *
 * Lo que se repuso no es sólo una marca en un papel: descuenta del inventario
 * y queda atado a la habitación, que es lo que después responde "quién sacó
 * toallas y para qué suite".
 */
export async function submitChecklist(input: unknown): Promise<ChecklistResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor();
  if (!user) return { ok: false, error };

  const { roomId, templateId, sourceLocationId, note, items } = parsed.data;

  try {
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      select: {
        items: { select: { id: true, productId: true, kind: true, label: true } },
      },
    });
    if (!template) return { ok: false, error: "Esa plantilla ya no existe." };

    const byId = new Map(template.items.map((i) => [i.id, i]));

    const missingNote = items.find(
      (i) => (i.status === "FALTANTE" || i.status === "DANIADO") && !i.note?.trim(),
    );
    if (missingNote) {
      const label = byId.get(missingNote.templateItemId)?.label ?? "un ítem";
      return {
        ok: false,
        error: `Contá qué pasó con ${label.toLowerCase()}: sin la nota, el reporte no sirve de nada.`,
      };
    }

    const run = await prisma.checklistRun.create({
      data: {
        roomId,
        templateId,
        userId: user.id,
        completedAt: new Date(),
        note: note ?? null,
        items: {
          create: items.map((item) => ({
            templateItemId: item.templateItemId,
            status: item.status,
            qty: item.qty ?? null,
            note: item.note?.trim() || null,
          })),
        },
      },
      select: { id: true },
    });

    const lines = items
      .filter((item) => item.status === "REPUESTO" && (item.qty ?? 0) > 0)
      .map((item) => ({ item, template: byId.get(item.templateItemId) }))
      .filter((entry) => entry.template?.kind === "CONSUMIBLE" && entry.template.productId)
      .map((entry) => ({
        productId: entry.template!.productId as string,
        quantity: entry.item.qty as number,
      }));

    if (lines.length) {
      await registerMovement({
        type: "CONSUMO",
        createdById: user.id,
        fromLocationId: sourceLocationId,
        roomId,
        reason: "Dotación de suite",
        checklistRunId: run.id,
        lines,
      });
    }

    revalidatePath("/", "layout");
    return { ok: true, id: run.id, discounted: lines.length };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo guardar la revisión." };
  }
}
