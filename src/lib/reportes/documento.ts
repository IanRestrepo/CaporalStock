/**
 * La forma de un reporte, antes de ser papel.
 *
 * Separar el dato del dibujo es lo que permite que las cifras salgan de una
 * consulta y el estilo de un solo lugar: cambiar el membrete no toca ninguna
 * consulta, y agregar un reporte no obliga a pensar en tipografías.
 */

export type Alineacion = "izquierda" | "derecha";

export type Columna = {
  titulo: string;
  /** Ancho en puntos. La última columna se estira contra el margen derecho. */
  ancho: number;
  alinear?: Alineacion;
  /** La columna que identifica la fila va en negrita, como la placa del original. */
  destacar?: boolean;
};

export type Documento = {
  /** Va arriba a la derecha, en versalitas. */
  clase: string;
  subtitulo: string;
  /** Las cuatro cifras del encabezado. La última se alinea a la derecha. */
  resumen: { etiqueta: string; valor: string }[];
  columnas: Columna[];
  filas: string[][];
  /** El pie del cuadro: subtotales y el total en grande. */
  totales?: { etiqueta: string; valor: string }[];
  total?: { etiqueta: string; valor: string };
  /** Cuando no hay nada que listar, se dice y no se deja la hoja muda. */
  vacio?: string;
};

/** Quién firma la hoja. */
export const HACIENDA = {
  nombre: "HACIENDA CAPORAL",
  razon: "Hacienda Caporal",
  contacto: "Alojamiento y hospedaje",
  pie: "Generado por Caporal",
};
