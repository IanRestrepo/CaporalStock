import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Cliente perezoso: no abre conexión hasta que alguien consulta de verdad.
 * Así `next build` puede importar las rutas sin exigir una base de datos viva.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copiá .env.example a .env y pegá la cadena de Neon.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as {
  __caporalPrisma?: PrismaClient;
};

function client(): PrismaClient {
  if (!globalForPrisma.__caporalPrisma) {
    globalForPrisma.__caporalPrisma = createClient();
  }
  return globalForPrisma.__caporalPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(client(), prop, receiver);
  },
});
