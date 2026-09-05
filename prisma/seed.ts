import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

/**
 * Arranque del hotel.
 *
 * Siembra lo que se repite en cada alojamiento: lo que va en el minibar y lo
 * que hay que encontrar al revisar la suite. No siembra existencias — el saldo
 * de la bodega lo levanta el hotel contando su estante, no un archivo.
 */

/** Por dónde se entra a la bodega. */
const SECTIONS = [
  { name: "Bar", color: "amber", icon: "wine", sortOrder: 1 },
  { name: "Cocina", color: "coral", icon: "chef-hat", sortOrder: 2 },
  { name: "Recepción", color: "sky", icon: "sparkles", sortOrder: 3 },
  { name: "Lavandería", color: "mint", icon: "washing-machine", sortOrder: 4 },
  { name: "Aseo y mantenimiento", color: "slate", icon: "spray-can", sortOrder: 5 },
  { name: "Decoración", color: "violet", icon: "lamp", sortOrder: 6 },
];

/** Qué es el producto. Da el color y el filtro rápido dentro de la lista. */
const CATEGORIES = [
  { name: "Aguas y gaseosas", color: "sky", icon: "cup-soda", sortOrder: 1 },
  { name: "Cervezas", color: "amber", icon: "cup-soda", sortOrder: 2 },
  { name: "Licores", color: "coral", icon: "wine", sortOrder: 3 },
  { name: "Amenities", color: "violet", icon: "sparkles", sortOrder: 4 },
  { name: "Lencería", color: "rose", icon: "bed-double", sortOrder: 5 },
  { name: "Dotación", color: "slate", icon: "plug", sortOrder: 6 },
  { name: "Menaje", color: "slate", icon: "sofa", sortOrder: 7 },
  { name: "Limpieza", color: "mint", icon: "spray-can", sortOrder: 8 },
];

/**
 * Los alojamientos. El grupo no es decorativo: decide qué checklist se usa al
 * revisar, porque una caverna no lleva lo mismo que un loft.
 */
const ROOMS = [
  { number: "Villa Girasol", floor: "Cabañas" },
  { number: "Villa Heliconia", floor: "Cabañas" },
  { number: "Loft Tulipán", floor: "Lofts" },
  { number: "Loft Hortensia", floor: "Lofts" },
  { number: "Loft Azucena", floor: "Lofts" },
  { number: "Loft Cataleya", floor: "Lofts" },
  { number: "Loft Amapola", floor: "Lofts" },
  { number: "Caverna 1", floor: "Cavernas" },
  { number: "Caverna 2", floor: "Cavernas" },
  { number: "Mirador 1", floor: "Miradores" },
  { number: "Mirador 2", floor: "Miradores" },
];

type Seed = {
  name: string;
  category: string;
  section: string;
  unit: "GRAMO" | "KILO" | "MILILITRO" | "LITRO" | "UNIDAD";
  min: number;
  /** Cuántos deben quedar en cada minibar después de reponer. */
  par?: number;
  /**
   * Lo que se le cobra al huésped.
   *
   * Sólo lo que se vende lo lleva. Una toalla o un control se controlan pero no
   * se facturan, y ponerles precio inflaría el consumo del mes con plata que
   * nadie cobró.
   */
  venta?: number;
  vence?: boolean;
};

/**
 * Lo que va en el minibar de cada alojamiento.
 *
 * Las medias son producto aparte y no media botella de la grande: en el
 * minibar entra una media, y contar "0,5 botellas" no es algo que alguien
 * pueda verificar mirando el estante.
 */
const MINIBAR: Seed[] = [
  { name: "Agua 300 ml", category: "Aguas y gaseosas", section: "Bar", unit: "UNIDAD", min: 24, par: 2, venta: 6000 },
  { name: "Coronita 210 ml", category: "Cervezas", section: "Bar", unit: "UNIDAD", min: 24, par: 2, venta: 9000 },
  { name: "Coca-Cola Original 269 ml", category: "Aguas y gaseosas", section: "Bar", unit: "UNIDAD", min: 12, par: 1, venta: 6000 },
  { name: "Coca-Cola Zero 269 ml", category: "Aguas y gaseosas", section: "Bar", unit: "UNIDAD", min: 12, par: 1, venta: 6000 },
  { name: "JP 250 ml", category: "Licores", section: "Bar", unit: "UNIDAD", min: 12, par: 1, venta: 12000 },
  { name: "Smirnoff 250 ml", category: "Licores", section: "Bar", unit: "UNIDAD", min: 12, par: 1, venta: 14000 },
  { name: "Aguardiente Amarillo media 375 ml", category: "Licores", section: "Bar", unit: "UNIDAD", min: 12, par: 1, venta: 35000 },
  { name: "Ron Viejo de Caldas media 375 ml", category: "Licores", section: "Bar", unit: "UNIDAD", min: 12, par: 1, venta: 38000 },
];

