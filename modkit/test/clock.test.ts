import assert from "node:assert/strict";
import test from "node:test";
import { assertStepCount, stepTimeoutMs, SIMULATION_STEP_MS, WORKER_MESSAGE } from "./clock.ts";

test("stepTimeoutMs grows with the work asked for and stays bounded", () => {
  assert.ok(stepTimeoutMs(0) >= 1000);
  assert.ok(stepTimeoutMs(100) > stepTimeoutMs(0));
  assert.equal(stepTimeoutMs(1_000_000), stepTimeoutMs(10_000_000));
});

test("assertStepCount rejects anything but a whole count", () => {
  assert.doesNotThrow(() => assertStepCount(0, "clock.ticks()"));
  assert.doesNotThrow(() => assertStepCount(120, "clock.ticks()"));
  assert.throws(() => assertStepCount(-1, "clock.ticks()"), /clock\.ticks\(\)/);
  assert.throws(() => assertStepCount(1.5, "clock.ticks()"), /whole number/);
  assert.throws(() => assertStepCount(Number.NaN, "clock.ticks()"), /whole number/);
});

test("the simulation step matches the manager's fixed timestep", () => {
  assert.equal(SIMULATION_STEP_MS, 1000 / 60);
  assert.equal(WORKER_MESSAGE.RunTick, 67);
  assert.equal(WORKER_MESSAGE.SetPaused, 54);
});
