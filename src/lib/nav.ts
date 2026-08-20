import {
  Bell,
  BedDouble,
  ChartNoAxesColumn,
  ChefHat,
  ClipboardCheck,
  House,
  Package,
  Receipt,
  Settings,
  ArrowLeftRight,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Aparece en la barra flotante del teléfono (máximo 4). */
  primary?: boolean;
};

export const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: House, primary: true },
  { href: "/bodegas", label: "Bodegas", icon: Warehouse, primary: true },
  { href: "/suites", label: "Suites", icon: BedDouble, primary: true },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
  { href: "/cocina", label: "Cocina", icon: ChefHat },
  { href: "/compras", label: "Compras", icon: Receipt, adminOnly: true },
  { href: "/reportes", label: "Reportes", icon: ChartNoAxesColumn, adminOnly: true },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function visibleNav(role: "ADMIN" | "EMPLEADO") {
  return NAV.filter((item) => !item.adminOnly || role === "ADMIN");
}

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
