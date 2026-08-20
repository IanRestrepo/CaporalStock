import { Children, cloneElement, isValidElement, type ReactElement } from "react";
import { cn } from "@/lib/cn";

type SlotProps = { children?: React.ReactNode; className?: string } & Record<string, unknown>;

/** Mini `asChild`: fusiona props sobre el único hijo, sin traer Radix entero. */
export function Slot({ children, className, ...rest }: SlotProps) {
  const child = Children.only(children) as ReactElement<Record<string, unknown>>;
  if (!isValidElement(child)) return null;

  return cloneElement(child, {
    ...rest,
    ...child.props,
    className: cn(className, child.props.className as string | undefined),
  });
}
