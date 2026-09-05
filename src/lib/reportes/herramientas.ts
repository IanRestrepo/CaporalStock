import "server-only";
import {
  consumptionByRoom,
  inventoryValue,
  periodFlow,
  recentMovements,
} from "@/lib/dashboard";
import { getExpiring, getLowStock } from "@/lib/alerts";
import { NOMBRES, TIPOS, type Tipo } from "@/lib/reportes/catalogo";
import { borrarProducto, guardarProducto } from "@/lib/productos";
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

/**
 * El PDF.
 *
 * No lo dibuja el modelo: elige el tipo y las fechas, y devuelve el enlace que
 * arma la hoja con los datos de la base. Así el papel dice lo mismo que la app,
 * pase lo que pase con la redacción de arriba.
 */
const generarPdf: Herramienta = {
  nombre: "generar_pdf",
  descripcion:
    "Arma el reporte en PDF con el membrete de la hacienda, listo para imprimir o archivar. Usalo cuando pidan 'un reporte', 'un PDF', 'algo para imprimir' o 'pasámelo en papel'. Tipos: ventas, stock, alertas, danios, movimientos, compras, suites.",
  parametros: objeto(
    {
      tipo: texto(
        "Uno de: ventas, stock, alertas, danios, movimientos, compras, suites.",
      ),
      desde: texto("Fecha de inicio AAAA-MM-DD. Se ignora en stock y alertas."),
      hasta: texto("Fecha de fin AAAA-MM-DD, exclusiva. Se ignora en stock y alertas."),
    },
    ["tipo"],
  ),
  correr: async (input) => {
    const tipo = String(input.tipo ?? "");
    if (!TIPOS.includes(tipo as Tipo)) {
      return JSON.stringify({ error: `No existe el reporte "${tipo}".`, disponibles: TIPOS });
    }

    const hoy = new Date();
    const inicio = String(input.desde ?? "") || new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    const fin = String(input.hasta ?? "") || new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString().slice(0, 10);

    return JSON.stringify({
      listo: true,
      nombre: NOMBRES[tipo as Tipo],
      // El enlace se le da al usuario tal cual; que lo escriba en la respuesta.
      enlace: `/api/reportes?tipo=${tipo}&desde=${inicio}&hasta=${fin}`,
      instruccion:
        "Decile al usuario que el reporte está listo y pegá el enlace como [Abrir el PDF](enlace).",
    });
  },
};

/**
 * Las dos que escriben.
 *
 * Todo lo demás en este archivo lee. Estas cambian el catálogo del hotel a
 * partir de una frase, que es un salto de confianza distinto: una lectura mal
 * entendida devuelve un número raro y se nota, pero un borrado mal entendido se
 * lleva un producto y nadie se entera hasta que lo busca.
 *
 * Por eso van sobre las mismas acciones que usa la interfaz —con su control de
 * administrador y su regla de archivar en vez de borrar cuando hay historial— y
 * por eso ninguna adivina: si el nombre no señala a un solo producto, no tocan
 * nada y devuelven la lista para que la persona elija.
 */
