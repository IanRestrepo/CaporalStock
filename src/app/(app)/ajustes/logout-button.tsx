"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { logout } from "./actions";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void logout())}
      className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left text-danger hover:bg-raised disabled:opacity-50"
    >
      <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1 text-[0.9375rem]">
        {pending ? "Cerrando…" : "Cerrar sesión"}
      </span>
    </button>
  );
}
