import "server-only";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
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

/** "agosto", "este mes", "últimos 90 días" -> un rango concreto. */
const rango = z.object({
  desde: z.string().describe("Fecha de inicio en formato AAAA-MM-DD, inclusive."),
  hasta: z.string().describe("Fecha de fin en formato AAAA-MM-DD, exclusiva."),
});

function fechas(input: { desde: string; hasta: string }) {
  const desde = new Date(`${input.desde}T00:00:00`);
  const hasta = new Date(`${input.hasta}T00:00:00`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    throw new Error("Las fechas deben venir como AAAA-MM-DD.");
  }
  return { desde, hasta };
}

const consumoDelPeriodo = betaZodTool({
  name: "consumo_del_periodo",
  description:
    "Cuánto se consumió y se vendió en un rango de fechas: costo, ingreso, utilidad bruta, mermas y compras. Usalo para 'cómo nos fue en agosto' o 'cuánto vendimos este mes'.",
  inputSchema: rango,
  run: async (input) => {
    const { desde, hasta } = fechas(input);
    const flujo = await periodFlow(desde, hasta);
    return JSON.stringify({
      desde: input.desde,
      hasta: input.hasta,
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
});

const consumoPorSuite = betaZodTool({
  name: "consumo_por_suite",
  description:
    "Qué consumió cada alojamiento en un rango: unidades, costo, ingreso. Usalo para 'qué habitación gasta más' o 'cuánto consumió la Caverna 1'.",
  inputSchema: rango,
  run: async (input) => {
    const { desde, hasta } = fechas(input);
    const filas = await consumptionByRoom(desde, hasta, 100);
    return JSON.stringify({
      desde: input.desde,
      hasta: input.hasta,
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
});

const queHayQueComprar = betaZodTool({
  name: "que_hay_que_comprar",
  description:
    "Lo que está por debajo de su mínimo y lo que está por vencer. Usalo para 'qué pido esta semana', 'qué está bajo mínimo' o 'qué se me vence'.",
  inputSchema: z.object({
    diasDeVencimiento: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe("Cuántos días hacia adelante mirar los vencimientos. Por defecto 30."),
  }),
  run: async (input) => {
    const [bajos, vencen] = await Promise.all([
      getLowStock(500),
      getExpiring(input.diasDeVencimiento ?? 30),
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
});

const valorDelInventario = betaZodTool({
  name: "valor_del_inventario",
  description:
    "Cuánta plata hay en existencias hoy, a costo, por bodega y en total. Usalo para 'cuánto tengo en bodega' o 'cuánto vale el inventario'.",
  inputSchema: z.object({}),
  run: async () => {
    const valor = await inventoryValue();
    return JSON.stringify({
      moneda: "COP",
      total: valor.total,
      porBodega: valor.byLocation.map((l) => ({ bodega: l.location, valor: l.value })),
    });
  },
});

const catalogoYExistencias = betaZodTool({
  name: "catalogo_y_existencias",
  description:
    "El saldo de cada producto, opcionalmente filtrado por nombre o categoría. Usalo cuando pregunten por un producto puntual: 'cuánta agua queda', 'cómo está el aguardiente'.",
  inputSchema: z.object({
    busqueda: z
      .string()
      .optional()
      .describe("Texto a buscar en el nombre del producto o de su categoría."),
  }),
  run: async (input) => {
    const busqueda = input.busqueda?.trim();
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
});

const ultimosMovimientos = betaZodTool({
  name: "ultimos_movimientos",
  description:
    "Los movimientos más recientes con quién los hizo. Usalo para 'qué pasó ayer' o 'quién sacó el aguardiente'.",
  inputSchema: z.object({
    cuantos: z.number().int().min(1).max(50).optional().describe("Por defecto 20."),
  }),
  run: async (input) => {
    const movimientos = await recentMovements(input.cuantos ?? 20);
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
});

export const HERRAMIENTAS = [
  consumoDelPeriodo,
  consumoPorSuite,
  queHayQueComprar,
  valorDelInventario,
  catalogoYExistencias,
  ultimosMovimientos,
];
