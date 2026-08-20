import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { PlacesAdmin, type Place, type RoomRow } from "./places-admin";

export const metadata = { title: "Bodegas y habitaciones" };

export default async function LugaresPage() {
  await requireAdminPage();

  const [locations, rooms] = await Promise.all([
    prisma.location.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        active: true,
        room: { select: { number: true } },
        _count: { select: { stock: true } },
      },
    }),
    prisma.room.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, number: true, floor: true, active: true },
    }),
  ]);

  const places: Place[] = locations.map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
    active: l.active,
    room: l.room?.number ?? null,
    items: l._count.stock,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        title="Bodegas y habitaciones"
        subtitle="Todo lugar que guarda producto."
      />
      <PlacesAdmin places={places} rooms={rooms as RoomRow[]} />
    </Screen>
  );
}
