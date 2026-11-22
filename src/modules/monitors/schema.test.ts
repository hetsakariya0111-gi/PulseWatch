import { describe, expect, it } from "vitest";

import {
  formatInterval,
  formatStatusCodes,
  monitorFormSchema,
  parseStatusCodes,
  toFormValues,
  toMonitorRecord,
} from "@/modules/monitors/schema";

describe("interval handling", () => {
  it("keeps known intervals and falls back to the default for unknown ones", () => {
    expect(formatInterval(1)).toBe("1");
    expect(formatInterval(60)).toBe("60");
    // A row written before the interval list changed must not break the form.
    expect(formatInterval(7)).toBe("5");
  });

  it("only accepts the supported intervals", () => {
    const base = {
      name: "Home",
      url: "https://example.com",
      type: "WEBSITE",
      method: "GET",
      expectedStatusCodes: "200",
      timeoutMs: "10000",
      enabled: true,
      failureThreshold: "2",
      recoveryThreshold: "1",
    };

    expect(monitorFormSchema.safeParse({ ...base, intervalMinutes: "5" }).success).toBe(true);
    expect(monitorFormSchema.safeParse({ ...base, intervalMinutes: "7" }).success).toBe(false);
  });
});

describe("status code parsing", () => {
  it("splits, trims, de-duplicates and sorts", () => {
    expect(parseStatusCodes("200, 204,200")).toEqual([200, 204]);
    expect(parseStatusCodes("500 , 200")).toEqual([200, 500]);
  });

  it("round-trips through the form representation", () => {
    expect(formatStatusCodes([200, 204])).toBe("200, 204");
  });

  it("rejects anything that is not comma-separated 3-digit codes", () => {
    const base = {
      name: "Home",
      url: "https://example.com",
      type: "WEBSITE",
      method: "GET",
      intervalMinutes: "5",
      timeoutMs: "10000",
      enabled: true,
      failureThreshold: "2",
      recoveryThreshold: "1",
    };

    expect(monitorFormSchema.safeParse({ ...base, expectedStatusCodes: "20" }).success).toBe(false);
    expect(monitorFormSchema.safeParse({ ...base, expectedStatusCodes: "200, abc" }).success).toBe(
      false,
    );
    expect(monitorFormSchema.safeParse({ ...base, expectedStatusCodes: "200,204" }).success).toBe(
      true,
    );
  });
});

describe("threshold and timeout bounds", () => {
  const base = {
    name: "Home",
    url: "https://example.com",
    type: "WEBSITE",
    method: "GET",
    expectedStatusCodes: "200",
    intervalMinutes: "5",
    enabled: true,
  };

  it("keeps the timeout between 1s and 30s", () => {
    expect(
      monitorFormSchema.safeParse({ ...base, timeoutMs: "500", failureThreshold: "2", recoveryThreshold: "1" })
        .success,
    ).toBe(false);
    expect(
      monitorFormSchema.safeParse({ ...base, timeoutMs: "30000", failureThreshold: "2", recoveryThreshold: "1" })
        .success,
    ).toBe(true);
  });

  it("keeps thresholds between 1 and 10", () => {
    expect(
      monitorFormSchema.safeParse({ ...base, timeoutMs: "10000", failureThreshold: "0", recoveryThreshold: "1" })
        .success,
    ).toBe(false);
    expect(
      monitorFormSchema.safeParse({ ...base, timeoutMs: "10000", failureThreshold: "11", recoveryThreshold: "1" })
        .success,
    ).toBe(false);
  });
});

describe("form <-> record mapping", () => {
  it("converts validated values into database columns", () => {
    const record = toMonitorRecord({
      name: "API",
      url: "https://example.com/health",
      description: "",
      type: "API",
      method: "HEAD",
      expectedStatusCodes: "200, 204",
      timeoutMs: "5000",
      intervalMinutes: "10",
      enabled: false,
      failureThreshold: "3",
      recoveryThreshold: "2",
    });

    expect(record).toEqual({
      name: "API",
      description: null,
      type: "API",
      method: "HEAD",
      expectedStatusCodes: [200, 204],
      timeoutMs: 5000,
      intervalMinutes: 10,
      enabled: false,
      failureThreshold: 3,
      recoveryThreshold: 2,
    });
  });

  it("is the inverse of toMonitorRecord", () => {
    const values = toFormValues({
      name: "API",
      url: "https://example.com/health",
      description: null,
      type: "API",
      method: "HEAD",
      expectedStatusCodes: [200, 204],
      timeoutMs: 5000,
      intervalMinutes: 10,
      enabled: true,
      failureThreshold: 3,
      recoveryThreshold: 2,
    });

    expect(values.description).toBe("");
    expect(values.expectedStatusCodes).toBe("200, 204");
    expect(values.timeoutMs).toBe("5000");
    expect(values.intervalMinutes).toBe("10");
  });
});
