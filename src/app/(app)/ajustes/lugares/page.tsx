import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { PlacesAdmin, type Place, type RoomRow } from "./places-admin";

export const metadata = { title: "Bodega y habitaciones" };

export default async function LugaresPage() {
  await requireAdminPage();

  const [central, rooms] = await Promise.all([
    prisma.location.findFirst({
      where: { kind: "PRINCIPAL", active: true, practice: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, _count: { select: { stock: true } } },
    }),
    prisma.room.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, number: true, floor: true, active: true },
    }),
  ]);

  const place: Place | null = central
    ? { id: central.id, name: central.name, items: central._count.stock }
    : null;

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        title="Bodega y habitaciones"
        subtitle="Dónde se guarda el inventario."
      />
      <PlacesAdmin central={place} rooms={rooms as RoomRow[]} />
    </Screen>
  );
}
