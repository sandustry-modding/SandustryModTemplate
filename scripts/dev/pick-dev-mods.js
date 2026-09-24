/**
 * Interactive mod picker for `npm run dev:pick` when stdin is a TTY and no `--mod` is passed.
 * F5 / picker picks the main set. `DEV_ALWAYS_MODS` adds companion folders.
 * `DEV_MODS=all` watches every mod; `selection` (default) follows F5.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "../lib/cli-style.js";
import { resolveDevModsSetting, watchModFolders } from "../lib/env.js";
import { discoverMods, parseModFilters, resolveModRoots } from "../lib/mods.js";
import { isCliTty, tuiModCombobox } from "../lib/tui.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const SELECTION_FILE = join(ROOT, ".tmp/dev-mod-selection.json");

/**
 * @typedef {{ all: true } | { all: false, folders: string[] }} DevModSelection
 */

/**
 * @param {Set<string>} validFolders
 * @returns {DevModSelection | null}
 */
export function readLastSelection(validFolders) {
  try {
    const data = JSON.parse(readFileSync(SELECTION_FILE, "utf8"));
    if (data?.all === true) return { all: true };
    if (Array.isArray(data?.folders)) {
      const folders = data.folders.filter((folder) => validFolders.has(folder));
      if (folders.length > 0) return { all: false, folders };
    }
  } catch {
    /* missing or invalid */
  }
  return null;
}

/** @param {string[] | null} picked `null` = all mods. */
export function writeLastSelection(picked) {
  mkdirSync(dirname(SELECTION_FILE), { recursive: true });
  if (picked == null) {
    writeFileSync(SELECTION_FILE, `${JSON.stringify({ all: true }, null, 2)}\n`);
    return;
  }
  writeFileSync(SELECTION_FILE, `${JSON.stringify({ all: false, folders: picked }, null, 2)}\n`);
}

/**
 * @param {DevModSelection | null} selection
 * @returns {string[]} `--mod` pairs, or `[]` for every mod in scope.
 */
export function selectionToModArgs(selection) {
  if (!selection || selection.all) return [];
  return selection.folders.flatMap((folder) => ["--mod", folder]);
}

/** @param {string[]} folders */
export function foldersToModArgs(folders) {
  if (folders.length === 0) return [];
  return folders.flatMap((folder) => ["--mod", folder]);
}

/**
 * Effective `--mod` args from F5 selection + `DEV_ALWAYS_MODS`.
 * @param {DevModSelection | null} selection
 * @param {Set<string>} [validFolders]
 * @returns {string[]}
 */
export function resolveWatchModArgs(selection, validFolders) {
  const setting = resolveDevModsSetting();
  return foldersToModArgs(watchModFolders(selection, setting, validFolders));
}

/**
 * @param {string[]} argv
 * @param {{ skipPicker?: boolean, roots?: string[] }} [options]
 * @returns {Promise<string[]>} Extra args to pass to esbuild (`[]` = all mods in scope).
 */
export async function pickDevModArgs(argv, options = {}) {
  const filters = parseModFilters(argv);
  const modRoots = options.roots ?? resolveModRoots(argv);
  const mods = discoverMods({ roots: modRoots });
  if (mods.length === 0) {
    const hint = "Add src/<name>/modinfo.ts";
    throw new Error(`No mods found. ${hint}`);
  }
  const validFolders = new Set(mods.map((mod) => mod.folder));
  const setting = resolveDevModsSetting();

  if (filters.length > 0) {
    writeLastSelection(filters);
    const args = resolveWatchModArgs({ all: false, folders: filters }, validFolders);
    logWatchSet(args, setting, filters);
    return args;
  }

  if (options.skipPicker) {
    const last = readLastSelection(validFolders);
    const args = resolveWatchModArgs(last, validFolders);
    logWatchSet(args, setting, last?.all ? null : last?.folders);
    return args;
  }

  if (!isCliTty()) {
    return resolveWatchModArgs(readLastSelection(validFolders), validFolders);
  }

  if (mods.length === 1) {
    console.log(styleText("dim", `Watching ${mods[0].folder}`));
    writeLastSelection([mods[0].folder]);
    return resolveWatchModArgs({ all: false, folders: [mods[0].folder] }, validFolders);
  }

  try {
    const byRoot = (root) =>
      mods
        .filter((mod) => mod.root === root)
        .sort((a, b) => a.folder.localeCompare(b.folder))
        .map((mod) => ({
          folder: mod.folder,
          hint: mod.repoPath,
        }));

    /** @type {{ label: string, mods: { folder: string, hint?: string }[] }[]} */
    const groups = [];
    for (const root of modRoots) {
      const rootMods = byRoot(root);
      if (rootMods.length > 0) {
        groups.push({ label: root, mods: rootMods });
      }
    }

    const last = readLastSelection(validFolders);
    const picked = await tuiModCombobox({
      title: "Watch which mods?",
      groups,
      initialSelected: last?.all ? [] : (last?.folders ?? []),
      initialFocus: last?.all ? "all" : last?.folders?.[0],
    });
    writeLastSelection(picked);
    if (picked == null) return resolveWatchModArgs({ all: true }, validFolders);
    return resolveWatchModArgs({ all: false, folders: picked }, validFolders);
  } catch (error) {
    if (error && typeof error === "object" && "cancelled" in error && error.cancelled) {
      console.log("Cancelled.");
      process.exit("exitCode" in error && typeof error.exitCode === "number" ? error.exitCode : 0);
    }
    throw error;
  }
}

/**
 * @param {string[]} args
 * @param {{ mode: string, alwaysFolders: string[] }} setting
 * @param {string[] | null | undefined} selected
 */
function logWatchSet(args, setting, selected) {
  if (args.length === 0) {
    console.log(styleText("dim", "Watching all mods"));
    return;
  }
  const folders = [];
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === "--mod" && args[i + 1]) folders.push(args[i + 1]);
  }
  if (setting.alwaysFolders.length > 0) {
    const always = setting.alwaysFolders.join(", ");
    const base = selected?.length ? selected.join(", ") : "(none)";
    console.log(
      styleText("dim", `Watching ${folders.join(", ")} (selection ${base} + always ${always})`),
    );
    return;
  }
  console.log(styleText("dim", `Watching ${folders.join(", ")}`));
}
