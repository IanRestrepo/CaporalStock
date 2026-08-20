import { describe, expect, test } from "vitest";
import {
  formatQty,
  fromBase,
  parseNumber,
  portionsAvailable,
  toBase,
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

describe("porciones de cocina", () => {
  test("dice cuántas porciones completas alcanzan", () => {
    // La receta rinde 10 porciones con 180 g: 18 g por porción.
    expect(portionsAvailable(1800, 180, 10)).toBe(100);
    expect(portionsAvailable(180, 180, 10)).toBe(10);
    expect(portionsAvailable(100, 180, 10)).toBe(5);
  });

  test("nunca promete porciones a medias", () => {
    expect(portionsAvailable(25, 180, 10)).toBe(1);
    expect(portionsAvailable(0, 180, 10)).toBe(0);
  });
});
