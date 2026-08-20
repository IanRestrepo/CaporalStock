import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Empty({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-8 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-[16px] bg-raised text-faint">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <p className="text-[0.9375rem] font-medium">{title}</p>
      {body ? <p className="mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-soft">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
