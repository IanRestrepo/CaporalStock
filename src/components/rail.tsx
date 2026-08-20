"use client";

import { cn } from "@/lib/cn";
import { isActive, visibleNav } from "@/lib/nav";
import { initials } from "@/lib/format";
import { Ellipsis, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Props = {
  role: "ADMIN" | "EMPLEADO";
  name: string;
  alertCount: number;
};

/**
 * Barra de navegación flotante: horizontal y abajo en teléfono, vertical y a la
 * izquierda desde `lg`. No toca los bordes de la pantalla — flota sobre el
 * contenido, que sigue corriendo por debajo.
 */
export function Rail({ role, name, alertCount }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = visibleNav(role);
  const primary = items.filter((i) => i.primary);
  const rest = items.filter((i) => !i.primary);

  return (
    <>
      {/* ── Teléfono ───────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 mb-safe lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-1 rounded-[24px] bg-raised/92 p-1.5 shadow-[0_16px_44px_-16px_rgba(0,0,0,0.75)] ring-1 ring-line backdrop-blur-xl">
          {primary.map((item) => (
            <RailTab key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}

          <Link
            href="/movimientos/nuevo"
            aria-label="Registrar movimiento"
            className="press grid h-12 flex-1 place-items-center rounded-[18px] bg-accent text-accent-ink"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </Link>

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="Más secciones"
            aria-expanded={moreOpen}
            className={cn(
              "press relative grid h-12 flex-1 place-items-center rounded-[18px] transition-colors",
              moreOpen ? "bg-surface text-ink" : "text-soft",
            )}
          >
            {moreOpen ? <X className="size-5" /> : <Ellipsis className="size-5" />}
            {alertCount > 0 && !moreOpen ? (
              <span className="absolute top-2.5 right-[calc(50%-14px)] size-1.5 rounded-full bg-danger" />
            ) : null}
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-39 lg:hidden">
          <button
            aria-label="Cerrar"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            style={{ animation: "fade-in 160ms ease both" }}
          />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] rise rounded-[24px] bg-surface p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-line">
            <div className="grid grid-cols-2 gap-1.5">
              {rest.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "press flex items-center gap-3 rounded-[16px] px-3.5 py-3.5",
                    isActive(pathname, item.href) ? "bg-accent-soft text-accent" : "hover:bg-raised",
                  )}
                >
                  <item.icon className="size-[18px]" strokeWidth={1.75} />
                  <span className="text-[0.875rem] font-medium">{item.label}</span>
                  {item.href === "/alertas" && alertCount > 0 ? (
                    <span className="ml-auto grid size-5 place-items-center rounded-full bg-danger text-2xs font-semibold text-canvas">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Escritorio ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 bottom-0 left-0 z-40 hidden w-[76px] flex-col items-center py-4 lg:flex">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[26px] bg-surface p-2.5">
          <Link
            href="/movimientos/nuevo"
            aria-label="Registrar movimiento"
            title="Registrar movimiento"
            className="press mb-1 grid size-11 place-items-center rounded-[15px] bg-accent text-accent-ink"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </Link>

          <span className="my-1 h-px w-7 bg-line" />

          {items
            .filter((i) => i.href !== "/ajustes")
            .map((item) => (
              <RailIcon
                key={item.href}
                {...item}
                active={isActive(pathname, item.href)}
                badge={item.href === "/alertas" ? alertCount : 0}
              />
            ))}

          <span className="mt-auto mb-1 h-px w-7 bg-line" />

          <RailIcon
            href="/ajustes"
            label="Ajustes"
            icon={items.find((i) => i.href === "/ajustes")!.icon}
            active={isActive(pathname, "/ajustes")}
          />

          <Link
            href="/ajustes"
            title={name}
            className="press mt-1 grid size-9 place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent"
          >
            {initials(name)}
          </Link>
        </div>
      </nav>
    </>
  );
}

function RailTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "press grid h-12 flex-1 place-items-center rounded-[18px] transition-colors",
        active ? "bg-surface text-ink" : "text-soft",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
    </Link>
  );
}

function RailIcon({
  href,
  label,
  icon: Icon,
  active,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "press relative grid size-11 place-items-center rounded-[15px] transition-colors",
        active ? "bg-raised text-ink" : "text-faint hover:bg-raised/60 hover:text-soft",
      )}
    >
      <Icon className="size-[19px]" strokeWidth={active ? 2 : 1.75} />
      {badge > 0 ? (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-danger" />
      ) : null}
    </Link>
  );
}
