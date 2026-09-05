import "server-only";
import {
  consumptionByRoom,
  inventoryValue,
  periodFlow,
  recentMovements,
} from "@/lib/dashboard";
import { getExpiring, getLowStock } from "@/lib/alerts";
import { num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatQty } from "@/lib/units";

/**
 * Las herramientas del agente de reportes.
 *
 * Todas devuelven cifras que salieron de la base. El modelo elige cuál correr
 * y redacta el resultado; no calcula nada. Si se le dejara calcular, inventaría
 * números creíbles y falsos — que es exactamente lo que este sistema existe
 * para evitar.
 */

/**
 * Una herramienta del agente.
 *
 * No importa nada del SDK del modelo a propósito: lo que hace es una consulta,
 * y la consulta no cambia porque cambie el proveedor. El esquema se declara en
 * la forma que espera la API de funciones (OpenAPI), que es la misma en todas.
 */
export type Herramienta = {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
  /** Lo que mandó el modelo. Llega sin verificar: cada herramienta lo valida. */
  correr: (input: Record<string, unknown>) => Promise<string>;
};

const objeto = (propiedades: Record<string, unknown>, requeridos: string[] = []) => ({
  type: "OBJECT",
  properties: propiedades,
  ...(requeridos.length ? { required: requeridos } : {}),
});

const texto = (description: string) => ({ type: "STRING", description });
const entero = (description: string) => ({ type: "INTEGER", description });

/** "agosto", "este mes", "últimos 90 días" -> un rango concreto. */
const RANGO = objeto(
  {
    desde: texto("Fecha de inicio en formato AAAA-MM-DD, inclusive."),
    hasta: texto("Fecha de fin en formato AAAA-MM-DD, exclusiva."),
  },
  ["desde", "hasta"],
);

function fechas(input: Record<string, unknown>) {
  const desde = new Date(`${String(input.desde)}T00:00:00`);
  const hasta = new Date(`${String(input.hasta)}T00:00:00`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    throw new Error("Las fechas deben venir como AAAA-MM-DD.");
  }
  return { desde, hasta };
}

const consumoDelPeriodo: Herramienta = {
  nombre: "consumo_del_periodo",
  descripcion:
    "Cuánto se consumió y se vendió en un rango de fechas: costo, ingreso, utilidad bruta, mermas y compras. Usalo para 'cómo nos fue en agosto' o 'cuánto vendimos este mes'.",
  parametros: RANGO,
  correr: async (input) => {
    const { desde, hasta } = fechas(input);
    const flujo = await periodFlow(desde, hasta);
    return JSON.stringify({
      desde: String(input.desde),
      hasta: String(input.hasta),
      costoDeLoConsumido: flujo.cost,
      ingresoPorVentas: flujo.revenue,
      utilidadBruta: flujo.margin,
      margenSobreVenta: flujo.marginRate,
      mermas: flujo.waste,
      compras: flujo.purchases,
      renglonesDeMovimiento: flujo.movements,
      moneda: "COP",
    });
  },
};

const consumoPorSuite: Herramienta = {
  nombre: "consumo_por_suite",
  descripcion:
    "Qué consumió cada alojamiento en un rango: unidades, costo, ingreso. Usalo para 'qué habitación gasta más' o 'cuánto consumió la Caverna 1'.",
  parametros: RANGO,
  correr: async (input) => {
    const { desde, hasta } = fechas(input);
    const filas = await consumptionByRoom(desde, hasta, 100);
    return JSON.stringify({
      desde: String(input.desde),
      hasta: String(input.hasta),
      moneda: "COP",
      suites: filas.map((f) => ({
        alojamiento: f.number,
        unidades: f.units,
        costo: f.cost,
        ingreso: f.revenue,
        utilidad: f.revenue - f.cost,
      })),
    });
  },
};

