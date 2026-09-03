"use server";

import { revalidatePath } from "next/cache";
import { limpiarPractica, prepararPractica } from "@/lib/practice";
import { actor } from "@/lib/session";

export type PracticeResult = { ok: true } | { ok: false; error: string };

/** Monta la bodega de práctica al abrir el tutorial. */
export async function iniciarPractica(): Promise<PracticeResult> {
  const { user, error } = await actor();
  if (!user) return { ok: false, error };

  try {
    await prepararPractica(user.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo preparar la práctica." };
  }
}

/**
 * Borra la práctica. Se llama al terminar el tutorial y al salir de sus
 * pantallas, así que tiene que poder correr muchas veces sin quejarse.
 */
export async function borrarPractica(): Promise<PracticeResult> {
  const { user, error } = await actor();
  if (!user) return { ok: false, error };

  try {
    await limpiarPractica();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo borrar la práctica." };
  }
}
