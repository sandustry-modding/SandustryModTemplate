# Live config

Tunable numbers and flags for a mod.
The values live on a named `globalThis` key.
The F3 debug overlay edits them.

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
});

export const config = treesLiveConfig.config;
```

Call `createLiveConfig` from `main.ts` (and `worker.ts` when workers read the values).

Read `config.oakTrunkHeight` in the function that uses it.

## UI

Turn on **F3 debug overlay** in **Options → Mods → Dev Tools**.
Press **F3**.
The live-config panel is in the top-left.
Pick the mod.
Change a field.
**Reset** restores defaults.

The panel lists every handle registered on `globalThis.modkitLiveConfig`.
Field names in the panel are the raw config keys.

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
Edits on the F3 panel write a `float64` shared buffer (`modkit:live-config:<id>`).
Worker `get()` copies those slots onto the live object.
`listen` still applies `modkit:live-config` event payloads when they arrive on that thread.

Densities and structure shapes that run only at register time still apply at load.

## Field meta

`createLiveConfig` keeps the raw object keys as labels.
It groups keys by prefix (`debug`, `pine`, `oak`, `wood`, `compost` / `dirt` / `wet`, `sieve`).
Chance and grow-start numbers get min `0` and max `1`.

Override `fields` when a group or range must differ.
