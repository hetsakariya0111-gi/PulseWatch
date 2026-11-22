import { describe, expect, it } from "vitest";

import {
  isBlockedHostname,
  isPublicIpAddress,
  resolveSafeTarget,
  SsrfError,
  validateUrlShape,
} from "@/lib/ssrf";

/**
 * SSRF is the highest-risk surface in the project: it is the one place where a
 * user's input decides what our server connects to. These tests pin the
 * behaviour so a future refactor cannot quietly widen the allow-list.
 */

function expectSsrfError(fn: () => unknown, code: SsrfError["code"]): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SsrfError);
    expect((error as SsrfError).code).toBe(code);
    return;
  }
  throw new Error(`Expected an SsrfError with code ${code}`);
}

describe("isPublicIpAddress", () => {
  it("rejects loopback, private, link-local and reserved ranges", () => {
    const blocked = [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata — the classic SSRF target
      "100.64.0.1", // carrier-grade NAT
      "0.0.0.0",
      "224.0.0.1", // multicast
      "::1",
      "fe80::1", // link-local
      "fc00::1", // unique local
      "::ffff:127.0.0.1", // IPv4-mapped loopback
      "::ffff:10.0.0.1",
    ];

    for (const ip of blocked) {
      expect(isPublicIpAddress(ip), ip).toBe(false);
    }
  });

  it("accepts globally routable addresses", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("1.1.1.1")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("strips an IPv6 zone index before checking", () => {
    expect(isPublicIpAddress("fe80::1%eth0")).toBe(false);
  });

  it("fails closed on input it cannot parse", () => {
    expect(isPublicIpAddress("not-an-ip")).toBe(false);
    expect(isPublicIpAddress("")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it("blocks metadata and local names, case and trailing dot insensitive", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("LOCALHOST.")).toBe(true);
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedHostname("metadata")).toBe(true);
    expect(isBlockedHostname("anything.internal")).toBe(true);
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("")).toBe(true);
  });

  it("allows ordinary public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("api.example.co.uk")).toBe(false);
  });
});

describe("validateUrlShape", () => {
  it("accepts http and https on allowed ports", () => {
    expect(validateUrlShape("https://example.com").port).toBe("");
    expect(validateUrlShape("http://example.com:8080/health").port).toBe("8080");
  });

  it("rejects non-http schemes", () => {
    expectSsrfError(() => validateUrlShape("ftp://example.com"), "INVALID_URL");
    expectSsrfError(() => validateUrlShape("file:///etc/passwd"), "INVALID_URL");
  });

  it("rejects embedded credentials", () => {
    expectSsrfError(() => validateUrlShape("https://user:pass@example.com"), "INVALID_URL");
  });

  it("rejects ports outside the allow-list", () => {
    expectSsrfError(() => validateUrlShape("http://example.com:22"), "BLOCKED_PORT");
    expectSsrfError(() => validateUrlShape("http://example.com:5432"), "BLOCKED_PORT");
  });

  it("rejects blocked hostnames", () => {
    expectSsrfError(() => validateUrlShape("http://localhost/admin"), "BLOCKED_HOST");
    expectSsrfError(() => validateUrlShape("http://metadata.google.internal/"), "BLOCKED_HOST");
  });

  it("rejects strings that are not URLs", () => {
    expectSsrfError(() => validateUrlShape("example.com"), "INVALID_URL");
    expectSsrfError(() => validateUrlShape(""), "INVALID_URL");
  });
});

describe("resolveSafeTarget", () => {
  it("rejects literal private and metadata IPs without any DNS lookup", async () => {
    await expect(resolveSafeTarget("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({
      code: "PRIVATE_ADDRESS",
    });
    await expect(resolveSafeTarget("http://127.0.0.1/")).rejects.toMatchObject({
      code: "PRIVATE_ADDRESS",
    });
    await expect(resolveSafeTarget("http://10.0.0.1/")).rejects.toMatchObject({
      code: "PRIVATE_ADDRESS",
    });
    await expect(resolveSafeTarget("http://[::1]/")).rejects.toMatchObject({
      code: "PRIVATE_ADDRESS",
    });
  });

  it("pins a literal public IP that needs no resolution", async () => {
    const target = await resolveSafeTarget("http://8.8.8.8/status");
    expect(target.address).toBe("8.8.8.8");
    expect(target.family).toBe(4);
    expect(target.allAddresses).toEqual(["8.8.8.8"]);
  });
});
