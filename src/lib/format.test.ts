import { describe, expect, it } from "vitest";

import {
  bucketClassName,
  formatDateTimeUtc,
  formatDuration,
  formatRelativeTime,
  formatResponseTime,
  formatShortDate,
  formatUptime,
  uptimeBucket,
  uptimePercent,
} from "@/lib/format";

describe("uptime helpers", () => {
  it("returns an em dash rather than dividing by zero", () => {
    expect(formatUptime(0, 0)).toBe("—");
    expect(uptimePercent(0, 0)).toBeNull();
  });

  it("keeps two decimals so 99.99% stays distinct from 100%", () => {
    expect(formatUptime(999, 1000)).toBe("99.90%");
    expect(formatUptime(10_000, 10_000)).toBe("100.00%");
    expect(uptimePercent(1, 2)).toBe(50);
  });
});

describe("formatResponseTime", () => {
  it("uses milliseconds under a second and seconds above", () => {
    expect(formatResponseTime(null)).toBe("—");
    expect(formatResponseTime(undefined)).toBe("—");
    expect(formatResponseTime(87)).toBe("87 ms");
    expect(formatResponseTime(1234)).toBe("1.23 s");
  });
});

describe("formatDuration", () => {
  it("scales the unit with the length", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(3_600_000)).toBe("1h 0m");
    expect(formatDuration(86_400_000)).toBe("1d 0h");
  });
});

describe("uptimeBucket", () => {
  it("classifies a day into a colour bucket", () => {
    expect(uptimeBucket(null)).toBe("none");
    expect(uptimeBucket(100)).toBe("up");
    expect(uptimeBucket(99.99)).toBe("up");
    expect(uptimeBucket(99)).toBe("degraded");
    expect(uptimeBucket(95)).toBe("degraded");
    expect(uptimeBucket(94.99)).toBe("down");
  });

  it("maps every bucket to a background class", () => {
    expect(bucketClassName("up")).toBe("bg-emerald-500");
    expect(bucketClassName("degraded")).toBe("bg-amber-500");
    expect(bucketClassName("down")).toBe("bg-red-500");
    expect(bucketClassName("none")).toBe("bg-muted");
  });
});

describe("date helpers stay in UTC", () => {
  const instant = new Date("2026-03-12T14:05:00.000Z");

  it("formats the exact UTC instant", () => {
    expect(formatDateTimeUtc(instant)).toContain("2026");
    expect(formatDateTimeUtc(instant)).toContain("14:05");
    expect(formatDateTimeUtc(instant)).toContain("UTC");
    expect(formatDateTimeUtc(null)).toBe("—");
  });

  it("formats a short day/month label for charts", () => {
    expect(formatShortDate(instant)).toContain("Mar");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-03-12T12:00:00.000Z");

  it("describes recent instants in words", () => {
    expect(formatRelativeTime(null, now)).toBe("never");
    expect(formatRelativeTime(new Date("2026-03-12T11:59:30.000Z"), now)).toBe("just now");
    expect(formatRelativeTime(new Date("2026-03-12T11:55:00.000Z"), now)).toBe("5 min ago");
    expect(formatRelativeTime(new Date("2026-03-12T09:00:00.000Z"), now)).toBe("3 h ago");
    expect(formatRelativeTime(new Date("2026-03-10T12:00:00.000Z"), now)).toBe("2 d ago");
  });

  it("never reports a negative age for a clock skewed slightly ahead", () => {
    expect(formatRelativeTime(new Date("2026-03-12T12:00:30.000Z"), now)).toBe("just now");
  });
});
