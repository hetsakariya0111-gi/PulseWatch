import { redirect } from "next/navigation";

import { auth } from "@/auth";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

/** Returns the signed-in user, or `null` when there is no valid session. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (user?.id === undefined) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}

/**
 * Returns the signed-in user or redirects to sign-in. Use this at the top of
 * every authenticated page and server action — middleware is only a
 * convenience and must never be the only check.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user === null) redirect("/sign-in");
  return user;
}

/** Same as `requireUser` but for server actions, which must not redirect silently. */
export async function requireUserForAction(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user === null) {
    throw new Error("You must be signed in to perform this action");
  }
  return user;
}
