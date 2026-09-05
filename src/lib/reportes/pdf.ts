import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { HACIENDA, type Documento } from "@/lib/reportes/documento";

/**
 * El papel.
 *
 * Un solo lugar decide cómo se ve un reporte de la hacienda: márgenes, tinta,
 * el alto de las filas. Los reportes traen datos, no decisiones de diseño.
 */

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 48;
const DERECHA = A4.ancho - MARGEN;

const FONDO = rgb(0.9647, 0.9569, 0.9373);
const TINTA = rgb(0.1059, 0.1059, 0.1059);
const TITULO = rgb(0.1843, 0.1647, 0.1412);
const SUAVE = rgb(0.4353, 0.4196, 0.3843);
const LINEA = rgb(0.847, 0.8314, 0.7922);
const LINEA_TENUE = rgb(0.9059, 0.8902, 0.8549);

/** Alto de fila y dónde empieza el cuadro: copiados del original. */
const FILA = 21;
const PRIMERA_FILA = 575.89;
const PIE = 64;

type Tipos = { normal: PDFFont; fuerte: PDFFont };

/** pdf-lib escribe WinAnsi: lo que no entra ahí revienta al guardar. */
function limpiar(texto: string) {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\xFF]/g, "");
}

function escribir(
  page: PDFPage,
  texto: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = TINTA,
) {
  page.drawText(limpiar(texto), { x, y, font, size, color });
}

function aLaDerecha(
  page: PDFPage,
  texto: string,
  borde: number,
  y: number,
  font: PDFFont,
  size: number,
  color = TINTA,
) {
  const limpio = limpiar(texto);
  const ancho = font.widthOfTextAtSize(limpio, size);
  page.drawText(limpio, { x: borde - ancho, y, font, size, color });
}

/** Corta lo que no entra en su columna en vez de pisar la de al lado. */
function recortar(texto: string, font: PDFFont, size: number, ancho: number) {
  const limpio = limpiar(texto);
  if (font.widthOfTextAtSize(limpio, size) <= ancho) return limpio;
  let corte = limpio;
  while (corte.length > 1 && font.widthOfTextAtSize(`${corte}…`, size) > ancho) {
    corte = corte.slice(0, -1);
  }
  return `${corte.trimEnd()}...`;
}

function hoja(pdf: PDFDocument) {
  const page = pdf.addPage([A4.ancho, A4.alto]);
  page.drawRectangle({ x: 0, y: 0, width: A4.ancho, height: A4.alto, color: FONDO });
  return page;
}

function raya(page: PDFPage, y: number, color = LINEA) {
  page.drawLine({
    start: { x: MARGEN, y },
    end: { x: DERECHA, y },
    thickness: 0.8,
    color,
  });
}

function encabezado(page: PDFPage, t: Tipos, doc: Documento, generado: string) {
  escribir(page, HACIENDA.nombre, MARGEN, 777.89, t.fuerte, 22, TITULO);
  aLaDerecha(page, doc.clase.toUpperCase(), DERECHA, 785.89, t.fuerte, 16, TITULO);
  aLaDerecha(page, doc.subtitulo, DERECHA, 769.89, t.normal, 9, SUAVE);

  escribir(page, HACIENDA.razon, MARGEN, 729.89, t.fuerte, 11, TITULO);
  escribir(page, HACIENDA.contacto, MARGEN, 714.89, t.normal, 8.5, SUAVE);
  escribir(page, `Generado ${generado}`, MARGEN, 701.89, t.normal, 8.5, SUAVE);

  // Las cifras del encabezado: etiqueta chica arriba, valor grande abajo.
  const columnas = doc.resumen.slice(0, 4);
  const paso = (DERECHA - MARGEN) / Math.max(columnas.length, 1);
  columnas.forEach((celda, i) => {
    const ultima = i === columnas.length - 1;
    const x = MARGEN + paso * i;
    if (ultima) {
      aLaDerecha(page, celda.etiqueta, DERECHA, 665.89, t.normal, 8, SUAVE);
      aLaDerecha(page, celda.valor, DERECHA, 649.89, t.fuerte, 11);
    } else {
      escribir(page, celda.etiqueta, x, 665.89, t.normal, 8, SUAVE);
      escribir(page, celda.valor, x, 649.89, t.fuerte, 11);
    }
  });

  raya(page, 625.89);
}

