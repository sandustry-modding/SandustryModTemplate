# Builds

The game runs `main.js` as a script body (`new Function`).
The loader wraps the body in an async function and puts `sandkit` in scope.
Bundle with esbuild `format: "esm"` and do not export from the entry — the output must have no `import` / `export`.

## Debug vs release

| Command               | `debugPatches` | Sourcemaps | Output                                                           |
| --------------------- | -------------- | ---------- | ---------------------------------------------------------------- |
| `npm run build`       | Omitted        | Off        | `build/<modinfo.id>/` only (no OS mods folder, no `dist/` links) |
| `npm run dev`         | Included       | Inline     | OS mods folder while watching; kept unless `DEV_CLEANUP=true` or `all` |
| `npm run dev:release` | Omitted        | Off        | OS mods folder while watching (same cleanup as `dev`)            |
| `--game` / `--debug`  | Included       | Inline     | Game mods folder                                                 |

`--no-debug` forces a release-style bundle even when watch or game flags are set (`npm run dev:release` uses this). `--mod <folder>` builds one mod folder (repeat `--mod` for several). `npm run dev` follows `.tmp/dev-mod-selection.json` from F5 / `dev:pick`, and merges companions from `.env` `DEV_ALWAYS_MODS` (see `.env.example`).
Debug builds (`npm run dev`, `--game`, `--debug`) install to the OS mods folder (`dist/` links there). `npm run build` discovers every `src/*/modinfo.ts`.
Use `npm run examples` or `npm run build -- --examples` for `examples/*/modinfo.ts`.
Those commands clone [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples) into `examples/` when that folder is missing.

Debug builds emit **inline** source maps on `main.js` (needed for `new Function` eval).
Use `--sourcemap` to force maps on a release build, or `--no-sourcemap` to omit them from a debug build.

`__MOD_DEBUG__` is `true` in dev builds and `false` in release.
All builds alias `console` to `console.ts` and inject it so bare `console.*` calls get a `[modId]` prefix and are written to the game log file.

## File logging (`console`)

All builds alias [`modkit/internal/esbuild/console.ts`](../modkit/internal/esbuild/console.ts) as `console` and inject it (same pattern as the `react` alias).
Each line goes to DevTools with a `[modId]` prefix and to `window.electron.log` (IPC `log:write`).
Debug builds also add `console.ts` to the source map `ignoreList` so breakpoints skip the shim when stepping.

Use `createLogger` from `@modkit/log` when you want a custom scope tag without going through `console`.

```ts
console.log("my-feature", payload);
// DevTools: [author.template] my-feature {…}
// logs/main.log: […] [INFO] [author.template] my-feature {…}
```

The shim uses `globalThis.console` internally so it does not recurse.

## Tailwind CSS

The game ships Tailwind **v3.4.19** inside `bundle.js`.
That stylesheet is purged: only classes the HUD uses are present.
A class such as `w-[28rem]` has no rule until the mod adds it.

Sandkit loads `main.js` only.
There is no CSS file in the mod manifest.
The build still has to insert a `<style>` tag.
Import shared `@modkit/ui/tailwind.css` from the mod entry.
Import `@modkit/ui/options.css` only when you use `OptionsSlider` / `OptionsSliderRow`.
The kit re-exports those React components from `modkit/ui/options/index.ts` so esbuild does not pick `options.css` instead.
The build inlines CSS as text (no `main.css` in the mod folder).
The compiled Tailwind sheet is **only the utilities this bundle uses**: esbuild lists the source files it packed, then Tailwind scans those files.
Unused `modkit/ui` components do not add CSS.
Mods that never import those files skip the compile.

