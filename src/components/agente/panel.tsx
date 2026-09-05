"use client";

import { Markdown } from "@/components/agente/markdown";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { pedirReporte } from "@/app/(app)/reportes/agente/actions";
import { ArrowUp, MessageSquarePlus, Printer, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Turno = { pregunta: string; respuesta: string; herramientas: string[] };

const SUGERENCIAS = [
  "¿Cómo nos fue este mes?",
  "¿Qué hay que comprar?",
  "¿Qué suite gasta más?",
  "¿Cuánta plata tengo en bodega?",
];

/**
 * El agente, a un toque desde cualquier pantalla.
 *
 * Vive en el layout y no en una ruta porque las preguntas aparecen mientras se
 * está haciendo otra cosa —contando el estante, cerrando un minibar— y mandar
 * a alguien a otra pantalla es perder el hilo de lo que estaba haciendo.
 */
export function AgentePanel({ hayClave }: { hayClave: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [imprimir, setImprimir] = useState<Turno | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Con el panel abierto, el fondo no se desplaza: es una pantalla, no una capa.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", cerrar);
    };
  }, [abierto]);

  useEffect(() => {
    if (abierto) fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos, pending, abierto]);

  // La hoja se manda a imprimir recién cuando ya está en el DOM.
  useEffect(() => {
    if (!imprimir) return;
    const t = setTimeout(() => {
      window.print();
      setImprimir(null);
    }, 60);
    return () => clearTimeout(t);
  }, [imprimir]);

  const enviar = (texto: string) => {
    const limpia = texto.trim();
    if (!limpia || pending) return;

    const previas = turnos.map((t) => ({ pregunta: t.pregunta, respuesta: t.respuesta }));
    setPregunta("");

    startTransition(async () => {
      const r = await pedirReporte(limpia, previas);
      if (!r.ok) {
        toast.push("error", r.error);
        setPregunta(limpia);
        return;
      }
      setTurnos((c) => [
        ...c,
        { pregunta: limpia, respuesta: r.markdown, herramientas: r.herramientas },
      ]);

      // Si el agente tocó el catálogo, la pantalla de atrás quedó vieja.
      if (r.herramientas.some((h) => h.startsWith("crear_") || h.startsWith("eliminar_"))) {
        router.refresh();
      }
    });
  };

  return (
    <>
      {/* El botón: arriba a la derecha, sobre todo, en cualquier pantalla. */}
      <button
        type="button"
        aria-label="Preguntarle al inventario"
        onClick={() => {
          setAbierto(true);
          setTimeout(() => campo.current?.focus(), 120);
        }}
        className={cn(
          "press fixed top-[calc(env(safe-area-inset-top)+12px)] right-3 z-40",
          "grid size-11 place-items-center rounded-full",
          "bg-surface/85 text-accent ring-1 ring-line backdrop-blur-xl",
          "hover:bg-raised lg:top-5 lg:right-5",
          abierto && "opacity-0",
          "print:hidden",
        )}
      >
        <Sparkles className="size-[18px]" strokeWidth={2} />
      </button>

      {abierto ? (
        <div className="fixed inset-0 z-50 flex flex-col print:hidden">
          {/* El degradado: del canvas al acento del usuario, no a un naranja fijo. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, var(--canvas) 0%, color-mix(in oklch, var(--accent) 22%, var(--canvas)) 45%, color-mix(in oklch, var(--accent) 72%, var(--canvas)) 100%)",
            }}
          />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+12px)] lg:px-5 lg:pt-5">
              <Redondo etiqueta="Cerrar" onClick={() => setAbierto(false)}>
                <X className="size-[18px]" />
              </Redondo>
              <Redondo
                etiqueta="Empezar de nuevo"
                onClick={() => {
                  setTurnos([]);
                  setPregunta("");
                }}
              >
                <MessageSquarePlus className="size-[18px]" />
              </Redondo>
            </div>

            <div data-scroll-y className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 lg:px-8">
              <div className="mx-auto w-full max-w-2xl">
                {!hayClave ? (
                  <p className="rounded-card bg-canvas/70 p-5 text-[0.9375rem] leading-relaxed text-soft backdrop-blur-sm">
                    Falta la clave de la API. Agregá <strong>GEMINI_API_KEY</strong> en las
                    variables de entorno y volvé a desplegar. El resto de la app funciona igual.
                  </p>
                ) : null}

                {hayClave && !turnos.length && !pending ? (
                  <div className="pt-6">
                    <p className="text-[1.25rem] leading-snug font-semibold tracking-[-0.01em]">
                      Preguntale al inventario
                    </p>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-soft">
                      En español, como se lo dirías a alguien. Las cifras salen de la base, no de
                      la memoria de nadie.
                    </p>
                    <div className="mt-5 space-y-2">
                      {SUGERENCIAS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => enviar(s)}
                          className="press block w-full rounded-[16px] bg-canvas/60 px-4 py-3 text-left text-[0.9375rem] backdrop-blur-sm hover:bg-canvas/80"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {turnos.map((turno, i) => (
                  <div key={i} className="mb-6">
                    <p className="mb-3 ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-[0.9375rem] text-canvas">
                      {turno.pregunta}
                    </p>
                    <div className="rounded-card bg-canvas/80 p-4 backdrop-blur-sm">
                      <Markdown texto={turno.respuesta} />
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-faint">
                          {turno.herramientas.join(", ").replace(/_/g, " ") || "sin consultas"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setImprimir(turno)}
                          className="press flex shrink-0 items-center gap-1.5 rounded-full bg-raised px-3 py-1.5 text-[0.8125rem] font-medium text-soft hover:text-ink"
                        >
                          <Printer className="size-3.5" />
                          Imprimir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {pending ? (
                  <div className="mb-6 rounded-card bg-canvas/60 p-4 backdrop-blur-sm">
                    <p className="text-[0.9375rem] text-soft">Consultando el inventario…</p>
                    <p className="mt-1 text-[0.8125rem] text-faint">
                      Puede tardar un minuto o dos.
                    </p>
                  </div>
                ) : null}

                <div ref={fin} className="h-2" />
              </div>
            </div>

            <div className="shrink-0 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:px-8 lg:pb-5">
              <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
                <textarea
                  ref={campo}
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar(pregunta);
                    }
                  }}
                  rows={1}
                  disabled={!hayClave}
                  placeholder="Escribe un mensaje…"
                  aria-label="Qué querés saber"
                  className="max-h-32 min-h-[3.25rem] flex-1 resize-none rounded-[20px] bg-canvas/70 px-4 py-3.5 text-[1rem] backdrop-blur-sm outline-none placeholder:text-faint focus:ring-2 focus:ring-ink/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  aria-label="Enviar"
                  disabled={pending || !pregunta.trim() || !hayClave}
                  onClick={() => enviar(pregunta)}
                  className="press grid size-13 shrink-0 place-items-center rounded-full bg-ink text-canvas disabled:opacity-40"
                >
                  <ArrowUp className="size-5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* La hoja: fuera del panel, invisible en pantalla, sola en el papel. */}
      {imprimir ? (
        <div data-hoja className="hidden print:block">
          <p className="mb-4 text-[0.8125rem] text-faint">
            Caporal · {imprimir.pregunta} · {new Date().toLocaleDateString("es-CO")}
          </p>
          <Markdown texto={imprimir.respuesta} />
        </div>
      ) : null}
    </>
  );
}

function Redondo({
  children,
  etiqueta,
  onClick,
}: {
  children: React.ReactNode;
  etiqueta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      className="press grid size-10 place-items-center rounded-full bg-canvas/50 text-ink ring-1 ring-line backdrop-blur-sm hover:bg-canvas/80"
    >
      {children}
    </button>
  );
}
