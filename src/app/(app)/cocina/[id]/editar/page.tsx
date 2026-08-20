import { notFound } from "next/navigation";
import { PageHeader, Screen } from "@/components/screen";
import { RecipeForm, type RecipeDraft } from "@/components/recipe-form";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { recipeProducts } from "@/lib/recipe-catalog";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Editar receta" };

export default async function EditarRecetaPage({ params }: PageProps<"/cocina/[id]/editar">) {
  const { id } = await params;
  await requireAdminPage();

  const [recipe, products] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        notes: true,
        yieldPortions: true,
        items: { select: { productId: true, qtyBase: true } },
      },
    }),
    recipeProducts(),
  ]);

  if (!recipe) notFound();

  const byId = new Map(products.map((p) => [p.id, p]));

  const draft: RecipeDraft = {
    id: recipe.id,
    name: recipe.name,
    yieldPortions: String(num(recipe.yieldPortions)),
    notes: recipe.notes ?? "",
    items: recipe.items.map((item) => ({
      productId: item.productId,
      // Se edita en unidad base: es como quedó guardado y evita redondeos raros
      // al ir y volver entre presentaciones.
      qty: String(num(item.qtyBase)),
      presentationId:
        byId.get(item.productId)?.presentations.find((p) => p.factor === 1)?.id ??
        byId.get(item.productId)?.presentations[0]?.id ??
        "",
    })),
  };

  return (
    <Screen>
      <PageHeader back={{ href: `/cocina/${recipe.id}` }} title="Editar receta" />
      <RecipeForm draft={draft} products={products} submitLabel="Guardar cambios" />
    </Screen>
  );
}
