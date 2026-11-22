"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/incidents", label: "Incidents" },
  { href: "/status-pages", label: "Status pages" },
] as const;

/**
 * Application header. A client component only because it highlights the active
 * nav item from `usePathname()` — the user data is passed down from the server
 * layout so no session fetch happens in the browser.
 */
export function AppHeader({
  user,
}: {
  user: { name: string | null; email: string | null; image: string | null };
}) {
  const pathname = usePathname();

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Activity className="size-5" />
          <span className="hidden sm:inline">PulseWatch</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} image={user.image} />
        </div>
      </div>
    </header>
  );
}
