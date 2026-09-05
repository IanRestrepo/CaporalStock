import { describe, expect, test } from "vitest";
import {
  formatQty,
  fromBase,
  parseNumber,
  toBase,
  UNIT_OPTIONS,
} from "@/lib/units";

describe("conversión de unidades", () => {
  test("una presentación se traduce a unidad base", () => {
    // 50 bolsas de 500 g son 25 kg de detergente
    expect(toBase(50, 500)).toBe(25000);
    expect(fromBase(25000, 500)).toBe(50);
  });

  test("la conversión sobrevive a los decimales", () => {
    expect(toBase(1.5, 3800)).toBe(5700);
    expect(fromBase(5700, 3800)).toBe(1.5);
  });

  test("escala a kg y litros para que la cifra se lea", () => {
    expect(formatQty(850, "GRAMO")).toBe("850 g");
    expect(formatQty(25000, "GRAMO")).toBe("25 kg");
    expect(formatQty(3800, "MILILITRO")).toBe("3,8 L");
    expect(formatQty(12, "UNIDAD")).toBe("12 u");
  });

  test("el modo exacto no escala", () => {
    expect(formatQty(25000, "GRAMO", { exact: true })).toBe("25.000 g");
  });

  test("acepta las dos formas de escribir un número", () => {
    expect(parseNumber("1.250,5")).toBe(1250.5);
    expect(parseNumber("1250.5")).toBe(1250.5);
    expect(parseNumber("1,250.5")).toBe(1250.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("kilos y litros", () => {
  test("no se escalan: ya vienen en la escala grande", () => {
    // Un gramo se vuelve kilo al pasar de 1000; un kilo ya es kilo.
    expect(formatQty(1500, "GRAMO")).toBe("1,5 kg");
    expect(formatQty(1500, "KILO")).toBe("1.500 kg");
    expect(formatQty(1500, "MILILITRO")).toBe("1,5 L");
    expect(formatQty(1500, "LITRO")).toBe("1.500 L");
  });

  test("admiten decimales, que es para lo que sirven", () => {
    expect(formatQty(2.5, "KILO")).toBe("2,5 kg");
    expect(formatQty(0.75, "LITRO")).toBe("0,75 L");
  });

  test("las unidades no se parten", () => {
    expect(formatQty(12, "UNIDAD")).toBe("12 u");
  });

  test("el desplegable ofrece las cinco", () => {
    const valores = UNIT_OPTIONS.map((o) => o.value);
    expect(valores).toEqual(["GRAMO", "UNIDAD", "LITRO", "KILO", "MILILITRO"]);
    expect(UNIT_OPTIONS.every((o) => o.label.includes("("))).toBe(true);
  });
});
