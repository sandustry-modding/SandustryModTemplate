/**
 * Select integration test files for `--mod` / positional mod folders.
 */
import { discoverMods, parseModFilters } from "../lib/mods.js";

/**
 * Turn bare mod folder names into `--mod` flags.
 * Keeps `--view`, `--test-*`, and explicit `--mod`.
 *
 * @param {string[]} argv
 * @returns {string[]}
 */
export function normalizeIntegrationArgv(argv) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mod") {
      const value = argv[i + 1];
      out.push(arg);
      if (value !== undefined) {
        out.push(value);
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("-")) {
      out.push(arg);
      continue;
    }
    out.push("--mod", arg);
  }
  return out;
}

/**
 * Keep files under one of the repo-relative prefixes.
 * `null` or an empty list keeps every file.
 *
 * @param {string[]} files
 * @param {string[] | null} [repoPaths]
 * @returns {string[]}
 */
export function filterIntegrationFiles(files, repoPaths) {
  const unique = [...new Set(files)];
  if (!repoPaths || repoPaths.length === 0) return unique.sort();
  const prefixes = repoPaths.map((path) => path.replaceAll("\\", "/").replace(/\/+$/, ""));
  return unique
    .filter((file) => {
      const normalized = file.replaceAll("\\", "/");
      return prefixes.some(
        (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
      );
    })
    .sort();
}

/**
 * Repo-relative folders whose `*.integration.test.ts` files should run.
 * `null` means the full suite.
 *
 * @param {string[]} argv
 * @param {{ folder: string; root: string; repoPath: string }[]} [discovered]
 * @returns {string[] | null}
 */
export function integrationTestRepoPaths(argv, discovered = discoverMods()) {
  const normalized = normalizeIntegrationArgv(argv);
  const filters = parseModFilters(normalized);
  if (filters.length === 0) return null;
  return filters.map((folder) => {
    const mod = discovered.find((entry) => entry.folder === folder);
    if (!mod) {
      throw new Error(
        `Unknown mod ${JSON.stringify(folder)}. Found: ${discovered.map((entry) => entry.folder).join(", ")}`,
      );
    }
    return mod.repoPath;
  });
}
