/**
 * Deterministic clock for integration tests.
 *
 * Sandustry runs on two `requestAnimationFrame` loops: the renderer's own frame
 * loop, and the manager worker's fixed-timestep loop that drives every
 * simulation tick. Wall-clock helpers race both of them.
 *
 * The clock takes both loops over. It replaces `requestAnimationFrame` in each
 * context with a pump the test drives, so a step advances the game by an exact
 * number of frames and ticks instead of by however much time the host machine
 * happened to give it.
 */
import { randomUUID } from "node:crypto";
import type { CdpConnection } from "./cdp.ts";
import { pauseEngineInPage, setSimulationSpeedInPage } from "./helpers/engine.ts";
import { toPageExpression } from "./serialize.ts";

/**
 * Simulation worker protocol ids, read out of the extracted build
 * (`decompiled/<version>/data/enums.json`, `Init_RunUpdate_SetCell`).
 *
 * They are not on the sandkit surface, so they are an adapter, not API:
 * `install()` proves them against a live tick and fails loudly rather than
 * silently stepping nothing when a game update moves them.
 */
export const WORKER_MESSAGE = {
  RunUpdate: 2,
  SetPaused: 54,
  RunTick: 67,
  SetSimulationSpeed: 68,
} as const;

/** The manager worker's fixed timestep, `1 / 60` s in both 0.5.6-mods and 0.5.7. */
export const SIMULATION_STEP_MS = 1000 / 60;

/** The manager clamps one frame's delta to 0.25 s, which is 15 ticks. */
export const MAX_TICKS_PER_FRAME = 15;

/**
 * Steps run once at install so a test starts from a settled world.
 *
 * They are not all an install advances: priming runs up to `MAX_TICKS_PER_FRAME`
 * ticks and proving the counter runs one more, so an install moves the world by
 * up to 18 ticks before a test takes over.
 */
export const DEFAULT_SETTLE_TICKS = 2;

/** Seed used when `seed()` is called without one. */
export const DEFAULT_SEED = 1;

const ARM_TIMEOUT_MS = 15_000;
const ARM_POLL_MS = 100;
const CALL_BASE_TIMEOUT_MS = 15_000;
const CALL_PER_TICK_MS = 250;
const CALL_MAX_TIMEOUT_MS = 600_000;
/** Clamp-sized frames `prime` may run: 2000 of them cover 500 s of time debt. */
const PRIME_FRAME_BUDGET = 2000;
const PRIME_TIMEOUT_MS = 20_000;
/** How long a pumped frame waits for its loop to ask for one. */
const FRAME_REQUEST_TIMEOUT_MS = 10_000;

export type ClockStatus = {
  installed: boolean;
  armed: boolean;
  /** The manager's own tick counter, or `-1` before the first observed tick. */
  simTick: number;
  frames: number;
};

export type StepResult = {
  /** Renderer frames pumped. */
  frames: number;
  /** Simulation ticks run. */
  ticks: number;
};

type ManagerClockConfig = {
  /** Identifies this install, so an agent left over from an earlier one stays quiet. */
  token: string;
  /** How long a pumped frame waits for the loop to ask for it. */
  frameRequestTimeoutMs: number;
  /** How many catch-up frames `prime` may run before it gives up. */
  primeFrames: number;
  /** And how long it may spend running them. */
  primeTimeoutMs: number;
  runTick: number;
  runUpdate: number;
  stepMs: number;
  maxTicksPerFrame: number;
};

type RendererClockConfig = {
  token: string;
  frameRequestTimeoutMs: number;
  stepMs: number;
  setPaused: number;
  setSimulationSpeed: number;
  /** Bound for a stepping call, which can legitimately take minutes. */
  callTimeoutMs: number;
  /** Bound for a bookkeeping call, which should answer at once. */
  answerTimeoutMs: number;
};

/** Timeout for a step call, scaled by how much work it asks for. */
export function stepTimeoutMs(count: number): number {
  return Math.min(
    CALL_MAX_TIMEOUT_MS,
    CALL_BASE_TIMEOUT_MS + Math.max(0, count) * CALL_PER_TICK_MS,
  );
}

export function assertStepCount(count: number, label: string): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`${label} needs a non-negative whole number, got ${count}`);
  }
}

