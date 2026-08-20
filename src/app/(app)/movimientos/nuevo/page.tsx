import { PageHeader, Screen } from "@/components/screen";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { MovementForm } from "./movement-form";

export const metadata = { title: "Registrar movimiento" };

export default async function NuevoMovimientoPage({
  searchParams,
}: PageProps<"/movimientos/nuevo">) {
  const user = await requireUser();
  const params = await searchParams;

  const [locations, rooms, products, stock] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, kind: true, room: { select: { number: true } } },
    }),
    prisma.room.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, number: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
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
    }),
    prisma.stock.findMany({
      where: { quantity: { gt: 0 } },
      select: { productId: true, locationId: true, quantity: true },
    }),
  ]);

  const available: Record<string, number> = {};
  for (const row of stock) {
    available[`${row.productId}:${row.locationId}`] = num(row.quantity);
  }

  const single = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };

  return (
    <Screen>
      <PageHeader back={{ href: "/movimientos" }} title="Registrar" />
      <MovementForm
        role={user.role}
        locations={locations.map((l) => ({
          id: l.id,
          name: l.name,
          kind: l.kind,
          room: l.room?.number ?? null,
        }))}
        rooms={rooms}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          baseUnit: p.baseUnit,
          category: p.category.name,
          color: p.category.color,
          presentations: p.presentations.map((pr) => ({
            id: pr.id,
            name: pr.name,
            factor: num(pr.factor),
          })),
        }))}
        available={available}
        initialType={single("tipo")}
        initialFrom={single("desde")}
        initialTo={single("hacia")}
        initialRoom={single("suite")}
      />
    </Screen>
  );
}
