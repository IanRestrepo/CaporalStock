"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InventoryError, adjustStock, registerMovement } from "@/lib/inventory";
import { actor } from "@/lib/session";

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("Las cantidades deben ser mayores a cero."),
});

const movementSchema = z.object({
  type: z.enum(["ENTRADA", "TRASLADO", "CONSUMO", "DANIO", "AJUSTE"]),
  fromLocationId: z.string().nullable().optional(),
  toLocationId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  reason: z.string().max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  lines: z.array(lineSchema).min(1, "Agrega al menos un producto."),
});

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

/** Tipos que un empleado puede registrar por su cuenta. */
const EMPLOYEE_TYPES = new Set(["TRASLADO", "CONSUMO", "DANIO"]);

export async function createMovement(input: unknown): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const data = parsed.data;

  const { user, error } = await actor(EMPLOYEE_TYPES.has(data.type) ? "CUALQUIERA" : "ADMIN");
  if (!user) return { ok: false, error };

  try {
    if (data.type === "DANIO" && !data.reason) {
      return { ok: false, error: "Un daño necesita motivo: sin eso el reporte de mermas no sirve." };
    }

    const movement = await registerMovement({
      type: data.type,
      createdById: user.id,
      fromLocationId: data.fromLocationId ?? null,
      toLocationId: data.toLocationId ?? null,
      roomId: data.roomId ?? null,
      reason: data.reason ?? null,
      note: data.note ?? null,
      lines: data.lines,
    });

    revalidatePath("/", "layout");
    return { ok: true, id: movement.id };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

const countSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  countedQty: z.number().min(0),
  reason: z.string().min(1, "Cuenta por qué estás ajustando."),
  note: z.string().max(500).nullable().optional(),
});

export async function submitCount(input: unknown): Promise<ActionResult> {
  const parsed = countSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    const movement = await adjustStock({ ...parsed.data, createdById: user.id });
    revalidatePath("/", "layout");
    return { ok: true, id: movement.id };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function message(error: unknown) {
  if (error instanceof InventoryError) return error.message;
  console.error(error);
  return "No se pudo guardar el movimiento. Intentá de nuevo.";
}
