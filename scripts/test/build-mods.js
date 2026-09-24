#!/usr/bin/env node
/**
 * One-shot debug bundles for integration tests.
 * Default: src/ and mods/. `--mod` builds only that set.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMods, parseModFilters } from "../lib/mods.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const ESBUILD = join(ROOT, "scripts/build/esbuild.config.mjs");

/**
 * @param {string[]} args
 */
function runBuild(args) {
  const result = spawnSync(process.execPath, [ESBUILD, ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error("Integration mod build failed.");
    process.exit(result.status ?? 1);
  }
}

/**
 * @param {string[]} [argv]
 * @returns {Promise<{ gameIds: string[] | undefined }>}
 */
export async function buildModsForIntegration(argv = process.argv.slice(2)) {
  let filters;
  try {
    filters = parseModFilters(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (filters.length === 0) {
    runBuild(["--debug"]);
    return { gameIds: undefined };
  }

  /** @type {string[]} */
  const esbuildArgs = ["--debug"];
  for (const folder of filters) {
    esbuildArgs.push("--mod", folder);
  }

  const loadArgv = esbuildArgs.filter((arg) => arg !== "--debug");
  let loaded;
  try {
    loaded = await loadMods(loadArgv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  if (loaded.length === 0) {
    console.error("No mods matched the integration filter.");
    process.exit(1);
  }

  console.log(`Integration mods: ${loaded.map((mod) => mod.folder).join(", ")}`);
  runBuild(esbuildArgs);
  return { gameIds: loaded.map((mod) => mod.gameId) };
}
