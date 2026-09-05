import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Qué significa dar de alta y de baja un producto.
 *
 * Vive acá y no dentro de la acción de servidor porque no es lo mismo la regla
 * que el permiso: la regla la comparten la interfaz y el agente, el permiso lo
 * comprueba quien recibe el pedido. Separarlos deja la regla a la vista y
 * probable, en vez de escondida detrás de una cookie.
 */

export type DatosProducto = {
  id?: string;
  name: string;
  categoryId: string;
  sectionId: string | null;
  baseUnit: "GRAMO" | "KILO" | "MILILITRO" | "LITRO" | "UNIDAD";
  costPrice: number;
  salePrice: number;
  minQty: number;
  perishable: boolean;
  active: boolean;
};

export async function guardarProducto(datos: DatosProducto) {
  const { id, ...campos } = datos;
  return id
    ? prisma.product.update({ where: { id }, data: campos, select: { id: true } })
    : prisma.product.create({ data: campos, select: { id: true } });
}

/**
 * Da de baja un producto.
 *
 * Si nunca se movió y está en cero, se va de verdad. Si ya tiene historial o
 * saldo, se archiva: borrarlo dejaría movimientos, compras y checklists
 * apuntando al vacío, y el pasado del inventario no se reescribe.
 */
export async function borrarProducto(id: string): Promise<{ archivado: boolean }> {
  const [lineas, compras, checklists, saldo] = await Promise.all([
    prisma.movementLine.count({ where: { productId: id } }),
    prisma.purchaseItem.count({ where: { productId: id } }),
    prisma.checklistTemplateItem.count({ where: { productId: id } }),
    prisma.stock.aggregate({ where: { productId: id }, _sum: { quantity: true } }),
  ]);

  const tieneHistorial = lineas > 0 || compras > 0 || checklists > 0;
  const queda = Number(saldo._sum.quantity ?? 0);

  if (tieneHistorial || queda !== 0) {
    await prisma.product.update({ where: { id }, data: { active: false } });
    return { archivado: true };
  }

  await prisma.product.delete({ where: { id } });
  return { archivado: false };
}
