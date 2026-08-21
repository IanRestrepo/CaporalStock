"use client";

import { BLANK_CATEGORY, CategoryForm } from "@/components/category-form";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { useState } from "react";

/** El "+" de la lista: acá lo que se agrega ya no son bodegas, son categorías. */
export function NuevaCategoria() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="quiet" size="icon" aria-label="Nueva categoría" onClick={() => setOpen(true)}>
        <Plus className="size-5" />
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva categoría"
        description="Se puede editar o borrar después desde Ajustes › Categorías."
      >
        <CategoryForm
          draft={BLANK_CATEGORY}
          submitLabel="Crear categoría"
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
