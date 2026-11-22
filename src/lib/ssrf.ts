import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import ipaddr from "ipaddr.js";

/**
 * SSRF (Server-Side Request Forgery) protection.
 *
 * A user can point a monitor at any URL, and our server will fetch it. Without
 * guards, that lets an attacker make our server request things it should never
 * reach — most famously cloud metadata endpoints such as
 * `http://169.254.169.254/` (AWS/GCP/Azure credentials) or internal services
 * on `localhost` / `10.x` / `192.168.x`.
 *
 * The defence has three parts:
 *   1. Validate the URL shape (scheme, no embedded credentials, allowed port).
 *   2. Resolve the hostname and reject if *any* resolved address is not a
 *      public one — a hostname resolving to a mix of public and private IPs is
 *      treated as hostile (fail closed).
 *   3. Pin the validated IP for the actual connection and re-validate on every
 *      redirect. Pinning closes the "DNS rebinding" hole where a hostname
 *      resolves to a public IP during validation and a private one a moment
 *      later, when the real request is made.
 *
 * Everything here is pure and side-effect free (apart from DNS), which is why
 * it lives in `lib` and is unit-tested directly.
 */

/** Why a URL was rejected. Callers use this to decide how to react. */
export type SsrfErrorCode =
  | "INVALID_URL"
  | "BLOCKED_HOST"
  | "BLOCKED_PORT"
  | "PRIVATE_ADDRESS"
  | "DNS_FAILURE";

/** Thrown when a URL is rejected for safety reasons. */
export class SsrfError extends Error {
  readonly code: SsrfErrorCode;

  constructor(code: SsrfErrorCode, message: string) {
    super(message);
    this.name = "SsrfError";
    this.code = code;
  }
}

/** Ports we allow. Anything else is rejected to avoid probing internal services. */
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443, 3000, 5000, 8000]);

/** Hostnames that resolve to things but should never be fetched by name. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

export interface ResolvedTarget {
  /** The original URL, normalised. */
  url: URL;
  /** The single address we will connect to (pinned against rebinding). */
  address: string;
  family: 4 | 6;
  /** Every address the hostname resolved to; all are guaranteed public. */
  allAddresses: string[];
}

function stripIpv6Brackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** Removes the interface/zone suffix from a link-local IPv6 address (`fe80::1%eth0`). */
function stripZoneIndex(ip: string): string {
  const percent = ip.indexOf("%");
  return percent === -1 ? ip : ip.slice(0, percent);
}

/**
 * True only for globally routable ("unicast") addresses.
 *
 * ipaddr.js classifies every address into a range; we allow exactly one. That
 * single rule covers loopback (127.0.0.0/8, ::1), link-local (169.254.0.0/16 —
 * the cloud metadata range, fe80::/10), private (10/8, 172.16/12, 192.168/16),
 * unique-local (fc00::/7), carrier-grade NAT (100.64/10), multicast, reserved
 * and the 6to4/teredo transition ranges, which are all classic SSRF vectors.
 */
export function isPublicIpAddress(ip: string): boolean {
  const cleaned = stripZoneIndex(stripIpv6Brackets(ip.trim()));

  if (isIP(cleaned) === 0) return false;

  try {
    const parsed = ipaddr.parse(cleaned);

    // `::ffff:127.0.0.1` is a private IPv4 address wearing an IPv6 coat.
    // `instanceof` (rather than `kind()`) is what narrows the union for TS.
    const normalized =
      parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address()
        : parsed;

    return normalized.range() === "unicast";
  } catch {
    // Unparseable input is never "safe".
    return false;
  }
}

/** True when the hostname is a name we refuse to resolve at all. */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (lower.length === 0) return true;
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  // `.internal`, `.local`, `.localhost` are not resolvable on the public internet.
  return (
    lower.endsWith(".internal") ||
    lower.endsWith(".local") ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".home.arpa")
  );
}

/**
 * Validates the *shape* of a URL without touching the network. Used both when a
 * monitor is saved (fast feedback for the user) and again at check time (the
 * database could contain an older, previously-valid URL).
 */
export function validateUrlShape(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new SsrfError("INVALID_URL", "URL is not valid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("INVALID_URL", "Only http:// and https:// URLs are allowed");
  }

  // `http://user:pass@host/` — credential smuggling and no legitimate use here.
  if (url.username !== "" || url.password !== "") {
    throw new SsrfError("INVALID_URL", "URLs with embedded credentials are not allowed");
  }

  const hostname = stripIpv6Brackets(url.hostname);
  if (isBlockedHostname(hostname)) {
    throw new SsrfError("BLOCKED_HOST", "This hostname is not allowed");
  }

  const port = url.port === "" ? (url.protocol === "https:" ? "443" : "80") : url.port;
  if (!ALLOWED_PORTS.has(Number(port))) {
    throw new SsrfError("BLOCKED_PORT", `Port ${port} is not allowed`);
  }

  return url;
}

/**
 * Resolves a hostname and returns its addresses, every one of which is public.
 * Throws `SsrfError` if DNS fails or any address is private.
 */
async function resolvePublicAddresses(hostname: string): Promise<{ address: string; family: 4 | 6 }[]> {
  const cleaned = stripIpv6Brackets(hostname);

  // A literal IP needs no DNS lookup.
  if (isIP(cleaned) !== 0) {
    if (!isPublicIpAddress(cleaned)) {
      throw new SsrfError("PRIVATE_ADDRESS", "Requests to private or reserved IP ranges are blocked");
    }
    return [{ address: cleaned, family: isIP(cleaned) === 6 ? 6 : 4 }];
  }

  let records: { address: string; family: number }[];
  try {
    records = await dnsLookup(cleaned, { all: true, verbatim: true });
  } catch {
    throw new SsrfError("DNS_FAILURE", "Could not resolve the hostname");
  }

  if (records.length === 0) {
    throw new SsrfError("DNS_FAILURE", "Could not resolve the hostname");
  }

  // Fail closed: if *any* record points somewhere private, refuse the whole host.
  for (const record of records) {
    if (!isPublicIpAddress(record.address)) {
      throw new SsrfError("PRIVATE_ADDRESS", "Hostname resolves to a private or reserved address");
    }
  }

  return records.map((record) => ({
    address: record.address,
    family: record.family === 6 ? (6 as const) : (4 as const),
  }));
}

/**
 * Full validation: URL shape + DNS resolution + private-range checks. Returns
 * the URL plus the exact IP to connect to. Call this before every request,
 * including each redirect hop.
 */
export async function resolveSafeTarget(rawUrl: string | URL): Promise<ResolvedTarget> {
  const url = rawUrl instanceof URL ? validateUrlShape(rawUrl.toString()) : validateUrlShape(rawUrl);
  const addresses = await resolvePublicAddresses(url.hostname);
  const first = addresses[0];
  if (first === undefined) {
    throw new SsrfError("DNS_FAILURE", "Could not resolve the hostname");
  }
  return {
    url,
    address: first.address,
    family: first.family,
    allAddresses: addresses.map((entry) => entry.address),
  };
}

/**
 * Convenience wrapper used when a monitor is created or edited. Throws
 * `SsrfError` with a user-facing message when the URL may not be monitored.
 */
export async function assertMonitorUrlIsSafe(rawUrl: string): Promise<URL> {
  const target = await resolveSafeTarget(rawUrl);
  return target.url;
}
