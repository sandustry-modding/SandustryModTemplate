import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIVE_CONFIG_GLOBAL,
  buildLiveConfigFields,
  createLiveConfig,
  formatLiveConfigDefaults,
  inferLiveConfigGroup,
  listLiveConfigs,
  liveConfigRegistry,
} from "./live-config.ts";

type Host = typeof globalThis & {
  [LIVE_CONFIG_GLOBAL]?: unknown;
  demoCfg?: Record<string, unknown>;
};

function host(): Host {
  return globalThis as Host;
}

function resetHost(): void {
  delete host()[LIVE_CONFIG_GLOBAL];
  delete host().demoCfg;
}

test("buildLiveConfigFields uses raw keys as labels", () => {
  const fields = buildLiveConfigFields({ oakTrunkHeight: 48, debug: false });
  assert.equal(fields.find((field) => field.key === "oakTrunkHeight")?.label, "oakTrunkHeight");
  assert.equal(fields.find((field) => field.key === "debug")?.label, "debug");
});

test("inferLiveConfigGroup uses key prefixes", () => {
  assert.equal(inferLiveConfigGroup("debug"), "debug");
  assert.equal(inferLiveConfigGroup("pineTrunkHeight"), "pine");
  assert.equal(inferLiveConfigGroup("oakLeafTipRadius"), "oak");
});

test("formatLiveConfigDefaults emits a grouped defaults object", () => {
  resetHost();
  const live = createLiveConfig({
    id: "demo.mod",
    title: "Demo",
    globalKey: "demoCfg",
    defaults: { debug: false, oakTrunkHeight: 48, pineTrunkBaseGrowStart: 0.45 },
  });
  live.set("oakTrunkHeight", 36);
  const text = formatLiveConfigDefaults(listLiveConfigs()[0]!);
  assert.match(text, /{\n  debug: false,/);
  assert.match(text, /\n\n  pineTrunkBaseGrowStart: 0\.45,/);
  assert.match(text, /\n\n  oakTrunkHeight: 36\n}/);
});

test("createLiveConfig installs defaults on the named global", () => {
  resetHost();
  const live = createLiveConfig({
    id: "demo.mod",
    title: "Demo",
    globalKey: "demoCfg",
    defaults: { oakTrunkHeight: 48, debug: false },
  });
  assert.equal(live.get().oakTrunkHeight, 48);
  assert.equal(host().demoCfg, live.get());
  assert.equal(listLiveConfigs().length, 1);
  assert.equal(listLiveConfigs()[0]?.title, "Demo");
});

test("config mutations write through the global and notify", () => {
  resetHost();
  const live = createLiveConfig({
    id: "demo.mod",
    title: "Demo",
    globalKey: "demoCfg",
    defaults: { oakTrunkHeight: 48, debug: false },
  });
  let ticks = 0;
  const stop = liveConfigRegistry().subscribe(() => {
    ticks += 1;
  });
  live.config.oakTrunkHeight = 20;
  assert.equal(host().demoCfg?.oakTrunkHeight, 20);
  assert.equal(live.get().oakTrunkHeight, 20);
  assert.ok(ticks >= 1);
  live.reset();
  assert.equal(live.get().oakTrunkHeight, 48);
  stop();
});

test("replacing the global overlays defaults", () => {
  resetHost();
  const live = createLiveConfig({
    id: "demo.mod",
    title: "Demo",
    globalKey: "demoCfg",
    defaults: { oakTrunkHeight: 48, debug: false },
  });
  host().demoCfg = { debug: true, oakTrunkHeight: 12 };
  const next = live.get();
  assert.equal(next.debug, true);
  assert.equal(next.oakTrunkHeight, 12);
});

test("listen applies matching payloads", () => {
  resetHost();
  const live = createLiveConfig({
    id: "demo.mod",
    title: "Demo",
    globalKey: "demoCfg",
    defaults: { oakTrunkHeight: 48, debug: false },
  });
  const listeners: ((payload: unknown) => void)[] = [];
  live.listen({
    events: {
      on(_eventId, callback) {
        listeners.push(callback);
        return () => {};
      },
    },
  });
  listeners[0]?.({ id: "demo.mod", values: { oakTrunkHeight: 9 } });
  assert.equal(live.get().oakTrunkHeight, 9);
  listeners[0]?.({ id: "other.mod", values: { oakTrunkHeight: 1 } });
  assert.equal(live.get().oakTrunkHeight, 9);
});

test("main set writes a shared float64 buffer for workers", () => {
  resetHost();
  const slots = new Float64Array(3);
  const g = globalThis as { sandkit?: unknown };
  const previous = g.sandkit;
  g.sandkit = {
    api: {
      events: { emit() {} },
      shared: {
        buffers: {
          ensure() {
            return slots;
          },
        },
      },
    },
  };
  try {
    const live = createLiveConfig({
      id: "demo.mod",
      title: "Demo",
      globalKey: "demoCfg",
      defaults: { oakTrunkHeight: 48, debug: false },
    });
    assert.ok(slots[0] > 0);
    assert.equal(slots[1], 48);
    assert.equal(slots[2], 0);
    live.set("oakTrunkHeight", 11);
    assert.equal(slots[1], 11);
    live.set("debug", true);
    assert.equal(slots[2], 1);
  } finally {
    if (previous === undefined) delete g.sandkit;
    else g.sandkit = previous;
  }
});

test("worker get copies slots from the shared buffer", () => {
  resetHost();
  const slots = new Float64Array([1, 11, 1]);
  const g = globalThis as { sandkit?: unknown };
  const previous = g.sandkit;
  g.sandkit = {
    api: {
      events: { emit() {} },
      shared: {
        buffers: {
          require() {
            return slots;
          },
        },
      },
    },
  };
  try {
    const live = createLiveConfig({
      id: "demo.worker",
      title: "Demo",
      globalKey: "demoCfg",
      defaults: { oakTrunkHeight: 48, debug: false },
    });
    assert.equal(live.get().oakTrunkHeight, 11);
    assert.equal(live.get().debug, true);
    assert.equal(slots[1], 11);
  } finally {
    if (previous === undefined) delete g.sandkit;
    else g.sandkit = previous;
  }
});
