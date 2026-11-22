import type { ReactNode } from "react";

/**
 * Standard page title block. Every authenticated page uses it so headings,
 * spacing and action placement stay identical across the app.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description !== undefined ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children !== undefined ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
