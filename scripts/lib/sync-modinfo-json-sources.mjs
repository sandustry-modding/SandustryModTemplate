#!/usr/bin/env node
/**
 * Refresh repo `modinfo.json` files (with `$schema`) from the loaded manifest.
 * Legacy mods can still use `modinfo.ts`; this script reads either source.
 */
import { join } from "node:path";
import { discoverMods } from "./mods.js";
import { loadModManifestExports, manifestLabel, modManifestSource } from "./mod-manifest.js";
import { withModinfoSchema } from "./json-schemas.js";
import { writeJsonIfChanged } from "./write-if-changed.js";

const roots = process.argv.includes("--template")
  ? ["src/template"]
  : ["src/template", "src/examples"];

for (const root of roots) {
  for (const mod of discoverMods({ roots: [root] })) {
    const source = modManifestSource(mod.dir);
    if (!source) continue;
    const label = manifestLabel(mod.repoPath, source);
    const loaded = await loadModManifestExports(mod.dir, `sync-modinfo-${mod.folder}`, label);
    writeJsonIfChanged(
      join(mod.dir, "modinfo.json"),
      withModinfoSchema(structuredClone(loaded.modinfo)),
    );
    console.log(`synced ${mod.repoPath}/modinfo.json`);
  }
}
