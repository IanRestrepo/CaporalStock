"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { Printer, Sparkles, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { pedirReporte } from "./actions";

/** Lo que más se pregunta, para no arrancar frente a una caja vacía. */
const SUGERENCIAS = [
  "¿Cómo nos fue este mes?",
  "¿Qué habitación gasta más?",
  "¿Qué hay que comprar esta semana?",
  "¿Cuánta plata tengo en bodega?",
];

export function AgenteDeReportes({ hayClave }: { hayClave: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [pregunta, setPregunta] = useState("");
  const [reporte, setReporte] = useState<{ markdown: string; herramientas: string[] } | null>(null);
  const [hecha, setHecha] = useState("");

  const pedir = (texto: string) => {
    const limpia = texto.trim();
    if (!limpia) return;
    startTransition(async () => {
      const result = await pedirReporte(limpia);
      if (!result.ok) {
        toast.push("error", result.error);
        return;
      }
      setReporte({ markdown: result.markdown, herramientas: result.herramientas });
      setHecha(limpia);
    });
  };

  if (!hayClave) {
    return (
      <Card>
        <Empty
          icon={TriangleAlert}
          title="Falta la clave de la API"
          body="Agregá GEMINI_API_KEY en las variables de entorno de Vercel y volvé a desplegar. Sin eso, el agente no puede consultar nada."
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="print:hidden">
        <Textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) pedir(pregunta);
          }}
          placeholder="¿Cómo nos fue en agosto con los licores?"
          rows={3}
          aria-label="Qué querés saber"
        />

        <div data-scroll-x className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => {
                setPregunta(s);
                pedir(s);
              }}
              className="press shrink-0 rounded-full bg-raised px-3.5 py-2 text-[0.8125rem] font-medium whitespace-nowrap text-soft hover:text-ink disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>

        <Button
          variant="accent"
          size="lg"
          className="mt-3 w-full"
          disabled={pending || !pregunta.trim()}
          onClick={() => pedir(pregunta)}
        >
          {pending ? "Consultando el inventario…" : "Pedir el reporte"}
          {!pending ? <Sparkles className="size-4" /> : null}
        </Button>

        {pending ? (
          <p className="mt-2.5 px-1 text-center text-[0.8125rem] text-faint">
            Puede tardar un minuto o dos: consulta la base y después escribe.
          </p>
        ) : null}
      </div>

      {reporte ? (
        <>
          <div className="mt-6 mb-2.5 flex items-center justify-between print:hidden">
            <p className="px-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
              Reporte
            </p>
            <Button size="sm" variant="quiet" onClick={() => window.print()}>
              <Printer className="size-4" />
              Imprimir
            </Button>
          </div>

          {/* La hoja impresa: sin tarjeta, sin sombras, a página completa. */}
          <Card className="p-5 print:rounded-none print:bg-transparent print:p-0 print:ring-0">
            <p className="mb-4 hidden text-[0.8125rem] text-faint print:block">
              Caporal · {hecha} · {new Date().toLocaleDateString("es-CO")}
            </p>
            <Markdown texto={reporte.markdown} />
          </Card>

          {reporte.herramientas.length ? (
            <p className="mt-3 px-1 text-[0.8125rem] text-faint print:hidden">
              Cifras tomadas de: {reporte.herramientas.join(", ").replace(/_/g, " ")}.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Markdown mínimo: títulos, tablas, viñetas y negrita.
 *
 * Alcanza para lo que el reporte produce y evita traer una librería entera al
 * bundle. El texto viene del modelo, así que se inserta como texto plano —
 * nunca como HTML.
 */
function Markdown({ texto }: { texto: string }) {
  const bloques: React.ReactNode[] = [];
  const lineas = texto.split("\n");
  let i = 0;
  let clave = 0;

  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
      parte.startsWith("**") && parte.endsWith("**") ? (
        <strong key={j} className="font-semibold">
          {parte.slice(2, -2)}
        </strong>
      ) : (
        <span key={j}>{parte}</span>
      ),
    );

  while (i < lineas.length) {
    const linea = lineas[i];

    if (!linea.trim()) {
      i++;
      continue;
    }

    // Tabla: encabezado, separador de guiones, filas.
    if (linea.includes("|") && lineas[i + 1]?.match(/^\s*\|?[\s:|-]+\|/)) {
      const celdas = (l: string) =>
        l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const encabezado = celdas(linea);
      const alineacion = celdas(lineas[i + 1]).map((c) =>
        c.endsWith(":") && !c.startsWith(":") ? "right" : c.startsWith(":") && c.endsWith(":") ? "center" : "left",
      );
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && lineas[i].includes("|")) {
        filas.push(celdas(lineas[i]));
        i++;
      }

      bloques.push(
        <div key={clave++} data-scroll-x className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-[0.875rem]">
            <thead>
              <tr className="border-b border-line">
                {encabezado.map((c, j) => (
                  <th
                    key={j}
                    className={cn(
                      "py-2 pr-3 text-2xs font-medium tracking-[0.08em] text-faint uppercase",
                      alineacion[j] === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, j) => (
                <tr key={j} className="border-b border-line last:border-0">
                  {fila.map((c, k) => (
                    <td
                      key={k}
                      className={cn(
                        "py-2 pr-3",
                        alineacion[k] === "right" ? "text-right tnum" : "text-left",
                      )}
                    >
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const titulo = linea.match(/^(#{1,4})\s+(.*)$/);
    if (titulo) {
      const nivel = titulo[1].length;
      bloques.push(
        <p
          key={clave++}
          className={cn(
            "mt-5 mb-2 font-semibold first:mt-0",
            nivel <= 2 ? "text-[1.125rem] tracking-[-0.01em]" : "text-[0.9375rem]",
          )}
        >
          {inline(titulo[2])}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      bloques.push(
        <ul key={clave++} className="my-3 space-y-1.5 pl-4">
          {items.map((item, j) => (
            <li key={j} className="list-disc text-[0.9375rem] leading-relaxed text-soft">
              {inline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    bloques.push(
      <p key={clave++} className="my-3 text-[0.9375rem] leading-relaxed text-soft">
        {inline(linea)}
      </p>,
    );
    i++;
  }

  return <div>{bloques}</div>;
}
