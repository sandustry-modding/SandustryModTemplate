/**
 * Discover `src/<name>/modinfo.json` or `modinfo.ts` folders and load each manifest.
 * Optional `--mod <folder>` (repeatable, or `--mod=<folder>`) selects one or more.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasModManifest,
  loadModManifestExports,
  manifestLabel,
  modManifestPath,
  modManifestSource,
} from "./mod-manifest.js";
import { gameModDir, syncModGameFolders } from "./mod-path.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** All mod source roots (discovery, isolation, setup). */
export const MOD_ROOTS = ["src", "mods"];

/** Default for `npm run build` / `npm run dev` — `src/` and private `mods/`. */
export const DEFAULT_MOD_ROOTS = ["src", "mods"];

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
export function resolveModRoots(argv) {
  if (parseModFilters(argv).length > 0) return MOD_ROOTS;
  return DEFAULT_MOD_ROOTS;
}

/** Workshop staging root (`npm run build` / `npm run publish`). */
export const PUBLISH_OUT_ROOT = join(ROOT, "build");

/** @param {string} gameId `modinfo.id` (same name as the OS mods folder) */
export function publishStagingDir(gameId) {
  return join(PUBLISH_OUT_ROOT, gameId);
}

const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

/**
 * Mod-folder name for a path inside a mod tree, or null when outside.
 * @param {string | undefined} filePath
 * @param {string} [root]
 * @returns {string | null}
 */
export function modFolderFromPath(filePath, root = ROOT) {
  if (!filePath) return null;
  let dir = normalize(filePath);
  try {
    if (!statSync(dir).isDirectory()) dir = dirname(dir);
  } catch {
    return null;
  }

  for (const modRoot of MOD_ROOTS) {
    const base = join(root, modRoot);
    let current = dir;
    while (true) {
      const rel = relative(base, current);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) break;
      if (hasModManifest(current)) return basename(current);
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

/**
 * Fail the bundle when one mod folder imports another mod's tree.
 * @param {string} [root]
 */
export function modIsolationPlugin(root = ROOT) {
  return {
    name: "mod-isolation",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData?.skipModIsolation) return;
        const result = await build.resolve(args.path, {
          importer: args.importer,
          resolveDir: args.resolveDir,
          kind: args.kind,
          namespace: args.namespace,
          pluginData: { ...args.pluginData, skipModIsolation: true },
        });
        if (result.errors?.length) return result;
        const fromMod = modFolderFromPath(args.importer, root);
        const toMod = modFolderFromPath(result.path, root);
        if (fromMod && toMod && fromMod !== toMod) {
          return {
            errors: [
              {
                text: `Mod "${fromMod}" cannot import from mod "${toMod}" (${args.path})`,
              },
            ],
          };
        }
        return result;
      });
    },
  };
}

/**
 * @typedef {object} DiscoveredMod
 * @property {string} folder Leaf folder name (`--mod` id)
 * @property {string} root `src` or `mods`
 * @property {string} dir Absolute path to the mod folder
 * @property {string} repoPath Repo-relative path (for example `src/examples`)
 */

/**
 * Walk a mod root and collect every directory that contains `modinfo.json`
 * or `modinfo.ts`.
 * @param {string} modRoot `src` or `mods`
 * @returns {DiscoveredMod[]}
 */
function discoverModsInTree(modRoot) {
  const base = join(ROOT, modRoot);
  if (!existsSync(base)) return [];

  /** @type {DiscoveredMod[]} */
  const mods = [];

  /** @param {string} dir */
  function walk(dir) {
    if (hasModManifest(dir)) {
      mods.push({
        folder: basename(dir),
        root: modRoot,
        dir,
        repoPath: relative(ROOT, dir).split(sep).join("/"),
      });
      return;
    }
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      const child = join(dir, name);
      try {
        if (statSync(child).isDirectory()) walk(child);
      } catch {
        /* removed while walking */
      }
    }
  }

  walk(base);
  return mods;
}

/**
 * @param {{ roots?: string[] }} [options]
 * @returns {DiscoveredMod[]} Sorted by folder name.
 */
export function discoverMods(options = {}) {
  const roots = options.roots ?? MOD_ROOTS;
  /** @type {DiscoveredMod[]} */
  const mods = [];
  /** @type {Map<string, string>} */
  const seen = new Map();

  for (const root of roots) {
    for (const mod of discoverModsInTree(root)) {
      const prior = seen.get(mod.folder);
      if (prior) {
        throw new Error(
          `Duplicate mod folder name "${mod.folder}" in ${prior} and ${mod.repoPath}. Folder names must be unique across mod roots.`,
        );
      }
      seen.set(mod.folder, mod.repoPath);
      mods.push(mod);
    }
  }

  return mods.sort((a, b) => a.folder.localeCompare(b.folder));
}

