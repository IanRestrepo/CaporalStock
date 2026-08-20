import "server-only";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { RecipeProduct } from "@/components/recipe-form";

/** Catálogo con presentaciones, listo para el formulario de recetas. */
export async function recipeProducts(): Promise<RecipeProduct[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      baseUnit: true,
      category: { select: { name: true, color: true } },
      presentations: {
        orderBy: { factor: "asc" },
        select: { id: true, name: true, factor: true },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category.name,
    color: product.category.color,
    baseUnit: product.baseUnit,
    presentations: product.presentations.map((p) => ({
      id: p.id,
      name: p.name,
      factor: num(p.factor),
    })),
  }));
}
