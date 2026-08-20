"use client";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ArrowRight, Delete, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { login } from "./actions";

const PIN_LENGTH = 4;

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"usuario" | "pin">("usuario");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const press = (digit: string) => {
    if (pending) return;
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
    setError(null);

    // Cuatro dígitos y va: nadie debería buscar un botón "entrar".
    if (next.length === PIN_LENGTH) {
      startTransition(async () => {
        const result = await login(username, next);
        if (result?.error) {
          setError(result.error);
          setPin("");
        }
      });
    }
  };

  if (step === "usuario") {
    return (
      <div className="space-y-4">
        <Field label="Usuario" htmlFor="usuario">
          <Input
            id="usuario"
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="p. ej. marcela"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && username.trim()) setStep("pin");
            }}
          />
        </Field>

        <Button
          type="button"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={!username.trim()}
          onClick={() => setStep("pin")}
        >
          Continuar
          <ArrowRight className="size-4" />
        </Button>

        {error ? <p className="text-center text-[0.875rem] text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStep("usuario");
          setPin("");
          setError(null);
        }}
        className="mb-6 text-[0.875rem] text-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
      >
        {username}
      </button>

      <div className="mb-2 flex justify-center gap-3.5" role="status" aria-label="PIN">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-3 rounded-full transition-all duration-200",
              i < pin.length ? "scale-110 bg-accent" : "bg-line-strong",
            )}
          />
        ))}
      </div>

      <p
        className={cn(
          "mb-6 text-center text-[0.875rem] transition-opacity",
          error ? "text-danger opacity-100" : "text-faint opacity-0",
        )}
      >
        {error ?? "·"}
      </p>

      <div className="grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <Key key={digit} onClick={() => press(digit)}>
            {digit}
          </Key>
        ))}
        <div aria-hidden />
        <Key onClick={() => press("0")}>0</Key>
        <Key onClick={() => setPin((p) => p.slice(0, -1))} muted aria-label="Borrar">
          <Delete className="size-5" strokeWidth={1.75} />
        </Key>
      </div>

      {pending ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-[0.875rem] text-soft">
          <LoaderCircle className="size-4 animate-spin" />
          Verificando…
        </p>
      ) : null}
    </div>
  );
}

function Key({
  children,
  onClick,
  muted,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press grid h-16 place-items-center rounded-[18px] text-[1.375rem] font-medium tnum",
        muted ? "text-soft hover:bg-raised" : "bg-surface hover:bg-raised",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