The insert lives in [overlay-hotkey/main.ts](https://github.com/sandustry-modding/SandustryExamples/blob/main/ui/overlay-hotkey/main.ts) (`style#<mod-id>-tailwind`).
A renderer hot reload re-inserts the sheet when that code runs again.
Restart the game if the overlay does not update.

Do not enable Tailwind preflight.
The game already resets `*, ::before, ::after`.
A second preflight can change the HUD.

Live `preview.html` pages and PNGs live under [docs/ui/canvas](ui/canvas/) (not in `modkit/ui`).
Preview utilities are in [docs/ui/canvas/_preview/utilities.css](ui/canvas/_preview/utilities.css).

### Verify

Static check against an extracted `sandustry/source/dist/js/bundle.js` (`npm run setup`):

| Selector           | In the game CSS |
| ------------------ | --------------- |
| `.flex {`          | Yes             |
| `.bg-black {`      | Yes             |
| `.bg-opacity-85 {` | Yes             |
| `.w-\[28rem\] {`   | No              |
| `.underline {`     | No              |

In game:

1. Run `npm run dev`, then `npm run sandustry` (or **F5**).
2. Press **Alt+E**.
  The overlay panel must be 28rem (448px) wide.
  The help sentence must be underlined.
3. In DevTools, `document.getElementById("<mod-id>-tailwind")` must exist.

## Commands

```bash
npm run setup            # check install, extract sandustry/source/, link dist/, sandustry/logs/, sandustry/saves/, sandustry/workshop/ (one time)
npm run dev              # watch all src/ mods (debug + sourcemaps)
npm run dev:release      # watch without debugPatches or sourcemaps
npm run dev:pick         # TTY picker; last choice pre-selected
npm run dev -- --mod overlay-hotkey
npm run dev -- --mod overlay-hotkey --mod template
npm run build            # release all src/ mods to build/<modinfo.id>/
npm run build -- --mod overlay-hotkey
npm run build -- --examples
npm run publish          # npm run build + SteamCMD Workshop upload
npm run publish -- --mod <folder>
npm run typecheck
npm run test
npm run test:integration  # headless Chromium on :9224, then *.integration.test.ts
npm run test:integration:view  # visible window (Linux needs DISPLAY)
nr test:integration:view overlay-hotkey  # one folder + its tests (visible)
nr test:integration overlay-hotkey  # one folder + its tests (headless)
npm run sandustry        # stop + launch (no build; keep npm run dev for the bundle)
```

When `npm run dev` stops (Ctrl+C, terminal close, or process exit), it removes the OS mod folders this template built in that watch session **only if** `.env` has `DEV_CLEANUP=true` (default `false` keeps them).
Set `DEV_CLEANUP=all` to remove **every** mod folder in `dist/` instead.
The `dist/` link stays.
Use `npm run build` when you want release staging under `build/`.

`npm run dev` watches the F5 / `dev:pick` choice (`.tmp/dev-mod-selection.json`) plus any companions from `DEV_ALWAYS_MODS` in `.env` / `.env.example`. `DEV_MODS` is `selection` (default) or `all`.
Copy `.env.example` to `.env` (or run `npm run setup`). **Sandustry** writes one folder. **Sandustry (all mods)** writes all.

`SANDUSTRY_MONITOR` picks the display for `npm run sandustry` and F5 (`left`, `right`, `primary`, or `0`, `1`, …).
Linux uses `xrandr` and `wmctrl`.
Windows uses PowerShell `Screen` and `--start-maximized`.
macOS and other OSes ignore monitor selection and use `0,0`.
See [README troubleshooting](../README.md#wrong-monitor-on-launch).
If `npm run dev` is already running, it restarts the bundle when that file changes (unless `DEV_MODS=all`).
It does not uninstall other owned OS folders (Workshop items and other local mods stay).
Use `npm run dev:pick` for a keyboard picker before the watch starts. **All mods** is the first row.
Mods are grouped under **src** and **mods**.
Type to filter the list, **Space** toggles mods, **Enter** confirms (All, checked mods, or the highlighted mod).
Pass `--mod` to skip the picker and pin that set.
Non-TTY `dev:pick` uses the last selection, or all mods when none is stored.

**F5** (VS Code) has two launches. **Sandustry** shows a **Quick Pick** of one mod and writes that folder to the shared watch selection.
It opens that mod’s Steam test world (`worldId` = `modinfo.id`).
Other owned OS folders stay installed.
Load Game groups by `worldId`.
Each test world uses `modinfo.id` as **worldId** and **world name**, so the left **WORLDS** list has one row per mod.
In-game Save and Autosave for that session use that same `worldId` (`<id>-autosave-N.save`).
F5 loads the **newest** save in that world (`meta.timestamp`), not only `<id>.save`.
F5 does **not** change last-played: Continue for your campaign stays on last-played.
F5 does **not** uninstall other owned OS folders. `npm run setup` and the first F5 create the Steam `<id>.save` from `Empty.save` when it is missing and shrink it to 1024×1024.
They do **not** write a `.save` into the mod source folder.
If the Steam test world already exists, F5 does not overwrite it.
After CDP `:9222` responds, F5 navigates `?db_load=<latestSaveId>`. **Sandustry (all mods)** writes “all mods” and Continues.
Keep `npm run dev` running: it follows the same selection.
Both wait until CDP `:9222` responds, then attach the debugger to the **renderer**.
They do not rebuild the mod themselves. **Restart** in the debugger toolbar kills that Electron process and starts a new one, then the renderer attach reconnects — a page reload does not restart workers or re-apply patches.
If attach fails or ports linger, press F5 again or run the **sandustry:stop** task.

The watch rebuilds when you save a file in the bundle graph (mod sources and imported `modkit/` files), `modinfo.ts`, or static files under `mod/`.
A Tailwind CSS change queues a second rebuild after the current one finishes, so the next save is not dropped.
Restart the game (F5) after `worker.js` or `patches.json` changes.
Save reload (`?db_load=`) does not re-apply those on Steam.

Renderer attach loads source maps from scripts named `sandkit-workshop://<modId>/main.js` (and from the OS mods folder / `dist/`).
Debug builds rewrite inline maps to `file://` sources, add a sandkit loader line offset, set matching `sourceURL`, and mark the aliased `console.ts` as ignore-listed so breakpoints resolve to mod source instead of the console shim.

## Workshop publish

`npm run publish` uses [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD).
It uses a **dedicated** install (downloads Valve’s official archive on first use):

- Linux / macOS: `~/.cache/sandustry-steamcmd/`
- Windows: `%LOCALAPPDATA%\sandustry-steamcmd\`

It does **not** use the Steam client’s `steamcmd` or Debian `/usr/games/steamcmd`, which share `~/.local/share/Steam` and clear the login cache when Steam runs.

Log into the Steam client as the Workshop item owner first (so publish can read your account name).
SteamCMD keeps a **separate** credential cache under `home/` in that folder (a private `HOME` / `USERPROFILE` for SteamCMD).
The first publish prompts for your Steam password (and Steam Guard if needed), then caches it.
Later publishes reuse that cache with short status lines.
Full SteamCMD output goes to `.tmp/steamcmd-publish.log`.

In a terminal, `npm run publish` shows an arrow-key list of **`src/` mods** (not `examples/`), then a confirm step (Upload / Cancel).

```bash
npm run publish
npm run publish -- --mod <folder>
npm run publish -- --mod <folder> --yes
```

The command runs `npm run build` for that folder.
The bundle lands in `build/<modinfo.id>/` (Workshop staging).
Staging gets the release bundle plus `workshop.json` only.
Preview images stay under `workshop/` and are sent only as SteamCMD `previewfile` (listing image), not inside the content folder. `README.md`, `CHANGELOG.md`, and `workshop/screenshots/` stay in the repo.
SteamCMD uploads content from `build/<modinfo.id>/`. `workshop/workshop.md` supplies the Steam description in Markdown; `npm run publish` converts it to Steam BBCode at upload time. `npm run build` and `npm run dev` also copy only `workshop.json`, and remove leftover `README.md`, `CHANGELOG.md`, preview images, and `screenshots/` from the game folder.

**First publish:** you do not need `workshop/workshop.json` or an in-game Workshop create step.
If the mod has `workshop/preview.png` (or `preview.gif`) and `workshop/workshop.md` (or `modinfo.description`), `npm run publish` sends `publishedfileid` `0` to SteamCMD, creates the item, then writes `src/<name>/workshop/workshop.json` with the new id.
Later publishes update that item.

**`workshop.md` syntax:** `#` / `##` headings, `**bold**`, numbered lists (`1.`), and bullet lists (`-`).
Do not add links or raw URLs — Steam Workshop virus scan rejects them and publish will fail.
Legacy `workshop.txt` (raw BBCode) still works if you keep it instead.

Steam **change notes** come from that mod's `CHANGELOG.md` (Keep a Changelog).
Write them for players: what changed in play, not how it was built. `npm run publish` uses the `##` section that matches `modinfo.version` (for example `## 0.2.0` or `## [0.2.0] - 2026-08-22`).
If that heading is missing, it uses `## Unreleased` and warns you to rename the heading to the version.
If there is no changelog, it sends the version string.
The confirm step prints the full Steam change-notes text before Upload / Cancel.

## GitHub Actions

Pushes, pull requests, and manual runs execute `.github/workflows/ci.yml` on **Ubuntu** and **Windows** (Node 24).
Each job runs `npm ci`, `npm run build`, and a Tailwind example build (`--examples --mod overlay-hotkey`). `--examples` clones [SandustryExamples](https://github.com/sandustry-modding/SandustryExamples) into `examples/`.

On **Windows**, CI also builds a fake Sandustry install under `.tmp/ci-sandustry/` (`scripts/setup/prepare-ci-game.js`), sets `SANDUSTRY`, and runs `npm run setup`.
That checks Node, links, asar extract, and junctions without Steam.

The workflow does **not** run `npm run publish`.
Publish needs SteamCMD credentials.
