import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BaseUnit } from "@/generated/prisma/enums";
import { UNITS } from "@/lib/units";

/**
 * Lectura de una hoja de inventario con la cámara.
 *
 * Lo que devuelve es una PROPUESTA, nunca un movimiento. Una foto de una hoja
 * escrita a mano se lee bien, no perfecto: hay tachones, cifras ambiguas y
 * nombres abreviados. Por eso cada renglón viaja con su nivel de confianza y
 * con el texto crudo de la hoja, para que la persona corrija antes de aplicar.
 * El saldo lo sigue moviendo únicamente `applyPhysicalCount`.
 */

export type CatalogEntry = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  section: string;
};

export type ScannedLine = {
  /** Lo que dice la hoja, tal cual se leyó. */
  texto: string;
  /** Producto del catálogo al que corresponde, o null si no se pudo decidir. */
  productoId: string | null;
  /** Cantidad en la unidad base del producto. */
  cantidad: number | null;
  confianza: "alta" | "media" | "baja";
  /** Por qué quedó dudoso, cuando lo está. */
  nota: string | null;
};

export class ScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanError";
  }
}

const MODEL = "claude-opus-5";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    lineas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          texto: { type: "string" },
          productoId: { type: ["string", "null"] },
          cantidad: { type: ["number", "null"] },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: ["string", "null"] },
        },
        required: ["texto", "productoId", "cantidad", "confianza", "nota"],
        additionalProperties: false,
      },
    },
  },
  required: ["lineas"],
  additionalProperties: false,
} as const;

function instructions(catalog: CatalogEntry[]) {
  const listado = catalog
    .map((p) => `${p.id}\t${p.name}\t${UNITS[p.baseUnit].plural}\t${p.section}`)
    .join("\n");

  return `Leés hojas de inventario de un hotel y las convertís en renglones estructurados.

CATÁLOGO (id, nombre, unidad base, sección). Es la única fuente de productos válidos:
${listado}

Reglas:

1. Un renglón por cada línea de producto que aparezca en la hoja. Respetá el orden.
2. "texto" es lo que dice la hoja, transcrito literal, incluyendo la cantidad y las abreviaturas.
3. "productoId" sólo puede ser un id del catálogo. Si el nombre de la hoja no corresponde
   claramente a uno, poné null: es preferible que una persona lo elija a que adivines.
   Las abreviaturas comunes sí se resuelven ("det. polvo" es detergente en polvo).
4. "cantidad" va SIEMPRE en la unidad base del producto. Si la hoja dice "2 kg" y la unidad
   base es gramos, son 2000. Si dice "3 bolsas" sin decir de cuánto, no podés saber cuántos
   gramos son: poné null y explicalo en "nota".
5. "confianza": alta si el nombre y la cifra se leen sin dudar; media si tuviste que
   interpretar; baja si el trazo es ambiguo o la cifra puede confundirse (un 1 con un 7,
   un 0 con un 6). Ante la duda, bajá la confianza en vez de inventar.
6. Nunca agregues productos que no estén en la hoja, ni completes cantidades que no se ven.
   Una hoja con ocho renglones devuelve ocho renglones.
7. Si la foto está ilegible o no es una hoja de inventario, devolvé la lista vacía.

Escribí en español. "nota" es null salvo que haya algo que la persona deba revisar.`;
}

export async function readInventorySheet(
  image: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
  catalog: CatalogEntry[],
): Promise<ScannedLine[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ScanError(
      "Falta ANTHROPIC_API_KEY. Agregala en el entorno para poder leer hojas con la cámara.",
    );
  }
  if (!catalog.length) {
    throw new ScanError("No hay productos en el catálogo contra los cuales comparar.");
  }

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // El catálogo es idéntico entre escaneos: se cachea y cada foto siguiente
      // cuesta una fracción.
      system: [
        {
          type: "text",
          text: instructions(catalog),
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.base64,
              },
            },
            {
              type: "text",
              text: "Leé esta hoja de inventario y devolvé sus renglones.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new ScanError("El modelo no pudo procesar esta imagen. Probá con otra foto.");
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!text.trim()) {
      throw new ScanError("No se pudo leer nada en la foto. Probá con más luz o más cerca.");
    }

    const parsed = JSON.parse(text) as { lineas?: ScannedLine[] };
    const lines = parsed.lineas ?? [];

    const valid = new Set(catalog.map((p) => p.id));
    return lines.map((line) => ({
      texto: String(line.texto ?? "").slice(0, 200),
      // Si el modelo devolviera un id inventado, se degrada a "sin identificar"
      // en vez de apuntar a un producto que no es.
      productoId: line.productoId && valid.has(line.productoId) ? line.productoId : null,
      cantidad:
        typeof line.cantidad === "number" && Number.isFinite(line.cantidad) && line.cantidad >= 0
          ? line.cantidad
          : null,
      confianza:
        line.confianza === "alta" || line.confianza === "media" ? line.confianza : "baja",
      nota: line.nota ? String(line.nota).slice(0, 200) : null,
    }));
  } catch (error) {
    if (error instanceof ScanError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ScanError("La clave de la API no es válida.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ScanError("Demasiadas fotos seguidas. Esperá unos segundos y volvé a intentar.");
    }
    if (error instanceof SyntaxError) {
      throw new ScanError("La respuesta llegó incompleta. Volvé a intentar.");
    }
    console.error("[scan]", error);
    throw new ScanError("No se pudo leer la hoja. Volvé a intentar.");
  }
}
