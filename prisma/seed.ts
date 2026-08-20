import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

/** Cantidades: siempre en unidad base. */
type Seed = {
  name: string;
  unit: "GRAMO" | "MILILITRO" | "UNIDAD";
  cost: number; // por unidad base
  sale: number; // por unidad base
  min: number;
  perishable?: boolean;
  presentations?: { name: string; factor: number; purchase?: boolean }[];
};

const CATEGORIES = [
  { name: "Bebidas", color: "sky", icon: "cup-soda", sortOrder: 1 },
  { name: "Snacks", color: "amber", icon: "cookie", sortOrder: 2 },
  { name: "Amenities", color: "violet", icon: "sparkles", sortOrder: 3 },
  { name: "Lavandería", color: "mint", icon: "washing-machine", sortOrder: 4 },
  { name: "Cocina", color: "coral", icon: "chef-hat", sortOrder: 5 },
  { name: "Aseo", color: "slate", icon: "spray-can", sortOrder: 6 },
  { name: "Lencería", color: "rose", icon: "bed-double", sortOrder: 7 },
];

const PRODUCTS: Record<string, Seed[]> = {
  Bebidas: [
    { name: "Agua sin gas 600 ml", unit: "UNIDAD", cost: 1200, sale: 5000, min: 24, presentations: [{ name: "Paca x12", factor: 12, purchase: true }] },
    { name: "Gaseosa lata 330 ml", unit: "UNIDAD", cost: 1800, sale: 6000, min: 24, presentations: [{ name: "Caja x24", factor: 24, purchase: true }] },
    { name: "Cerveza lata 330 ml", unit: "UNIDAD", cost: 2600, sale: 9000, min: 24, presentations: [{ name: "Caja x24", factor: 24, purchase: true }] },
    { name: "Jugo de naranja 250 ml", unit: "UNIDAD", cost: 2100, sale: 7000, min: 12, perishable: true, presentations: [{ name: "Bandeja x6", factor: 6, purchase: true }] },
  ],
  Snacks: [
    { name: "Maní salado 40 g", unit: "UNIDAD", cost: 1500, sale: 5500, min: 12, perishable: true, presentations: [{ name: "Display x20", factor: 20, purchase: true }] },
    { name: "Chocolatina 35 g", unit: "UNIDAD", cost: 1700, sale: 6000, min: 12, perishable: true, presentations: [{ name: "Display x24", factor: 24, purchase: true }] },
    { name: "Papas fritas 45 g", unit: "UNIDAD", cost: 1900, sale: 6500, min: 12, perishable: true },
  ],
  Amenities: [
    { name: "Shampoo sachet 20 ml", unit: "UNIDAD", cost: 600, sale: 0, min: 48, presentations: [{ name: "Bolsa x100", factor: 100, purchase: true }] },
    { name: "Jabón de tocador 25 g", unit: "UNIDAD", cost: 500, sale: 0, min: 48, presentations: [{ name: "Bolsa x100", factor: 100, purchase: true }] },
    { name: "Papel higiénico rollo", unit: "UNIDAD", cost: 1400, sale: 0, min: 36, presentations: [{ name: "Paca x12", factor: 12, purchase: true }] },
  ],
  Lavandería: [
    { name: "Detergente en polvo", unit: "GRAMO", cost: 9.4, sale: 0, min: 8000, presentations: [{ name: "Bolsa 500 g", factor: 500, purchase: true }, { name: "Saco 10 kg", factor: 10000 }] },
    { name: "Suavizante", unit: "MILILITRO", cost: 6.2, sale: 0, min: 5000, presentations: [{ name: "Garrafa 3,8 L", factor: 3800, purchase: true }] },
    { name: "Blanqueador", unit: "MILILITRO", cost: 3.8, sale: 0, min: 4000, presentations: [{ name: "Garrafa 3,8 L", factor: 3800, purchase: true }] },
  ],
  Cocina: [
    { name: "Café en grano", unit: "GRAMO", cost: 38, sale: 0, min: 3000, perishable: true, presentations: [{ name: "Bolsa 1 kg", factor: 1000, purchase: true }] },
    { name: "Azúcar", unit: "GRAMO", cost: 4.2, sale: 0, min: 5000, presentations: [{ name: "Bolsa 1 kg", factor: 1000, purchase: true }] },
    { name: "Harina de trigo", unit: "GRAMO", cost: 3.6, sale: 0, min: 4000, presentations: [{ name: "Bolsa 1 kg", factor: 1000, purchase: true }] },
    { name: "Mantequilla", unit: "GRAMO", cost: 28, sale: 0, min: 1500, perishable: true, presentations: [{ name: "Barra 250 g", factor: 250, purchase: true }] },
    { name: "Leche entera", unit: "MILILITRO", cost: 4.1, sale: 0, min: 6000, perishable: true, presentations: [{ name: "Litro", factor: 1000, purchase: true }] },
  ],
  Aseo: [
    { name: "Limpiavidrios", unit: "MILILITRO", cost: 5.5, sale: 0, min: 3000, presentations: [{ name: "Garrafa 2 L", factor: 2000, purchase: true }] },
    { name: "Desinfectante", unit: "MILILITRO", cost: 7.1, sale: 0, min: 4000, presentations: [{ name: "Garrafa 3,8 L", factor: 3800, purchase: true }] },
    { name: "Bolsa de basura", unit: "UNIDAD", cost: 320, sale: 0, min: 100, presentations: [{ name: "Rollo x30", factor: 30, purchase: true }] },
  ],
  Lencería: [
    { name: "Toalla de cuerpo", unit: "UNIDAD", cost: 22000, sale: 0, min: 30 },
    { name: "Toalla de mano", unit: "UNIDAD", cost: 9000, sale: 0, min: 30 },
    { name: "Sábana queen", unit: "UNIDAD", cost: 48000, sale: 0, min: 18 },
    { name: "Funda de almohada", unit: "UNIDAD", cost: 12000, sale: 0, min: 36 },
  ],
};

