import { Dot } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatRelative, initials } from "@/lib/format";
import { MOVEMENT_LABEL, MOVEMENT_TONE } from "@/lib/movements";
import { categoryColor } from "@/lib/appearance";
import { formatQty } from "@/lib/units";
import type { BaseUnit, MovementType } from "@/generated/prisma/enums";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, TriangleAlert, Scale } from "lucide-react";

const GLYPH = {
  ENTRADA: ArrowDownLeft,
  TRASLADO: ArrowRight,
  CONSUMO: ArrowUpRight,
  DANIO: TriangleAlert,
  AJUSTE: Scale,
} as const;

const TONE_TEXT = {
  ok: "text-ok bg-ok-soft",
  info: "text-info bg-info-soft",
  neutral: "text-soft bg-raised",
  danger: "text-danger bg-danger-soft",
  warn: "text-warn bg-warn-soft",
} as const;

export type MovementRowData = {
  id: string;
  type: MovementType;
  occurredAt: Date;
  reason: string | null;
  createdBy: { name: string };
  fromLocation: { name: string } | null;
  toLocation: { name: string } | null;
  room: { number: string } | null;
  lines: {
    quantity: unknown;
    product: { name: string; baseUnit: BaseUnit; category: { color: string } };
  }[];
};

export function MovementRow({ movement }: { movement: MovementRowData }) {
  const Icon = GLYPH[movement.type];
  const tone = MOVEMENT_TONE[movement.type];
  const [first, ...others] = movement.lines;

  const path = [movement.fromLocation?.name, movement.toLocation?.name]
    .filter(Boolean)
    .join(" → ");

  return (
    <div className="flex gap-3.5 px-5 py-3.5">
      <span
        className={cn(
          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px]",
          TONE_TEXT[tone],
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[0.9375rem] font-medium">
            {first ? (
              <>
                <span className="tnum">
                  {formatQty(Number(first.quantity), first.product.baseUnit)}
                </span>{" "}
                {first.product.name}
              </>
            ) : (
              MOVEMENT_LABEL[movement.type]
            )}
          </p>
          <span className="shrink-0 text-2xs text-faint">
            {formatRelative(movement.occurredAt)}
          </span>
        </div>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-soft">
          {first ? (
            <Dot color={categoryColor(first.product.category.color)} />
          ) : null}
          <span className="truncate">
            {MOVEMENT_LABEL[movement.type]}
            {path ? ` · ${path}` : ""}
            {movement.room ? ` · Suite ${movement.room.number}` : ""}
          </span>
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-faint">
          <span className="grid size-4.5 place-items-center rounded-full bg-raised text-[9px] font-semibold text-soft">
            {initials(movement.createdBy.name)}
          </span>
          {movement.createdBy.name}
          {others.length > 0 ? <span>· +{others.length} producto{others.length > 1 ? "s" : ""}</span> : null}
          {movement.reason ? <span className="truncate">· {movement.reason}</span> : null}
        </p>
      </div>
    </div>
  );
}
