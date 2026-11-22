import { z } from "zod";

import { HttpMethod, MonitorType } from "@/generated/prisma/enums";

import {
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_RECOVERY_THRESHOLD,
  DEFAULT_TIMEOUT_MS,
  MAX_THRESHOLD,
  MAX_TIMEOUT_MS,
  MIN_THRESHOLD,
  MIN_TIMEOUT_MS,
  MONITOR_INTERVAL_STRINGS,
} from "./constants";

/**
 * Form schema for monitors.
 *
 * Every field is a string (or boolean) because that is what HTML inputs
 * produce. Keeping the schema string-typed means React Hook Form's resolver and
 * the server action share one schema with no input/output type gymnastics; the
 * `toMonitorRecord` helper converts to database types afterwards.
 */

/** A whole number sent as a string, constrained to a range. */
function numericString(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .refine((value) => Number(value) >= min && Number(value) <= max, {
      message: `${label} must be between ${min} and ${max}`,
    });
}

export const monitorFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep the name under 80 characters"),
  url: z.string().trim().min(1, "URL is required").max(2048, "URL is too long"),
  description: z
    .string()
    .trim()
    .max(280, "Keep the description under 280 characters")
    .optional()
    .or(z.literal("")),
  type: z.enum([MonitorType.WEBSITE, MonitorType.API]),
  method: z.enum([HttpMethod.GET, HttpMethod.HEAD, HttpMethod.POST]),
  expectedStatusCodes: z
    .string()
    .trim()
    .min(1, "At least one status code is required")
    .regex(/^\d{3}(\s*,\s*\d{3})*$/, "Use comma-separated 3-digit codes, e.g. 200, 204"),
  timeoutMs: numericString(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, "Timeout"),
  intervalMinutes: z.enum(MONITOR_INTERVAL_STRINGS),
  enabled: z.boolean(),
  failureThreshold: numericString(MIN_THRESHOLD, MAX_THRESHOLD, "Failure threshold"),
  recoveryThreshold: numericString(MIN_THRESHOLD, MAX_THRESHOLD, "Recovery threshold"),
});

export type MonitorFormValues = z.infer<typeof monitorFormSchema>;

const INTERVAL_VALUES = new Set<string>(MONITOR_INTERVAL_STRINGS);

export const defaultMonitorValues: MonitorFormValues = {
  name: "",
  url: "",
  description: "",
  type: MonitorType.WEBSITE,
  method: HttpMethod.GET,
  expectedStatusCodes: "200",
  timeoutMs: String(DEFAULT_TIMEOUT_MS),
  intervalMinutes: formatInterval(DEFAULT_INTERVAL_MINUTES),
  enabled: true,
  failureThreshold: String(DEFAULT_FAILURE_THRESHOLD),
  recoveryThreshold: String(DEFAULT_RECOVERY_THRESHOLD),
};

/**
 * Converts a stored interval (a number) back to the string the form and schema
 * use, falling back to the default if the stored value is not a known interval
 * (e.g. a row written before the interval list changed).
 */
export function formatInterval(minutes: number): MonitorFormValues["intervalMinutes"] {
  const value = String(minutes);
  const safe = INTERVAL_VALUES.has(value) ? value : String(DEFAULT_INTERVAL_MINUTES);
  return safe as MonitorFormValues["intervalMinutes"];
}

/** "200, 204" -> [200, 204], de-duplicated and sorted. */
export function parseStatusCodes(value: string): number[] {
  const codes = new Set<number>();
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    codes.add(Number(trimmed));
  }
  return [...codes].sort((a, b) => a - b);
}

export function formatStatusCodes(codes: number[]): string {
  return codes.join(", ");
}

/** Converts validated form values into the column shape Prisma expects. */
export function toMonitorRecord(values: MonitorFormValues) {
  return {
    name: values.name,
    description: values.description === undefined || values.description === "" ? null : values.description,
    type: values.type,
    method: values.method,
    expectedStatusCodes: parseStatusCodes(values.expectedStatusCodes),
    timeoutMs: Number(values.timeoutMs),
    intervalMinutes: Number(values.intervalMinutes),
    enabled: values.enabled,
    failureThreshold: Number(values.failureThreshold),
    recoveryThreshold: Number(values.recoveryThreshold),
  };
}

/** Inverse of `toMonitorRecord`, used to pre-fill the edit form. */
export function toFormValues(monitor: {
  name: string;
  url: string;
  description: string | null;
  type: MonitorFormValues["type"];
  method: MonitorFormValues["method"];
  expectedStatusCodes: number[];
  timeoutMs: number;
  intervalMinutes: number;
  enabled: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
}): MonitorFormValues {
  return {
    name: monitor.name,
    url: monitor.url,
    description: monitor.description ?? "",
    type: monitor.type,
    method: monitor.method,
    expectedStatusCodes: formatStatusCodes(monitor.expectedStatusCodes),
    timeoutMs: String(monitor.timeoutMs),
    intervalMinutes: formatInterval(monitor.intervalMinutes),
    enabled: monitor.enabled,
    failureThreshold: String(monitor.failureThreshold),
    recoveryThreshold: String(monitor.recoveryThreshold),
  };
}
