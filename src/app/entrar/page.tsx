import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col justify-between px-6 pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-9">
            {/* La marca: tres niveles de existencia, de lleno a vacío. */}
            <svg viewBox="0 0 320 216" className="mb-6 h-9 w-auto" aria-label="Caporal">
              <rect y="0" width="320" height="46" rx="23" fill="var(--accent)" />
              <rect y="85" width="228" height="46" rx="23" fill="var(--text)" />
              <rect y="170" width="136" height="46" rx="23" fill="var(--text-faint)" />
            </svg>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">
              Caporal
            </h1>
            <p className="mt-1.5 text-[0.9375rem] text-soft">
              Inventario, minibares y dotación del hotel.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>

      <p className="pb-4 text-center text-[0.8125rem] text-faint">
        ¿Olvidaste tu PIN? Pedile a administración que lo restablezca.
      </p>
    </div>
  );
}
