import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const COOKIE = "caporal_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días: es un teléfono de trabajo, no un banco

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Falta SESSION_SECRET en el entorno.");
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  accent: string;
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Una sola consulta por request, aunque veinte componentes pregunten quién es. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, username: true, role: true, accent: true, active: true },
    });

    if (!user || !user.active) return null;

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      accent: user.accent,
    };
  } catch {
    return null;
  }
});

/** Para páginas: sin sesión no hay error 500, hay pantalla de entrada. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Para páginas de administración: un empleado que llegue por URL vuelve al inicio. */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/**
 * Para server actions: devuelve el error como dato en vez de redirigir, porque
 * dentro de una acción `redirect()` es una excepción que el catch se tragaría.
 */
export async function actor(role: "ADMIN" | "CUALQUIERA" = "CUALQUIERA") {
  const user = await getSessionUser();
  if (!user) return { user: null, error: "Tu sesión venció. Volvé a entrar." } as const;
  if (role === "ADMIN" && user.role !== "ADMIN") {
    return { user: null, error: "Esta acción sólo la puede hacer un administrador." } as const;
  }
  return { user, error: null } as const;
}
