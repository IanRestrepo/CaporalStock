import { afterAll, describe, expect, test } from "vitest";
import { HERRAMIENTAS } from "@/lib/reportes/herramientas";
import { prisma } from "@/lib/prisma";

/**
 * Las herramientas del agente son de donde salen las cifras del reporte.
 *
 * El modelo no calcula: elige cuál correr y redacta. Así que lo que hay que
 * probar es que cada una devuelva datos de la base, bien formados — si una
 * revienta o devuelve basura, el reporte sale con un hueco o, peor, el modelo
 * lo rellena.
 */

const porNombre = Object.fromEntries(HERRAMIENTAS.map((h) => [h.nombre, h]));

async function correr(nombre: string, input: Record<string, unknown>) {
  return JSON.parse(await porNombre[nombre].correr(input));
}

const MES = { desde: "2026-08-01", hasta: "2026-09-01" };

describe("herramientas del agente de reportes", () => {
  test("están todas y se describen solas", () => {
    expect(HERRAMIENTAS).toHaveLength(9);
    for (const h of HERRAMIENTAS) {
      expect(h.nombre).toMatch(/^[a-z_]+$/);
      // La descripción es lo único que el modelo lee para elegir: si es pobre,
      // corre la herramienta equivocada.
      expect(h.descripcion.length).toBeGreaterThan(60);
    }
  });

  test("el consumo del período devuelve plata, no texto", async () => {
    const r = await correr("consumo_del_periodo", MES);
    for (const campo of ["costoDeLoConsumido", "ingresoPorVentas", "utilidadBruta", "mermas"]) {
      expect(typeof r[campo]).toBe("number");
    }
    expect(r.utilidadBruta).toBe(r.ingresoPorVentas - r.costoDeLoConsumido);
    expect(r.moneda).toBe("COP");
  });

  test("el consumo por suite trae los alojamientos del hotel", async () => {
    const r = await correr("consumo_por_suite", MES);
    expect(Array.isArray(r.suites)).toBe(true);
    for (const s of r.suites) {
      expect(typeof s.alojamiento).toBe("string");
      expect(s.utilidad).toBe(s.ingreso - s.costo);
    }
  });

  test("qué comprar separa lo bajo de lo que vence", async () => {
    const r = await correr("que_hay_que_comprar", {});
    expect(Array.isArray(r.bajoMinimo)).toBe(true);
    expect(Array.isArray(r.porVencer)).toBe(true);
    // Las cantidades vienen formateadas para copiarse tal cual al reporte.
    for (const a of r.bajoMinimo) expect(a.hay).toMatch(/\d/);
  });

  test("el valor del inventario cuadra con la suma por bodega", async () => {
    const r = await correr("valor_del_inventario", {});
    const suma = r.porBodega.reduce((s: number, b: { valor: number }) => s + b.valor, 0);
    expect(Math.abs(suma - r.total)).toBeLessThan(1);
  });

  test("el catálogo filtra por nombre y no muestra la práctica", async () => {
    const todo = await correr("catalogo_y_existencias", {});
    expect(todo.length).toBeGreaterThan(0);
    expect(todo.every((p: { producto: string }) => !p.producto.includes("de práctica"))).toBe(true);

    const agua = await correr("catalogo_y_existencias", { busqueda: "agua" });
    expect(agua.length).toBeLessThanOrEqual(todo.length);
    expect(agua.every((p: { producto: string; categoria: string; subcategoria: string }) =>
      `${p.producto} ${p.categoria} ${p.subcategoria}`.toLowerCase().includes("agua"),
    )).toBe(true);
  });

  test("distingue lo que se vende de lo que es sólo stock", async () => {
    const todo = await correr("catalogo_y_existencias", {});
    const venden = todo.filter((p: { seVende: boolean }) => p.seVende);
    const stock = todo.filter((p: { seVende: boolean }) => !p.seVende);
    expect(venden.length).toBeGreaterThan(0);
    expect(stock.length).toBeGreaterThan(0);
    for (const p of venden) expect(p.precioVenta).toBeGreaterThan(0);
    for (const p of stock) expect(p.precioVenta).toBe(0);
  });

  test("el PDF devuelve un enlace de la app, no de afuera", async () => {
    const r = await correr("generar_pdf", { tipo: "stock" });
    expect(r.listo).toBe(true);
    expect(r.enlace).toMatch(/^\/api\/reportes\?tipo=stock/);
  });

  test("un tipo de reporte inventado se rechaza", async () => {
    const r = await correr("generar_pdf", { tipo: "loquesea" });
    expect(r.error).toMatch(/No existe/);
    expect(r.disponibles).toContain("ventas");
  });

  test("los últimos movimientos respetan el tope pedido", async () => {
    const r = await correr("ultimos_movimientos", { cuantos: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });

  test("una fecha mal escrita se rechaza en vez de inventar un rango", async () => {
    await expect(correr("consumo_del_periodo", { desde: "agosto", hasta: "ya" })).rejects.toThrow(
      /AAAA-MM-DD/,
    );
  });
});

/**
 * Las dos que escriben.
 *
 * Acá no alcanza con que no revienten: hay que probar que NO hagan de más.
 * Una lectura equivocada devuelve un número raro y se nota; un borrado
 * equivocado se lleva un producto y nadie se entera hasta que lo busca.
 */
describe("crear y eliminar productos", () => {
  const marca = `ZZ-agente-${Date.now()}`;

  afterAll(async () => {
    const ids = await prisma.product.findMany({
      where: { name: { startsWith: "ZZ-agente-" } },
      select: { id: true },
    });
    if (ids.length) {
      await prisma.stock.deleteMany({ where: { productId: { in: ids.map((p) => p.id) } } });
      await prisma.presentation.deleteMany({ where: { productId: { in: ids.map((p) => p.id) } } });
      await prisma.product.deleteMany({ where: { id: { in: ids.map((p) => p.id) } } });
    }
  });

  test("una subcategoría inventada no crea nada, y dice cuáles hay", async () => {
    const r = await correr("crear_producto", {
      nombre: `${marca} fantasma`,
      subcategoria: "Repuestos de nave espacial",
    });
    expect(r.error).toMatch(/No existe la subcategoría/);
    expect(Array.isArray(r.disponibles)).toBe(true);
    expect(await prisma.product.count({ where: { name: `${marca} fantasma` } })).toBe(0);
  });

  test("una unidad desconocida no crea nada", async () => {
    const r = await correr("crear_producto", {
      nombre: `${marca} raro`,
      subcategoria: "Licores",
      unidad: "BARRILES",
    });
    expect(r.error).toMatch(/Unidad desconocida/);
    expect(await prisma.product.count({ where: { name: `${marca} raro` } })).toBe(0);
  });

  test("crea el producto con su unidad y su clasificación", async () => {
    const r = await correr("crear_producto", {
      nombre: `${marca} whisky`,
      subcategoria: "Licores",
      categoria: "Bar",
      unidad: "LITRO",
      precioVenta: 40000,
      minimo: 3,
    });
    expect(r.creado).toBe(true);

    const creado = await prisma.product.findFirstOrThrow({
      where: { name: `${marca} whisky` },
      select: { baseUnit: true, salePrice: true, section: { select: { name: true } } },
    });
    expect(creado.baseUnit).toBe("LITRO");
    expect(Number(creado.salePrice)).toBe(40000);
    expect(creado.section?.name).toBe("Bar");
  });

  test("no crea dos veces el mismo producto", async () => {
    const r = await correr("crear_producto", {
      nombre: `${marca} whisky`,
      subcategoria: "Licores",
    });
    expect(r.error).toMatch(/Ya existe/);
    expect(await prisma.product.count({ where: { name: `${marca} whisky` } })).toBe(1);
  });

  test("un nombre ambiguo no borra nada y devuelve los candidatos", async () => {
    // Dos que empiezan igual y ninguno se llama exactamente como la búsqueda.
    await correr("crear_producto", { nombre: `${marca} ron claro`, subcategoria: "Licores" });
    await correr("crear_producto", { nombre: `${marca} ron oscuro`, subcategoria: "Licores" });

    const r = await correr("eliminar_producto", { nombre: `${marca} ron` });
    expect(r.error).toMatch(/coincide con/);
    expect(r.coincidencias).toHaveLength(2);
    expect(await prisma.product.count({ where: { name: { startsWith: `${marca} ron` } } })).toBe(2);
  });

  test("el nombre exacto gana sobre los parecidos", async () => {
    // "whisky" existe tal cual y además está "whisky añejo": no es ambiguo.
    await correr("crear_producto", { nombre: `${marca} whisky añejo`, subcategoria: "Licores" });

    const r = await correr("eliminar_producto", { nombre: `${marca} whisky` });
    expect(r.nombre).toBe(`${marca} whisky`);
    expect(await prisma.product.count({ where: { name: `${marca} whisky añejo` } })).toBe(1);
  });

  test("un producto que no existe no borra nada", async () => {
    const r = await correr("eliminar_producto", { nombre: "ZZ-nada-de-esto-existe" });
    expect(r.error).toMatch(/No hay ningún producto/);
  });

  test("borra de verdad el que nunca se movió", async () => {
    const r = await correr("eliminar_producto", { nombre: `${marca} whisky añejo` });
    expect(r.archivado).toBe(false);
    expect(await prisma.product.count({ where: { name: `${marca} whisky añejo` } })).toBe(0);
  });

  test("archiva en vez de borrar el que tiene saldo", async () => {
    await correr("crear_producto", { nombre: `${marca} con saldo`, subcategoria: "Licores" });
    const producto = await prisma.product.findFirstOrThrow({
      where: { name: `${marca} con saldo` },
      select: { id: true },
    });
    const bodega = await prisma.location.findFirstOrThrow({
      where: { kind: "PRINCIPAL", practice: false },
      select: { id: true },
    });
    await prisma.stock.create({
      data: { productId: producto.id, locationId: bodega.id, quantity: 5 },
    });

    const r = await correr("eliminar_producto", { nombre: `${marca} con saldo` });
    expect(r.archivado).toBe(true);

    const despues = await prisma.product.findUniqueOrThrow({
      where: { id: producto.id },
      select: { active: true },
    });
    expect(despues.active).toBe(false);
  });
});
