import { PageHeader, Screen } from "@/components/screen";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { TeamAdmin, type TeamMember } from "./team-admin";

export const metadata = { title: "Equipo" };

export default async function EquipoPage() {
  await requireAdminPage();

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      active: true,
      _count: { select: { movements: true } },
    },
  });

  const members: TeamMember[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
    movements: user._count.movements,
  }));

  return (
    <Screen>
      <PageHeader
        back={{ href: "/ajustes" }}
        title="Equipo"
        subtitle="Quién puede entrar y qué puede hacer."
      />
      <TeamAdmin members={members} />
    </Screen>
  );
}
