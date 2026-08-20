import { notFound } from "next/navigation";
import Link from "next/link";
import { SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, Screen } from "@/components/screen";
import { formatMoney, num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { RecipeCalc, type Ingredient } from "./recipe-calc";

export default async function RecetaPage({ params }: PageProps<"/cocina/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const [recipe, locations] = await Promise.all([
    prisma.recipe.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        notes: true,
        yieldPortions: true,
        items: {
          select: {
            qtyBase: true,
            product: {
              select: {
                id: true,
                name: true,
                baseUnit: true,
                costPrice: true,
                category: { select: { color: true } },
                stock: { select: { locationId: true, quantity: true } },
              },
            },
          },
        },
      },
    }),
    prisma.location.findMany({
      where: { active: true, kind: { in: ["PRINCIPAL", "AREA"] } },
      orderBy: [{ kind: "desc" }, { sortOrder: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!recipe) notFound();

  const kitchen =
    locations.find((l) => l.name.toLowerCase().includes("cocina")) ?? locations[0];

  const ingredients: Ingredient[] = recipe.items.map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    color: item.product.category.color,
    baseUnit: item.product.baseUnit,
    perYield: num(item.qtyBase),
    available:
      item.product.stock.find((s) => s.locationId === kitchen?.id)?.quantity !== undefined
        ? num(item.product.stock.find((s) => s.locationId === kitchen?.id)!.quantity)
        : 0,
  }));

  const yieldPortions = num(recipe.yieldPortions);
  const costPerPortion =
    yieldPortions > 0
      ? recipe.items.reduce(
          (sum, item) => sum + num(item.qtyBase) * num(item.product.costPrice),
          0,
        ) / yieldPortions
      : 0;

  return (
    <Screen>
      <PageHeader
        back={{ href: "/cocina" }}
        eyebrow={`Rinde ${yieldPortions} porciones`}
        title={recipe.name}
        subtitle={recipe.notes ?? undefined}
        action={
          user.role === "ADMIN" ? (
            <Button asChild variant="quiet" size="icon" aria-label="Editar receta">
              <Link href={`/cocina/${recipe.id}/editar`}>
                <SquarePen className="size-[18px]" />
              </Link>
            </Button>
          ) : null
        }
      />

      {user.role === "ADMIN" ? (
        <Card className="mb-5 px-5 py-4">
          <p className="text-[0.8125rem] text-faint">Costo por porción</p>
          <p className="mt-1 text-[1.375rem] leading-tight font-semibold tnum">
            {formatMoney(costPerPortion, costPerPortion < 100)}
          </p>
        </Card>
      ) : null}

      <RecipeCalc
        recipeId={recipe.id}
        yieldPortions={yieldPortions}
        ingredients={ingredients}
        locations={locations}
        defaultLocationId={kitchen?.id ?? ""}
      />
    </Screen>
  );
}
