import { request as httpRequest, type IncomingHttpHeaders, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";

import { CheckErrorType } from "@/generated/prisma/enums";
import { SsrfError, resolveSafeTarget, type ResolvedTarget } from "@/lib/ssrf";

/**
 * The HTTP probe used by the check engine.
 *
 * We deliberately do **not** use `fetch`. Node's `fetch` (undici) gives no way
 * to pin the IP we connect to, which would leave us open to DNS rebinding: the
 * URL could resolve to a public address during validation and to `127.0.0.1`
 * when the socket is actually opened. `http`/`https` expose a `lookup` hook, so
 * we resolve the hostname once, validate it, and then force the connection to
 * that exact address while keeping the original hostname for the `Host` header
 * and TLS SNI.
 */

/** Hard ceiling on redirect hops. Each hop is re-validated against SSRF. */
const MAX_REDIRECTS = 5;

/** We only need the status line; large bodies are aborted to save memory. */
const MAX_RESPONSE_BYTES = 1_000_000;

export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 30_000;

export const USER_AGENT = "PulseWatch/1.0 (+https://github.com/pulsewatch)";

export interface HttpCheckInput {
  url: string;
  method: "GET" | "HEAD" | "POST";
  expectedStatusCodes: number[];
  timeoutMs: number;
}

export interface HttpCheckOutput {
  success: boolean;
  statusCode: number | null;
  /** Time to first byte (headers) for the final request in the chain. */
  responseTimeMs: number;
  errorType: CheckErrorType | null;
  errorMessage: string | null;
  finalUrl: string;
}

/** Internal error carrying the domain error type we want to persist. */
class ProbeError extends Error {
  readonly type: CheckErrorType;

  constructor(type: CheckErrorType, message: string) {
    super(message);
    this.name = "ProbeError";
    this.type = type;
  }
}

/**
 * A `lookup` replacement that ignores DNS and always returns the address we
 * already validated. Node may call `lookup` either for a single address or for
 * all addresses (`{ all: true }`, used by happy-eyeballs), so handle both.
 */
function createPinnedLookup(address: string, family: 4 | 6) {
  return (
    _hostname: string,
    options: unknown,
    callback: (err: Error | null, address: string | { address: string; family: number }[], family?: number) => void,
  ): void => {
    const wantsAll = typeof options === "object" && options !== null && (options as { all?: boolean }).all === true;
    if (wantsAll) {
      callback(null, [{ address, family }]);
    } else {
      callback(null, address, family);
    }
  };
}

/** Maps an SSRF rejection to the domain error type we persist. */
function mapSsrfErrorToType(error: SsrfError): CheckErrorType {
  return error.code === "DNS_FAILURE" ? CheckErrorType.DNS_FAILURE : CheckErrorType.SSRF_BLOCKED;
}

function mapNodeErrorToType(code: string | undefined): CheckErrorType {
  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return CheckErrorType.DNS_FAILURE;
    case "CERT_HAS_EXPIRED":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "ERR_SSL_WRONG_VERSION_NUMBER":
      return CheckErrorType.TLS_ERROR;
    case "ECONNREFUSED":
    case "ECONNRESET":
    case "EHOSTUNREACH":
    case "ENETUNREACH":
    case "EPIPE":
    case "ETIMEDOUT":
      return CheckErrorType.CONNECTION_ERROR;
    default:
      return CheckErrorType.UNKNOWN;
  }
}

interface SingleResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  responseTimeMs: number;
}

/**
 * Performs one request to an already-validated target. Never follows
 * redirects — the caller does that so each hop gets re-validated.
 */
