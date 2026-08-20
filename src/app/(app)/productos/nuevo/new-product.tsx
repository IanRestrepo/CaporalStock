"use client";

import { ProductForm } from "@/components/product-form";
import { useRouter } from "next/navigation";

export function NewProduct({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();

  return (
    <ProductForm
      categories={categories}
      submitLabel="Crear producto"
      draft={{
        name: "",
        categoryId: categories[0]?.id ?? "",
        baseUnit: "UNIDAD",
        costPrice: 0,
        salePrice: 0,
        minQty: 0,
        perishable: false,
        active: true,
      }}
      onDone={(id) => router.push(`/productos/${id}`)}
    />
  );
}
