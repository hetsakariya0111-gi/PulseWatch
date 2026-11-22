import { describe, expect, it } from "vitest";

import type { MonitorStateInput } from "@/modules/checks/state";
import { computeNextState } from "@/modules/checks/state";

/**
 * The state machine decides when a blip becomes an incident. It has no I/O, so
 * it is cheap to test exhaustively — which is exactly why it was extracted from
 * the engine.
 */

function state(partial: Partial<MonitorStateInput> = {}): MonitorStateInput {
  return {
    status: "UP",
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    failureThreshold: 2,
    recoveryThreshold: 1,
    ...partial,
  };
}

describe("computeNextState — recovery path", () => {
  it("moves an UNKNOWN monitor to UP on the first success", () => {
    const next = computeNextState(state({ status: "UNKNOWN" }), true);

    expect(next.status).toBe("UP");
    expect(next.consecutiveSuccesses).toBe(1);
    expect(next.consecutiveFailures).toBe(0);
    expect(next.incidentShouldOpen).toBe(false);
    expect(next.incidentShouldResolve).toBe(false);
  });

  it("holds a DOWN monitor down until the recovery threshold is met", () => {
    const first = computeNextState(
      state({ status: "DOWN", consecutiveFailures: 3, recoveryThreshold: 2 }),
      true,
    );
    expect(first.status).toBe("DOWN");
    expect(first.consecutiveSuccesses).toBe(1);
    expect(first.incidentShouldResolve).toBe(false);

    const second = computeNextState(
      state({ status: "DOWN", consecutiveFailures: 3, consecutiveSuccesses: 1, recoveryThreshold: 2 }),
      true,
    );
    expect(second.status).toBe("UP");
    expect(second.consecutiveSuccesses).toBe(2);
    expect(second.incidentShouldResolve).toBe(true);
  });

  it("resolves immediately when the recovery threshold is 1", () => {
    const next = computeNextState(state({ status: "DOWN", consecutiveFailures: 4 }), true);
    expect(next.status).toBe("UP");
    expect(next.incidentShouldResolve).toBe(true);
    expect(next.incidentShouldOpen).toBe(false);
  });
});

describe("computeNextState — failure path", () => {
  it("does not open an incident inside the failure tolerance window", () => {
    const next = computeNextState(state({ status: "UP", failureThreshold: 2 }), false);

    expect(next.status).toBe("UP");
    expect(next.consecutiveFailures).toBe(1);
    expect(next.consecutiveSuccesses).toBe(0);
    expect(next.incidentShouldOpen).toBe(false);
  });

  it("opens exactly one incident when the threshold is crossed", () => {
    const crossing = computeNextState(
      state({ status: "UP", consecutiveFailures: 1, failureThreshold: 2 }),
      false,
    );
    expect(crossing.status).toBe("DOWN");
    expect(crossing.consecutiveFailures).toBe(2);
    expect(crossing.incidentShouldOpen).toBe(true);

    // Subsequent failures keep it DOWN but must not reopen the incident.
    const after = computeNextState(
      state({ status: "DOWN", consecutiveFailures: 2, failureThreshold: 2 }),
      false,
    );
    expect(after.status).toBe("DOWN");
    expect(after.incidentShouldOpen).toBe(false);
  });

  it("resets the success streak when a check fails", () => {
    const next = computeNextState(state({ consecutiveSuccesses: 4 }), false);
    expect(next.consecutiveSuccesses).toBe(0);
  });
});
