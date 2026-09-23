/**
 * Keep `.vscode/launch.json` `inputs.debugMod` in sync with discovered mods.
 * VS Code pickString cannot run a command; the option list is static.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MOD_ROOTS, discoverMods } from "../lib/mods.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function launchJsonPath(root = ROOT) {
  return join(root, ".vscode", "launch.json");
}

/** Folder names for the F5 pickString (src/ and mods/). */
export function debugModPickFolders() {
  return discoverMods({ roots: DEFAULT_MOD_ROOTS })
    .map((mod) => mod.folder)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {unknown} launch
 * @param {string[]} options
 */
export function applyDebugModPickInput(launch, options) {
  if (!launch || typeof launch !== "object" || Array.isArray(launch)) {
    throw new Error("launch.json must be a JSON object");
  }
  if (options.length === 0) throw new Error("No mods found for the F5 picker.");
  const rec = /** @type {Record<string, unknown>} */ (launch);
  rec.inputs = [
    {
      id: "debugMod",
      type: "pickString",
      description: "Debug which mod?",
      options,
    },
  ];
  return rec;
}

/** @param {string} [filePath] */
export function syncLaunchDebugModPicker(filePath = launchJsonPath()) {
  const options = debugModPickFolders();
  const launch = JSON.parse(readFileSync(filePath, "utf8"));
  applyDebugModPickInput(launch, options);
  writeFileSync(filePath, `${JSON.stringify(launch, null, 2)}\n`);
  return options;
}
