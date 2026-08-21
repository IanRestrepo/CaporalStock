"use client";

import { BLANK_TAXONOMY, TaxonomyForm } from "@/components/taxonomy-form";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { saveSection } from "@/app/(app)/ajustes/actions";
import { Plus } from "lucide-react";
import { useState } from "react";

/** El "+" de la lista: acá lo que se agrega ya no son bodegas, son secciones. */
export function NuevaSeccion() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="quiet" size="icon" aria-label="Nueva sección" onClick={() => setOpen(true)}>
        <Plus className="size-5" />
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva sección"
        description="Se puede editar o borrar después desde Ajustes › Secciones."
      >
        <TaxonomyForm
          draft={BLANK_TAXONOMY}
          submitLabel="Crear sección"
          placeholder="p. ej. Lavandería"
          save={saveSection}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