function singleRequest(
  target: ResolvedTarget,
  method: string,
  timeoutMs: number,
): Promise<SingleResponse> {
  return new Promise<SingleResponse>((resolve, reject) => {
    const { url } = target;
    const isHttps = url.protocol === "https:";

    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port === "" ? (isHttps ? 443 : 80) : Number(url.port),
      path: `${url.pathname}${url.search}`,
      method,
      // `agent: false` forces a fresh socket per request. Connection reuse
      // could otherwise hand us a pooled socket to a different address than
      // the one we pinned and validated.
      agent: false,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        Connection: "close",
      },
    };

    // The cast is required because Node types `lookup` as the full dns.lookup
    // overload set; ours intentionally implements just the subset Node uses.
    options.lookup = createPinnedLookup(target.address, target.family) as unknown as RequestOptions["lookup"];

    const startedAt = Date.now();
    let settled = false;
    let receivedBytes = 0;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const request = (isHttps ? httpsRequest : httpRequest)(options, (response) => {
      const responseTimeMs = Date.now() - startedAt;

      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          request.destroy();
          fail(new ProbeError(CheckErrorType.RESPONSE_TOO_LARGE, "Response body exceeded 1MB"));
        }
      });

      response.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, responseTimeMs });
      });

      response.on("error", (error: Error) => fail(error));
    });

    const timer = setTimeout(() => {
      request.destroy();
      fail(new ProbeError(CheckErrorType.TIMEOUT, `Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    request.on("error", (error: NodeJS.ErrnoException) => {
      fail(new ProbeError(mapNodeErrorToType(error.code), error.message));
    });

    request.end();
  });
}

function resolveRedirect(current: URL, location: string): URL {
  try {
    return new URL(location, current);
  } catch {
    throw new ProbeError(CheckErrorType.INVALID_URL, "Redirect returned an invalid Location header");
  }
}

/**
 * Runs an availability check with full SSRF protection:
 * URL validation, per-hop DNS re-validation, IP pinning, bounded redirects,
 * a hard timeout and a response-size cap.
 */
export async function performHttpCheck(input: HttpCheckInput): Promise<HttpCheckOutput> {
  const timeoutMs = Math.min(Math.max(input.timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
  const startedAt = Date.now();

  let currentUrl: URL;
  let target: ResolvedTarget;

  try {
    target = await resolveSafeTarget(input.url);
    currentUrl = target.url;
  } catch (error) {
    if (error instanceof SsrfError) {
      return {
        success: false,
        statusCode: null,
        responseTimeMs: Date.now() - startedAt,
        errorType: mapSsrfErrorToType(error),
        errorMessage: error.message,
        finalUrl: input.url,
      };
    }

    return {
      success: false,
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      errorType: CheckErrorType.INVALID_URL,
      errorMessage: error instanceof Error ? error.message : "Invalid URL",
      finalUrl: input.url,
    };
  }

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await singleRequest(target, input.method, timeoutMs);

      const isRedirect = response.statusCode >= 300 && response.statusCode < 400;
      const location = response.headers.location;

      if (isRedirect && typeof location === "string") {
        if (hop === MAX_REDIRECTS) {
          throw new ProbeError(CheckErrorType.TOO_MANY_REDIRECTS, `Exceeded ${MAX_REDIRECTS} redirects`);
        }

        // Re-validate the redirect destination from scratch: a redirect is the
        // classic way to bounce a validated URL onto an internal address.
        const nextUrl = resolveRedirect(currentUrl, location);
        target = await resolveSafeTarget(nextUrl);
        currentUrl = target.url;
        continue;
      }

      const expected = input.expectedStatusCodes.includes(response.statusCode);
      return {
        success: expected,
        statusCode: response.statusCode,
        responseTimeMs: response.responseTimeMs,
        errorType: expected ? null : CheckErrorType.UNEXPECTED_STATUS,
        errorMessage: expected ? null : `Expected ${input.expectedStatusCodes.join("/")}, got ${response.statusCode}`,
        finalUrl: currentUrl.toString(),
      };
    }

    // Unreachable: the loop either returns or throws on the last hop.
    throw new ProbeError(CheckErrorType.TOO_MANY_REDIRECTS, "Exceeded redirect limit");
  } catch (error) {
    if (error instanceof SsrfError) {
      return {
        success: false,
        statusCode: null,
        responseTimeMs: Date.now() - startedAt,
        errorType: mapSsrfErrorToType(error),
        errorMessage: error.message,
        finalUrl: currentUrl.toString(),
      };
    }

    if (error instanceof ProbeError) {
      return {
        success: false,
        statusCode: null,
        responseTimeMs: Date.now() - startedAt,
        errorType: error.type,
        errorMessage: error.message,
        finalUrl: currentUrl.toString(),
      };
    }

    const code = (error as NodeJS.ErrnoException).code;
    return {
      success: false,
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      errorType: mapNodeErrorToType(code),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      finalUrl: currentUrl.toString(),
    };
  }
}
