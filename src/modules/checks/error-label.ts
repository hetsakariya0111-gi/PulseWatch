import type { CheckErrorType } from "@/generated/prisma/enums";

/**
 * Human-readable failure reasons.
 *
 * The enum lives in the database so analytics can group by cause; this map is
 * the single place that turns those codes into language a user can act on.
 */
const ERROR_LABELS: Record<CheckErrorType, string> = {
  TIMEOUT: "Timed out",
  DNS_FAILURE: "DNS lookup failed",
  TLS_ERROR: "TLS / certificate error",
  UNEXPECTED_STATUS: "Unexpected status code",
  CONNECTION_ERROR: "Connection failed",
  SSRF_BLOCKED: "Blocked: unsafe target address",
  TOO_MANY_REDIRECTS: "Too many redirects",
  RESPONSE_TOO_LARGE: "Response body too large",
  INVALID_URL: "Invalid URL",
  UNKNOWN: "Unknown error",
};

export function checkErrorLabel(errorType: CheckErrorType | null): string {
  if (errorType === null) return "—";
  return ERROR_LABELS[errorType];
}
