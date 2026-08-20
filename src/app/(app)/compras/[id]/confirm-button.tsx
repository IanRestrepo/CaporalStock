"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { confirmPurchase } from "../actions";

export function ConfirmButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="accent"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await confirmPurchase(purchaseId);
          if (!result.ok) {
            toast.push("error", result.error);
            return;
          }
          toast.push("ok", "Mercancía ingresada al inventario.");
          router.refresh();
        })
      }
    >
      {pending ? "Ingresando…" : "Dar entrada al inventario"}
    </Button>
  );
}