/** A `requestAnimationFrame` loop, taken over and driven by hand. */
type FramePump = {
  /** Has a real frame arrived to hand over the timestamp the loop last saw? */
  readonly armed: boolean;
  /** Frames pumped so far. */
  readonly frames: number;
  /** Where the pump has moved the loop's clock to. */
  readonly virtualMs: number;
  /** Advance the clock by `advanceMs`, and run the frame the loop asked for. */
  frame(advanceMs: number): Promise<void>;
  /** Give the loop back to the browser, along with any frame it is waiting on. */
  release(): void;
};

/**
 * Take over `requestAnimationFrame` wherever this runs, and return the pump
 * that drives it. The renderer and the manager worker each run one, and each
 * builds its own agent around it.
 *
 * One real frame is let through first: the loop measures the gap to the
 * timestamp it last saw, and only that frame can tell us what it was. Every
 * callback after it is captured, and runs when a test says so.
 *
 * This function is copied into the page on its own, so `label` and the timeout
 * arrive as arguments rather than from the module around it.
 */
function createFramePumpInPage(label: string, requestTimeoutMs: number): FramePump {
  const scope = globalThis;
  const realRequestAnimationFrame = scope.requestAnimationFrame;
  let queue: FrameRequestCallback[] = [];
  let armed = false;
  let virtualMs = 0;
  let frames = 0;

  // The loop asks for its next frame once its own work settles, so a pump can
  // arrive before the request does.
  let waiting: (() => void) | null = null;
  const capture = (callback: FrameRequestCallback) => {
    queue.push(callback);
    const resume = waiting;
    waiting = null;
    resume?.();
    return queue.length;
  };
  scope.requestAnimationFrame = (callback: FrameRequestCallback) =>
    realRequestAnimationFrame.call(scope, (time: number) => {
      virtualMs = time;
      scope.requestAnimationFrame = capture as typeof scope.requestAnimationFrame;
      armed = true;
      return callback(time);
    });

  const waitForRequest = () =>
    queue.length > 0
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`modkit clock (${label}): the loop asked for no frame`)),
            requestTimeoutMs,
          );
          waiting = () => {
            clearTimeout(timer);
            resolve();
          };
        });

  return {
    get armed() {
      return armed;
    },
    get frames() {
      return frames;
    },
    get virtualMs() {
      return virtualMs;
    },
    async frame(advanceMs: number): Promise<void> {
      if (!armed) {
        throw new Error(`modkit clock (${label}): no real frame arrived to arm the pump`);
      }
      await waitForRequest();
      const due = queue;
      queue = [];
      virtualMs += advanceMs;
      frames += 1;
      await Promise.all(due.map((callback) => callback(virtualMs)));
    },
    release(): void {
      scope.requestAnimationFrame = realRequestAnimationFrame;
      const due = queue;
      queue = [];
      for (const callback of due) realRequestAnimationFrame.call(scope, callback);
    },
  };
}

/**
 * Installed in the manager worker. Owns the simulation clock: one pumped frame
 * advances the manager's accumulator by an exact multiple of its fixed step, so
 * it runs exactly that many ticks.
 */
