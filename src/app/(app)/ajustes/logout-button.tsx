"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logout } from "./actions";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const salir = () => {
    setLeaving(true);
    startTransition(async () => {
      // Esperar la acción es lo que faltaba: sin el await, la cookie se borraba
      // a veces después de que el router ya había decidido no moverse.
      await logout();
      router.replace("/entrar");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={pending || leaving}
      onClick={salir}
      className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left text-danger hover:bg-raised disabled:opacity-50"
    >
      <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1 text-[0.9375rem]">
        {pending || leaving ? "Cerrando…" : "Cerrar sesión"}
      </span>
    </button>
  );
}
