import { PageHeader, Screen } from "@/components/screen";
import { RecipeForm } from "@/components/recipe-form";
import { recipeProducts } from "@/lib/recipe-catalog";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Nueva receta" };

export default async function NuevaRecetaPage() {
  await requireAdminPage();
  const products = await recipeProducts();

  return (
    <Screen>
      <PageHeader
        back={{ href: "/cocina" }}
        title="Nueva receta"
        subtitle="Escribí las cantidades como las dice el cocinero: para la tanda completa."
      />
      <RecipeForm
        products={products}
        submitLabel="Crear receta"
        draft={{ name: "", yieldPortions: "", notes: "", items: [] }}
      />
    </Screen>
  );
}
