import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ROUNDS = 10;

export function hashPin(pin: string) {
  return bcrypt.hash(pin, ROUNDS);
}

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Login por usuario + PIN. Se compara siempre contra un hash — incluso cuando el
 * usuario no existe — para que el tiempo de respuesta no delate qué usuarios
 * son reales.
 */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function authenticate(username: string, pin: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, pinHash: true, active: true },
  });

  const ok = await bcrypt.compare(pin, user?.pinHash ?? DUMMY_HASH);

  if (!user || !user.active || !ok) return null;
  return { id: user.id };
}
