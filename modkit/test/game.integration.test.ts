import assert from "node:assert/strict";
import test from "node:test";
import { expect, setupGame } from "@modkit/test";

const game = await setupGame();

/** Void `Empty.save` spawn (world pixels). Keeps the smoke shot stable across the suite. */
const VOID_SPAWN = { x: 2042, y: 2018 };

test("Game scene exposes sandkit.api", async () => {
  const state = await game.evaluate(() => {
    const api = sandkit.api;
    return {
      hasApi: Boolean(api),
      gameScene: sandkit.enums.Scene.Game,
    };
  });
  assert.equal(state.hasApi, true);
  assert.equal(typeof state.gameScene, "number");
});

test("player position is finite", async () => {
  const pos = await game.evaluate(() => sandkit.api.player.getPositionAtWorld());
  assert.equal(typeof pos.x, "number");
  assert.equal(typeof pos.y, "number");
  assert.ok(Number.isFinite(pos.x));
  assert.ok(Number.isFinite(pos.y));
});
