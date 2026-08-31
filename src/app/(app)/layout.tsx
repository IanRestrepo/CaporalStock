import { redirect } from "next/navigation";
import { Rail } from "@/components/rail";
import { TutorialReturn } from "@/components/tutorial-return";
import { ToastProvider } from "@/components/ui/toast";
import { countAlerts } from "@/lib/alerts";
import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");

  const alertCount = await countAlerts();

  return (
    <ToastProvider>
      <Rail role={user.role} name={user.name} alertCount={alertCount} />
      <TutorialReturn />
      <main className="lg:pl-[76px]">{children}</main>
    </ToastProvider>
  );
}
