import { cn } from "@/lib/cn";
import {
  ArrowRight,
  BedDouble,
  Bell,
  Check,
  ClipboardCheck,
  Minus,
  PackageMinus,
  Plus,
  Receipt,
  ScanLine,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type Step = {
  id: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  icon: LucideIcon;
  /** Sólo para administración. */
  adminOnly?: boolean;
  /** A dónde lleva el botón, si el paso invita a probarlo. */
  go?: { href: string; label: string };
  visual?: ReactNode;
};

/* ── Piezas de ilustración, hechas con el mismo lenguaje visual de la app ── */

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] bg-sunken p-4", className)}>{children}</div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "ok" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-2xs font-medium whitespace-nowrap",
        tone === "accent" && "bg-accent text-accent-ink",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "neutral" && "bg-raised text-soft",
      )}
    >
      {children}
    </span>
  );
}

function Row({
  color,
  name,
  detail,
  right,
}: {
  color: string;
  name: string;
  detail?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-surface px-3 py-2.5">
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem]">{name}</span>
        {detail ? <span className="block text-2xs text-faint tnum">{detail}</span> : null}
      </span>
      {right}
    </div>
  );
}

/* ─────────────────────────────── Los pasos ─────────────────────────────── */

export const STEPS: Step[] = [
  {
    id: "regla",
    eyebrow: "Lo primero",
    title: "El saldo se calcula solo",
    icon: Warehouse,
    body: (
      <>
        No hay una casilla para escribir cuánto hay. Registras lo que pasó —una salida, un
        traslado, una entrada— y el número se actualiza.
        <br />
        <br />
        Cada registro queda con el nombre de quien lo hizo, la hora y el motivo.
      </>
    ),
    visual: (
      <Frame className="space-y-2">
        <div className="flex items-center gap-2 text-2xs text-faint">
          <Chip>Entrada +240</Chip>
          <Chip>Traslado 24</Chip>
          <Chip tone="danger">Daño 2</Chip>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <ArrowRight className="size-3.5 shrink-0 text-faint" />
          <span className="text-[0.8125rem] text-soft">
            saldo <strong className="font-semibold text-ink tnum">214 u</strong>
          </span>
        </div>
        <p className="pt-1 text-2xs leading-relaxed text-faint">
          El saldo sale de sumar los movimientos.
        </p>
      </Frame>
    ),
  },
  {
    id: "unidades",
    eyebrow: "Cómo se mide",
    title: "Cada producto tiene su unidad",
    icon: ScanLine,
    body: (
      <>
        La unidad sirve para guardar la referencia del producto. No convierte nada por su cuenta.
        <br />
        <br />
        Una Corona de 330 ml se cuenta por unidades: son botellas, y el “330 ml” es parte del
        nombre. El arroz y la sal sí van por peso, porque así se compran. Si entran 50 bolsas de
        500 g, quedan 25 kg.
      </>
    ),
    visual: (
      <Frame className="space-y-2.5">
        <Row color="var(--cat-mint)" name="Detergente en polvo" detail="50 bolsas × 500 g" />
        <div className="flex items-center gap-2 pl-3">
          <ArrowRight className="size-3.5 text-faint" />
          <span className="text-[0.8125rem] font-semibold tnum">25 kg</span>
          <span className="text-2xs text-faint">guardados como 25.000 g</span>
        </div>
        <p className="text-2xs leading-relaxed text-faint">
          Una botella empezada se escribe con decimal: 1,75 son una llena y otra a tres cuartos.
        </p>
      </Frame>
    ),
  },
  {
    id: "lugares",
    eyebrow: "Dónde está cada cosa",
    title: "Bodegas, puntos de servicio y minibares",
    icon: Warehouse,
    body: (
      <>
        La bodega central, los puntos de servicio —recepción, café bar, cocina— y el minibar de
        cada suite.
        <br />
        <br />
        Pasar producto de un lado a otro es un traslado y queda registrado.
      </>
    ),
    go: { href: "/bodegas", label: "Ver las bodegas" },
    visual: (
      <Frame className="space-y-2">
        <Row color="var(--accent)" name="Bodega central" detail="donde llega la mercancía" />
        <div className="flex items-center gap-2 pl-3 text-faint">
          <ArrowRight className="size-3.5" />
          <span className="text-2xs">traslado</span>
        </div>
        <Row color="var(--cat-sky)" name="Cocina / Bar" detail="punto de servicio" />
        <Row color="var(--cat-violet)" name="Minibar · Suite 101" detail="nevera de la habitación" />
      </Frame>
    ),
  },
  {
    id: "sacar",
    eyebrow: "Lo que más vas a usar",
    title: "Sacar un producto",
    icon: PackageMinus,
    body: (
      <>
        El botón + de la barra abre el registro. Eliges de dónde sale, qué producto y cuánto. Si
        fue para una suite, la marcas ahí mismo.
        <br />
        <br />
        Un empleado puede sacar por consumo o por daño, y trasladar entre bodegas. Ingresar
        mercancía y corregir conteos es de administración.
      </>
    ),
    go: { href: "/movimientos/nuevo", label: "Probar a registrar uno" },
    visual: (
      <Frame className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="accent">Sacar</Chip>
          <Chip>Trasladar</Chip>
          <Chip>Daño</Chip>
        </div>
        <Row color="var(--cat-sky)" name="Cerveza lata 330 ml" detail="Suite 204 · consumo" right={<span className="text-[0.8125rem] font-semibold tnum">2 u</span>} />
        <p className="text-2xs leading-relaxed text-faint">
          Si pides más de lo que hay, no se guarda.
        </p>
      </Frame>
    ),
  },
  {
    id: "conteo",
    eyebrow: "Hacer el inventario",
    title: "Contar el inventario",
    icon: ScanLine,
    adminOnly: true,
    body: (
      <>
        Eliges la bodega y escribes lo que ves. Con “siguiente” el cursor baja solo al producto
        de abajo.
        <br />
        <br />
        Debajo de cada nombre está lo que dice el sistema, y al escribir aparece la diferencia. Un
        campo vacío significa que no lo contaste y ese producto no se toca. Para decir que no queda
        nada, escribe 0.
      </>
    ),
    go: { href: "/inventario", label: "Abrir el conteo" },
    visual: (
      <Frame className="space-y-2">
        <Row
          color="var(--cat-mint)"
          name="Detergente en polvo"
          detail="faltan 1 kg"
          right={<span className="rounded-[10px] bg-raised px-2.5 py-1 text-[0.8125rem] font-semibold tnum">24000</span>}
        />
        <Row
          color="var(--cat-sky)"
          name="Suavizante"
          detail="coincide"
          right={<span className="rounded-[10px] bg-raised px-2.5 py-1 text-[0.8125rem] font-semibold tnum">11400</span>}
        />
        <p className="text-2xs leading-relaxed text-faint">
          Queda registrado como ajuste por conteo, con tu nombre.
        </p>
      </Frame>
    ),
  },
  {
    id: "suites",
    eyebrow: "Las habitaciones",
    title: "Minibar y checklist",
    icon: BedDouble,
    body: (
      <>
        En la suite marcas cuántas unidades se consumieron del minibar. Se cargan a esa
        habitación y se pide la reposición a bodega.
        <br />
        <br />
        El checklist es aparte: control del TV, aire, persianas, toallas. Lo que repongas ahí sale
        del inventario.
      </>
    ),
    go: { href: "/suites", label: "Ver las suites" },
    visual: (
      <Frame className="space-y-2">
        <Row
          color="var(--cat-sky)"
          name="Agua sin gas 600 ml"
          detail="3 de 4 u"
          right={
            <span className="flex items-center gap-1.5">
              <span className="grid size-6 place-items-center rounded-[8px] bg-surface text-faint"><Minus className="size-3" /></span>
              <span className="w-4 text-center text-[0.8125rem] font-semibold tnum">1</span>
              <span className="grid size-6 place-items-center rounded-[8px] bg-surface text-faint"><Plus className="size-3" /></span>
            </span>
          }
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Chip tone="ok">Control TV</Chip>
          <Chip tone="ok">Aire</Chip>
          <Chip tone="danger">Persiana rota</Chip>
        </div>
      </Frame>
    ),
  },
  {
    id: "compras",
    eyebrow: "Sólo administración",
    title: "Compras",
    icon: Receipt,
    adminOnly: true,
    body: (
      <>
        La mercancía entra por una factura: proveedor, número y lo que trae. Puedes adjuntar la
        foto o el PDF.
        <br />
        <br />
        Al confirmarla se actualiza el costo de cada producto. Ese costo queda guardado en cada
        movimiento, así que cambiar un precio hoy no altera los reportes de meses anteriores.
      </>
    ),
    go: { href: "/compras/nueva", label: "Registrar una factura" },
    visual: (
      <Frame className="space-y-2">
        <Row color="var(--cat-amber)" name="Factura FE-1042" detail="Distribuidora La Sabana" right={<Chip tone="ok">confirmada</Chip>} />
        <div className="flex items-center gap-2 pl-3 text-faint">
          <ArrowRight className="size-3.5" />
          <span className="text-2xs">50 bolsas → 25 kg · costo actualizado</span>
        </div>
      </Frame>
    ),
  },
  {
    id: "alertas",
    eyebrow: "Que no te agarre por sorpresa",
    title: "Alertas y reportes",
    icon: Bell,
    body: (
      <>
        Avisa cuando un producto baja del mínimo y cuando un lote está por vencerse. El mínimo
        lo defines tú y puede ser distinto en cada bodega.
        <br />
        <br />
        En Reportes ves entradas, salidas, mermas por motivo, consumo por suite y utilidad.
      </>
    ),
    go: { href: "/alertas", label: "Ver las alertas" },
    visual: (
      <Frame className="space-y-2">
        <Row color="var(--cat-coral)" name="Mantequilla · Bodega central" detail="1,25 kg de 1,5 kg" right={<span className="text-[0.8125rem] font-semibold text-warn tnum">83%</span>} />
        <Row color="var(--cat-mint)" name="Leche entera · lote FE-1042" detail="vence en 6 días" right={<Chip tone="danger">6 d</Chip>} />
      </Frame>
    ),
  },
  {
    id: "roles",
    eyebrow: "Quién hace qué",
    title: "Empleado y administración",
    icon: ClipboardCheck,
    body: (
      <>
        Un empleado registra salidas, daños y traslados, cierra minibares y revisa suites. No ve
        precios ni utilidad.
        <br />
        <br />
        Administración hace todo lo anterior, más compras, reportes, productos, mínimos y el
        checklist.
      </>
    ),
    visual: (
      <Frame className="space-y-2.5">
        <div className="space-y-1.5">
          <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">Empleado</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="ok"><Check className="mr-1 inline size-2.5" strokeWidth={3} />Sacar</Chip>
            <Chip tone="ok"><Check className="mr-1 inline size-2.5" strokeWidth={3} />Trasladar</Chip>
            <Chip tone="ok"><Check className="mr-1 inline size-2.5" strokeWidth={3} />Minibar</Chip>
            <Chip>Precios</Chip>
            <Chip>Compras</Chip>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">Administración</p>
          <Chip tone="accent">Todo lo anterior, más el dinero</Chip>
        </div>
      </Frame>
    ),
  },
];

export function stepsFor(role: "ADMIN" | "EMPLEADO") {
  return STEPS.filter((s) => !s.adminOnly || role === "ADMIN");
}