function installManagerClock(config: ManagerClockConfig): string {
  const scope = globalThis as typeof globalThis & { __modkitClock?: unknown };
  if (scope.__modkitClock) return "already";

  // The worker global, not the window shape the DOM lib assumes.
  const worker = self as unknown as {
    postMessage(data: unknown): void;
    addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
    removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  };
  const pump = createFramePumpInPage("manager", config.frameRequestTimeoutMs);
  const realPostMessage = MessagePort.prototype.postMessage;
  let simTick = -1;

  // Every tick the manager posts one `RunTick` (or `RunUpdate`) per worker
  // thread, and the manager's own tick counter rides along at index 5. That is
  // the engine's count of ticks actually run, not ours.
  MessagePort.prototype.postMessage = function patchedPostMessage(
    this: MessagePort,
    ...args: Parameters<MessagePort["postMessage"]>
  ) {
    const data = args[0];
    if (Array.isArray(data) && (data[0] === config.runTick || data[0] === config.runUpdate)) {
      if (typeof data[5] === "number") simTick = data[5];
    }
    return (realPostMessage as (...a: unknown[]) => void).apply(this, args);
  } as MessagePort["postMessage"];

  /**
   * Run until the first tick, which establishes the counter to step from.
   *
   * Stepping runs the loop's clock ahead of the wall clock, because a pumped
   * frame costs far less than the 1/60 s it represents. When real frames drive
   * the loop again they hand it a timestamp in the past, and the loop's
   * accumulator goes as far negative as the stepping ran ahead. Frames the size
   * of the loop's own clamp climb out of that debt quickly, because a frame that
   * leaves the accumulator below the threshold runs no tick at all.
   *
   * With no debt to climb, the first such frame runs the whole clamp: priming
   * costs up to `maxTicksPerFrame` ticks of simulation.
   */
  const prime = async (): Promise<number> => {
    const catchUpMs = config.maxTicksPerFrame * config.stepMs;
    const deadline = Date.now() + config.primeTimeoutMs;
    for (let attempt = 0; simTick < 0; attempt += 1) {
      if (attempt >= config.primeFrames || Date.now() > deadline) {
        throw new Error(
          `modkit clock (manager): ${attempt} catch-up frames ran no tick. The simulation is ` +
            "paused, or the worker protocol ids in modkit/test/clock.ts no longer match this build.",
        );
      }
      await pump.frame(catchUpMs);
    }
    return simTick;
  };

  const runTicks = async (count: number): Promise<{ ticks: number; frames: number }> => {
    await prime();
    const startTick = simTick;
    const startFrames = pump.frames;
    let stalled = 0;
    while (simTick - startTick < count) {
      const before = simTick;
      const remaining = count - (simTick - startTick);
      await pump.frame(Math.min(remaining, config.maxTicksPerFrame) * config.stepMs);
      if (simTick === before) {
        stalled += 1;
        if (stalled > 2) {
          throw new Error(
            "modkit clock (manager): pumped frames ran no tick. The simulation is paused, " +
              "or the worker protocol ids in modkit/test/clock.ts no longer match this build.",
          );
        }
      } else {
        stalled = 0;
      }
    }
    return { ticks: simTick - startTick, frames: pump.frames - startFrames };
  };

  const status = () => ({
    installed: true,
    armed: pump.armed,
    simTick,
    frames: pump.frames,
    virtualMs: pump.virtualMs,
  });

  const uninstall = () => {
    pump.release();
    MessagePort.prototype.postMessage = realPostMessage;
    // A listener left behind would answer for a later clock with stale numbers.
    worker.removeEventListener("message", onRequest);
    delete scope.__modkitClock;
    return "uninstalled";
  };

  const onRequest = (event: MessageEvent) => {
    const data = event.data;
    if (!Array.isArray(data) || data[0] !== "__modkit:clock" || data[1] !== config.token) return;
    const id = data[2];
    Promise.resolve()
      .then((): Promise<unknown> | unknown => {
        if (data[3] === "ticks") return runTicks(data[4]);
        if (data[3] === "prime") return prime();
        if (data[3] === "status") return status();
        if (data[3] === "uninstall") return uninstall();
        throw new Error(`modkit clock (manager): unknown request ${String(data[3])}`);
      })
      .then((value) => worker.postMessage(["__modkit:clock:done", config.token, id, null, value]))
      .catch((error: unknown) =>
        worker.postMessage([
          "__modkit:clock:done",
          config.token,
          id,
          error instanceof Error ? error.message : String(error),
        ]),
      );
  };
  worker.addEventListener("message", onRequest);

  scope.__modkitClock = { frame: pump.frame, prime, runTicks, status, uninstall };
  return "installed";
}

/**
 * Installed in the renderer. Owns the frame loop, and drives the manager clock
 * over the worker channel so one step is one frame and one tick.
 */
