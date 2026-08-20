"use client";

import { Button } from "@/components/ui/button";
import { ProductSheet, type ProductDraft } from "@/components/product-form";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export function ProductAdmin({
  product,
  categories,
}: {
  product: ProductDraft;
  categories: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="quiet" size="icon" aria-label="Editar producto" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-[18px]" />
      </Button>
      <ProductSheet
        open={open}
        onClose={() => setOpen(false)}
        draft={product}
        categories={categories}
      />
    </>
  );
}
