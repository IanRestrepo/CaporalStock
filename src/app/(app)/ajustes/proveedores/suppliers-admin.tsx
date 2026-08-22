"use client";

import { BLANK_SUPPLIER, SupplierSheet, type SupplierDraft } from "@/app/(app)/compras/nueva/supplier-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Plus, Truck } from "lucide-react";
import { useState } from "react";

export type SupplierRow = {
  id: string;
  name: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  purchases: number;
};

export function SuppliersAdmin({ suppliers }: { suppliers: SupplierRow[] }) {
  const [draft, setDraft] = useState<SupplierDraft | null>(null);

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <p className="text-2xs font-medium tracking-[0.12em] text-faint uppercase">
          Proveedores · {suppliers.length}
        </p>
        <Button size="sm" variant="quiet" onClick={() => setDraft(BLANK_SUPPLIER)}>
          <Plus className="size-4" />
          Nuevo
        </Button>
      </div>

      {suppliers.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">
          {suppliers.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              onClick={() =>
                setDraft({
                  id: supplier.id,
                  name: supplier.name,
                  taxId: supplier.taxId ?? "",
                  phone: supplier.phone ?? "",
                  email: supplier.email ?? "",
                  notes: supplier.notes ?? "",
                  active: supplier.active,
                })
              }
              className="press flex w-full items-center gap-3.5 px-5 py-3.5 text-left hover:bg-raised"
            >
              <Truck className="size-[18px] shrink-0 text-faint" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem]">{supplier.name}</span>
                <span className="block truncate text-[0.8125rem] text-faint tnum">
                  {supplier.phone ?? supplier.taxId ?? "Sin datos de contacto"}
                  {supplier.purchases > 0
                    ? ` · ${supplier.purchases} factura${supplier.purchases === 1 ? "" : "s"}`
                    : ""}
                </span>
              </span>
              {!supplier.active ? <Badge>inactivo</Badge> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-card bg-surface">
          <Empty
            icon={Truck}
            title="Todavía no hay proveedores"
            body="Carnicerías, pesquerías, distribuidoras: creá acá a quién le comprás, y después las facturas los encuentran."
            action={
              <Button variant="accent" onClick={() => setDraft(BLANK_SUPPLIER)}>
                <Plus className="size-4" />
                Nuevo proveedor
              </Button>
            }
          />
        </div>
      )}

      <p className="mt-2.5 px-1 text-[0.8125rem] text-faint">
        También se pueden crear en el momento, desde el “+” que está al lado del proveedor en una
        factura nueva.
      </p>

      <SupplierSheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        draft={draft ?? BLANK_SUPPLIER}
      />
    </div>
  );
}
