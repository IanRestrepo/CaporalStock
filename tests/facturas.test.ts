import { afterAll, describe, expect, test } from "vitest";
import { readInvoice, storeInvoice } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

/**
 * La factura tiene que sobrevivir a la petición que la subió.
 *
 * Antes se escribía a disco, y en serverless eso falla al escribir y, si no
 * fallara, el archivo no estaría cuando alguien fuera a abrirlo.
 */

const guardadas: string[] = [];

function archivo(nombre: string, tipo: string, bytes: Uint8Array) {
  return new File([bytes as BlobPart], nombre, { type: tipo });
}

// Sin `$disconnect()`: el cliente es un singleton que comparten todos los
// archivos de prueba, y cerrarlo acá deja sin conexión a los que corran después.
afterAll(async () => {
  if (guardadas.length) {
    await prisma.invoiceFile.deleteMany({ where: { id: { in: guardadas } } });
  }
});

describe("facturas", () => {
  test("se guarda y se vuelve a leer igual", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const stored = await storeInvoice(archivo("FE-1042.pdf", "application/pdf", bytes));

    const id = stored.url.split("/").pop()!;
    guardadas.push(id);
    expect(stored.url).toBe(`/api/facturas/${id}`);

    const leida = await readInvoice(id);
    expect(leida).not.toBeNull();
    expect(leida!.mimeType).toBe("application/pdf");
    expect(leida!.name).toBe("FE-1042.pdf");
    expect(Buffer.from(leida!.data).equals(Buffer.from(bytes))).toBe(true);
  });

  test("una factura que no existe no revienta", async () => {
    expect(await readInvoice("noexiste")).toBeNull();
  });

  test("rechaza lo que no es factura", async () => {
    await expect(
      storeInvoice(archivo("hoja.xlsx", "application/vnd.ms-excel", new Uint8Array([1]))),
    ).rejects.toThrow(/PDF o una foto/);
  });

  test("rechaza lo que no pasaría por la función serverless", async () => {
    const grande = new Uint8Array(5 * 1024 * 1024);
    await expect(storeInvoice(archivo("gorda.pdf", "application/pdf", grande))).rejects.toThrow(
      /4 MB/,
    );
  });
});
