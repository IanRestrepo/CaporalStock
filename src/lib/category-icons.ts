import {
  Bath,
  BedDouble,
  ChefHat,
  Cookie,
  CupSoda,
  Droplets,
  Flower2,
  Lamp,
  Package,
  PaintRoller,
  Plug,
  Shirt,
  Sofa,
  Sparkles,
  SprayCan,
  Utensils,
  WashingMachine,
  Wine,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Íconos de categoría. Se guarda el id en la base, no el componente: el ícono
 * es un dato del negocio ("esto es lencería") y tiene que sobrevivir a un
 * cambio de librería de íconos.
 */
export const CATEGORY_ICONS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "package", name: "Caja", icon: Package },
  { id: "cup-soda", name: "Bebida", icon: CupSoda },
  { id: "wine", name: "Licor", icon: Wine },
  { id: "cookie", name: "Snack", icon: Cookie },
  { id: "chef-hat", name: "Cocina", icon: ChefHat },
  { id: "utensils", name: "Menaje", icon: Utensils },
  { id: "sparkles", name: "Amenities", icon: Sparkles },
  { id: "bath", name: "Baño", icon: Bath },
  { id: "bed-double", name: "Lencería", icon: BedDouble },
  { id: "shirt", name: "Ropa", icon: Shirt },
  { id: "washing-machine", name: "Lavandería", icon: WashingMachine },
  { id: "spray-can", name: "Aseo", icon: SprayCan },
  { id: "droplets", name: "Líquidos", icon: Droplets },
  { id: "lamp", name: "Decoración", icon: Lamp },
  { id: "sofa", name: "Mobiliario", icon: Sofa },
  { id: "flower", name: "Jardín", icon: Flower2 },
  { id: "paint-roller", name: "Pintura", icon: PaintRoller },
  { id: "plug", name: "Eléctrico", icon: Plug },
  { id: "wrench", name: "Mantenimiento", icon: Wrench },
];

export function categoryIcon(id: string): LucideIcon {
  return CATEGORY_ICONS.find((c) => c.id === id)?.icon ?? Package;
}
