import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve("./tests/server-only-stub.ts"),
      "@": path.resolve("./src"),
    },
  },
  test: {
    environment: "node",
    // Las pruebas tocan la base real y se pisarían entre sí en paralelo.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
    setupFiles: ["./tests/setup.ts"],
  },
});
