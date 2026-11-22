/**
 * The shape the auth forms and their server actions agree on.
 *
 * This lives outside `actions.ts` on purpose: a `"use server"` module may only
 * export async functions, and `initialFormState` is a plain object that the
 * client forms hand to `useActionState` as the starting state.
 */

export interface FormState {
  ok: boolean;
  message?: string;
  /** Mirrors Zod's flattened output so inputs can highlight the specific problem. */
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialFormState: FormState = { ok: false };
