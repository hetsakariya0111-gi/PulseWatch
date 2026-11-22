/**
 * Monitor domain constants.
 *
 * Intervals are fixed rather than free-form so the scheduler's load is
 * predictable: a user cannot ask us to probe their site every second, and the
 * `nextCheckAt` index stays meaningful. See the README for the free-tier
 * reasoning behind the caps.
 */

export const MONITOR_INTERVALS = [1, 5, 10, 30, 60] as const;
export type MonitorInterval = (typeof MONITOR_INTERVALS)[number];

/** String form of the intervals, for <Select> options and Zod enums. */
export const MONITOR_INTERVAL_STRINGS = ["1", "5", "10", "30", "60"] as const;

export const DEFAULT_INTERVAL_MINUTES: MonitorInterval = 5;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_FAILURE_THRESHOLD = 2;
export const DEFAULT_RECOVERY_THRESHOLD = 1;

export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 30_000;
export const MIN_THRESHOLD = 1;
export const MAX_THRESHOLD = 10;

/** Free-tier guards. Enforced in the service layer, not just the UI. */
export const MAX_PROJECTS_PER_USER = 10;
export const MAX_MONITORS_PER_PROJECT = 20;

/** A lease is considered expired if the run holding it died before finishing. */
export const LEASE_DURATION_MS = 60_000;
