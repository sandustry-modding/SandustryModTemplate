/**
 * Write patches.json from a mod folder (`patches.json`, `patches.ts`, or `modinfo.ts` exports).
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const MODKIT_DIR = join(ROOT, "modkit");
/** Ephemeral esbuild output — lives under the system temp dir, not the repo. */
export const CACHE_DIR = join(tmpdir(), "sandustry-mod-template");
const JS_PATCH_PATH = /^js\/[^/]+\.js$/;
const OPERATIONS = new Set(["insertBefore", "replace", "wrap"]);

import { modkitAliasPlugin } from "./modkit-alias.js";
import { loadModManifestExports } from "./mod-manifest.js";
import { writeJsonIfChanged } from "./write-if-changed.js";
/**
 * Bundle a TypeScript entry and import it as Node ESM.
 * @param {string} entryPoint
 * @param {string} cacheName
 */
export async function bundleAndImport(entryPoint, cacheName) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const outfile = join(CACHE_DIR, cacheName);
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    plugins: [modkitAliasPlugin(MODKIT_DIR)],
    logLevel: "silent",
  });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

/**
 * @param {unknown} patch
 * @param {string} label
 */
function assertPatch(patch, label) {
  if (!patch || typeof patch !== "object") {
    throw new Error(`${label}: each patch must be an object`);
  }

  const { id, file, operation, expectedMatches } = /** @type {Record<string, unknown>} */ (patch);

  if (typeof id !== "string" || !id) {
    throw new Error(`${label}: each patch must have a string id`);
  }
  if (typeof file !== "string" || !JS_PATCH_PATH.test(file)) {
    throw new Error(
      `Patch "${id}": file must be a relative JavaScript path under js/ (got ${JSON.stringify(file)})`,
    );
  }
  if (typeof operation !== "string" || !OPERATIONS.has(operation)) {
    throw new Error(
      `Patch "${id}": operation must be insertBefore, replace, or wrap (got ${JSON.stringify(operation)})`,
    );
  }
  if (!Number.isInteger(expectedMatches)) {
    throw new Error(`Patch "${id}": expectedMatches must be an integer`);
  }

  const hasFind = typeof patch.find === "string" && patch.find.length > 0;
  const hasRegex = patch.regex != null && typeof patch.regex === "object";
  if (hasFind === hasRegex) {
    throw new Error(`Patch "${id}": set exactly one of find or regex`);
  }

  if (operation === "wrap") {
    if (typeof patch.before !== "string" || typeof patch.after !== "string") {
      throw new Error(`Patch "${id}": wrap requires before and after strings`);
    }
  } else if (typeof patch.code !== "string" || !patch.code) {
    throw new Error(`Patch "${id}": ${operation} requires a non-empty code string`);
  }
}

/** @param {unknown[]} patches */
function validatePatches(patches) {
  const seen = new Set();

  for (const [index, patch] of patches.entries()) {
    assertPatch(patch, `patches[${index}]`);
    const id = /** @type {{ id: string }} */ (patch).id;
    if (seen.has(id)) {
      throw new Error(`Duplicate patch id "${id}"`);
    }
    seen.add(id);
  }
}

/**
 * @param {string} outDir
 * @param {{
 *   modDebug?: boolean;
 *   modDir: string;
 *   cachePrefix: string;
 *   label?: string;
 *   loaded?: Awaited<ReturnType<typeof loadModManifestExports>>;
 * }} options
 */
export async function buildPatches(outDir, options) {
  const {
    modDebug = false,
    modDir,
    cachePrefix,
    label = "modinfo.json",
    loaded: provided,
  } = options;
  mkdirSync(outDir, { recursive: true });

  const mod = provided ?? (await loadModManifestExports(modDir, `${cachePrefix}-patches`, label));
  const production = structuredClone(mod.patches ?? []);
  const debugPatches = structuredClone(mod.debugPatches ?? []);

  if (!Array.isArray(production)) {
    throw new Error(`${label} must export a \`patches\` array`);
  }
  if (mod.debugPatches != null && !Array.isArray(mod.debugPatches)) {
    throw new Error(`${label} \`debugPatches\` must be an array when exported`);
  }

  const patches = modDebug ? [...production, ...(debugPatches ?? [])] : [...production];
  validatePatches(patches);

  const patchesPath = join(outDir, "patches.json");
  if (patches.length === 0) {
    if (existsSync(patchesPath)) rmSync(patchesPath);
    return patches;
  }

  writeJsonIfChanged(patchesPath, patches);

  return patches;
}
