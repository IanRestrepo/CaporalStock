import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { HERRAMIENTAS } from "@/lib/reportes/herramientas";

/**
 * El agente de reportes.
 *
 * Traduce una pregunta en español a las consultas que ya sabe hacer el sistema,
 * y redacta el resultado. Las cifras salen de la base: acá sólo se acomodan.
 */

const MODELO = "claude-opus-5";

const INSTRUCCIONES = `Sos el analista de Caporal, el sistema de inventario de un hotel pequeño en Colombia.

Respondés preguntas sobre el inventario usando las herramientas disponibles, y devolvés un reporte listo para imprimir y pasarle a la administración.

Reglas que no se negocian:

- Toda cifra tiene que venir de una herramienta. Nunca calcules, estimes ni completes un número de memoria. Si te falta un dato, corré otra herramienta o decí que no lo tenés.
- Si la pregunta no se puede responder con las herramientas, decilo en una línea y explicá qué haría falta. No inventes un reporte plausible.
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

export async function generarReporte(pregunta: string): Promise<Reporte> {
  // El SDK también acepta ANTHROPIC_AUTH_TOKEN; en Vercel se usa la clave.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return {
      ok: false,
      error:
        "Falta la clave de la API. Agregá ANTHROPIC_API_KEY en las variables de entorno para poder pedir reportes.",
    };
  }

  const client = new Anthropic();
  const hoy = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const usadas: string[] = [];

  try {
    const runner = client.beta.messages.toolRunner({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: INSTRUCCIONES,
      tools: HERRAMIENTAS,
      messages: [
        {
          role: "user",
          content: `Hoy es ${hoy}.\n\n${pregunta}`,
        },
      ],
    });

    // Cada vuelta es un mensaje completo: se anota qué consultó para poder
    // mostrar de dónde salieron las cifras.
    for await (const mensaje of runner) {
      for (const bloque of mensaje.content) {
        if (bloque.type === "tool_use") usadas.push(bloque.name);
      }
    }

    const final = await runner.done();

    if (final.stop_reason === "refusal") {
      return { ok: false, error: "El modelo no quiso responder esa pregunta." };
    }

    const markdown = final.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!markdown) {
      return { ok: false, error: "El reporte volvió vacío. Probá con otra pregunta." };
    }

    return { ok: true, markdown, herramientas: [...new Set(usadas)] };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "La clave de la API no es válida." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Demasiadas peticiones seguidas. Esperá un momento." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error(err);
      return { ok: false, error: `La API respondió ${err.status}. Intentá de nuevo.` };
    }
    console.error(err);
    return { ok: false, error: "No se pudo generar el reporte." };
  }
}
