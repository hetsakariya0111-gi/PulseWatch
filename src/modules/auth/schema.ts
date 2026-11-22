import { z } from "zod";

/**
 * Input schemas for authentication. These are the single source of truth for
 * both runtime validation and the inferred TypeScript types, so the form and
 * the server action can never drift apart.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254)
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt truncates beyond 72 bytes
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on sign-in: existing passwords must keep working even if
  // the policy tightened. Only shape is checked.
  password: z.string().min(1, "Password is required").max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
