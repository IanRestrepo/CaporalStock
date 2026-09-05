import "server-only";
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { HERRAMIENTAS, type Herramienta } from "@/lib/reportes/herramientas";

/**
 * El agente de reportes.
 *
 * Traduce una pregunta en español a las consultas que ya sabe hacer el sistema,
 * y redacta el resultado. Las cifras salen de la base: acá sólo se acomodan.
 */

/**
 * El modelo.
 *
 * Alcanza de sobra: el trabajo es elegir cuál de seis consultas correr y
 * redactar un párrafo. Elegido midiendo, no por ser el más nuevo: al probarlo,
 * `3.8-flash` devolvía 503 por saturación y `flash-latest` fallaba una de cada
 * dos, mientras que éste respondió siempre en unos tres segundos. Si algún día
 * devuelve 404, `ai.models.list()` dice cuáles hay.
 */
const MODELO = "gemini-3.5-flash";

/** Cuántas veces puede pedir datos antes de escribir. Seis herramientas, margen para encadenar. */
const MAX_VUELTAS = 8;

/**
 * El plan gratuito se cae solo.
 *
 * No es la clave ni la petición: el modelo se satura y devuelve 503, y a veces
 * un 403 que también es pasajero. Reintentar dos veces con espera convierte la
 * mayoría de esos fallos en un reporte, en vez de un error que no explica nada.
 */
const TRANSITORIOS = new Set([403, 429, 500, 502, 503, 504]);
const REINTENTOS = 3;

async function conReintentos<T>(hacer: () => Promise<T>): Promise<T> {
  let ultimo: unknown;
  for (let intento = 0; intento < REINTENTOS; intento++) {
    try {
      return await hacer();
    } catch (err) {
      ultimo = err;
      const status = (err as { status?: number })?.status;
      if (!status || !TRANSITORIOS.has(status)) throw err;
      if (intento < REINTENTOS - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
      }
    }
  }
  throw ultimo;
}

const INSTRUCCIONES = `Sos el analista de Caporal, el sistema de inventario de un hotel pequeño en Colombia.

Respondés preguntas sobre el inventario usando las herramientas disponibles, y devolvés un reporte listo para imprimir y pasarle a la administración.

Reglas que no se negocian:

- Toda cifra tiene que venir de una herramienta. Nunca calcules, estimes ni completes un número de memoria. Si te falta un dato, corré otra herramienta o decí que no lo tenés.
- Si la pregunta no se puede responder con las herramientas, decilo en una línea y explicá qué haría falta. No inventes un reporte plausible.
- No inventes nombres de personas, proveedores, marcas ni lugares. No te dirijas a nadie por su nombre y no abras con un saludo: no sabés quién va a leer esto.
- Las fechas relativas ("este mes", "agosto", "la semana pasada") las resolvés contra la fecha de hoy, que viene en el mensaje. El rango va de la fecha inicial inclusive a la final exclusiva.
- La plata es en pesos colombianos. Escribila como $ 1.234.567, sin decimales.
- Las cantidades vienen ya formateadas por las herramientas: copialas tal cual.

Formato de la respuesta, en Markdown:

1. Un título corto de una línea, con el período si aplica.
2. Un párrafo de dos o tres frases con lo que hay que saber: lo que cambió, lo que llama la atención, lo que habría que mirar. Escribí como le hablarías al dueño del hotel, no como un tablero de control.
3. Los datos en tablas. Una tabla por tema, con la columna de plata alineada a la derecha.
4. Si hay algo que amerite acción — algo bajo mínimo, algo por vencer, una merma grande — cerrá con una sección "Qué haría" de dos o tres viñetas concretas.

Nada de preámbulos, disclaimers ni ofrecimientos de ayuda adicional. El reporte y nada más.`;

export type Reporte =
  | { ok: true; markdown: string; herramientas: string[] }
  | { ok: false; error: string };

export function hayClave() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const declaraciones = HERRAMIENTAS.map((h: Herramienta) => ({
  name: h.nombre,
  description: h.descripcion,
  parameters: h.parametros,
}));

export async function generarReporte(pregunta: string): Promise<Reporte> {
  if (!hayClave()) {
    return {
      ok: false,
      error:
        "Falta la clave de la API. Agregá GEMINI_API_KEY en las variables de entorno para poder pedir reportes.",
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const hoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const historia: Content[] = [
    { role: "user", parts: [{ text: `Hoy es ${hoy}.\n\n${pregunta}` }] },
  ];
  const usadas: string[] = [];

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const respuesta = await conReintentos(() =>
        ai.models.generateContent({
          model: MODELO,
          contents: historia,
          config: {
            systemInstruction: INSTRUCCIONES,
            tools: [{ functionDeclarations: declaraciones }],
          },
        }),
      );

      const llamadas = respuesta.functionCalls ?? [];

      if (!llamadas.length) {
        const markdown = (respuesta.text ?? "").trim();
        if (!markdown) {
          return { ok: false, error: "El reporte volvió vacío. Probá con otra pregunta." };
        }
        return { ok: true, markdown, herramientas: [...new Set(usadas)] };
      }

      // Lo que el modelo pidió se guarda tal cual: sin su propio turno en la
      // historia, la vuelta siguiente no sabe qué preguntó.
      historia.push({ role: "model", parts: respuesta.candidates?.[0]?.content?.parts ?? [] });

      const resultados: Part[] = [];
      for (const llamada of llamadas) {
        const herramienta = HERRAMIENTAS.find((h) => h.nombre === llamada.name);
        usadas.push(llamada.name ?? "?");

        // Un error de una consulta vuelve como resultado, no como excepción: el
        // modelo puede corregir el rango y reintentar en vez de tumbar el reporte.
        let salida: string;
        try {
          salida = herramienta
            ? await herramienta.correr((llamada.args ?? {}) as Record<string, never>)
            : JSON.stringify({ error: `No existe la herramienta ${llamada.name}.` });
        } catch (err) {
          salida = JSON.stringify({
            error: err instanceof Error ? err.message : "La consulta falló.",
          });
        }

        resultados.push({
          functionResponse: { name: llamada.name, response: { resultado: salida } },
        });
      }

      historia.push({ role: "user", parts: resultados });
    }

    return {
      ok: false,
      error: "El reporte dio demasiadas vueltas sin terminar. Probá con una pregunta más concreta.",
    };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401) {
      return { ok: false, error: "La clave de la API no es válida." };
    }
    if (status === 429) {
      return { ok: false, error: "Se agotó la cuota del plan gratuito. Probá en un rato." };
    }
    // Llegar acá con un 503 significa que ya se reintentó y sigue saturado.
    if (status && TRANSITORIOS.has(status)) {
      return {
        ok: false,
        error: "El modelo está saturado en este momento. Probá de nuevo en un minuto.",
      };
    }
    if (status === 404) {
      return {
        ok: false,
        error: `El modelo ${MODELO} ya no está disponible. Hay que actualizarlo en agente.ts.`,
      };
    }
    console.error(err);
    return { ok: false, error: "No se pudo generar el reporte." };
  }
}
