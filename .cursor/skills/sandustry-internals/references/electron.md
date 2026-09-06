# Electron bridge

Source of truth: `sandustry/source/preload.js`.
Main handlers: `sandustry/source/main.js`.
Live keys match preload.

Bridge object: `window.electron` (ambient free name: `electron`).

Types: `@sandustry-modding/types/electron` (`ElectronBridge`, result helpers, nested APIs).
Full `@param` / `@returns` JSDoc lives on each method in that module.
Ambient: `electron`, `ElectronBridge`, `ElectronLogLevel`, `ElectronPlatform`, and `window.electron` on `@sandustry-modding/types`.

## Host check

Webpack helper `b8()` is true when `navigator.userAgent` contains `"Electron"` **or** `window.process.type === "renderer"`. `electron.load` / `save` run only then.
Otherwise the renderer uses IndexedDB (`A(e)`).
A Chromium host that is not Electron must set one of those before `js/bundle.js`.

Throw text `Save not found: "<id>"` is the same for a failed `electron.load` and a missing IndexedDB save.

## Sync (startup-safe)

| Method                              | IPC                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `getPlatformSync()`                 | `get-platform-sync` - `"steam"` / `"msstore"` / `"gog"`                       |
| `getIsSteamDeckSync()`              | `get-is-steam-deck-sync`                                                      |
| `getPreferredSystemLanguagesSync()` | `get-preferred-system-languages-sync`                                         |
| `getLastPlayedGameSync()`           | `get-last-played-game-sync` - JSON string `{ id }`                            |
| `saveExistsSync(id)`                | `save-exists-sync`                                                            |
| `getSettingsSync()`                 | `get-settings-sync`                                                           |
| `isFilePatchingActiveSync()`        | `is-file-patching-active-sync` - true when patch protocol has patched sources |

`getSystemInfo()` is **local** (no IPC): `platform`, `arch`, `electronVersion`, `chromeVersion`, `nodeVersion`.

## Invoke bags (do not call unless asked)

- Saves: `save`, `saveSerialized`, `load`, `loadRaw`, `deleteSave`, `exportSave`, `importSave`, `getSaveFiles`, `getSaveFolder` - on-disk layout: `boot.md`
- Last played: `saveLastPlayedGame`, `clearLastPlayedGame`
- Settings: `saveSettings`
- Window: `setFullscreen`, `openDevTools` (`send`, not invoke)
- Quit / browser: `appQuit`, `openExternalBrowser`
- Platform: `diagnostics`, `checkLicense`, `writeGameEvent`, `platformPrimeAchievements`, `platformShowReauthPrompt`
- Nested: `localMods.*`, `customMaps.*`, `platform.*` (achievements, cloud, workshop, overlay)
- Log: `log(level, scope, message)` -> `log:write` fire-and-forget
- Xbox listeners: `onXboxUserSignedOut|SignedIn`, `onXboxLicenseLost` (Steam: never fire)
- Sleep: `onAppSuspend`, `onAppResume`

## File patching

Steam only. `sandustry-patch` privileged scheme. `setupProtocolInterceptor` in `main.js` runs when `workshopPatches.length > 0`. `isFilePatchingActiveSync` is true when interceptor is up **and** patched source map is non-empty.
