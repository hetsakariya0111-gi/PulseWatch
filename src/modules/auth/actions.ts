"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";

import { signIn, signOut } from "@/auth";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

import { loginSchema, registerSchema } from "./schema";
import { AuthServiceError, registerUser } from "./service";
import type { FormState } from "./form-state";

function tooManyAttempts(): FormState {
  return { ok: false, message: "Too many attempts. Please wait a moment and try again." };
}

/**
 * Creates an account and immediately signs the user in.
 *
 * Note the deliberate absence of a broad try/catch around `signIn`: a
 * successful call throws a Next.js redirect error that must be allowed to
 * propagate. Only genuinely unexpected failures are caught, and they are
 * logged rather than leaked to the client.
 */
export async function registerAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ip = clientIpFromHeaders(await headers());
  if (!rateLimit(`register:${ip}`, 5, 60_000).ok) return tooManyAttempts();

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return { ok: false, message: error.message };
    }
    logger.error("registration failed", { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });

  // Unreachable: signIn redirects on success. Kept for the return type.
  return { ok: true };
}

export async function loginAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ip = clientIpFromHeaders(await headers());
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Keyed by IP + email so one attacker cannot lock out every account from a
  // shared IP, and so distributing an attack across emails still hits a limit.
  if (!rateLimit(`login:${ip}:${parsed.data.email}`, 10, 300_000).ok) return tooManyAttempts();

  // Only same-origin, relative paths are honoured — otherwise a crafted
  // `callbackUrl` would turn sign-in into an open redirect.
  const requestedRedirect = formData.get("callbackUrl");
  const redirectTo =
    typeof requestedRedirect === "string" && requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/dashboard";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately vague: never reveal whether the email exists.
      return { ok: false, message: "Invalid email or password." };
    }
    throw error; // includes the Next.js redirect on success
  }

  return { ok: true };
}

export async function signInWithGitHubAction(): Promise<void> {
  await signIn("github", { redirectTo: "/dashboard" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
