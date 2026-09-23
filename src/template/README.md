# Template

Starter mod in `src/`.
Feature folders use `register` / `registerWorker`.

## Use

1. Enable the mod.
2. Load the **Template** Void save (F5 **Sandustry** opens the newest save in that world).
3. Press **Alt+E** for the overlay.

## Edit this mod

Set `id`, `name`, `author`, and `description` in `modinfo.ts`.
Keep `main.ts` as a list of `register()` calls behind `isEnabled()`.
Put extra source in feature folders, not next to `main.ts`.
Keep worker code in `worker.ts` or `*.worker.ts`; do not import those files from `main.ts`.
Restart the game after `worker.ts` or `patches.ts` changes.

Copy `src/template/` to `src/<your-mod>/` when you want a second mod.

## Features

| Folder        | What it shows                                                        |
| ------------- | -------------------------------------------------------------------- |
| `element/`    | Custom powder, smelter recipe, contact, worker update                |
| `terrain/`    | Custom terrain                                                       |
| `structure/`  | Buildable 4×4 block with a 1s processing tick (`mod/structure.png`)  |
| `ui/`         | Overlay (**Alt+E**)                                                  |
| `input/`      | Key binding (**T**)                                                  |
| `shared/`     | Shared ids                                                           |

Optional `patches.ts` at the mod root: see [Patches](https://sandustry-modding.github.io/#/patches).
Prefer Sandkit before patches.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
