import { describe, expect, test } from "vitest";
import { armarReporte, NOMBRES, TIPOS } from "@/lib/reportes/catalogo";
import { renderizarPdf } from "@/lib/reportes/pdf";

/**
 * El papel que sale de acá lo lee la administración y se archiva.
 *
 * Lo que se prueba es que cada reporte se arme y se dibuje sin reventar, con
 * cualquier estado de la base — incluido el más común al empezar, que es vacío.
 * Un reporte que falla al renderizar no avisa: devuelve un 500 cuando alguien
 * ya lo estaba esperando.
 */

const DESDE = new Date("2026-08-01T00:00:00");
const HASTA = new Date("2026-09-01T00:00:00");

describe("reportes en PDF", () => {
  test("están todos nombrados", () => {
    for (const tipo of TIPOS) expect(NOMBRES[tipo]).toBeTruthy();
  });

  for (const tipo of TIPOS) {
    test(`${tipo} se arma y se dibuja`, async () => {
      const doc = await armarReporte(tipo, DESDE, HASTA);

      expect(doc.subtitulo.length).toBeGreaterThan(3);
      expect(doc.resumen.length).toBe(4);
      expect(doc.columnas.length).toBeGreaterThan(2);
      // Cada fila trae exactamente una celda por columna, o el cuadro se corre.
      for (const fila of doc.filas) expect(fila).toHaveLength(doc.columnas.length);
      // Con la base vacía la hoja no puede quedar muda.
      if (!doc.filas.length) expect(doc.vacio).toBeTruthy();

      const pdf = await renderizarPdf(doc, "05/09/2026 10:00");
      expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(800);
    }, 60000);
  }

  test("un rango sin datos igual produce una hoja válida", async () => {
    const doc = await armarReporte("ventas", new Date("1999-01-01"), new Date("1999-02-01"));
    expect(doc.filas).toHaveLength(0);
    const pdf = await renderizarPdf(doc, "05/09/2026 10:00");
    expect(pdf.byteLength).toBeGreaterThan(800);
  }, 60000);

  test("los acentos no rompen la fuente", async () => {
    const pdf = await renderizarPdf(
      {
        clase: "Reporte",
        subtitulo: "de prueba",
        resumen: [
          { etiqueta: "Período", valor: "Añejo" },
          { etiqueta: "Señal", valor: "—" },
          { etiqueta: "Comillas", valor: "“x”" },
          { etiqueta: "Total", valor: "$ 1.000" },
        ],
        columnas: [
          { titulo: "Producto", ancho: 60 },
          { titulo: "Valor", ancho: 40, alinear: "derecha" },
        ],
        filas: [["Aguardiente Amarillo · media", "$ 35.000"]],
      },
      "05/09/2026 10:00",
    );
    expect(pdf.byteLength).toBeGreaterThan(800);
  }, 60000);
});
