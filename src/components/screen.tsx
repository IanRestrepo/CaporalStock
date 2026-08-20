import { cn } from "@/lib/cn";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Contenedor de pantalla. Reserva el espacio de la barra flotante y del notch
 * para que ningún contenido quede debajo del pulgar ni del reloj del sistema.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl px-4 pt-4 pb-32 lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label?: string };
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex items-start gap-3", className)}>
      {back ? (
        <Link
          href={back.href}
          aria-label={back.label ?? "Volver"}
          className="press mt-0.5 grid size-10 shrink-0 place-items-center rounded-[13px] bg-surface text-soft hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </Link>
      ) : null}

      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-1 text-2xs font-medium tracking-[0.12em] text-faint uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance lg:text-[2rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-[0.9375rem] leading-snug text-soft">{subtitle}</p>
        ) : null}
      </div>

      {action ? <div className="mt-0.5 shrink-0">{action}</div> : null}
    </header>
  );
}
