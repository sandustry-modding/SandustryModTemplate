#!/usr/bin/env node
/**
 * Watch src/<name>/ and build each mod into the game mods folder
 * (Linux: ~/.config/sandustry/mods/<modinfo.id>;
 *  Windows: %APPDATA%/sandustry/mods/<modinfo.id>).
 * On stop, remove mods per `DEV_CLEANUP` (`true` = owned only, `all` = wipe `dist/`).
 * Usage: npm run dev [-- --mod template]
 *        npm run dev:release  — watch without debug / sourcemaps
 *        npm run dev:pick  — TTY mod picker (last choice pre-selected)
 *
 * F5 writes `.tmp/dev-mod-selection.json`. `DEV_MODS` is all | selection.
 * `DEV_ALWAYS_MODS` adds companion folders on top of the F5 set (see `.env.example`).
 */
import { spawn } from "node:child_process";
import { mkdirSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "../lib/cli-style.js";
import { resolveDevCleanup, resolveDevModsSetting } from "../lib/env.js";
import { DEFAULT_MOD_ROOTS, discoverMods, parseModFilters } from "../lib/mods.js";
import { syncLaunchDebugModPicker } from "../lib/sync-debug-mod-picker.js";
import { removeAllDistContents, removeOwnedGameMods } from "../lib/mod-path.js";
import {
  pickDevModArgs,
  readLastSelection,
  resolveWatchModArgs,
  SELECTION_FILE,
} from "./pick-dev-mods.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
try {
  syncLaunchDebugModPicker();
} catch {
  /* launch.json missing or invalid */
}
const raw = process.argv.slice(2);
const pick = raw.includes("--pick");
const release = raw.includes("--no-debug");
const extra = stripModFilterArgs(raw.filter((arg) => arg !== "--pick"));
const setting = resolveDevModsSetting();
/** Restart watch when F5 / picker selection changes (not needed for DEV_MODS=all). */
const followSelection = setting.mode !== "all";
await pickDevModArgs(
  raw.filter((arg) => arg !== "--pick"),
  {
    roots: DEFAULT_MOD_ROOTS,
    skipPicker: !pick,
  },
);

console.log(
  styleText(
    ["bold", "cyan"],
    release ? "Watching src/ and mods/ (release)" : "Watching src/ and mods/",
  ),
);

const esbuildScript = join(ROOT, "scripts/build/esbuild.config.mjs");

/** @returns {string[]} */
function currentModArgs() {
  const validFolders = new Set(discoverMods({ roots: DEFAULT_MOD_ROOTS }).map((mod) => mod.folder));
  const filters = parseModFilters(raw);
  if (filters.length > 0) {
    return resolveWatchModArgs({ all: false, folders: filters }, validFolders);
  }
  return resolveWatchModArgs(readLastSelection(validFolders), validFolders);
}

function spawnWatch() {
  const modArgs = currentModArgs();
  return spawn(process.execPath, [esbuildScript, "--watch", ...modArgs, ...extra], {
    stdio: "inherit",
    cwd: ROOT,
    windowsHide: true,
  });
}

let child = spawnWatch();
let stopping = false;
let cleaned = false;
let restarting = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let restartTimer;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  const cleanup = resolveDevCleanup();
  if (cleanup === "off") return;
  try {
    if (cleanup === "all") removeAllDistContents(ROOT);
    else removeOwnedGameMods(ROOT);
  } catch (err) {
    console.error(
      styleText("red", cleanup === "all" ? "Failed to clear dist/:" : "Failed to remove owned mods:"),
      err,
    );
  }
}

function attachChild(proc) {
  proc.on("exit", (code, signal) => {
    if (restarting) {
      restarting = false;
      child = spawnWatch();
      attachChild(child);
      return;
    }
    cleanup();
    if (signal) process.exit(0);
    process.exit(code ?? 0);
  });
}

attachChild(child);

function scheduleRestart() {
  if (stopping || !followSelection) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (spawnArgsMatch(child, currentModArgs())) return;
    console.log(styleText("cyan", "Mod selection changed — restarting watch."));
    restarting = true;
    if (!child.killed) child.kill("SIGTERM");
  }, 150);
}

/** @param {import("node:child_process").ChildProcess} proc @param {string[]} modArgs */
function spawnArgsMatch(proc, modArgs) {
  const args = proc.spawnargs ?? [];
  const expected = [process.execPath, esbuildScript, "--watch", ...modArgs, ...extra];
  if (args.length !== expected.length) return false;
  return args.every((arg, i) => arg === expected[i]);
}

if (followSelection) {
  mkdirSync(dirname(SELECTION_FILE), { recursive: true });
  watch(dirname(SELECTION_FILE), (_event, filename) => {
    if (String(filename ?? "") !== "dev-mod-selection.json") return;
    scheduleRestart();
  });
}

/** @param {NodeJS.Signals} signal */
function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
}

process.on("exit", cleanup);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGHUP", () => stop("SIGHUP"));

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
function stripModFilterArgs(argv) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mod") {
      i += 1;
      continue;
    }
    if (arg.startsWith("--mod=")) continue;
    out.push(arg);
  }
  return out;
}
