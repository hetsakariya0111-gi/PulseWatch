/**
 * Shared result type for server actions driven by `useActionState`.
 *
 * Returning a value instead of throwing keeps expected failures (validation,
 * "not found", authorization) on the normal code path where the form can show
 * a message. Only genuine bugs are allowed to throw.
 */
export interface ActionState<TData = undefined> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: TData;
}

export const initialActionState: ActionState = { ok: false };

export function actionError<TData = undefined>(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
): ActionState<TData> {
  return fieldErrors === undefined ? { ok: false, message } : { ok: false, message, fieldErrors };
}

export function actionSuccess<TData>(message: string, data?: TData): ActionState<TData> {
  return data === undefined ? { ok: true, message } : { ok: true, message, data };
}

/** Reads a required string field from FormData, returning "" when absent. */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Checkbox/switch helper: HTML forms omit unchecked boxes entirely. */
export function formBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}
