import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import test, { before } from "node:test";
import { setupGame } from "@modkit/test";

const game = await setupGame();

/** A clear patch of air over the reserved red platform, whose surface is `FLOOR_Y`. */
const DROP_X = 510;
const DROP_Y = 460;
const FLOOR_Y = 511;
const AREA = { x0: DROP_X - 6, x1: DROP_X + 6, y0: DROP_Y - 2, y1: FLOOR_Y };

type Cell = [x: number, y: number, type: number];

function readArea(x0: number, x1: number, y0: number, y1: number): Cell[] {
  const out: Cell[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const type = sandkit.api.elements.getTypeAtCell(x, y);
      if (type) out.push([x, y, type]);
    }
  }
  return out;
}

async function area(): Promise<Cell[]> {
  return game.evaluate(readArea, AREA.x0, AREA.x1, AREA.y0, AREA.y1);
}

async function clearArea(): Promise<void> {
  await game.evaluate(
    (x0: number, x1: number, y0: number, y1: number) => {
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) sandkit.api.elements.removeAtCell(x, y);
      }
    },
    AREA.x0,
    AREA.x1,
    AREA.y0,
    AREA.y1,
  );
  await game.ticks(5);
}

async function dropSand(): Promise<void> {
  await game.evaluate(
    (x: number, y: number) => {
      sandkit.api.elements.createAtCell(x, y, sandkit.api.elements.getTypeById("sand"));
    },
    DROP_X,
    DROP_Y,
  );
}

before(async () => {
  await game.clock.install();
});

// The clock is left installed: the host already keeps the game frozen between
// tests, and the next file adopts it.

test("ticks() runs exactly the requested number of simulation ticks", async () => {
  for (const count of [1, 7, 60, 137]) {
    const before = await game.clock.simTick();
    const stepped = await game.ticks(count);
    const after = await game.clock.simTick();
    assert.equal(stepped.ticks, count, `ticks(${count}) reported ${stepped.ticks}`);
    assert.equal(stepped.frames, count);
    assert.equal(
      after - before,
      count,
      `ticks(${count}) moved the engine counter by ${after - before}`,
    );
  }
});

test("wall-clock time does not advance a stepped simulation", async () => {
  await clearArea();
  await dropSand();
  await game.ticks(6);
  const inFlight = await area();
  assert.equal(inFlight.length, 1, `expected one grain in flight, saw ${JSON.stringify(inFlight)}`);

  const tickBefore = await game.clock.simTick();
  await sleep(750);
  assert.deepEqual(await area(), inFlight, "the grain moved while no test stepped the clock");
  assert.equal(await game.clock.simTick(), tickBefore);

  await game.ticks(6);
  assert.notDeepEqual(await area(), inFlight, "the grain did not move when stepped");
});

test("renderFrames() advances the renderer without ticking the simulation", async () => {
  const before = await game.clock.simTick();
  const stepped = await game.renderFrames(3);
  assert.equal(stepped.ticks, 0);
  assert.equal(await game.clock.simTick(), before);
});

test("a seeded drop lands in the same place on every run", async () => {
  const outcomes: string[] = [];
  for (let run = 0; run < 5; run += 1) {
    await clearArea();
    await game.seed(12345);
    await dropSand();
    await game.ticks(150);
    outcomes.push(JSON.stringify(await area()));
  }
  assert.equal(
    new Set(outcomes).size,
    1,
    `the drop is not reproducible: ${JSON.stringify(outcomes)}`,
  );
  const resting = JSON.parse(outcomes[0] ?? "[]") as Cell[];
  assert.deepEqual(
    resting.map(([, y]) => y),
    [FLOOR_Y],
    `the grain did not come to rest on the platform: ${outcomes[0]}`,
  );
});

test("waitFor() steps the clock instead of sleeping", async () => {
  await clearArea();
  await dropSand();
  const resting = await game.waitFor(readArea, (cells) => cells.some(([, y]) => y === FLOOR_Y), {
    args: [AREA.x0, AREA.x1, AREA.y0, AREA.y1],
    ticksPerPoll: 10,
    message: "sand never landed",
  });
  assert.equal(resting.length, 1);
});

test("withRealTime() advances the game and takes that long doing it", async () => {
  await clearArea();
  await dropSand();
  await game.ticks(6);
  const inFlight = await area();

  const startedAt = Date.now();
  const stepped = await game.clock.withRealTime(500);
  const elapsed = Date.now() - startedAt;

  assert.equal(stepped.ticks, 30, "500 ms is 30 ticks at the fixed timestep");
  assert.ok(elapsed >= 450, `withRealTime(500) returned after only ${elapsed} ms`);
  assert.notDeepEqual(await area(), inFlight, "the grain did not move");
  assert.equal((await game.clockStatus()).installed, true);
});

test("the clock recovers after it hands the game back and takes it again", async () => {
  await game.clock.uninstall();
  assert.equal((await game.clockStatus()).installed, false);

  await game.clock.install();
  const before = await game.clock.simTick();
  const stepped = await game.ticks(10);
  assert.equal(stepped.ticks, 10);
  assert.equal(await game.clock.simTick(), before + 10);
});