const ROOMS = ["101", "102", "103", "104", "105", "106", "201", "202", "203", "204", "205", "206"];

/** Lo que debe haber en cada minibar. */
const MINIBAR_PAR: Record<string, number> = {
  "Agua sin gas 600 ml": 4,
  "Gaseosa lata 330 ml": 2,
  "Cerveza lata 330 ml": 2,
  "Jugo de naranja 250 ml": 2,
  "Maní salado 40 g": 2,
  "Chocolatina 35 g": 2,
  "Papas fritas 45 g": 1,
};

async function main() {
  console.log("→ limpiando");
  await prisma.movementLine.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.checklistRunItem.deleteMany();
  await prisma.checklistRun.deleteMany();
  await prisma.checklistTemplateItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.presentation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.location.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log("→ usuarios");
  const pin = (value: string) => bcrypt.hashSync(value, 10);
  const admin = await prisma.user.create({
    data: { name: "Administración", username: "admin", pinHash: pin("2468"), role: "ADMIN", accent: "clay" },
  });
  await prisma.user.createMany({
    data: [
      { name: "Marcela Ruiz", username: "marcela", pinHash: pin("1234"), role: "EMPLEADO", accent: "moss" },
      { name: "Jonathan Pérez", username: "jonathan", pinHash: pin("1111"), role: "EMPLEADO", accent: "ocean" },
      { name: "Luz Dary Gómez", username: "luzdary", pinHash: pin("2222"), role: "EMPLEADO", accent: "orchid" },
    ],
  });

  console.log("→ habitaciones y bodegas");
  const principal = await prisma.location.create({
    data: { name: "Bodega principal", kind: "PRINCIPAL", sortOrder: 0 },
  });
  const areas = await Promise.all(
    [
      { name: "Lavandería", sortOrder: 1 },
      { name: "Cocina", sortOrder: 2 },
      { name: "Aseo y mantenimiento", sortOrder: 3 },
    ].map((a) => prisma.location.create({ data: { ...a, kind: "AREA" as const } })),
  );

  const minibars: { room: string; locationId: string }[] = [];
  for (const [index, number] of ROOMS.entries()) {
    const room = await prisma.room.create({
      data: { number, floor: number.startsWith("1") ? "Piso 1" : "Piso 2", sortOrder: index },
    });
    const location = await prisma.location.create({
      data: { name: `Minibar ${number}`, kind: "MINIBAR", roomId: room.id, sortOrder: index },
    });
    minibars.push({ room: number, locationId: location.id });
  }

  console.log("→ catálogo");
  const productByName = new Map<string, { id: string; unit: string }>();
  for (const cat of CATEGORIES) {
    const category = await prisma.category.create({ data: cat });
    for (const seed of PRODUCTS[cat.name] ?? []) {
      const product = await prisma.product.create({
        data: {
          name: seed.name,
          categoryId: category.id,
          baseUnit: seed.unit,
          costPrice: seed.cost,
          salePrice: seed.sale,
          minQty: seed.min,
          perishable: seed.perishable ?? false,
          presentations: {
            create: [
              { name: seed.unit === "UNIDAD" ? "Unidad" : seed.unit === "GRAMO" ? "Gramo" : "Mililitro", factor: 1, isDefaultConsume: true },
              ...(seed.presentations ?? []).map((p) => ({
                name: p.name,
                factor: p.factor,
                isDefaultPurchase: p.purchase ?? false,
              })),
            ],
          },
        },
      });
      productByName.set(seed.name, { id: product.id, unit: seed.unit });
    }
  }

  console.log("→ proveedores y factura");
  const supplier = await prisma.supplier.create({
    data: { name: "Distribuidora La Sabana", taxId: "900123456-7", phone: "313 555 0142" },
  });

  console.log("→ carga inicial de bodega");
  const initial: [string, number][] = [
    ["Agua sin gas 600 ml", 240], ["Gaseosa lata 330 ml", 144], ["Cerveza lata 330 ml", 96],
    ["Jugo de naranja 250 ml", 60], ["Maní salado 40 g", 80], ["Chocolatina 35 g", 72],
    ["Papas fritas 45 g", 40], ["Shampoo sachet 20 ml", 300], ["Jabón de tocador 25 g", 300],
    ["Papel higiénico rollo", 120], ["Detergente en polvo", 25000], ["Suavizante", 11400],
    ["Blanqueador", 7600], ["Café en grano", 6000], ["Azúcar", 10000], ["Harina de trigo", 8000],
    ["Mantequilla", 2000], ["Leche entera", 12000], ["Limpiavidrios", 4000],
    ["Desinfectante", 7600], ["Bolsa de basura", 180], ["Toalla de cuerpo", 48],
    ["Toalla de mano", 48], ["Sábana queen", 24], ["Funda de almohada", 48],
  ];

  await prisma.movement.create({
    data: {
      type: "ENTRADA",
      createdById: admin.id,
      toLocationId: principal.id,
      reason: "Carga inicial",
      note: "Inventario levantado en el arranque del sistema.",
      lines: {
        create: initial.map(([name, qty]) => ({
          productId: productByName.get(name)!.id,
          quantity: qty,
        })),
      },
    },
  });
  for (const [name, qty] of initial) {
    await prisma.stock.create({
      data: { productId: productByName.get(name)!.id, locationId: principal.id, quantity: qty },
    });
  }

  console.log("→ minibares al nivel par");
  for (const bar of minibars) {
    for (const [name, par] of Object.entries(MINIBAR_PAR)) {
      const product = productByName.get(name)!;
      await prisma.stock.create({
        data: { productId: product.id, locationId: bar.locationId, quantity: par, parQty: par, minQty: Math.max(1, Math.floor(par / 2)) },
      });
      await prisma.stock.update({
        where: { productId_locationId: { productId: product.id, locationId: principal.id } },
        data: { quantity: { decrement: par } },
      });
    }
    await prisma.movement.create({
      data: {
        type: "TRASLADO",
        createdById: admin.id,
        fromLocationId: principal.id,
        toLocationId: bar.locationId,
        reason: "Montaje de minibar",
        lines: {
          create: Object.entries(MINIBAR_PAR).map(([name, par]) => ({
            productId: productByName.get(name)!.id,
            quantity: par,
          })),
        },
      },
    });
  }

  console.log("→ dotación de áreas");
  const laundry = areas[0];
  const kitchen = areas[1];
  const areaLoad: [string, number, string][] = [
    ["Detergente en polvo", 5000, laundry.id],
    ["Suavizante", 3800, laundry.id],
    ["Blanqueador", 3800, laundry.id],
    ["Café en grano", 2000, kitchen.id],
    ["Azúcar", 3000, kitchen.id],
    ["Leche entera", 4000, kitchen.id],
    ["Harina de trigo", 3000, kitchen.id],
    ["Mantequilla", 750, kitchen.id],
  ];
  for (const [name, qty, locationId] of areaLoad) {
    const product = productByName.get(name)!;
    await prisma.stock.create({ data: { productId: product.id, locationId, quantity: qty, minQty: qty * 0.3 } });
    await prisma.stock.update({
      where: { productId_locationId: { productId: product.id, locationId: principal.id } },
      data: { quantity: { decrement: qty } },
    });
    await prisma.movement.create({
      data: {
        type: "TRASLADO",
        createdById: admin.id,
        fromLocationId: principal.id,
        toLocationId: locationId,
        reason: "Dotación de área",
        lines: { create: [{ productId: product.id, quantity: qty }] },
      },
    });
  }

  console.log("→ recetas");
  const cocinaCat = await prisma.category.findUniqueOrThrow({ where: { name: "Cocina" } });
  await prisma.recipe.create({
    data: {
      name: "Café americano (jarra)",
      categoryId: cocinaCat.id,
      yieldPortions: 10,
      notes: "Rinde 10 tazas de 8 oz.",
      items: {
        create: [
          { productId: productByName.get("Café en grano")!.id, qtyBase: 180 },
          { productId: productByName.get("Azúcar")!.id, qtyBase: 100 },
        ],
      },
    },
  });
  await prisma.recipe.create({
    data: {
      name: "Pan de desayuno",
      categoryId: cocinaCat.id,
      yieldPortions: 12,
      items: {
        create: [
          { productId: productByName.get("Harina de trigo")!.id, qtyBase: 600 },
          { productId: productByName.get("Mantequilla")!.id, qtyBase: 120 },
          { productId: productByName.get("Leche entera")!.id, qtyBase: 400 },
        ],
      },
    },
  });

  console.log("→ checklist de suite");
  await prisma.checklistTemplate.create({
    data: {
      name: "Alistamiento de suite",
      items: {
        create: [
          { label: "Control de TV", kind: "DOTACION", expectedQty: 1, sortOrder: 1 },
          { label: "Control de aire acondicionado", kind: "DOTACION", expectedQty: 1, sortOrder: 2 },
          { label: "Persianas en buen estado", kind: "DOTACION", sortOrder: 3 },
          { label: "Secador de cabello", kind: "DOTACION", expectedQty: 1, sortOrder: 4 },
          { label: "Caja fuerte funcionando", kind: "DOTACION", sortOrder: 5 },
          { label: "Almohadas", kind: "DOTACION", expectedQty: 4, sortOrder: 6 },
          { label: "Toalla de cuerpo", kind: "CONSUMIBLE", productId: productByName.get("Toalla de cuerpo")!.id, expectedQty: 2, sortOrder: 7 },
          { label: "Toalla de mano", kind: "CONSUMIBLE", productId: productByName.get("Toalla de mano")!.id, expectedQty: 2, sortOrder: 8 },
          { label: "Papel higiénico", kind: "CONSUMIBLE", productId: productByName.get("Papel higiénico rollo")!.id, expectedQty: 2, sortOrder: 9 },
          { label: "Shampoo", kind: "CONSUMIBLE", productId: productByName.get("Shampoo sachet 20 ml")!.id, expectedQty: 2, sortOrder: 10 },
          { label: "Jabón de tocador", kind: "CONSUMIBLE", productId: productByName.get("Jabón de tocador 25 g")!.id, expectedQty: 2, sortOrder: 11 },
          { label: "Observaciones del estado general", kind: "DOTACION", requireNote: true, sortOrder: 12 },
        ],
      },
    },
  });

  console.log(`\n✓ Listo. Proveedor ${supplier.name} creado.`);
  console.log("  admin / 2468   ·   marcela / 1234   ·   jonathan / 1111   ·   luzdary / 2222");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