function installRendererClock(config: RendererClockConfig): string {
  const scope = globalThis as typeof globalThis & { __modkitClock?: unknown };
  if (scope.__modkitClock) return "already";

  type RendererState = {
    session: { paused: boolean; settings: { frameRateCap?: number } };
    environment: { multithreading: { simulation: { manager: Worker } } };
  };
  const state = () => sandkit.engine.state as unknown as RendererState;

  const pump = createFramePumpInPage("renderer", config.frameRequestTimeoutMs);

  // The frame loop skips its whole update while `paused`, and skips frames that
  // arrive faster than the cap. Both would swallow pumped frames.
  const prior = {
    paused: state().session.paused,
    frameRateCap: state().session.settings.frameRateCap,
  };
  const manager = () => state().environment.multithreading.simulation.manager;
  state().session.paused = false;
  state().session.settings.frameRateCap = 0;

  let nextId = 1;
  const inflight = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const onAnswer = (event: MessageEvent) => {
    const data = event.data;
    if (!Array.isArray(data) || data[0] !== "__modkit:clock:done" || data[1] !== config.token) {
      return;
    }
    const entry = inflight.get(data[2]);
    if (!entry) return;
    inflight.delete(data[2]);
    if (data[3]) entry.reject(new Error(String(data[3])));
    else entry.resolve(data[4]);
  };
  manager().addEventListener("message", onAnswer);

  const callManager = (op: string, arg?: unknown, timeoutMs?: number): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      inflight.set(id, { resolve, reject });
      manager().postMessage(["__modkit:clock", config.token, id, op, arg]);
      setTimeout(() => {
        if (inflight.delete(id)) {
          reject(new Error(`modkit clock: the manager worker never answered "${op}"`));
        }
      }, timeoutMs ?? config.callTimeoutMs);
    });

  const prime = async () =>
    (await callManager("prime", undefined, config.answerTimeoutMs)) as number;

  const simTicks = async (count: number) =>
    (await callManager("ticks", count)) as { ticks: number; frames: number };

  const renderFrames = async (count: number) => {
    for (let index = 0; index < count; index += 1) await pump.frame(config.stepMs);
    return { frames: count, ticks: 0 };
  };

  /** One frame then one tick, so renderer work and simulation work interleave. */
  const ticks = async (count: number, paceToWallClock = false) => {
    const startedAt = performance.now();
    let ran = 0;
    for (let index = 0; index < count; index += 1) {
      await pump.frame(config.stepMs);
      ran += (await simTicks(1)).ticks;
      if (!paceToWallClock) continue;
      const due = startedAt + (index + 1) * config.stepMs - performance.now();
      if (due > 0) await new Promise((resolve) => setTimeout(resolve, due));
    }
    return { frames: count, ticks: ran };
  };

  const status = async () => {
    const managerStatus = (await callManager("status", undefined, config.answerTimeoutMs)) as {
      armed: boolean;
      simTick: number;
    };
    return {
      installed: true,
      armed: pump.armed && managerStatus.armed,
      simTick: managerStatus.simTick,
      frames: pump.frames,
    };
  };

  const uninstall = async () => {
    await callManager("uninstall", undefined, config.answerTimeoutMs).catch(() => undefined);
    // A listener left behind would answer for a later clock with stale numbers.
    manager().removeEventListener("message", onAnswer);
    pump.release();
    pauseEngineInPage(prior.paused, config.setPaused);
    if (typeof prior.frameRateCap === "number") {
      state().session.settings.frameRateCap = prior.frameRateCap;
    }
    delete scope.__modkitClock;
    return "uninstalled";
  };

  scope.__modkitClock = {
    frame: pump.frame,
    prime,
    ticks,
    simTicks,
    renderFrames,
    status,
    uninstall,
  };
  return "installed";
}

/**
 * Replaces `Math.random` with a seeded generator, in whichever context it is
 * evaluated. Installed once, then reset on every later call.
 *
 * The engine draws random numbers as it ticks: the manager picks a scan offset
 * it passes into every worker's update, and the workers draw their own. So
 * stepping alone does not make a scenario repeatable, and seeding the same value
 * in every context before each run does.
 */
