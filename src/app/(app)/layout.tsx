import { redirect } from "next/navigation";
import { AgentePanel } from "@/components/agente/panel";
import { Rail } from "@/components/rail";
import { TutorialReturn } from "@/components/tutorial-return";
import { ToastProvider } from "@/components/ui/toast";
import { countAlerts } from "@/lib/alerts";
import { hayClave } from "@/lib/reportes/agente";
import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");

  const alertCount = await countAlerts();

  return (
    <ToastProvider>
      <Rail role={user.role} name={user.name} alertCount={alertCount} />
      <TutorialReturn />
      {user.role === "ADMIN" ? <AgentePanel hayClave={hayClave()} /> : null}
      <main className="lg:pl-[76px]">{children}</main>
    </ToastProvider>
  );
}
