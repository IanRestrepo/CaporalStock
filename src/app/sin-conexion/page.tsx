import { CloudOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-[18px] bg-raised text-faint">
        <CloudOff className="size-6" strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-soft">
        Caporal necesita señal para mostrarte saldos reales. Un inventario en frío
        miente, así que preferimos no mostrarte nada.
      </p>
      <p className="mt-6 text-[0.8125rem] text-faint">Vuelve a intentar cuando recuperes datos.</p>
    </div>
  );
}
