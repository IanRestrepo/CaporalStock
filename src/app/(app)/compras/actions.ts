"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { InventoryError, registerMovement } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { actor } from "@/lib/session";
import { storeInvoice } from "@/lib/storage";
import { round4 } from "@/lib/units";

const lineSchema = z.object({
  productId: z.string().min(1),
  presentationId: z.string().nullable().optional(),
  /** Cantidad tal como viene en la factura (50 bolsas). */
  qtyPresentation: z.number().positive(),
  /** Cuántas unidades base tiene cada presentación. */
  factor: z.number().positive(),
  /** Precio de la línea completa, tal como lo cobró el proveedor. */
  lineTotal: z.number().min(0),
  lotCode: z.string().max(60).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

const purchaseSchema = z.object({
  supplierId: z.string().min(1, "Elegí el proveedor."),
  number: z.string().trim().min(1, "Falta el número de la factura."),
  locationId: z.string().min(1, "Elegí a qué bodega entra la mercancía."),
  issuedAt: z.string().min(1),
  tax: z.number().min(0).default(0),
  notes: z.string().max(500).nullable().optional(),
  confirm: z.boolean().default(true),
  lines: z.array(lineSchema).min(1, "La factura no tiene renglones."),
});

export type PurchaseResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Registra una factura de compra.
 *
 * Al confirmarla se genera la ENTRADA correspondiente: es el único camino por
 * el que entra mercancía al sistema, y por eso el costo promedio sólo se
 * recalcula aquí.
 */
export async function createPurchase(formData: FormData): Promise<PurchaseResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, error: "No se pudo leer el formulario." };
  }

  const parsed = purchaseSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const data = parsed.data;

  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;

  const file = formData.get("factura");
  if (file instanceof File && file.size > 0) {
    try {
      const stored = await storeInvoice(file);
      attachmentUrl = stored.url;
      attachmentName = stored.name;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "No se pudo subir la factura." };
    }
  }

  const items = data.lines.map((line) => {
    const qtyBase = round4(line.qtyPresentation * line.factor);
    const unitCost = qtyBase > 0 ? line.lineTotal / qtyBase : 0;
    return { ...line, qtyBase, unitCost };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal + data.tax;

  try {
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: data.supplierId,
        locationId: data.locationId,
        createdById: user.id,
        number: data.number,
        issuedAt: new Date(data.issuedAt),
        receivedAt: data.confirm ? new Date() : null,
        status: data.confirm ? "CONFIRMADA" : "BORRADOR",
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        tax: new Prisma.Decimal(data.tax.toFixed(2)),
        total: new Prisma.Decimal(total.toFixed(2)),
        attachmentUrl,
        attachmentName,
        notes: data.notes ?? null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            presentationId: item.presentationId ?? null,
            qtyPresentation: new Prisma.Decimal(item.qtyPresentation),
            qtyBase: new Prisma.Decimal(item.qtyBase),
            unitCost: new Prisma.Decimal(item.unitCost.toFixed(6)),
            lineTotal: new Prisma.Decimal(item.lineTotal.toFixed(2)),
            expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          })),
        },
      },
      select: { id: true },
    });

    if (data.confirm) {
      await receive(purchase.id, user.id);
    }

    revalidatePath("/", "layout");
    return { ok: true, id: purchase.id };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Ese proveedor ya tiene una factura con ese número." };
    }
    console.error(err);
    return { ok: false, error: "No se pudo guardar la compra." };
  }
}

export async function confirmPurchase(purchaseId: string): Promise<PurchaseResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    await receive(purchaseId, user.id);
    revalidatePath("/", "layout");
    return { ok: true, id: purchaseId };
  } catch (err) {
    if (err instanceof InventoryError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "No se pudo confirmar la factura." };
  }
}

/** Da entrada a la mercancía y crea un lote por cada renglón con vencimiento. */
async function receive(purchaseId: string, userId: string) {
  const purchase = await prisma.purchase.findUniqueOrThrow({
    where: { id: purchaseId },
    select: {
      id: true,
      number: true,
      locationId: true,
      status: true,
      items: {
        select: {
          id: true,
          productId: true,
          qtyBase: true,
          unitCost: true,
          expiresAt: true,
          lotId: true,
          product: { select: { perishable: true } },
        },
      },
    },
  });

  const lines = [];

  for (const item of purchase.items) {
    let lotId = item.lotId;

    if (!lotId && (item.expiresAt || item.product.perishable)) {
      const lot = await prisma.lot.create({
        data: {
          productId: item.productId,
          code: `${purchase.number}-${item.id.slice(-4)}`,
          expiresAt: item.expiresAt,
          unitCost: item.unitCost,
        },
        select: { id: true },
      });
      lotId = lot.id;
      await prisma.purchaseItem.update({ where: { id: item.id }, data: { lotId } });
    }

    lines.push({
      productId: item.productId,
      quantity: Number(item.qtyBase),
      unitCost: Number(item.unitCost),
      lotId,
    });
  }

  await registerMovement({
    type: "ENTRADA",
    createdById: userId,
    toLocationId: purchase.locationId,
    purchaseId: purchase.id,
    reason: `Factura ${purchase.number}`,
    lines,
  });

  if (purchase.status !== "CONFIRMADA") {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: "CONFIRMADA", receivedAt: new Date() },
    });
  }
}

const supplierSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto."),
  taxId: z.string().trim().max(40).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
});

export async function createSupplier(input: unknown): Promise<PurchaseResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  try {
    const supplier = await prisma.supplier.create({ data: parsed.data });
    revalidatePath("/compras");
    return { ok: true, id: supplier.id };
  } catch {
    return { ok: false, error: "Ya existe un proveedor con ese nombre." };
  }
}
