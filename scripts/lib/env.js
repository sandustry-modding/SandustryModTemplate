/**
 * Load repo-root `.env` into `process.env` (does not override existing keys).
 * Call once at process start before reading SANDUSTRY / DEV_* settings.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const ENV_FILE = join(ROOT, ".env");

/** @type {boolean} */
let loaded = false;

/**
 * Parse dotenv-style text. Supports `KEY=value # comment` and quoted values.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trimEnd();
    }
    out[key] = value;
  }
  return out;
}

/**
 * Apply `.env` keys that are not already set in `process.env`.
 * @param {{ root?: string, path?: string, force?: boolean }} [options]
 * @returns {Record<string, string>}
 */
export function loadRepoEnv(options = {}) {
  if (loaded && !options.force) return {};
  loaded = true;
  const path = options.path ?? (options.root ? join(options.root, ".env") : ENV_FILE);
  if (!existsSync(path)) return {};
  const parsed = parseEnvText(readFileSync(path, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return parsed;
}

/**
 * Read a trimmed env string (after `loadRepoEnv`).
 * @param {string} key
 * @param {string} [fallback]
 */
export function envString(key, fallback = "") {
  loadRepoEnv();
  const value = process.env[key];
  if (value == null || value.trim() === "") return fallback;
  return value.trim();
}

/**
 * Truthy when value is `1` / `true` / `yes` / `on` (case-insensitive).
 * @param {string} key
 * @param {boolean} [fallback]
 */
export function envFlag(key, fallback = false) {
  const raw = envString(key, fallback ? "true" : "false").toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

/**
 * @typedef {"all" | "selection"} DevModsMode
 */

/**
 * Parse a comma-separated folder list (empty pieces dropped).
 * @param {string} raw
 * @returns {string[]}
 */
export function parseFolderList(raw) {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Resolve `DEV_MODS` + `DEV_ALWAYS_MODS` into a watch/build policy.
 * - `DEV_MODS=all` — every mod under the active roots
 * - `DEV_MODS=selection` (default) — F5 / `dev:pick` set, plus `DEV_ALWAYS_MODS`
 * - `DEV_ALWAYS_MODS` — comma folders always compiled with the F5 selection
 * @param {string} [devModsRaw]
 * @param {string} [alwaysRaw]
 * @returns {{ mode: DevModsMode, alwaysFolders: string[] }}
 */
export function resolveDevModsSetting(
  devModsRaw = envString("DEV_MODS", "selection"),
  alwaysRaw = envString("DEV_ALWAYS_MODS", ""),
) {
  const value = devModsRaw.trim();
  const alwaysFolders = parseFolderList(alwaysRaw);
  if (value.toLowerCase() === "all") return { mode: "all", alwaysFolders: [] };
  return { mode: "selection", alwaysFolders };
}

/**
 * Merge F5 / picker selection with `DEV_ALWAYS_MODS`.
 * `[]` means compile every mod in scope.
 * @param {DevModSelectionLike | null} selection
 * @param {{ mode: DevModsMode, alwaysFolders: string[] }} setting
 * @param {Set<string>} [validFolders]
 * @returns {string[]}
 *
 * @typedef {{ all: true } | { all: false, folders: string[] }} DevModSelectionLike
 */
export function watchModFolders(selection, setting, validFolders) {
  if (setting.mode === "all") return [];

  /** @param {string[]} folders */
  const keep = (folders) =>
    validFolders ? folders.filter((folder) => validFolders.has(folder)) : folders.slice();

  // Selection "all" still means every mod.
  if (!selection || selection.all) return [];
  if (setting.alwaysFolders.length === 0) return keep(selection.folders);
  const merged = new Set([...keep(selection.folders), ...keep(setting.alwaysFolders)]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

/**
 * Cleanup when `npm run dev` stops.
 * `false` (default) — keep mods in `dist/`.
 * `true` — remove template-owned mods only.
 * `all` — remove every mod folder in `dist/`.
 * @returns {"off" | "owned" | "all"}
 */
export function resolveDevCleanup() {
  const raw = envString("DEV_CLEANUP", "false").toLowerCase();
  if (raw === "all") return "all";
  if (["1", "true", "yes", "on"].includes(raw)) return "owned";
  return "off";
}

/**
 * Monitor for `npm run sandustry` and F5 (`SANDUSTRY_MONITOR` in `.env`).
 * `primary` (default), `left`, `right`, or a 0-based index (`0`, `1`, …).
 * @returns {string}
 */
export function resolveSandustryMonitor() {
  return envString("SANDUSTRY_MONITOR", "primary").toLowerCase();
}

loadRepoEnv();