/** Reparte el ancho sobrante: los pesos de las columnas son proporciones. */
function posiciones(columnas: Documento["columnas"]) {
  const total = columnas.reduce((s, c) => s + c.ancho, 0);
  const util = DERECHA - MARGEN;
  let x = MARGEN;
  return columnas.map((c) => {
    const ancho = (c.ancho / total) * util;
    const inicio = x;
    x += ancho;
    return { columna: c, x: inicio, ancho };
  });
}

function cabeceraDeTabla(page: PDFPage, t: Tipos, cols: ReturnType<typeof posiciones>, y: number) {
  for (const { columna, x, ancho } of cols) {
    if (columna.alinear === "derecha") {
      aLaDerecha(page, columna.titulo.toUpperCase(), x + ancho, y, t.fuerte, 8, SUAVE);
    } else {
      escribir(page, columna.titulo.toUpperCase(), x, y, t.fuerte, 8, SUAVE);
    }
  }
  raya(page, y - 8, LINEA);
}

export async function renderizarPdf(doc: Documento, generado: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const t: Tipos = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    fuerte: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const cols = posiciones(doc.columnas);
  const paginas: PDFPage[] = [];

  let page = hoja(pdf);
  paginas.push(page);
  encabezado(page, t, doc, generado);
  cabeceraDeTabla(page, t, cols, 601.89);
  let y = PRIMERA_FILA;

  if (!doc.filas.length) {
    escribir(page, doc.vacio ?? "No hay nada para este período.", MARGEN, y, t.normal, 9, SUAVE);
    y -= FILA;
  }

  for (const fila of doc.filas) {
    if (y < PIE + FILA * 2) {
      page = hoja(pdf);
      paginas.push(page);
      cabeceraDeTabla(page, t, cols, A4.alto - MARGEN - 12);
      y = A4.alto - MARGEN - 38;
    }

    cols.forEach(({ columna, x, ancho }, i) => {
      const valor = fila[i] ?? "";
      const font = columna.destacar ? t.fuerte : t.normal;
      if (columna.alinear === "derecha") {
        aLaDerecha(page, valor, x + ancho, y, font, 9);
      } else {
        escribir(page, recortar(valor, font, 9, ancho - 8), x, y, font, 9);
      }
    });

    raya(page, y - 7, LINEA_TENUE);
    y -= FILA;
  }

  // Los totales van pegados al cuadro, no al pie de la hoja.
  if (doc.totales?.length || doc.total) {
    let ty = y - 12;
    const etiquetaX = MARGEN + (DERECHA - MARGEN) * 0.55;

    for (const linea of doc.totales ?? []) {
      if (ty < PIE + 40) break;
      escribir(page, linea.etiqueta, etiquetaX, ty, t.normal, 10, SUAVE);
      aLaDerecha(page, linea.valor, DERECHA, ty, t.normal, 10);
      ty -= 22;
    }

    if (doc.total && ty > PIE + 20) {
      page.drawLine({
        start: { x: etiquetaX, y: ty + 14 },
        end: { x: DERECHA, y: ty + 14 },
        thickness: 0.8,
        color: LINEA,
      });
      escribir(page, doc.total.etiqueta.toUpperCase(), etiquetaX, ty - 6, t.fuerte, 11, TITULO);
      aLaDerecha(page, doc.total.valor, DERECHA, ty - 8, t.fuerte, 13, TITULO);
    }
  }

  paginas.forEach((p, i) => {
    escribir(p, HACIENDA.pie, MARGEN, 40, t.normal, 8, SUAVE);
    aLaDerecha(p, `Página ${i + 1} de ${paginas.length}`, DERECHA, 40, t.normal, 8, SUAVE);
  });

  return pdf.save();
}
