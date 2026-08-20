import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Neon: las migraciones corren contra el endpoint directo (sin pooler).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
