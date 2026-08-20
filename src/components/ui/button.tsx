import { Slot } from "@/components/ui/slot";
import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

type Variant = "accent" | "solid" | "quiet" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  accent: "bg-accent text-accent-ink hover:bg-accent-hover font-semibold",
  solid: "bg-ink text-canvas hover:opacity-90 font-semibold",
  quiet: "bg-raised text-ink hover:bg-hover",
  ghost: "text-soft hover:text-ink hover:bg-raised",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-canvas",
  outline: "text-ink ring-1 ring-inset ring-line-strong hover:bg-raised",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[0.8125rem] rounded-[11px] gap-1.5",
  md: "h-11 px-4 text-sm rounded-control gap-2",
  lg: "h-13 px-5 text-[0.9375rem] rounded-[16px] gap-2",
  icon: "size-11 rounded-control",
  "icon-sm": "size-9 rounded-[11px]",
};

type Props = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
};

export function Button({
  className,
  variant = "quiet",
  size = "md",
  asChild,
  ...props
}: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "press inline-flex select-none items-center justify-center whitespace-nowrap",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
