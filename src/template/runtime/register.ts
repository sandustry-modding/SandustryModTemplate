import { modinfo } from "../modinfo.ts";

const api = sandkit.api;

/** Events, storage, triggers, and a main-thread hook. */
export function register(): void {
  api.events.on("game:ready", () => {
    console.log(`${modinfo.id} game:ready`);
  });

  const bag = api.storage.ensure(modinfo.id);
  const loadCount = typeof bag.loadCount === "number" ? bag.loadCount + 1 : 1;
  bag.loadCount = loadCount;
  api.storage.set(modinfo.id, "lastLoadedAt", Date.now());

  api.triggers.register(`${modinfo.id}:heartbeat`, {
    interval: 300,
    callback: () => {
      console.log(`${modinfo.id} trigger heartbeat`);
    },
  });

  api.hooks.intercept("input:escape", () => {
    console.log(`${modinfo.id} input:escape`);
  });

  api.schedule.nextTick(() => {
    api.grid.mutate((_writer) => {
      console.log(`${modinfo.id} schedule.nextTick mutate`);
    });
  });
}