/** @returns {string[]} Sorted folder names that contain a mod manifest. */
export function discoverModFolders() {
  return discoverMods().map((mod) => mod.folder);
}

/**
 * @param {string} folder
 * @returns {DiscoveredMod | undefined}
 */
export function findModByFolder(folder) {
  return discoverMods().find((mod) => mod.folder === folder);
}

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
export function parseModFilters(argv) {
  /** @type {string[]} */
  const filters = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mod") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--mod requires a folder name (for example --mod template)");
      }
      filters.push(value);
      i += 1;
      continue;
    }
    if (arg.startsWith("--mod=")) {
      const value = arg.slice("--mod=".length).trim();
      if (!value) throw new Error("--mod requires a folder name (for example --mod=template)");
      filters.push(value);
    }
  }
  return filters;
}

/**
 * @param {string[]} argv
 * @returns {string | null}
 */
export function parseModFilter(argv) {
  const filters = parseModFilters(argv);
  return filters[0] ?? null;
}

/**
 * @typedef {object} LoadedMod
 * @property {string} folder
 * @property {string} root
 * @property {string} repoPath
 * @property {string} dir
 * @property {string} manifestPath `modinfo.json` or `modinfo.ts`
 * @property {"json" | "ts"} manifestSource
 * @property {string} manifestLabel Repo path used in build errors
 * @property {string} main
 * @property {string | null} worker
 * @property {any} manifest
 * @property {string} gameId OS mods folder name (`modinfo.id`)
 * @property {string} outDir
 */

/**
 * @param {string[]} [argv]
 * @returns {Promise<LoadedMod[]>}
 */
export async function loadMods(argv = process.argv.slice(2)) {
  const modRoots = resolveModRoots(argv);
  const discovered = discoverMods({ roots: modRoots });
  const allDiscovered = modRoots.length === MOD_ROOTS.length ? discovered : discoverMods();
  if (discovered.length === 0) {
    const hint = "Add src/<name>/modinfo.ts or mods/<name>/modinfo.ts";
    throw new Error(`No mods found. ${hint}`);
  }

  const filters = parseModFilters(argv);
  let selected =
    filters.length > 0 ? discovered.filter((mod) => filters.includes(mod.folder)) : discovered;
  if (filters.length > 0) {
    const unknown = filters.filter((folder) => !allDiscovered.some((mod) => mod.folder === folder));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown --mod ${unknown.map((folder) => JSON.stringify(folder)).join(", ")}. Found: ${allDiscovered.map((m) => m.folder).join(", ")}`,
      );
    }
    if (selected.length === 0) {
      throw new Error(
        `No mods matched --mod. Found: ${allDiscovered.map((m) => m.folder).join(", ")}`,
      );
    }
  }

  /** @type {LoadedMod[]} */
  const mods = [];
  for (const entry of selected) {
    const { folder, dir, repoPath } = entry;
    const manifestPath = modManifestPath(dir);
    const source = modManifestSource(dir);
    if (!manifestPath || !source) {
      throw new Error(`${repoPath} is missing modinfo.json`);
    }
    const label = manifestLabel(repoPath, source);
    const main = join(dir, "main.ts");
    const workerTs = join(dir, "worker.ts");
    if (!existsSync(main)) {
      throw new Error(`${label} needs ${repoPath}/main.ts`);
    }

    const loaded = await loadModManifestExports(dir, `modinfo-${folder}`, label);
    const manifest = structuredClone(loaded.modinfo);
    const id = manifest?.id;
    if (typeof id !== "string" || !id.trim()) {
      throw new Error(`${label} id must be a non-empty string (OS mods folder name)`);
    }
    const name = manifest?.name;
    if (typeof name !== "string" || !name.trim()) {
      throw new Error(`${label} name must be a non-empty string`);
    }

    const worker = existsSync(workerTs) ? workerTs : null;
    if (worker && typeof manifest.workerEntry !== "string") {
      manifest.workerEntry = "worker.js";
    }

    const gameId = id.trim();
    mods.push({
      folder,
      root: entry.root,
      repoPath,
      dir,
      manifestPath,
      manifestSource: source,
      manifestLabel: label,
      main,
      worker,
      manifest,
      gameId,
      outDir: gameModDir(gameId),
    });
  }
  return mods;
}

/**
 * Link `dist/` to the OS mods folder and create each game mod folder.
 * Other owned OS folders stay installed.
 * @param {string} repoRoot
 * @param {LoadedMod[]} mods
 */
export function prepareModOutputs(repoRoot, mods) {
  syncModGameFolders(repoRoot, mods);
}