function seedRandom(seed: number): number {
  const scope = globalThis as typeof globalThis & {
    __modkitRandom?: { reset(value: number): void };
  };
  if (!scope.__modkitRandom) {
    let state = 0;
    scope.__modkitRandom = {
      reset(value: number) {
        state = value >>> 0;
      },
    };
    // mulberry32: small, fast, and good enough to make a test repeatable.
    Math.random = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  scope.__modkitRandom.reset(seed);
  return seed;
}

/**
 * Call a method on the clock the renderer agent published.
 *
 * `optional` is for the callers that treat a missing clock as an answer rather
 * than a failure: teardown, where the page may have reloaded since the last
 * call, and the poll that waits for a fresh install to arm.
 */
function callClockAgentInPage(
  method: string,
  args: readonly unknown[],
  optional: boolean,
): unknown {
  const clock = (globalThis as typeof globalThis & { __modkitClock?: ClockAgent }).__modkitClock;
  if (!clock) {
    if (optional) return null;
    throw new Error("modkit clock is not installed");
  }
  const call = (clock as unknown as Record<string, unknown>)[method];
  if (typeof call !== "function") throw new Error(`modkit clock has no ${method}()`);
  return (call as (...rest: unknown[]) => unknown).apply(clock, [...args]);
}

/** What the renderer agent publishes on `globalThis.__modkitClock`. */
type ClockAgent = {
  frame(advanceMs: number): Promise<void>;
  prime(): Promise<number>;
  ticks(count: number, paceToWallClock?: boolean): Promise<StepResult>;
  simTicks(count: number): Promise<StepResult>;
  renderFrames(count: number): Promise<StepResult>;
  status(): Promise<ClockStatus>;
  uninstall(): Promise<string>;
};

type ClockAgentMethod = keyof ClockAgent;

/**
 * Steps the game by exact frames and ticks instead of by wall-clock time.
 * Reach it through `SandustrySession.clock`.
 */
export class SimulationClock {
  private readonly cdp: CdpConnection;
  private installed: boolean | null = null;

  constructor(cdp: CdpConnection) {
    this.cdp = cdp;
  }

  /**
   * Take over both frame loops. Idempotent, and a clock another test file left
   * installed is adopted rather than reinstalled.
   */
  async install(options?: { settleTicks?: number }): Promise<void> {
    if (await this.isInstalled()) {
      // An earlier file may have left a working clock, or a broken one.
      try {
        await this.status();
        return;
      } catch {
        await this.uninstall();
      }
    }
    // Nothing advances on its own once the pump owns both loops, so the engine's
    // own pause flag only gets in the way, and ticks are counted in fixed steps,
    // so the speed multiplier has to be 1. Both are restored on uninstall.
    await this.cdp.evaluate(toPageExpression(pauseEngineInPage, [false, WORKER_MESSAGE.SetPaused]));
    await this.cdp.evaluate(
      toPageExpression(setSimulationSpeedInPage, [WORKER_MESSAGE.SetSimulationSpeed, 1]),
    );
    const manager = await this.cdp.workerSession("manager-worker");
    const token = `modkit-clock-${randomUUID()}`;
    await this.cdp.evaluate(
      toPageExpression(
        installManagerClock,
        [
          {
            token,
            frameRequestTimeoutMs: FRAME_REQUEST_TIMEOUT_MS,
            primeFrames: PRIME_FRAME_BUDGET,
            primeTimeoutMs: PRIME_TIMEOUT_MS,
            runTick: WORKER_MESSAGE.RunTick,
            runUpdate: WORKER_MESSAGE.RunUpdate,
            stepMs: SIMULATION_STEP_MS,
            maxTicksPerFrame: MAX_TICKS_PER_FRAME,
          } satisfies ManagerClockConfig,
        ],
        { include: [createFramePumpInPage] },
      ),
      { sessionId: manager.sessionId },
    );
    await this.cdp.evaluate(
      toPageExpression(
        installRendererClock,
        [
          {
            token,
            frameRequestTimeoutMs: FRAME_REQUEST_TIMEOUT_MS,
            stepMs: SIMULATION_STEP_MS,
            setPaused: WORKER_MESSAGE.SetPaused,
            setSimulationSpeed: WORKER_MESSAGE.SetSimulationSpeed,
            callTimeoutMs: CALL_MAX_TIMEOUT_MS,
            answerTimeoutMs: CALL_BASE_TIMEOUT_MS,
          } satisfies RendererClockConfig,
        ],
        { include: [pauseEngineInPage, createFramePumpInPage] },
      ),
    );
    this.installed = true;
    await this.waitUntilArmed();
    await this.proveTickCounter();
    const settle = options?.settleTicks ?? DEFAULT_SETTLE_TICKS;
    if (settle > 0) await this.ticks(settle);
  }

  /** Does this page already have a clock installed (by this file or another)? */
  async isInstalled(): Promise<boolean> {
    this.installed ??= Boolean(
      await this.cdp.evaluate(
        toPageExpression(
          () =>
            Boolean((globalThis as typeof globalThis & { __modkitClock?: unknown }).__modkitClock),
          [],
        ),
      ),
    );
    return this.installed;
  }

  /**
   * Hand both loops back to the browser.
   *
   * Stepping runs the game's clock ahead of the wall clock, so a game handed
   * back this way idles until wall time catches up with the time already
   * stepped. That is fine for teardown; a later `install()` steps out of the
   * debt on its own.
   */
  async uninstall(): Promise<void> {
    if (!(await this.isInstalled())) return;
    await this.callAgent("uninstall", [], { timeoutMs: stepTimeoutMs(0), optional: true });
    this.installed = false;
  }

  /** Step `count` renderer frames, each followed by one simulation tick. */
  async ticks(count: number): Promise<StepResult> {
    assertStepCount(count, "clock.ticks()");
    await this.install();
    return this.step("ticks", count);
  }

  /** Step the simulation only. The renderer does not advance. */
  async simTicks(count: number): Promise<StepResult> {
    assertStepCount(count, "clock.simTicks()");
    await this.install();
    return this.step("simTicks", count);
  }

  /** Step the renderer only. It hands queued world writes on; a tick applies them. */
  async renderFrames(count: number): Promise<StepResult> {
    assertStepCount(count, "clock.renderFrames()");
    await this.install();
    return this.step("renderFrames", count);
  }

  async status(): Promise<ClockStatus> {
    if (!(await this.isInstalled())) {
      return { installed: false, armed: false, simTick: -1, frames: 0 };
    }
    return (await this.callAgent("status", [], { timeoutMs: CALL_BASE_TIMEOUT_MS })) as ClockStatus;
  }

  /** The manager's own tick counter. */
  async simTick(): Promise<number> {
    return (await this.status()).simTick;
  }

  /**
   * Seed `Math.random` in the renderer and in every game worker, so a scenario
   * repeats. Call it before each run you want to compare: stepping fixes *when*
   * the game advances, and this fixes the choices it makes while advancing.
   */
  async seed(value: number = DEFAULT_SEED): Promise<void> {
    if (!Number.isInteger(value)) {
      throw new Error(`clock.seed() needs a whole number, got ${value}`);
    }
    // Attaching to the manager also attaches every other worker target.
    await this.cdp.workerSession("manager-worker");
    const expression = toPageExpression(seedRandom, [value]);
    await this.cdp.evaluate(expression);
    for (const worker of this.cdp.attachedWorkers()) {
      await this.cdp.evaluate(expression, { sessionId: worker.sessionId });
    }
  }

  /**
   * Advance the game by as much as `durationMs` of wall-clock time would, and
   * take that long doing it.
   *
   * The escape hatch for a check that has to line up with something outside the
   * game's own loops, such as a timer in a mod. It still steps, so the tick
   * count stays exact; it just refuses to run faster than the clock on the wall.
   */
  async withRealTime(durationMs: number): Promise<StepResult> {
    assertStepCount(Math.round(durationMs), "clock.withRealTime()");
    await this.install();
    const count = Math.round(durationMs / SIMULATION_STEP_MS);
    return (await this.callAgent("ticks", [count, true], {
      timeoutMs: stepTimeoutMs(count) + durationMs,
    })) as StepResult;
  }

  /** Every call into the renderer agent goes through here. */
  private async callAgent(
    method: ClockAgentMethod,
    args: readonly unknown[],
    options: { timeoutMs: number; optional?: boolean },
  ): Promise<unknown> {
    return this.cdp.evaluate(
      toPageExpression(callClockAgentInPage, [method, args, options.optional === true]),
      { timeoutMs: options.timeoutMs },
    );
  }

  private async step(
    method: "ticks" | "simTicks" | "renderFrames",
    count: number,
  ): Promise<StepResult> {
    return (await this.callAgent(method, [count], {
      timeoutMs: stepTimeoutMs(count),
    })) as StepResult;
  }

  private async waitUntilArmed(): Promise<void> {
    const deadline = Date.now() + ARM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const status = (await this.callAgent("status", [], {
        timeoutMs: CALL_BASE_TIMEOUT_MS,
        optional: true,
      }).catch(() => null)) as ClockStatus | null;
      if (status?.armed === true) return;
      await new Promise((resolve) => setTimeout(resolve, ARM_POLL_MS));
    }
    throw new Error(
      "modkit clock: no animation frame arrived within " +
        `${ARM_TIMEOUT_MS} ms. The page may be throttled or the game may not be running.`,
    );
  }

  /** One step has to move the engine's own tick counter by exactly one. */
  private async proveTickCounter(): Promise<void> {
    const before = (await this.callAgent("prime", [], {
      timeoutMs: PRIME_TIMEOUT_MS + CALL_BASE_TIMEOUT_MS,
    })) as number;
    const stepped = await this.step("ticks", 1);
    const after = await this.simTick();
    if (stepped.ticks !== 1 || after - before !== 1) {
      throw new Error(
        `modkit clock: one step ran ${stepped.ticks} ticks and moved the engine counter from ` +
          `${before} to ${after}. Expected exactly 1 of each.`,
      );
    }
  }
}
