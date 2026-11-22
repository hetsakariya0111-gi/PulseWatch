import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/modules/auth/session";

/**
 * Shell for every signed-in page.
 *
 * `requireUser()` runs before anything renders, so an unauthenticated visitor
 * is redirected to `/sign-in` even if the middleware matcher is ever changed.
 * It also makes the whole route group dynamic, which is what we want: these
 * pages are personalised and must never be statically cached.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={{ name: user.name, email: user.email, image: user.image }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
