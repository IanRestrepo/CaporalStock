import "server-only";
import type { Documento } from "@/lib/reportes/documento";
import { consumptionByRoom, inventoryValue, periodFlow } from "@/lib/dashboard";
import { getExpiring, getLowStock } from "@/lib/alerts";
import { formatMoney, num } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatQty } from "@/lib/units";

/**
 * Los reportes que sabe hacer la hacienda.
 *
 * Cada uno arma un documento a partir de la base y nada más: no hay modelo de
 * lenguaje en este archivo. El agente elige cuál pedir y con qué fechas; lo que
 * termina en el papel sale de acá, y por eso se puede confiar en el papel.
 */

export const TIPOS = [
  "ventas",
  "stock",
  "alertas",
  "danios",
  "movimientos",
  "compras",
  "suites",
] as const;

export type Tipo = (typeof TIPOS)[number];

export const NOMBRES: Record<Tipo, string> = {
  ventas: "Ventas y utilidad",
  stock: "Existencias",
  alertas: "Alertas",
  danios: "Daños y mermas",
  movimientos: "Movimientos",
  compras: "Compras",
  suites: "Consumo por suite",
};

const fecha = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
const fechaHora = (d: Date) =>
  `${fecha(d)} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
const periodo = (desde: Date, hasta: Date) => {
  const fin = new Date(hasta.getTime() - 1);
  return `${fecha(desde)} — ${fecha(fin)}`;
};

const TIPO_MOVIMIENTO: Record<string, string> = {
  ENTRADA: "Entrada",
  TRASLADO: "Traslado",
  CONSUMO: "Consumo",
  DANIO: "Daño",
  AJUSTE: "Ajuste",
};

async function ventas(desde: Date, hasta: Date): Promise<Documento> {
  const [flujo, filas] = await Promise.all([
    periodFlow(desde, hasta),
    prisma.$queryRaw<
      { producto: string; unidad: string; unidades: string; costo: string; venta: string }[]
    >`
      SELECT p.name AS producto,
             p."baseUnit"::text AS unidad,
             SUM(ml.quantity)::text AS unidades,
             SUM(ml.quantity * ml."unitCost")::text AS costo,
             SUM(ml.quantity * ml."unitPrice")::text AS venta
        FROM "Movement" m
        JOIN "MovementLine" ml ON ml."movementId" = m.id
        JOIN "Product" p ON p.id = ml."productId" AND NOT p.practice
       WHERE m.type = 'CONSUMO'
         AND m."occurredAt" >= ${desde} AND m."occurredAt" < ${hasta}
       GROUP BY p.name, p."baseUnit"
       ORDER BY SUM(ml.quantity * ml."unitPrice") DESC, p.name
    `,
  ]);

  return {
    clase: "Reporte",
    subtitulo: "de ventas y utilidad",
    resumen: [
      { etiqueta: "Período", valor: periodo(desde, hasta) },
      { etiqueta: "Referencias", valor: String(filas.length) },
      { etiqueta: "Costo", valor: formatMoney(flujo.cost) },
      { etiqueta: "Ingresos", valor: formatMoney(flujo.revenue) },
    ],
    columnas: [
      { titulo: "#", ancho: 4 },
      { titulo: "Producto", ancho: 34, destacar: true },
      { titulo: "Cantidad", ancho: 16, alinear: "derecha" },
      { titulo: "Costo", ancho: 16, alinear: "derecha" },
      { titulo: "Venta", ancho: 16, alinear: "derecha" },
      { titulo: "Utilidad", ancho: 16, alinear: "derecha" },
    ],
    filas: filas.map((f, i) => [
      String(i + 1),
      f.producto,
      formatQty(Number(f.unidades), f.unidad as never, { exact: true }),
      formatMoney(Number(f.costo)),
      formatMoney(Number(f.venta)),
      formatMoney(Number(f.venta) - Number(f.costo)),
    ]),
    totales: [
      { etiqueta: "Costo de lo vendido", valor: formatMoney(flujo.cost) },
      { etiqueta: "Ingresos", valor: formatMoney(flujo.revenue) },
      { etiqueta: "Mermas del período", valor: formatMoney(flujo.waste) },
    ],
    total: { etiqueta: "Utilidad bruta", valor: formatMoney(flujo.margin) },
    vacio: "No se vendió nada en este período.",
  };
}

async function stock(): Promise<Documento> {
  const [productos, valor] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, practice: false },
      orderBy: [{ section: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        name: true,
        baseUnit: true,
        minQty: true,
        costPrice: true,
        section: { select: { name: true } },
        stock: { select: { quantity: true, location: { select: { practice: true } } } },
      },
    }),
    inventoryValue(),
  ]);

  const filas = productos.map((p, i) => {
    const total = p.stock
      .filter((s) => !s.location.practice)
      .reduce((sum, s) => sum + num(s.quantity), 0);
    const minimo = num(p.minQty);
    return {
      celdas: [
        String(i + 1),
        p.name,
        p.section?.name ?? "Sin categoría",
        formatQty(total, p.baseUnit, { exact: true }),
        minimo > 0 ? formatQty(minimo, p.baseUnit, { exact: true }) : "—",
        formatMoney(total * num(p.costPrice)),
      ],
      bajo: minimo > 0 && total < minimo,
    };
  });

  return {
    clase: "Reporte",
    subtitulo: "de existencias",
    resumen: [
      { etiqueta: "Referencias", valor: String(productos.length) },
      { etiqueta: "Con existencia", valor: String(filas.filter((f) => f.celdas[3] !== "0 u").length) },
      { etiqueta: "Bajo mínimo", valor: String(filas.filter((f) => f.bajo).length) },
      { etiqueta: "Valor a costo", valor: formatMoney(valor.total) },
    ],
    columnas: [
      { titulo: "#", ancho: 4 },
      { titulo: "Producto", ancho: 32, destacar: true },
      { titulo: "Categoría", ancho: 22 },
      { titulo: "Existencia", ancho: 16, alinear: "derecha" },
      { titulo: "Mínimo", ancho: 12, alinear: "derecha" },
      { titulo: "Valor", ancho: 16, alinear: "derecha" },
    ],
    filas: filas.map((f) => f.celdas),
    total: { etiqueta: "Valor del inventario", valor: formatMoney(valor.total) },
    vacio: "El catálogo está vacío.",
  };
}

async function alertas(): Promise<Documento> {
  const [bajos, vencen] = await Promise.all([getLowStock(500), getExpiring(30)]);

  const filas = [
    ...bajos.map((a) => [
      "Bajo mínimo",
      a.product,
      a.location,
      formatQty(a.quantity, a.baseUnit, { exact: true }),
      formatQty(a.threshold, a.baseUnit, { exact: true }),
      formatQty(Math.max(a.threshold - a.quantity, 0), a.baseUnit, { exact: true }),
    ]),
    ...vencen.map((a) => [
      "Por vencer",
      a.product,
      `Lote ${a.code}`,
      formatQty(a.quantity, a.baseUnit, { exact: true }),
      fecha(a.expiresAt),
      "—",
    ]),
  ];

  return {
    clase: "Reporte",
    subtitulo: "de alertas",
    resumen: [
      { etiqueta: "Generado", valor: fecha(new Date()) },
      { etiqueta: "Bajo mínimo", valor: String(bajos.length) },
      { etiqueta: "Por vencer", valor: String(vencen.length) },
      { etiqueta: "Total", valor: String(filas.length) },
    ],
    columnas: [
      { titulo: "Alerta", ancho: 13 },
      { titulo: "Producto", ancho: 30, destacar: true },
      { titulo: "Dónde", ancho: 23 },
      { titulo: "Hay", ancho: 11, alinear: "derecha" },
      { titulo: "Objetivo", ancho: 12, alinear: "derecha" },
      { titulo: "Faltan", ancho: 11, alinear: "derecha" },
    ],
    filas,
    vacio: "No hay nada bajo mínimo ni por vencer. Todo en orden.",
  };
}

async function danios(desde: Date, hasta: Date): Promise<Documento> {
  const filas = await prisma.$queryRaw<
    {
      cuando: Date; producto: string; unidad: string; cantidad: string;
      costo: string; motivo: string | null; quien: string;
    }[]
  >`
    SELECT m."occurredAt" AS cuando,
           p.name AS producto,
           p."baseUnit"::text AS unidad,
           ml.quantity::text AS cantidad,
           (ml.quantity * ml."unitCost")::text AS costo,
           m.reason AS motivo,
           u.name AS quien
      FROM "Movement" m
      JOIN "MovementLine" ml ON ml."movementId" = m.id
      JOIN "Product" p ON p.id = ml."productId" AND NOT p.practice
      JOIN "User" u ON u.id = m."createdById"
     WHERE m.type = 'DANIO'
       AND m."occurredAt" >= ${desde} AND m."occurredAt" < ${hasta}
     ORDER BY m."occurredAt" DESC
  `;

  const total = filas.reduce((s, f) => s + Number(f.costo), 0);

  return {
    clase: "Reporte",
    subtitulo: "de daños y mermas",
    resumen: [
      { etiqueta: "Período", valor: periodo(desde, hasta) },
      { etiqueta: "Registros", valor: String(filas.length) },
      { etiqueta: "Generado", valor: fecha(new Date()) },
      { etiqueta: "Costo perdido", valor: formatMoney(total) },
    ],
    columnas: [
      { titulo: "#", ancho: 4 },
      { titulo: "Fecha", ancho: 18 },
      { titulo: "Producto", ancho: 28, destacar: true },
      { titulo: "Motivo", ancho: 20 },
      { titulo: "Cantidad", ancho: 14, alinear: "derecha" },
      { titulo: "Costo", ancho: 16, alinear: "derecha" },
    ],
    filas: filas.map((f, i) => [
      String(i + 1),
      fechaHora(f.cuando),
      f.producto,
      f.motivo ?? "Sin motivo",
      formatQty(Number(f.cantidad), f.unidad as never, { exact: true }),
      formatMoney(Number(f.costo)),
    ]),
    total: { etiqueta: "Total perdido", valor: formatMoney(total) },
    vacio: "No se registraron daños en este período.",
  };
}

async function movimientos(desde: Date, hasta: Date): Promise<Documento> {
  const filas = await prisma.movement.findMany({
    where: { occurredAt: { gte: desde, lt: hasta } },
    orderBy: { occurredAt: "desc" },
    take: 400,
    select: {
      occurredAt: true,
      type: true,
      reason: true,
      createdBy: { select: { name: true } },
      fromLocation: { select: { name: true, practice: true } },
      toLocation: { select: { name: true, practice: true } },
      room: { select: { number: true } },
      lines: {
        select: { quantity: true, product: { select: { name: true, baseUnit: true, practice: true } } },
      },
    },
  });

  const reales = filas.filter(
    (m) =>
      !m.fromLocation?.practice &&
      !m.toLocation?.practice &&
      !m.lines.some((l) => l.product.practice),
  );

  return {
    clase: "Reporte",
    subtitulo: "de movimientos",
    resumen: [
      { etiqueta: "Período", valor: periodo(desde, hasta) },
      { etiqueta: "Movimientos", valor: String(reales.length) },
      { etiqueta: "Generado", valor: fecha(new Date()) },
      {
        etiqueta: "Renglones",
        valor: String(reales.reduce((s, m) => s + m.lines.length, 0)),
      },
    ],
    columnas: [
      { titulo: "#", ancho: 4 },
      { titulo: "Fecha", ancho: 17 },
      { titulo: "Tipo", ancho: 11 },
      { titulo: "Producto", ancho: 26, destacar: true },
      { titulo: "Ruta", ancho: 26 },
      { titulo: "Cantidad", ancho: 16, alinear: "derecha" },
    ],
    filas: reales.flatMap((m, i) =>
      m.lines.map((l) => [
        String(i + 1),
        fechaHora(m.occurredAt),
        TIPO_MOVIMIENTO[m.type] ?? m.type,
        l.product.name,
        [m.fromLocation?.name, m.toLocation?.name].filter(Boolean).join(" › ") ||
          (m.room ? `Suite ${m.room.number}` : "—"),
        formatQty(num(l.quantity), l.product.baseUnit, { exact: true }),
      ]),
    ),
    vacio: "No hubo movimientos en este período.",
  };
}

async function compras(desde: Date, hasta: Date): Promise<Documento> {
  const facturas = await prisma.purchase.findMany({
    where: { issuedAt: { gte: desde, lt: hasta } },
    orderBy: { issuedAt: "desc" },
    select: {
      number: true,
      issuedAt: true,
      status: true,
      total: true,
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const total = facturas.reduce((s, f) => s + num(f.total), 0);

  return {
    clase: "Reporte",
    subtitulo: "de compras",
    resumen: [
      { etiqueta: "Período", valor: periodo(desde, hasta) },
      { etiqueta: "Facturas", valor: String(facturas.length) },
      { etiqueta: "Generado", valor: fecha(new Date()) },
      { etiqueta: "Total comprado", valor: formatMoney(total) },
    ],
    columnas: [
      { titulo: "#", ancho: 4 },
      { titulo: "Factura", ancho: 16, destacar: true },
      { titulo: "Fecha", ancho: 14 },
      { titulo: "Proveedor", ancho: 32 },
      { titulo: "Estado", ancho: 14 },
      { titulo: "Total", ancho: 16, alinear: "derecha" },
    ],
    filas: facturas.map((f, i) => [
      String(i + 1),
      f.number,
      fecha(f.issuedAt),
      f.supplier.name,
      f.status === "CONFIRMADA" ? "Confirmada" : "Borrador",
      formatMoney(num(f.total)),
    ]),
    total: { etiqueta: "Total comprado", valor: formatMoney(total) },
    vacio: "No se registraron compras en este período.",
  };
}

async function suites(desde: Date, hasta: Date): Promise<Documento> {
  const filas = await consumptionByRoom(desde, hasta, 100);
  const ingreso = filas.reduce((s, f) => s + f.revenue, 0);
  const costo = filas.reduce((s, f) => s + f.cost, 0);

  return {
    clase: "Reporte",
    subtitulo: "de consumo por suite",
    resumen: [
      { etiqueta: "Período", valor: periodo(desde, hasta) },
      { etiqueta: "Alojamientos", valor: String(filas.length) },
      { etiqueta: "Costo", valor: formatMoney(costo) },
      { etiqueta: "Ingresos", valor: formatMoney(ingreso) },
    ],
    columnas: [
      { titulo: "#", ancho: 5 },
      { titulo: "Alojamiento", ancho: 39, destacar: true },
      { titulo: "Unidades", ancho: 14, alinear: "derecha" },
      { titulo: "Costo", ancho: 14, alinear: "derecha" },
      { titulo: "Ingreso", ancho: 14, alinear: "derecha" },
      { titulo: "Utilidad", ancho: 14, alinear: "derecha" },
    ],
    filas: filas.map((f, i) => [
      String(i + 1),
      f.number,
      String(f.units),
      formatMoney(f.cost),
      formatMoney(f.revenue),
      formatMoney(f.revenue - f.cost),
    ]),
    totales: [
      { etiqueta: "Costo", valor: formatMoney(costo) },
      { etiqueta: "Ingresos", valor: formatMoney(ingreso) },
    ],
    total: { etiqueta: "Utilidad bruta", valor: formatMoney(ingreso - costo) },
    vacio: "Ninguna suite registró consumo en este período.",
  };
}

export async function armarReporte(tipo: Tipo, desde: Date, hasta: Date): Promise<Documento> {
  switch (tipo) {
    case "ventas":
      return ventas(desde, hasta);
    case "stock":
      return stock();
    case "alertas":
      return alertas();
    case "danios":
      return danios(desde, hasta);
    case "movimientos":
      return movimientos(desde, hasta);
    case "compras":
      return compras(desde, hasta);
    case "suites":
      return suites(desde, hasta);
  }
}
