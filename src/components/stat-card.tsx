import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Compact metric card used by the dashboard summary row.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          {Icon !== undefined ? <Icon className="size-3.5" /> : null}
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint !== undefined ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
