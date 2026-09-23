# Template

Starter mod in `src/`.
Shows a toast when the mod loads.
Feature folders follow the same `register` / `registerMain` / `registerWorker` shape as content mods.

## Use

1. Enable the mod.
2. Load the **Template** Void save (F5 **Sandustry** opens the newest save in that world).
3. Look for the toast: **Template loaded**.
4. Press **Alt+E** for the overlay, or **T** for the input toast.

## Edit this mod

Set `id`, `name`, `author`, and `description` in `modinfo.ts`.
Keep `main.ts` as a list of `register()` calls behind `isEnabled()`.
Put extra source in feature folders, not next to `main.ts`.
Restart the game after `worker.ts` or `patches.ts` changes.

Copy `src/template/` to `src/<your-mod>/` when you want a second mod.

## Features

| Folder        | What it shows                                                        |
| ------------- | -------------------------------------------------------------------- |
| `boot/`       | Toast on load                                                        |
| `spark-dust/` | Custom powder, grabber hook, smelter recipe, worker `element:update` |
| `chalk/`      | Custom terrain                                                       |
| `beacon/`     | Structure plus processing (`mod/beacon.png`)                         |
| `contact/`    | Spark Dust + water → steam                                           |
| `ui/`         | Overlay (**Alt+E**) and a management-menu row (**F1**)               |
| `input/`      | Key binding (**T**)                                                  |
| `runtime/`    | `game:ready`, storage, triggers, escape hook, `schedule.nextTick`    |
| `config.ts`   | F3 live-config knobs                                                 |

Optional `patches.ts` at the mod root: see [Patches](https://sandustry-modding.github.io/#/patches).
Prefer Sandkit before patches.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
