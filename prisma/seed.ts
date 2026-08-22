import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

/**
 * Arranque en limpio.
 *
 * No siembra inventario de mentira: el hotel real levanta el suyo. Deja lo
 * mínimo indispensable para poder entrar y empezar a cargar productos:
 * un administrador, la bodega central y las categorías con las que se ordena.
 */

/** Por dónde se entra a la bodega. Antes eran las áreas de operación. */
const SECTIONS = [
  { name: "Lavandería", color: "sky", icon: "washing-machine", sortOrder: 1 },
  { name: "Cocina", color: "coral", icon: "chef-hat", sortOrder: 2 },
  { name: "Aseo y mantenimiento", color: "mint", icon: "spray-can", sortOrder: 3 },
  { name: "Decoración", color: "violet", icon: "lamp", sortOrder: 4 },
];

/** Los alojamientos del hotel, en el orden en que se recorren. */
const ROOMS = [
  { number: "Villa Girasol", floor: "Villas" },
  { number: "Villa Heliconia", floor: "Villas" },
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

/** Qué es el producto. Da el color y el filtro rápido dentro de la lista. */
const CATEGORIES = [
  { name: "Bebidas", color: "sky", icon: "cup-soda", sortOrder: 1 },
  { name: "Snacks", color: "amber", icon: "cookie", sortOrder: 2 },
  { name: "Amenities", color: "violet", icon: "sparkles", sortOrder: 3 },
  { name: "Lencería", color: "rose", icon: "bed-double", sortOrder: 4 },
  { name: "Limpieza", color: "mint", icon: "spray-can", sortOrder: 5 },
  { name: "Alimentos", color: "coral", icon: "utensils", sortOrder: 6 },
  { name: "Menaje", color: "slate", icon: "sofa", sortOrder: 7 },
  { name: "Herramientas", color: "slate", icon: "wrench", sortOrder: 8 },
];

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

  console.log("→ bodega central");
  await prisma.location.create({
    data: { name: "Bodega central", kind: "PRINCIPAL", sortOrder: 0 },
  });

  console.log("→ categorías y subcategorías");
  await prisma.section.createMany({ data: SECTIONS });
  await prisma.category.createMany({ data: CATEGORIES });

  console.log("→ alojamientos");
  // Cada habitación nace con su minibar: nunca deberían existir por separado.
  for (const [index, room] of ROOMS.entries()) {
    const created = await prisma.room.create({ data: { ...room, sortOrder: index } });
    await prisma.location.create({
      data: {
        name: `Minibar ${created.number}`,
        kind: "MINIBAR",
        roomId: created.id,
        sortOrder: index,
      },
    });
  }

  console.log("\n✓ Listo. Entrá con  admin / 2468");
  console.log(`  ${ROOMS.length} alojamientos creados con su minibar.`);
  console.log("  La bodega arranca vacía: creá los productos desde /bodegas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
