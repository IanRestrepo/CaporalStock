"use server";

import { redirect } from "next/navigation";
import { authenticate, isValidPin } from "@/lib/auth";
import { createSession } from "@/lib/session";

export type LoginState = { error: string } | undefined;

/**
 * Devuelve el error o redirige. No usa `useActionState` del lado del cliente
 * para que el teclado pueda limpiar el PIN en el mismo sitio donde lo envía,
 * sin efectos que reaccionen a un estado anterior.
 */
export async function login(username: string, pin: string): Promise<LoginState> {
  if (!username.trim()) return { error: "Escribe tu usuario." };
  if (!isValidPin(pin)) return { error: "El PIN son 4 a 6 dígitos." };

  const user = await authenticate(username, pin);
  if (!user) return { error: "Usuario o PIN incorrecto." };

  await createSession(user.id);
  redirect("/");
}