/** Lo que se revisa en la suite y descuenta stock al reponerlo. */
const CONSUMIBLES: Seed[] = [
  { name: "Toalla de cuerpo", category: "Lencería", section: "Lavandería", unit: "UNIDAD", min: 30 },
  { name: "Toalla de manos", category: "Lencería", section: "Lavandería", unit: "UNIDAD", min: 20 },
  { name: "Toalla de pies", category: "Lencería", section: "Lavandería", unit: "UNIDAD", min: 20 },
  { name: "Tendido de sábanas", category: "Lencería", section: "Lavandería", unit: "UNIDAD", min: 15 },
  { name: "Cobija", category: "Lencería", section: "Lavandería", unit: "UNIDAD", min: 12 },
  { name: "Almohada", category: "Lencería", section: "Lavandería", unit: "UNIDAD", min: 44 },
  { name: "Dispensador de jabón", category: "Amenities", section: "Recepción", unit: "UNIDAD", min: 11 },
  { name: "Dispensador de shampoo", category: "Amenities", section: "Recepción", unit: "UNIDAD", min: 11 },
  { name: "Dispensador de acondicionador", category: "Amenities", section: "Recepción", unit: "UNIDAD", min: 11 },
];

/** Lo que se verifica pero no se descuenta: si falta, se reporta. */
const DOTACION: Seed[] = [
  { name: "Televisor", category: "Dotación", section: "Decoración", unit: "UNIDAD", min: 11 },
  { name: "Control de televisor", category: "Dotación", section: "Decoración", unit: "UNIDAD", min: 13 },
  { name: "Control de decodificador", category: "Dotación", section: "Decoración", unit: "UNIDAD", min: 13 },
  { name: "Control de aire/ventilador", category: "Dotación", section: "Decoración", unit: "UNIDAD", min: 13 },
  { name: "Control de persianas", category: "Dotación", section: "Decoración", unit: "UNIDAD", min: 5 },
  { name: "Nevera de minibar", category: "Dotación", section: "Decoración", unit: "UNIDAD", min: 11 },
  { name: "Destapador", category: "Menaje", section: "Recepción", unit: "UNIDAD", min: 11 },
];

/**
 * La dotación de una suite, por tipo de alojamiento.
 *
 * `controles` es el multiplicador: las cabañas llevan doble juego. Y las
 * persianas sólo existen en los lofts, así que pedirlas en una caverna sería
 * mandar a alguien a buscar algo que no está.
 */
const TIPOS = [
  { grupo: "Cabañas", controles: 2, persianas: false },
  { grupo: "Lofts", controles: 1, persianas: true },
  { grupo: "Cavernas", controles: 1, persianas: false },
  { grupo: "Miradores", controles: 1, persianas: false },
];

type ItemPlantilla = {
  label: string;
  kind: "DOTACION" | "CONSUMIBLE";
  producto?: string;
  cantidad?: number;
  nota?: boolean;
};

function plantillaDe(controles: number, persianas: boolean): ItemPlantilla[] {
  const items: ItemPlantilla[] = [
    { label: "Televisor", kind: "DOTACION", producto: "Televisor", cantidad: 1 },
    { label: "Control de televisor", kind: "DOTACION", producto: "Control de televisor", cantidad: controles },
    { label: "Control de decodificador", kind: "DOTACION", producto: "Control de decodificador", cantidad: controles },
    { label: "Control de aire/ventilador", kind: "DOTACION", producto: "Control de aire/ventilador", cantidad: controles },
  ];

  if (persianas) {
    items.push({ label: "Control de persianas", kind: "DOTACION", producto: "Control de persianas", cantidad: 1 });
  }

  items.push(
    { label: "Toallas de cuerpo", kind: "CONSUMIBLE", producto: "Toalla de cuerpo", cantidad: 2 },
    { label: "Toalla de manos", kind: "CONSUMIBLE", producto: "Toalla de manos", cantidad: 1 },
    { label: "Toalla de pies", kind: "CONSUMIBLE", producto: "Toalla de pies", cantidad: 1 },
    { label: "Dispensador de jabón", kind: "DOTACION", producto: "Dispensador de jabón", cantidad: 1 },
    { label: "Dispensador de shampoo", kind: "DOTACION", producto: "Dispensador de shampoo", cantidad: 1 },
    { label: "Dispensador de acondicionador", kind: "DOTACION", producto: "Dispensador de acondicionador", cantidad: 1 },
    { label: "Nevera del minibar funcionando", kind: "DOTACION", producto: "Nevera de minibar", cantidad: 1 },
    { label: "Almohadas", kind: "DOTACION", producto: "Almohada", cantidad: 4 },
    { label: "Tendido de sábanas", kind: "CONSUMIBLE", producto: "Tendido de sábanas", cantidad: 1 },
    { label: "Cobija", kind: "DOTACION", producto: "Cobija", cantidad: 1 },
    { label: "Destapador", kind: "DOTACION", producto: "Destapador", cantidad: 1 },
    { label: "Observaciones del estado general", kind: "DOTACION", nota: true },
  );

  return items;
}

