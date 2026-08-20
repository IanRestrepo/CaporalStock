import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Almacenamiento de facturas.
 *
 * En local escribe a ./uploads (fuera de /public, para que nadie llegue al PDF
 * adivinando la URL: se sirve por /api/facturas con sesión válida).
 *
 * En un hosting serverless el disco es efímero — ahí hay que enchufar un blob
 * store. El único punto a cambiar es esta función.
 */

const ROOT = path.join(process.cwd(), "uploads");
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
]);

export type StoredFile = { url: string; name: string };

export async function storeInvoice(file: File): Promise<StoredFile> {
  const extension = ALLOWED.get(file.type);
  if (!extension) {
    throw new Error("La factura debe ser un PDF o una foto (JPG, PNG, WEBP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("El archivo supera los 8 MB.");
  }

  const key = `${randomUUID()}.${extension}`;
  const folder = path.join(ROOT, "facturas");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, key), Buffer.from(await file.arrayBuffer()));

  return { url: `/api/facturas/${key}`, name: file.name };
}

export function invoicePath(key: string) {
  // Sin separadores: el nombre viene de la URL y no debe poder salir de la carpeta.
  if (key.includes("/") || key.includes("\\") || key.includes("..")) return null;
  return path.join(ROOT, "facturas", key);
}