const queHayQueComprar: Herramienta = {
  nombre: "que_hay_que_comprar",
  descripcion:
    "Lo que está por debajo de su mínimo y lo que está por vencer. Usalo para 'qué pido esta semana', 'qué está bajo mínimo' o 'qué se me vence'.",
  parametros: objeto({
    diasDeVencimiento: entero(
      "Cuántos días hacia adelante mirar los vencimientos. Por defecto 30.",
    ),
  }),
  correr: async (input) => {
    const [bajos, vencen] = await Promise.all([
      getLowStock(500),
      getExpiring(Math.min(Math.max(Number(input.diasDeVencimiento ?? 30) || 30, 1), 365)),
    ]);
    return JSON.stringify({
      bajoMinimo: bajos.map((a) => ({
        producto: a.product,
        donde: a.location,
        hay: formatQty(a.quantity, a.baseUnit),
        deberiaHaber: formatQty(a.threshold, a.baseUnit),
        faltan: formatQty(Math.max(a.threshold - a.quantity, 0), a.baseUnit),
      })),
      porVencer: vencen.map((a) => ({
        producto: a.product,
        lote: a.code,
        vence: a.expiresAt.toISOString().slice(0, 10),
        cantidad: formatQty(a.quantity, a.baseUnit),
      })),
    });
  },
};

const valorDelInventario: Herramienta = {
  nombre: "valor_del_inventario",
  descripcion:
    "Cuánta plata hay en existencias hoy, a costo, por bodega y en total. Usalo para 'cuánto tengo en bodega' o 'cuánto vale el inventario'.",
  parametros: objeto({}),
  correr: async () => {
    const valor = await inventoryValue();
    return JSON.stringify({
      moneda: "COP",
      total: valor.total,
      porBodega: valor.byLocation.map((l) => ({ bodega: l.location, valor: l.value })),
    });
  },
};

const catalogoYExistencias: Herramienta = {
  nombre: "catalogo_y_existencias",
  descripcion:
    "El saldo de cada producto, opcionalmente filtrado por nombre o categoría. Usalo cuando pregunten por un producto puntual: 'cuánta agua queda', 'cómo está el aguardiente'.",
  parametros: objeto({
    busqueda: texto("Texto a buscar en el nombre del producto o de su categoría."),
  }),
  correr: async (input) => {
    const busqueda = typeof input.busqueda === "string" ? input.busqueda.trim() : "";
    const productos = await prisma.product.findMany({
      where: {
        active: true,
        practice: false,
        ...(busqueda
          ? {
              OR: [
                { name: { contains: busqueda, mode: "insensitive" } },
                { section: { name: { contains: busqueda, mode: "insensitive" } } },
                { category: { name: { contains: busqueda, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 200,
      select: {
        name: true,
        baseUnit: true,
        minQty: true,
        costPrice: true,
        salePrice: true,
        section: { select: { name: true } },
        category: { select: { name: true } },
        stock: { select: { quantity: true, location: { select: { name: true } } } },
      },
    });

    return JSON.stringify(
      productos.map((p) => {
        const total = p.stock.reduce((s, x) => s + num(x.quantity), 0);
        return {
          producto: p.name,
          categoria: p.section?.name ?? "sin categoría",
          subcategoria: p.category.name,
          existencias: formatQty(total, p.baseUnit),
          minimo: formatQty(num(p.minQty), p.baseUnit),
          precioCosto: num(p.costPrice),
          precioVenta: num(p.salePrice),
          seVende: num(p.salePrice) > 0,
        };
      }),
    );
  },
};

const ultimosMovimientos: Herramienta = {
  nombre: "ultimos_movimientos",
  descripcion:
    "Los movimientos más recientes con quién los hizo. Usalo para 'qué pasó ayer' o 'quién sacó el aguardiente'.",
  parametros: objeto({ cuantos: entero("Cuántos traer, de 1 a 50. Por defecto 20.") }),
  correr: async (input) => {
    const pedidos = Number(input.cuantos ?? 20);
    const cuantos = Math.min(Math.max(Number.isFinite(pedidos) ? pedidos : 20, 1), 50);
    const movimientos = await recentMovements(cuantos);
    return JSON.stringify(
      movimientos.map((m) => ({
        cuando: m.occurredAt.toISOString(),
        tipo: m.type,
        quien: m.createdBy.name,
        desde: m.fromLocation?.name ?? null,
        hacia: m.toLocation?.name ?? null,
        alojamiento: m.room?.number ?? null,
        motivo: m.reason,
        renglones: m.lines.map((l) => ({
          producto: l.product.name,
          cantidad: formatQty(num(l.quantity), l.product.baseUnit),
        })),
      })),
    );
  },
};

export const HERRAMIENTAS: Herramienta[] = [
  consumoDelPeriodo,
  consumoPorSuite,
  queHayQueComprar,
  valorDelInventario,
  catalogoYExistencias,
  ultimosMovimientos,
];
