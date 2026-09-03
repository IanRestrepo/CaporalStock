import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Almacenamiento de facturas.
 *
 * El archivo vive en la base, no en disco. En un hosting serverless el disco es
 * de solo lectura y además se borra entre invocaciones: escribir ahí falla, y
 * si no fallara el archivo no estaría cuando alguien fuera a abrirlo.
 *
 * Se sirve por /api/facturas, que exige sesión de administrador — nadie llega
 * al PDF adivinando la URL.
 */

/**
 * Tope del archivo.
 *
 * No es un capricho: el cuerpo de una petición a una función serverless está
 * limitado a unos 4,5 MB, así que un archivo más grande no llegaría a
 * guardarse. Mejor decirlo antes de subir que fallar después.
 */
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
]);

export type StoredFile = { url: string; name: string };

export async function storeInvoice(file: File): Promise<StoredFile> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("La factura debe ser un PDF o una foto (JPG, PNG, WEBP).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("El archivo supera los 4 MB.");
  }

  const stored = await prisma.invoiceFile.create({
    data: {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    },
    select: { id: true },
  });

  return { url: `/api/facturas/${stored.id}`, name: file.name };
}

export async function readInvoice(id: string) {
  return prisma.invoiceFile.findUnique({
    where: { id },
    select: { data: true, mimeType: true, name: true },
  });
}
