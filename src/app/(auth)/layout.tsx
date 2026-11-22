import type { ReactNode } from "react";

import { Activity } from "lucide-react";
import Link from "next/link";

/**
 * Centered shell shared by the sign-in and sign-up screens.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <Activity className="size-5" />
        PulseWatch
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground text-center text-xs">
        Uptime monitoring with automatic incident detection and public status pages.
      </p>
    </div>
  );
}
