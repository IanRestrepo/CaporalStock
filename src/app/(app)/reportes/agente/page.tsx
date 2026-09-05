import { PageHeader, Screen } from "@/components/screen";
import { hayClave } from "@/lib/reportes/agente";
import { requireAdminPage } from "@/lib/session";
import { AgenteDeReportes } from "./agente-form";

export const metadata = { title: "Pedir un reporte" };

export default async function AgentePage() {
  await requireAdminPage();
  return (
    <Screen>
      <PageHeader
        back={{ href: "/reportes" }}
        title="Pedir un reporte"
        subtitle="Preguntá en español. Las cifras salen del inventario, no de la memoria de nadie."
      />
      <AgenteDeReportes hayClave={hayClave()} />
    </Screen>
  );
}
