import assert from "node:assert/strict";
import test from "node:test";
import { nextRestartDelay, watchChildExitAction } from "./never-exit.js";

test("watch child exit: user stop", () => {
  assert.equal(watchChildExitAction({ stopping: true, restarting: false, signal: null }), "exit");
});

test("watch child exit: group SIGINT is a stop", () => {
  assert.equal(
    watchChildExitAction({ stopping: false, restarting: false, signal: "SIGINT" }),
    "exit",
  );
});

test("watch child exit: selection swap", () => {
  assert.equal(
    watchChildExitAction({ stopping: false, restarting: true, signal: "SIGTERM" }),
    "swap",
  );
  assert.equal(watchChildExitAction({ stopping: false, restarting: true, signal: null }), "swap");
});

test("watch child exit: crash respawns", () => {
  assert.equal(
    watchChildExitAction({ stopping: false, restarting: false, signal: null }),
    "respawn",
  );
});

test("restart delay doubles up to 10s", () => {
  assert.equal(nextRestartDelay(0), 500);
  assert.equal(nextRestartDelay(250), 500);
  assert.equal(nextRestartDelay(8000), 10_000);
  assert.equal(nextRestartDelay(10_000), 10_000);
});
