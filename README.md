# Sandustry Mod Template

> [!WARNING]
> **Unofficial** community docs.
> Not affiliated with Lantto Games, Hooded Horse, or the [official Sandustry wiki](https://wiki.hoodedhorse.com/Sandustry/Sandustry_Official_Wiki).
> See the [official Sandkit docs](https://sandustry.com/sandkit.html).

TypeScript template for [Sandustry](https://store.steampowered.com/app/2764460/Sandustry/) mods (Steam **[mods]** beta).
Browse mods on the [Workshop](https://steamcommunity.com/app/2764460/workshop/).
Kit and API pages: [docs site](https://ethanconneely.com/SandustryModTemplate/).

## Features

- **Multi-mod** — One repo, many mods.
  Each `src/<name>/` or cloned `examples/<name>/` with a `modinfo.ts` builds to its own game folder.
- **[TypeScript](https://sandustry-modding.github.io/SandustryTypes/#/)** — Sandkit API types (`@sandustry-modding/types`)
- **[React HUD](docs/modkit/react.md)** — JSX via `sandkit.react`, plus the [UI kit gallery](docs/ui/README.md)
- **[Watch rebuild](docs/builds.md)** — `npm run dev` writes `main.js` to the game mods folder
- **[Typed `modinfo.ts`](docs/modinfo.md)** — Manifest fields.
  Optional [patches](docs/patches.md) from the same folder

## Quick start

Need **Node 24** and Sandustry with the **[mods]** beta (Library → Properties → Betas).

```bash
git clone https://github.com/IrishBruse/SandustryModTemplate.git
cd SandustryModTemplate
npm install
npm run setup
npm run dev
```

Then **F5** in VS Code (or `npm run sandustry`). **Sandustry** shows a Quick Pick of one mod, then opens the **newest save** in that mod’s Steam test world (`modinfo.id`, 1024×1024). `npm run dev` watches that one folder.
Other OS mods stay installed.
Load Game lists that id on the left (**WORLDS**).
In-game Save, quicksave, and autosave for that session appear on the right under that world.
Continue for your campaign stays on last-played.
F5 does not change last-played. `npm run setup` creates the Steam test world when it is missing and does not overwrite it.
It does not put a `.save` in the mod folder. **Sandustry (all mods)** starts every selected mod and Continues.
In game, look for **Template loaded**. **Alt+E** opens the overlay sample after `npm run examples` (`examples/overlay-hotkey`).

Windows: the same commands work in PowerShell.
If setup cannot find the game:

```powershell
$env:SANDUSTRY="C:\Program Files (x86)\Steam\steamapps\common\Sandustry\Sandustry.exe"
npm run setup
```

If a mod has its own `package.json`, run `npm install` in that folder too.
Root `npm install` does not do this.

Keep `npm run dev` running.
Save a file.
The watch rebuilds `main.js` into the game mods folder.
Restart the game for workers and patches.

### Your own mod

1. Open `src/template/`.
2. Set `id`, `name`, and `author` in `modinfo.json` ([field list](docs/modinfo.md)).
3. Edit `main.ts`.
  Put extra source in feature folders, not next to `main.ts`.
4. Copy `src/template/` to `src/<your-mod>/` when you want a second mod.

Do not import files from another mod folder.
Shared code goes in `modkit/`.

## Commands

### Setup and game

- **`npm run setup`** — Check install, extract `app.asar` (except `node_modules/`) to `sandustry/source/`, link `dist/`, `sandustry/logs/`, `sandustry/saves/`, and `sandustry/workshop/`
- **`npm run sandustry`** — Stop and launch the game (no build).
  Set `SANDUSTRY_MONITOR` in `.env` to pick a display (`left`, `right`, `primary`, or `0`, `1`, …).

### Development

- **`npm run dev`** — Watch the F5 / `dev:pick` set (plus any companions from `.env` `DEV_ALWAYS_MODS`).
  Mods stay in `dist/` unless `DEV_CLEANUP=true` (owned only) or `DEV_CLEANUP=all`.
  F5 **Sandustry** writes that one folder and does not uninstall other OS mods.
- **`npm run dev:release`** — Same watch as `dev`, without `debugPatches` or sourcemaps.
  Use to test mods before upload to workshop.
- **`npm run dev:pick`** — Same as `dev`, with a TTY picker first
- **`npm run examples`** — Clone [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples) into `examples/` if that folder is missing, then watch those mods (optional `--mod <name>`)

### Release

- **`npm run build`** — Release all `src/` mods to `build/<modinfo.id>/` (Workshop staging)
- **`npm run publish`** — Runs `npm run build`, then SteamCMD upload

### Quality

- **`npm run typecheck`** — TypeScript check
- **`npm run test`** — Unit tests only (`*.test.ts`).
  No Chromium.
- **`npm run test:integration`** — Build mods, boot extracted dist in headless Chromium (CDP `:9224`), run `*.integration.test.ts`.
  Optional mod folder (`nr test:integration template`) or `--examples` (clones sample mods when `examples/` is missing).
  Use **`npm run test:integration:view`** for a visible window (`nr test:integration:view collector-element`).
- **`npm run lint`** — Typecheck, oxlint, and format check
- **`npm run lint:fix`** — oxlint `--fix` and oxfmt

### Docs

- **`npm run docs`** — Serve Docsify on `docs/`

Build flags, Workshop upload, and Tailwind details: [Builds](docs/builds.md).

## Folder layout

Each `src/<name>/`, `mods/<name>/`, or `examples/<name>/` folder with a `modinfo.json` is one game mod.
Put shared code in `modkit/`.
Do not import files from another mod folder.

| Path                  | What it is                                                     |
| --------------------- | -------------------------------------------------------------- |
| `src/<name>/`         | Your mod (`modinfo.json` + `main.ts`)                          |
| `mods/<name>/`        | Optional private mods (gitignored)                             |
| `examples/<name>/`    | Sample mods (cloned, gitignored)                               |
| `modkit/`             | Shared kit. Import as `@modkit/*`                              |
| `dist/`               | Link to the Sandustry mods folder on disk                      |
| `build/<modinfo.id>/` | Workshop staging (copied on `npm run build`)                   |
| `sandustry/`          | Local game extract and OS folder links (gitignored; see below) |

`mods/` is optional and gitignored, with the same `modinfo` rules as `src/`. `npm run build`, `npm run dev`, and `npm run publish` include it. `examples/` is gitignored. `npm run examples` clones [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples) into that folder when it is missing.
This repo also ignores `src/irishbruse.*/`; those mods keep their own repos (`README.md` and `CHANGELOG.md` in that repo).

The game folder and Workshop staging use the `id` field in `modinfo.json`, not the repo folder name or display `name`.
`dist/` points at the OS mods folder.
Each built mod lives at `dist/<modinfo.id>/`.
Release staging is `build/<modinfo.id>/`.

You do not copy files into the game folder by hand. `npm run dev` and `npm run build` write them.

### `sandustry/`

`npm run setup` creates this folder.
It is gitignored.
Do not edit it by hand; run setup again after a game update.

| Path                  | What it is                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sandustry/source/`   | Extract of `app.asar` (except `node_modules/`). Refreshed on every setup. Read `package.json` for the game version. Use `dist/js/bundle.js` (or `.formatted-source/bundle.js` when present) for [patch](docs/patches.md) `find` strings. Integration tests boot `source/dist`. |
| `sandustry/logs/`     | Link to OS Sandustry logs (`main.log`, …)                                                                                                                                                                                                                                      |
| `sandustry/saves/`    | Link to OS save files                                                                                                                                                                                                                                                          |
| `sandustry/workshop/` | Link to Steam Workshop content for app **2764460**                                                                                                                                                                                                                             |

Older `sandustry/<version>-<branch>/` folders from prior template versions are removed on the next setup.

### Game folders on disk

| OS      | Mods                                    | Saves                       | Logs                       |
| ------- | --------------------------------------- | --------------------------- | -------------------------- |
| Linux   | `~/.config/sandustry/mods/<modinfo.id>` | `~/.config/sandustry/saves` | `~/.config/sandustry/logs` |
| Windows | `%APPDATA%\sandustry\mods\<modinfo.id>` | `%APPDATA%\sandustry\saves` | `%APPDATA%\sandustry\logs` |

`dist/` links to the Mods column. `sandustry/saves/`, `sandustry/logs/`, and `sandustry/workshop/` link to the matching OS (or Steam) paths above.
Workshop items live under `steamapps/workshop/content/2764460` in the Steam library that holds the game.

### Sample mods

Start from [`src/template/`](src/template/).
Sample mods live in [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples).
Run `npm run examples` to clone them into `examples/`, then copy a folder into `src/<your-mod>/`.

Mods in `src/` that ship with this template:

| Folder                      | What it shows                                                                 |
| --------------------------- | ----------------------------------------------------------------------------- |
| [`template`](src/template/) | Starter mod. Toast on load. Change `id` / `name` / `author` in `modinfo.json` |

### Files in a mod folder

Every mod under `src/<name>/`, `mods/<name>/`, or `examples/<name>/` needs these files:

| File           | Role                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| `modinfo.json` | JSON manifest with `$schema` for IDE validation. See [Mod manifest](docs/modinfo.md)  |
| `modinfo.ts`   | TypeScript manifest (`defineModInfo` or `modinfoFromJson`). Optional patch re-exports |
| `main.ts`      | Mod entry                                                                             |

The repo has one [`tsconfig.json`](tsconfig.json).
TypeScript checks `modkit/`, `src/`, `examples/`, and `mods/` together (`moduleDetection` is `force` so script-style `main.ts` files do not clash).
The build still blocks imports from another mod folder.

Keep extra TypeScript out of the mod root.
Only `modinfo.json` and/or `modinfo.ts`, `main.ts`, optional `worker.ts`, and optional `patches.json` / `patches.ts` may sit at the mod root.
Put other source files in feature folders (`ui/`, `health/`, `capture/`, …).

Add these when you need them:

| File                         | Role                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `worker.ts`                  | Worker entry at the mod root. The build writes `worker.js`                                |
| `patches.json`               | Optional patch list (JSON array). See [Patches](docs/patches.md).                         |
| `patches.ts`                 | Optional patch list (`definePatches`). See [Patches](docs/patches.md).                    |
| `ui/`                        | React overlays                                                                            |
| Feature folders              | Other source files (`health/`, `capture/`, …). Keep tests next to the file they test      |
| `mod/`                       | Static files copied into the output folder.                                               |
| `package.json`               | Optional. npm packages for this mod only. Run `npm install` in that folder yourself       |
| `README.md` / `CHANGELOG.md` | Player docs and Steam notes. Publish reads `CHANGELOG.md`; builds do not copy these files |
| `workshop/`                  | Workshop assets (`workshop.json`, previews, `workshop.md`, `screenshots/`)                |

### What you import

Import `@modkit/*` and files in your own folder only.

| Import                                        | From                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@modkit/modinfo`                             | `defineModInfo`                                                                          |
| `@modkit/patches`                             | `definePatches` and patch types. Browser stub keeps payloads out of `main.js`            |
| `@modkit/react` / JSX                         | Runtime React from `sandkit.react`                                                       |
| `@modkit/utils`                               | `safe`, `isEnabled`, `inGame`, `registerRetroGame`                                       |
| `@modkit/test`                                | Extracted-game integration tests (CDP `:9224`). Import from `*.integration.test.ts` only |
| `@modkit/ui`                                  | Shared React UI components                                                               |
| `sandkit` / `SandkitApi` / `WorkerSandkitApi` | Ambient globals. Do not import with a `types/` prefix                                    |

Sandkit API types come from [`@sandustry-modding/types`](https://www.npmjs.com/package/@sandustry-modding/types).
Browse the reference at [SandustryTypes](https://sandustry-modding.github.io/SandustryTypes/#/).
Ambient `sandkit` loads through [`modkit/sandkit.d.ts`](modkit/sandkit.d.ts).
Do not list this package under `compilerOptions.types`.
Manifest and patch schemas: `@sandustry-modding/types/configs`.

## Troubleshooting

**`npm run setup` fails** — Fix each `FAIL` line, then run `npm run setup` again.

**Setup fails with missing `node_modules` in a mod folder** — That mod has its own `package.json`.
Run `npm install` inside that folder.
Root `npm install` does not do this.

**Mods do not load** — Opt into the Steam beta: Library → Sandustry → Properties → Betas → select `mods`.
Run `npm run setup` to confirm the asar has `sandkit`.

![Steam Properties Betas tab with the mods branch selected](docs/assets/images/mods-branch.png)

**Game binary not found** — Point the launcher at your executable.

Linux:

```bash
export SANDUSTRY=/path/to/steamapps/common/Sandustry/sandustry
```

Default probe includes `~/games/SteamLibrary/steamapps/common/Sandustry/sandustry` and Steam library folders from `libraryfolders.vdf`.

Windows (PowerShell):

```powershell
$env:SANDUSTRY="C:\Program Files (x86)\Steam\steamapps\common\Sandustry\Sandustry.exe"
```

Windows (cmd):

```bat
set SANDUSTRY=C:\Program Files (x86)\Steam\steamapps\common\Sandustry\Sandustry.exe
```

Default probe includes `%ProgramFiles(x86)%\Steam` and `%ProgramFiles%\Steam`, plus libraries from `libraryfolders.vdf`.

### Wrong monitor on launch

Set `SANDUSTRY_MONITOR` in `.env` (see `.env.example`).
`npm run sandustry` and F5 use the same setting.

| Value     | Meaning                                      |
| --------- | -------------------------------------------- |
| `primary` | OS primary display (default)                 |
| `left`    | Leftmost display                             |
| `right`   | Rightmost display                            |
| `0`, `1`… | Index after sorting left-to-right, top-to-bottom |

| OS      | Monitor placement | How                                    |
| ------- | ----------------- | -------------------------------------- |
| Linux   | Yes               | `xrandr` list; `wmctrl` maximize (F5)   |
| Windows | Yes               | PowerShell `Screen`; `--start-maximized` |
| macOS   | No                | Falls back to `0,0`                    |

**Duplicate mods in the console** — After a rename, old folders can stay in the OS mods directory.
The game loads every folder there, so you get two copies of each sample.
The watch build removes leftover game folders this template used to own.
Stopping `npm run dev` also removes those owned folders.
Restart the game after a rename or after you stop the watch.

**VS Code breakpoints do not bind** — Run `npm run dev`, then select **Sandustry** or **Sandustry (all mods)** and press F5.
For **Sandustry**, pick a mod in the Quick Pick.
That launches the game, waits for CDP `:9222`, loads that mod’s Void save, then attaches **Renderer** (mods).
Set breakpoints in `src/<name>/` TypeScript files, not in `dist/` or `main.js`.
Do not press **F12** while the IDE debugger is attached — Electron DevTools steals the CDP session.
Keep **Open DevTools on load** off under F5.

**F5 attach fails or the game will not stop** — Press F5 again (preLaunch runs stop first), or run the **sandustry:stop** task / `node scripts/sandustry/sandustry-stop.js`.

**Debugger Restart says "No debugger available"** — Select **Sandustry** (the Node launch), not a renderer-only attach.
Restart must kill and relaunch the game process.

**Code changes do not show in game** — Keep `npm run dev` running so the watch rebuilds `main.js`.
Restart the game (F5) after `worker.js` or `patches.json` changes.
Save reload (`?db_load=`) does not re-apply those on Steam.

**`npm run publish` hangs after a successful upload** — SteamCMD used to keep the `Steam>` prompt because it inherited the terminal. Publish now closes stdin and stops SteamCMD if it does not exit.
See [Workshop publish](docs/builds.md#workshop-publish).

**`npm run publish` fails to download SteamCMD** — Publish fetches the official Valve installer into the dedicated cache when that install is missing (`~/.cache/sandustry-steamcmd/` on Linux / macOS, `%LOCALAPPDATA%\sandustry-steamcmd\` on Windows).
See [Workshop publish](docs/builds.md#workshop-publish).

**`npm run publish` fails with "No cached credentials"** — SteamCMD login is separate from the Steam client.
On a TTY, publish prompts for password / Steam Guard once, then uploads.
Full SteamCMD output is in `.tmp/steamcmd-publish.log`.

**Types missing** — Run `npm install`.
Sandkit API declarations come from `@sandustry-modding/types`.
See [SandustryTypes](https://sandustry-modding.github.io/SandustryTypes/#/).

## More docs

| Topic              | Page                                                  |
| ------------------ | ----------------------------------------------------- |
| Builds and publish | [docs/builds.md](docs/builds.md)                      |
| Mod manifest       | [docs/modinfo.md](docs/modinfo.md)                    |
| `configSchema`     | [docs/config-schema.md](docs/config-schema.md)        |
| Bundle patches     | [docs/patches.md](docs/patches.md)                    |
| Modkit             | [docs/modkit/README.md](docs/modkit/README.md)        |
| UI kit             | [docs/ui/README.md](docs/ui/README.md)                |
| Sandkit types      | https://sandustry-modding.github.io/SandustryTypes/#/ |
| Official Sandkit   | https://sandustry.com/sandkit.html                    |
