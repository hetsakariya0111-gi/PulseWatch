import { describe, expect, it } from "vitest";

import {
  normalizeStatusPageInput,
  statusPageInputSchema,
  suggestSlug,
} from "@/modules/status-pages/schema";

/**
 * Slugs become public URLs (`/status/<slug>`), so the rules here are the reason
 * two users cannot collide and the reason a slug can never shadow a real app
 * route.
 */

describe("suggestSlug", () => {
  it("lowercases and hyphenates a display name", () => {
    expect(suggestSlug("My API Status")).toBe("my-api-status");
    expect(suggestSlug("  Acme   Inc.  ")).toBe("acme-inc");
  });

  it("pads a name that would be too short on its own", () => {
    expect(suggestSlug("ab")).toBe("status-ab");
  });

  it("never exceeds the column's practical limit", () => {
    expect(suggestSlug("a".repeat(200)).length).toBeLessThanOrEqual(50);
  });
});

describe("statusPageInputSchema", () => {
  const base = { title: "Acme status", isPublic: true };

  it("accepts a well-formed slug", () => {
    const parsed = statusPageInputSchema.safeParse({ ...base, slug: "acme-status" });
    expect(parsed.success).toBe(true);
  });

  it("normalises case and surrounding whitespace before validating", () => {
    const parsed = statusPageInputSchema.safeParse({ ...base, slug: "  Acme-Status  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.slug).toBe("acme-status");
  });

  it("rejects spaces, leading hyphens and double hyphens", () => {
    expect(statusPageInputSchema.safeParse({ ...base, slug: "my api" }).success).toBe(false);
    expect(statusPageInputSchema.safeParse({ ...base, slug: "-leading" }).success).toBe(false);
    expect(statusPageInputSchema.safeParse({ ...base, slug: "double--hyphen" }).success).toBe(false);
  });

  it("rejects slugs that are too short or too long", () => {
    expect(statusPageInputSchema.safeParse({ ...base, slug: "ab" }).success).toBe(false);
    expect(statusPageInputSchema.safeParse({ ...base, slug: "a".repeat(51) }).success).toBe(false);
  });

  it("rejects slugs that would shadow an application route", () => {
    for (const reserved of ["dashboard", "projects", "status", "api"]) {
      expect(statusPageInputSchema.safeParse({ ...base, slug: reserved }).success, reserved).toBe(
        false,
      );
    }
  });

  it("requires a title", () => {
    expect(statusPageInputSchema.safeParse({ ...base, slug: "acme", title: "  " }).success).toBe(
      false,
    );
  });
});

describe("normalizeStatusPageInput", () => {
  it("turns an empty description into null and lowercases the slug", () => {
    expect(
      normalizeStatusPageInput({ slug: "Acme", title: "Acme status", description: "", isPublic: false }),
    ).toEqual({ slug: "acme", title: "Acme status", description: null, isPublic: false });
  });
});