const crearProducto: Herramienta = {
  nombre: "crear_producto",
  descripcion:
    "Da de alta un producto en el catálogo. Usalo cuando pidan 'agregá', 'creá' o 'añadí' un producto. Pedí la unidad de medida si no la dijeron: no se puede cambiar después.",
  parametros: objeto(
    {
      nombre: texto("Nombre del producto, como va a aparecer en la lista."),
      subcategoria: texto("Qué es: Bebidas, Licores, Lencería… Si no existe, se devuelven las que hay."),
      categoria: texto("Dónde se usa: Bar, Cocina, Lavandería… Opcional."),
      unidad: texto("GRAMO, KILO, MILILITRO, LITRO o UNIDAD. Por defecto UNIDAD."),
      precioCosto: entero("Lo que cuesta comprarlo, por unidad de medida. Opcional."),
      precioVenta: entero("Lo que se le cobra al huésped. Cero o vacío si no se vende."),
      minimo: entero("Stock mínimo: por debajo de esto el sistema avisa. Opcional."),
      controlaVencimiento: texto("'si' si hay que llevarle fecha de vencimiento."),
    },
    ["nombre", "subcategoria"],
  ),
  correr: async (input) => {
    const nombre = String(input.nombre ?? "").trim();
    if (nombre.length < 2) return JSON.stringify({ error: "Falta el nombre del producto." });

    const [subcategorias, categorias] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
      prisma.section.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const buscar = (lista: { id: string; name: string }[], texto: unknown) => {
      const q = String(texto ?? "").trim().toLowerCase();
      if (!q) return null;
      return (
        lista.find((x) => x.name.toLowerCase() === q) ??
        lista.find((x) => x.name.toLowerCase().includes(q)) ??
        null
      );
    };

    const sub = buscar(subcategorias, input.subcategoria);
    if (!sub) {
      return JSON.stringify({
        error: `No existe la subcategoría "${input.subcategoria}".`,
        disponibles: subcategorias.map((c) => c.name),
      });
    }

    const yaEsta = await prisma.product.findFirst({
      where: { name: { equals: nombre, mode: "insensitive" }, practice: false },
      select: { name: true, active: true },
    });
    if (yaEsta) {
      return JSON.stringify({
        error: `Ya existe "${yaEsta.name}"${yaEsta.active ? "" : " (archivado)"}. No se creó nada.`,
      });
    }

    const unidad = String(input.unidad ?? "UNIDAD").toUpperCase();
    const unidades = ["GRAMO", "KILO", "MILILITRO", "LITRO", "UNIDAD"];
    if (!unidades.includes(unidad)) {
      return JSON.stringify({ error: `Unidad desconocida "${unidad}".`, unidades });
    }

    try {
      await guardarProducto({
        name: nombre,
        categoryId: sub.id,
        sectionId: buscar(categorias, input.categoria)?.id ?? null,
        baseUnit: unidad as never,
        costPrice: Number(input.precioCosto ?? 0) || 0,
        salePrice: Number(input.precioVenta ?? 0) || 0,
        minQty: Number(input.minimo ?? 0) || 0,
        perishable: String(input.controlaVencimiento ?? "").toLowerCase().startsWith("s"),
        active: true,
      });
    } catch (err) {
      console.error(err);
      return JSON.stringify({ error: "No se pudo crear el producto." });
    }

    return JSON.stringify({
      creado: true,
      nombre,
      subcategoria: sub.name,
      categoria: buscar(categorias, input.categoria)?.name ?? "sin asignar",
      unidad,
      aviso: "Nace con existencia en cero: el saldo entra por una compra o un conteo.",
    });
  },
};

const eliminarProducto: Herramienta = {
  nombre: "eliminar_producto",
  descripcion:
    "Da de baja un producto del catálogo. Usalo cuando pidan 'borrá', 'eliminá' o 'quitá' un producto. Si el nombre no señala a uno solo, no borra nada y devuelve los que coinciden.",
  parametros: objeto(
    { nombre: texto("Nombre del producto a dar de baja, lo más completo posible.") },
    ["nombre"],
  ),
  correr: async (input) => {
    const busqueda = String(input.nombre ?? "").trim();
    if (busqueda.length < 2) return JSON.stringify({ error: "Falta el nombre del producto." });

    const candidatos = await prisma.product.findMany({
      where: { active: true, practice: false, name: { contains: busqueda, mode: "insensitive" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    });

    if (!candidatos.length) {
      return JSON.stringify({ error: `No hay ningún producto activo que se llame "${busqueda}".` });
    }

    // Un nombre exacto gana sobre los parecidos: "Agua 300 ml" no debería
    // quedar bloqueada porque además exista "Agua 300 ml sin gas".
    const exacto = candidatos.find((c) => c.name.toLowerCase() === busqueda.toLowerCase());
    const elegido = exacto ?? (candidatos.length === 1 ? candidatos[0] : null);

    if (!elegido) {
      return JSON.stringify({
        error: `"${busqueda}" coincide con ${candidatos.length} productos. No se borró nada.`,
        coincidencias: candidatos.map((c) => c.name),
        instruccion: "Preguntale a la persona cuál de estos quiere dar de baja, con el nombre completo.",
      });
    }

    let archivado: boolean;
    try {
      ({ archivado } = await borrarProducto(elegido.id));
    } catch (err) {
      console.error(err);
      return JSON.stringify({ error: "No se pudo dar de baja el producto." });
    }

    return JSON.stringify({
      nombre: elegido.name,
      archivado,
      detalle: archivado
        ? "Tenía movimientos o saldo, así que se archivó en vez de borrarse: desaparece de las listas pero el historial queda intacto."
        : "Nunca se movió y estaba en cero, así que se borró del todo.",
    });
  },
};

export const HERRAMIENTAS: Herramienta[] = [
  consumoDelPeriodo,
  consumoPorSuite,
  queHayQueComprar,
  valorDelInventario,
  catalogoYExistencias,
  ultimosMovimientos,
  generarPdf,
  crearProducto,
  eliminarProducto,
];
