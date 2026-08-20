import { afterAll, describe, expect, test } from "vitest";
import { authenticate, hashPin, isValidPin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const marca = `acceso-${Date.now()}`;
const creados: string[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: creados } } });
  await prisma.$disconnect();
});

async function crear(pin: string, active = true) {
  const user = await prisma.user.create({
    data: {
      name: "Persona de prueba",
      username: `${marca}-${creados.length}`,
      pinHash: await hashPin(pin),
      role: "EMPLEADO",
      active,
    },
  });
  creados.push(user.id);
  return user;
}

describe("acceso por usuario y PIN", () => {
  test("acepta el PIN correcto", async () => {
    const user = await crear("4821");
    await expect(authenticate(user.username, "4821")).resolves.toEqual({ id: user.id });
  });

  test("rechaza el PIN equivocado", async () => {
    const user = await crear("4821");
    await expect(authenticate(user.username, "1111")).resolves.toBeNull();
  });

  test("un usuario inactivo no entra aunque acierte el PIN", async () => {
    const user = await crear("4821", false);
    await expect(authenticate(user.username, "4821")).resolves.toBeNull();
  });

  test("un usuario inexistente no entra", async () => {
    await expect(authenticate("no-existe-jamas", "4821")).resolves.toBeNull();
  });

  test("el PIN se guarda cifrado, nunca en claro", async () => {
    const user = await crear("4821");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.pinHash).not.toContain("4821");
    expect(row.pinHash.startsWith("$2")).toBe(true);
  });

  test("el formato de PIN exige 4 a 6 dígitos", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});
