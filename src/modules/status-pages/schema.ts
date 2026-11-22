import { z } from "zod";

/**
 * Status page slugs become the public URL (`/status/<slug>`), so they are
 * constrained harder than a normal display string: lowercase, URL-safe, and
 * unable to collide with a real application route.
 */

/** Paths that already exist in the app and must never be shadowed by a slug. */
export const RESERVED_SLUGS: readonly string[] = [
  "api",
  "admin",
  "dashboard",
  "projects",
  "monitors",
  "incidents",
  "status",
  "settings",
  "sign-in",
  "sign-up",
  "sign-out",
  "login",
  "logout",
  "about",
  "pricing",
  "health",
];

/**
 * Normalise before validating: a user typing "My API Status" should get a
 * useful error about the spaces, not a confusing one about case.
 */
const slugSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .string()
    .min(3, "The URL slug must be at least 3 characters")
    .max(50, "The URL slug must be at most 50 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
    .refine((value) => !RESERVED_SLUGS.includes(value), "That slug is reserved by the application"),
);

export const statusPageInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1, "Title is required").max(80, "Keep the title under 80 characters"),
  description: z
    .string()
    .trim()
    .max(280, "Keep the description under 280 characters")
    .optional()
    .or(z.literal("")),
  isPublic: z.boolean(),
});

export type StatusPageInput = z.infer<typeof statusPageInputSchema>;

export function normalizeStatusPageInput(input: StatusPageInput): {
  slug: string;
  title: string;
  description: string | null;
  isPublic: boolean;
} {
  return {
    slug: input.slug.trim().toLowerCase(),
    title: input.title,
    description: input.description === undefined || input.description === "" ? null : input.description,
    isPublic: input.isPublic,
  };
}

/** Best-effort slug suggestion for the "create status page" form. */
export function suggestSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return slug.length >= 3 ? slug : `status-${slug}`.slice(0, 50);
}
