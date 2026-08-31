import { describe, expect, test } from "vitest";
import { STEPS, stepsFor } from "@/app/(app)/tutorial/steps";

describe("tutorial", () => {
  test("el empleado no ve los pasos de administración", () => {
    const pasos = stepsFor("EMPLEADO");
    expect(pasos.some((p) => p.adminOnly)).toBe(false);
    expect(pasos.map((p) => p.id)).not.toContain("compras");
    expect(pasos.map((p) => p.id)).not.toContain("conteo");
  });

  test("administración los ve todos", () => {
    expect(stepsFor("ADMIN")).toHaveLength(STEPS.length);
    expect(stepsFor("ADMIN").map((p) => p.id)).toContain("compras");
  });

  test("el empleado igual ve lo que sí puede hacer", () => {
    const ids = stepsFor("EMPLEADO").map((p) => p.id);
    for (const esperado of ["regla", "unidades", "lugares", "sacar", "suites", "roles"]) {
      expect(ids).toContain(esperado);
    }
  });

  test("cada paso tiene identificador único", () => {
    const ids = STEPS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("los enlaces apuntan a rutas de la app", () => {
    for (const paso of STEPS) {
      if (paso.go) expect(paso.go.href.startsWith("/")).toBe(true);
    }
  });

  test("ningún paso que lleva a una pantalla de admin es visible para el empleado", () => {
    const soloAdmin = ["/compras", "/reportes", "/inventario", "/ajustes/"];
    for (const paso of stepsFor("EMPLEADO")) {
      if (!paso.go) continue;
      expect(soloAdmin.some((r) => paso.go!.href.startsWith(r))).toBe(false);
    }
  });
});
