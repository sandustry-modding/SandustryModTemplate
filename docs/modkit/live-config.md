# Live config

Tunable numbers and flags for a mod.
The values live on a named `globalThis` key.
The Dev Tools pause panel **Config** tab edits them.

Player Options still use [`configSchema`](../config-schema.md).
Use live config for debug knobs, not for shipped player settings.

## Register

```ts
import { createLiveConfig } from "@modkit/utils";

export const treesLiveConfig = createLiveConfig({
  id: "irishbruse.trees",
  title: "Trees",
  globalKey: "irishbruseTrees",
  defaults: {
    debug: false,
    oakTrunkHeight: 48,
  },
  fields: {
    debug: {
      label: "Fast growth",
      description: "Place more trunk rows each tick.",
    },
  },
});

export const config = treesLiveConfig.config;
```

Call `createLiveConfig` from `main.ts` (and `worker.ts` when workers read the values).

Read `config.oakTrunkHeight` in the function that uses it.

## UI

Pause the game.
Open **Dev Tools**.
Open the **Config** tab.
Pick the mod.
Change a field.
**Reset** restores defaults.

The tab lists every handle registered on `globalThis.modkitLiveConfig`.

## Console

```js
irishbruseTrees.oakTrunkHeight = 36;
irishbruseTrees.debug = true;
```

Replace the object to overlay defaults:

```js
irishbruseTrees = { debug: true };
```

## Workers

The sim worker has its own `globalThis`.
In `worker.ts` call `handle.get()` and `handle.listen(api)`.
The Config tab emits `modkit:live-config` with `{ id, values }`.
The worker listener copies matching values onto its live object.

Densities and structure shapes that run only at register time still apply at load.

## Field meta

`createLiveConfig` builds labels from camelCase keys.
It groups keys by prefix (`debug`, `pine`, `oak`, `wood`, `compost` / `dirt` / `wet`, `sieve`).
Chance and grow-start numbers get min `0` and max `1`.

Override `fields` when a label, group, or range must differ.
