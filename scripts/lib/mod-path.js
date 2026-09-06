/**
 * Sandustry mod output paths and repo `dist/` link (symlink / Windows junction).
 * Game folder name comes from `modinfo.id` in `src/<name>/modinfo.ts`.
 * The game resolves symlinks with realpath and rejects mod folders outside the mods root.
 *
 * Mods dir: Linux ~/.config/sandustry/mods ; Windows %APPDATA%/sandustry/mods
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { styleText } from "./cli-style.js";
import { linkDirectory, samePath, sandustryModsDir } from "./paths.js";

export const REPO_DIST_LINK = "dist";

const TEMPLATE_BY_FOLDER_FILE = ".tmp/template-mod-by-folder.json";
const DEV_OWNED_MODS_FILE = ".tmp/dev-owned-mods.json";

/** Remove a symlink (including a dangling one) or a real file/directory. */
function removePath(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) {
    unlinkSync(path);
    return;
  }
  rmSync(path, { recursive: true, force: true });
}

function isOwnedGameDir(dir) {
  return samePath(dirname(resolve(dir)), sandustryModsDir());
}

/** @param {string} repoRoot */
function templateByFolderPath(repoRoot) {
  return join(repoRoot, TEMPLATE_BY_FOLDER_FILE);
}

/** @param {string} repoRoot */
function devOwnedModsPath(repoRoot) {
  return join(repoRoot, DEV_OWNED_MODS_FILE);
}

