import { z } from "zod";

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep the name under 80 characters"),
  description: z
    .string()
    .trim()
    .max(280, "Keep the description under 280 characters")
    .optional()
    .or(z.literal("")),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

/** Normalises the optional description: "" becomes "not set". */
export function normalizeProjectInput(input: ProjectInput): { name: string; description: string | null } {
  return {
    name: input.name,
    description: input.description === undefined || input.description === "" ? null : input.description,
  };
}
