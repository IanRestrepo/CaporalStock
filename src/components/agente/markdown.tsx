"use client";

import { cn } from "@/lib/cn";

/**
 * Markdown mínimo: títulos, tablas, viñetas y negrita.
 *
 * Alcanza para lo que el reporte produce y evita traer una librería entera al
 * bundle. El texto viene del modelo, así que se inserta como texto plano —
 * nunca como HTML.
 */
export function Markdown({ texto }: { texto: string }) {
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