/** @param {string} repoRoot @returns {Record<string, string>} */
function readTemplateByFolder(repoRoot) {
  const path = templateByFolderPath(repoRoot);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    /** @type {Record<string, string>} */
    const out = {};
    for (const [folder, gameName] of Object.entries(parsed)) {
      if (typeof folder === "string" && typeof gameName === "string" && gameName.trim()) {
        out[folder] = gameName.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** @param {string} repoRoot @param {Record<string, string>} byFolder */
function writeTemplateByFolder(repoRoot, byFolder) {
  const path = templateByFolderPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(byFolder, null, 2)}\n`);
}

/** @param {string} repoRoot @param {string[]} gameNames */
function writeDevOwnedMods(repoRoot, gameNames) {
  const path = devOwnedModsPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ gameNames }, null, 2)}\n`);
}

/** Remove a game folder this template used to own. */
function removeOwnedGameDir(gameDir) {
  if (!existsSync(gameDir) || !isOwnedGameDir(gameDir)) return;
  removePath(gameDir);
  console.log(`Removed game mod ${gameDir}`);
}

/**
 * Link `dist/` at the repo root to the OS Sandustry mods folder.
 * Migrates the legacy layout where `dist/<folder>/` was a per-mod link.
 * @param {string} repoRoot
 * @param {{ quiet?: boolean }} [options]
 * @returns {'linked' | 'already' | 'migrated'}
 */
export function ensureRepoDistLink(repoRoot, options = {}) {
  const quiet = options.quiet === true;
  const distPath = join(repoRoot, REPO_DIST_LINK);
  const modsDir = sandustryModsDir();
  mkdirSync(modsDir, { recursive: true });

  let stat;
  try {
    stat = lstatSync(distPath);
  } catch {
    stat = null;
  }

  if (stat?.isSymbolicLink()) {
    const current = resolve(dirname(distPath), readlinkSync(distPath));
    if (samePath(current, modsDir)) {
      if (!quiet) okDistLink(modsDir, true);
      return "already";
    }
    removePath(distPath);
  } else if (stat?.isDirectory()) {
    for (const name of readdirSync(distPath)) {
      const child = join(distPath, name);
      try {
        if (lstatSync(child).isSymbolicLink()) removePath(child);
      } catch {
        /* skip unreadable entry */
      }
      if (name === ".owned-game-names.json") removePath(child);
    }
    removePath(distPath);
    if (!quiet) {
      console.log(
        `${styleText("yellow", "Migrated")} legacy ${REPO_DIST_LINK}/ per-mod links to a single mods-folder link.`,
      );
    }
    linkDirectory(modsDir, distPath);
    if (!existsSync(distPath)) {
      throw new Error(`Could not link ${REPO_DIST_LINK}/ to ${modsDir}`);
    }
    if (!quiet) okDistLink(modsDir, false);
    return "migrated";
  } else if (stat) {
    removePath(distPath);
  }

  linkDirectory(modsDir, distPath);
  if (!existsSync(distPath)) {
    throw new Error(`Could not link ${REPO_DIST_LINK}/ to ${modsDir}`);
  }
  if (!quiet) okDistLink(modsDir, false);
  return "linked";
}

/** @param {string} modsDir @param {boolean} already */
function okDistLink(modsDir, already) {
  const label = `${REPO_DIST_LINK}/`;
  if (already) {
    console.log(
      `${styleText("green", "ok")}    Link ${styleText("bold", label)} ${styleText("dim", `-> ${modsDir} (already linked)`)}`,
    );
    return;
  }
  console.log(
    `${styleText("green", "Linked")} ${styleText("bold", label)} ${styleText("dim", `-> ${modsDir}`)}`,
  );
}

/** @param {string} repoRoot @returns {string} Absolute path to the OS mods folder `dist/` links to. */
function readRepoDistTarget(repoRoot) {
  const distPath = join(repoRoot, REPO_DIST_LINK);
  try {
    const stat = lstatSync(distPath);
    if (stat.isSymbolicLink()) {
      return resolve(dirname(distPath), readlinkSync(distPath));
    }
    if (stat.isDirectory()) return distPath;
  } catch {
    /* dist/ missing */
  }
  return sandustryModsDir();
}

/**
 * Remove every mod folder under `dist/` (the OS Sandustry mods directory).
 * Used when `npm run dev` stops with `DEV_CLEANUP=all`.
 * Leaves the `dist/` mods-folder link in place.
 * @param {string} repoRoot
 */
export function removeAllDistContents(repoRoot) {
  const modsDir = readRepoDistTarget(repoRoot);
  if (!existsSync(modsDir)) return;

  for (const name of readdirSync(modsDir)) {
    const child = join(modsDir, name);
    removePath(child);
    console.log(`Removed ${child}`);
  }

  removePath(devOwnedModsPath(repoRoot));
  removePath(templateByFolderPath(repoRoot));
}

/**
 * Remove OS mod folders built by the last dev watch session.
 * Used when `npm run dev` stops. Leaves the `dist/` mods-folder link in place.
 * @param {string} repoRoot
 */
export function removeOwnedGameMods(repoRoot) {
  const ownedPath = devOwnedModsPath(repoRoot);
  if (!existsSync(ownedPath)) return;

  /** @type {string[]} */
  let gameNames = [];
  try {
    const parsed = JSON.parse(readFileSync(ownedPath, "utf8"));
    if (Array.isArray(parsed?.gameNames)) {
      gameNames = parsed.gameNames.filter((name) => typeof name === "string" && name.trim());
    }
  } catch {
    /* ignore malformed state */
  }

  removePath(ownedPath);
  for (const gameName of gameNames) {
    removeOwnedGameDir(gameModDir(gameName));
  }
}

/** @param {string} modId `modinfo.id` */
export function gameModDir(modId) {
  return join(sandustryModsDir(), modId);
}

/** @param {string} modId */
export function ensureGameModDir(modId) {
  const dir = gameModDir(modId);
  mkdirSync(dirname(dir), { recursive: true });
  if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) {
    removePath(dir);
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** @param {string} dir @returns {string | null} */
function readModinfoId(dir) {
  const modinfoPath = join(dir, "modinfo.json");
  if (!existsSync(modinfoPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(modinfoPath, "utf8"));
    return typeof parsed?.id === "string" && parsed.id.trim() ? parsed.id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * After a folder-layout change or id reuse, an old folder can keep the same `id`.
 * Sandustry rejects every copy of a duplicate manifest id — remove the leftovers.
 * @param {{ gameId: string; manifest?: { id?: string } }[]} mods
 */
export function removeStaleSameIdGameDirs(mods) {
  /** @type {Map<string, string>} id → current OS mods folder name */
  const wantedById = new Map();
  for (const mod of mods) {
    const id = typeof mod.manifest?.id === "string" ? mod.manifest.id.trim() : "";
    if (!id) continue;
    wantedById.set(id, mod.gameId);
  }
  if (wantedById.size === 0) return;

  const root = sandustryModsDir();
  if (!existsSync(root)) return;

  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    let stat;
    try {
      stat = lstatSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory() && !stat.isSymbolicLink()) continue;
    if (!isOwnedGameDir(dir)) continue;

    const id = readModinfoId(dir);
    if (!id) continue;
    const wantedName = wantedById.get(id);
    if (!wantedName || name === wantedName) continue;

    removePath(dir);
    console.log(
      `${styleText("yellow", "Removed")} stale mod folder ${styleText("bold", name)} ${styleText("dim", `(same id as "${wantedName}")`)}`,
    );
  }
}

/**
 * Ensure `dist/` links to the OS mods folder and sync template-owned game folders.
 * `--mod` rebuilds that set only. Other owned OS folders stay installed so
 * other local mods (and Workshop items that do not share those ids) keep loading.
 * @param {string} repoRoot
 * @param {{ folder: string; gameId: string; manifest?: { id?: string } }[]} mods
 */
export function syncModGameFolders(repoRoot, mods) {
  ensureRepoDistLink(repoRoot, { quiet: true });

  const previousByFolder = readTemplateByFolder(repoRoot);

  removeStaleSameIdGameDirs(mods);

  for (const mod of mods) {
    const previous = previousByFolder[mod.folder];
    if (previous && previous !== mod.gameId) {
      removeOwnedGameDir(gameModDir(previous));
    }
    ensureGameModDir(mod.gameId);
    previousByFolder[mod.folder] = mod.gameId;
  }

  writeTemplateByFolder(repoRoot, previousByFolder);
  writeDevOwnedMods(repoRoot, [
    ...new Set([...Object.values(previousByFolder), ...mods.map((mod) => mod.gameId)]),
  ]);
}
