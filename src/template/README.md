# Template

Starter mod in `src/`.
Shows a toast when the mod loads.
Feature folders use `register` / `registerMain` / `registerWorker`.

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
| `element/`    | Custom powder, grabber hook, smelter recipe, contact, worker update  |
| `terrain/`    | Custom terrain                                                       |
| `structure/`  | Buildable 4×4 block with a 1s processing tick (`mod/structure.png`)  |
| `ui/`         | Overlay (**Alt+E**)                                                  |
| `input/`      | Key binding (**T**)                                                  |
| `shared/`     | Ids and F3 live-config knobs                                         |

Optional `patches.ts` at the mod root: see [Patches](https://sandustry-modding.github.io/#/patches).
Prefer Sandkit before patches.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
