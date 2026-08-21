import { cookies } from "next/headers";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  MapPin,
  Shapes,
  Palette,
  Users,
} from "lucide-react";
import { Card, RowList, SectionLabel } from "@/components/ui/card";
import { PageHeader, Screen } from "@/components/screen";
import { DEFAULT_ACCENT, DEFAULT_THEME, type ThemeId } from "@/lib/appearance";
import { initials } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { AppearancePicker } from "./appearance-picker";
import { LogoutButton } from "./logout-button";
import { PinForm } from "./pin-form";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const user = await requireUser();
  const jar = await cookies();
  const theme = (jar.get("caporal_theme")?.value ?? DEFAULT_THEME) as ThemeId;
  const accent = jar.get("caporal_accent")?.value ?? user.accent ?? DEFAULT_ACCENT;

  const adminLinks = [
    { href: "/ajustes/equipo", label: "Equipo", hint: "Usuarios, roles y PIN", icon: Users },
    {
      href: "/ajustes/categorias",
      label: "Categorías",
      hint: "Con qué se ordena la bodega",
      icon: Shapes,
    },
    {
      href: "/ajustes/lugares",
      label: "Bodega y habitaciones",
      hint: "Dónde se guarda el inventario",
      icon: MapPin,
    },
    {
      href: "/ajustes/checklist",
      label: "Checklist de suite",
      hint: "Qué debe haber en cada habitación",
      icon: ClipboardList,
    },
  ];

  return (
    <Screen>
      <PageHeader title="Ajustes" />

      <Card className="mb-6 flex items-center gap-4 px-5 py-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.9375rem] font-semibold text-accent">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[1.0625rem] font-semibold">{user.name}</p>
          <p className="mt-0.5 text-[0.8125rem] text-faint">
            @{user.username} · {user.role === "ADMIN" ? "Administración" : "Empleado"}
          </p>
        </div>
      </Card>

      <SectionLabel className="mb-2.5">
        <span className="inline-flex items-center gap-1.5">
          <Palette className="size-3" />
          Apariencia
        </span>
      </SectionLabel>
      <Card className="mb-7 p-5">
        <AppearancePicker accent={accent} theme={theme} />
      </Card>

      {user.role === "ADMIN" ? (
        <>
          <SectionLabel className="mb-2.5">Administración</SectionLabel>
          <Card className="mb-7 overflow-hidden">
            <RowList>
              {adminLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="press flex items-center gap-3.5 px-5 py-3.5 hover:bg-raised"
                >
                  <link.icon className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem]">{link.label}</span>
                    <span className="block text-[0.8125rem] text-faint">{link.hint}</span>
                  </span>
                  <ChevronRight className="size-4.5 shrink-0 text-faint" />
                </Link>
              ))}
            </RowList>
          </Card>
        </>
      ) : null}

      <SectionLabel className="mb-2.5">Cuenta</SectionLabel>
      <Card className="overflow-hidden">
        <RowList>
          <PinForm />
          <LogoutButton />
        </RowList>
      </Card>

      <p className="mt-8 text-center text-2xs text-faint">Caporal · v1.0</p>
    </Screen>
  );
}
