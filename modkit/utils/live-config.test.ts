import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIVE_CONFIG_GLOBAL,
  createLiveConfig,
  humanizeLiveConfigKey,
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

test("humanizeLiveConfigKey splits camelCase", () => {
  assert.equal(humanizeLiveConfigKey("oakTrunkHeight"), "Oak trunk height");
});

test("inferLiveConfigGroup uses key prefixes", () => {
  assert.equal(inferLiveConfigGroup("debug"), "Debug");
  assert.equal(inferLiveConfigGroup("pineTrunkHeight"), "Pine");
  assert.equal(inferLiveConfigGroup("oakLeafTipRadius"), "Oak");
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
