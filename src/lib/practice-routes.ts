/**
 * Las pantallas a las que el tutorial manda a practicar.
 *
 * Vive aparte de `practice.ts` porque lo necesita el cliente y aquél es
 * `server-only`: importarlo desde un componente arrastraría Prisma al bundle.
 */
export const PRACTICE_ROUTES = [
  "/bodegas",
  "/movimientos",
  "/inventario",
  "/suites",
  "/compras",
  "/alertas",
];
