import Link from "next/link";
import { ChefHat, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LevelBar } from "@/components/level-row";
import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { portionsAvailable } from "@/lib/units";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Cocina" };

export default async function CocinaPage() {
  const user = await requireUser();

  const [recipes, kitchen] = await Promise.all([
    prisma.recipe.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        yieldPortions: true,
        items: {
          select: {
            qtyBase: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.location.findFirst({
      where: { active: true, name: { contains: "Cocina", mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        stock: { select: { productId: true, quantity: true } },
      },
    }),
  ]);

  const onHand = new Map(
    (kitchen?.stock ?? []).map((s) => [s.productId, num(s.quantity)]),
  );

  return (
    <Screen>
      <PageHeader
        title="Cocina"
        subtitle={
          kitchen
            ? `Porciones posibles con lo que hay en ${kitchen.name}.`
            : "Recetas y rendimiento."
        }
        action={
          user.role === "ADMIN" ? (
            <Button asChild variant="quiet" size="icon" aria-label="Nueva receta">
              <Link href="/cocina/nueva">
                <Plus className="size-5" />
              </Link>
            </Button>
          ) : null
        }
      />

      {recipes.length ? (
        <div className="space-y-2.5">
          {recipes.map((recipe) => {
            const yieldPortions = num(recipe.yieldPortions);
            const possible = recipe.items.length
              ? Math.min(
                  ...recipe.items.map((item) =>
                    portionsAvailable(
                      onHand.get(item.product.id) ?? 0,
                      num(item.qtyBase),
                      yieldPortions,
                    ),
                  ),
                )
              : 0;

            const limiting = recipe.items
              .map((item) => ({
                name: item.product.name,
                portions: portionsAvailable(
                  onHand.get(item.product.id) ?? 0,
                  num(item.qtyBase),
                  yieldPortions,
                ),
              }))
              .sort((a, b) => a.portions - b.portions)[0];

            const ratio = Math.min(possible / Math.max(yieldPortions, 1), 1);

            return (
              <Link
                key={recipe.id}
                href={`/cocina/${recipe.id}`}
                className="press block rounded-card bg-surface p-4 hover:bg-raised"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[1.0625rem] leading-tight font-semibold">
                      {recipe.name}
                    </p>
                    <p className="mt-1 text-[0.8125rem] text-faint tnum">
                      Rinde {yieldPortions} porciones · {recipe.items.length} ingredientes
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4.5 shrink-0 text-faint" />
                </div>

                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.02em] tnum">
                    {Number.isFinite(possible) ? possible : "∞"}
                  </span>
                  <span className="text-[0.875rem] text-soft">porciones alcanzan</span>
                </div>

                <LevelBar
                  ratio={ratio}
                  tone={possible === 0 ? "danger" : possible < yieldPortions ? "warn" : "ok"}
                />

                {limiting && possible < yieldPortions ? (
                  <p className="mt-2.5 text-[0.8125rem] text-warn">
                    Lo limita {limiting.name.toLowerCase()}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty
            icon={ChefHat}
            title="Sin recetas"
            body="Cargá una receta para saber cuántas porciones alcanzan con lo que hay en bodega."
            action={
              user.role === "ADMIN" ? (
                <Button asChild variant="accent">
                  <Link href="/cocina/nueva">Crear la primera</Link>
                </Button>
              ) : null
            }
          />
        </Card>
      )}
    </Screen>
  );
}
