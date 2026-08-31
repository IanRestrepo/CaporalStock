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
  /**
   * Dónde va lo que trae este renglón. Una factura del mismo proveedor puede
   * traer trapos para lavandería y bombillos para decoración: antes había que
   * partirla en dos, ahora cada renglón dice a dónde va.
   */
  sectionId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

const purchaseSchema = z.object({
  supplierId: z.string().min(1, "Elegí el proveedor."),
  number: z.string().trim().min(1, "Falta el número de la factura."),
  locationId: z.string().min(1, "Elige a qué bodega entra la mercancía."),
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
    // La clasificación del renglón manda: es la última vez que alguien miró el
    // producto de verdad, con la factura en la mano.
    await Promise.all(
      items
        .filter((item) => item.sectionId !== undefined || item.categoryId)
        .map((item) =>
          prisma.product.update({
            where: { id: item.productId },
            data: {
              ...(item.sectionId !== undefined ? { sectionId: item.sectionId } : {}),
              ...(item.categoryId ? { categoryId: item.categoryId } : {}),
            },
          }),
        ),
    );

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

/**
 * Da entrada a la mercancía.
 *
 * Sólo abre lote cuando el renglón trae fecha de vencimiento. Marcar un
 * producto para controlar vencimiento no obliga a lotear todo lo que entre:
 * si nadie escribió la fecha, no hay nada que vencer y un lote vacío es papeleo.
 */
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
        },
      },
    },
  });

  const lines = [];

  for (const item of purchase.items) {
    let lotId = item.lotId;

    if (!lotId && item.expiresAt) {
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
  id: z.string().optional(),
  name: z.string().trim().min(2, "El nombre es muy corto."),
  taxId: z.string().trim().max(40).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().default(true),
});

export type SupplierResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Alta y edición de proveedores. Se puede hacer desde Ajustes o en el momento
 * de cargar la factura: nadie tiene la carnicería creada antes de que llegue
 * la primera remisión.
 */
export async function saveSupplier(input: unknown): Promise<SupplierResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incompletos." };
  }

  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const { id, ...values } = parsed.data;
  const data = {
    ...values,
    taxId: values.taxId || null,
    phone: values.phone || null,
    email: values.email || null,
    notes: values.notes || null,
  };

  try {
    const supplier = id
      ? await prisma.supplier.update({ where: { id }, data })
      : await prisma.supplier.create({ data });

    revalidatePath("/", "layout");
    return { ok: true, id: supplier.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Ya existe un proveedor con ese nombre." };
    }
    console.error(err);
    return { ok: false, error: "No se pudo guardar el proveedor." };
  }
}

export async function deleteSupplier(id: string): Promise<SupplierResult> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchases > 0) {
    return {
      ok: false,
      error: `Tiene ${purchases} factura${purchases === 1 ? "" : "s"} registrada${purchases === 1 ? "" : "s"}. Desactivalo en vez de borrarlo.`,
    };
  }

  try {
    await prisma.supplier.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "No se pudo borrar el proveedor." };
  }
}
