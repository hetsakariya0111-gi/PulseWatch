import type { MonitorStatus } from "@/generated/prisma/enums";

/**
 * Monitor state machine (pure, no I/O).
 *
 * Kept separate from the engine so it can be unit-tested without a database —
 * this is the logic that decides whether a blip becomes an incident, and it is
 * the easiest thing in the project to get subtly wrong.
 */

export interface MonitorStateInput {
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  /** Consecutive failures needed to declare the monitor DOWN. */
  failureThreshold: number;
  /** Consecutive successes needed to declare a DOWN monitor recovered. */
  recoveryThreshold: number;
}

export interface MonitorStateResult {
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  /** The failure threshold was just crossed — open an incident. */
  incidentShouldOpen: boolean;
  /** The recovery threshold was just met — resolve the open incident. */
  incidentShouldResolve: boolean;
}

/**
 * Advances a monitor by one check result.
 *
 * "Flap protection": a single failed probe does not page anyone. We only move
 * to DOWN (and open an incident) after `failureThreshold` consecutive
 * failures, and we only move back to UP after `recoveryThreshold` consecutive
 * successes. That mirrors how Uptime Kuma / Better Stack behave and keeps
 * transient network noise out of the incident feed.
 */
export function computeNextState(
  input: MonitorStateInput,
  success: boolean,
): MonitorStateResult {
  if (success) {
    const consecutiveSuccesses = input.consecutiveSuccesses + 1;

    if (input.status === "DOWN") {
      // Still recovering: hold the incident open until the threshold is met.
      if (consecutiveSuccesses < input.recoveryThreshold) {
        return {
          status: "DOWN",
          consecutiveFailures: 0,
          consecutiveSuccesses,
          incidentShouldOpen: false,
          incidentShouldResolve: false,
        };
      }

      return {
        status: "UP",
        consecutiveFailures: 0,
        consecutiveSuccesses,
        incidentShouldOpen: false,
        incidentShouldResolve: true,
      };
    }

    return {
      status: "UP",
      consecutiveFailures: 0,
      consecutiveSuccesses,
      incidentShouldOpen: false,
      incidentShouldResolve: false,
    };
  }

  const consecutiveFailures = input.consecutiveFailures + 1;

  if (input.status === "DOWN") {
    // Already down; the incident is open, so there is nothing to announce.
    return {
      status: "DOWN",
      consecutiveFailures,
      consecutiveSuccesses: 0,
      incidentShouldOpen: false,
      incidentShouldResolve: false,
    };
  }

  if (consecutiveFailures >= input.failureThreshold) {
    return {
      status: "DOWN",
      consecutiveFailures,
      consecutiveSuccesses: 0,
      incidentShouldOpen: true,
      incidentShouldResolve: false,
    };
  }

  // Inside the tolerance window: report the failure in the history but keep the
  // last known status so a single dropped packet does not flip the badge.
  return {
    status: input.status,
    consecutiveFailures,
    consecutiveSuccesses: 0,
    incidentShouldOpen: false,
    incidentShouldResolve: false,
  };
}
