import type { ReactNode } from "react";

/**
 * Placeholder for "nothing here yet" states, with an optional call to action.
 */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {description !== undefined ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