async function main() {
  console.log("→ limpiando");
  await prisma.movementLine.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.checklistRunItem.deleteMany();
  await prisma.checklistRun.deleteMany();
  await prisma.checklistTemplateItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.presentation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.section.deleteMany();
  await prisma.location.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log("→ administrador");
  await prisma.user.create({
    data: {
      name: "Administración",
      username: "admin",
      pinHash: bcrypt.hashSync("2468", 10),
      role: "ADMIN",
      accent: "clay",
    },
  });

  console.log("→ bodega y puntos de servicio");
  const central = await prisma.location.create({
    data: { name: "Bodega central", kind: "PRINCIPAL", sortOrder: 0 },
  });
  await prisma.location.createMany({
    data: [
      { name: "Recepción", kind: "AREA", sortOrder: 1 },
      { name: "Café Bar", kind: "AREA", sortOrder: 2 },
      { name: "Cocina / Bar", kind: "AREA", sortOrder: 3 },
    ],
  });

  console.log("→ categorías y subcategorías");
  await prisma.section.createMany({ data: SECTIONS });
  await prisma.category.createMany({ data: CATEGORIES });

  const sections = new Map(
    (await prisma.section.findMany({ select: { id: true, name: true } })).map((s) => [s.name, s.id]),
  );
  const categories = new Map(
    (await prisma.category.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]),
  );

  console.log("→ productos");
  const productos = new Map<string, string>();
  for (const seed of [...MINIBAR, ...CONSUMIBLES, ...DOTACION]) {
    const product = await prisma.product.create({
      data: {
        name: seed.name,
        categoryId: categories.get(seed.category)!,
        sectionId: sections.get(seed.section)!,
        baseUnit: seed.unit,
        salePrice: seed.venta ?? 0,
        minQty: seed.min,
        perishable: seed.vence ?? false,
        presentations: { create: [{ name: "Unidad", factor: 1, isDefaultConsume: true }] },
      },
      select: { id: true },
    });
    productos.set(seed.name, product.id);
  }

  console.log("→ alojamientos y minibares");
  // Cada alojamiento nace con su minibar, y el minibar con su nivel par: qué
  // debe haber adentro es parte de la habitación, no algo que se configure después.
  for (const [index, room] of ROOMS.entries()) {
    const created = await prisma.room.create({ data: { ...room, sortOrder: index } });
    const minibar = await prisma.location.create({
      data: {
        name: `Minibar ${created.number}`,
        kind: "MINIBAR",
        roomId: created.id,
        sortOrder: index,
      },
    });

    await prisma.stock.createMany({
      data: MINIBAR.filter((s) => s.par).map((seed) => ({
        productId: productos.get(seed.name)!,
        locationId: minibar.id,
        quantity: 0,
        parQty: seed.par!,
        minQty: seed.par!,
      })),
    });
  }

  console.log("→ checklists por tipo de alojamiento");
  for (const tipo of TIPOS) {
    const items = plantillaDe(tipo.controles, tipo.persianas);
    await prisma.checklistTemplate.create({
      data: {
        name: tipo.grupo,
        items: {
          create: items.map((item, i) => ({
            label: item.label,
            kind: item.kind,
            productId: item.producto ? productos.get(item.producto)! : null,
            expectedQty: item.cantidad ?? null,
            requireNote: item.nota ?? false,
            sortOrder: i + 1,
          })),
        },
      },
    });
  }

  const total = MINIBAR.length + CONSUMIBLES.length + DOTACION.length;
  console.log("\n✓ Listo. Entrá con  admin / 2468");
  const seVenden = MINIBAR.filter((s) => s.venta).length;
  console.log(`  ${total} productos · ${seVenden} con precio de venta, el resto sólo stock`);
  console.log(`  ${ROOMS.length} alojamientos con su minibar al par`);
  console.log(`  ${TIPOS.length} checklists: ${TIPOS.map((t) => t.grupo).join(", ")}`);
  console.log(`  La bodega ${central.name} arranca en cero: el saldo lo levanta el conteo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
