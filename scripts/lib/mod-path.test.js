import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("removeAllDistContents clears every mods folder entry and tracking files", async () => {
  const { removeAllDistContents } = await import("./mod-path.js");
  const { linkDirectory } = await import("./paths.js");

  const root = mkdtempSync(join(tmpdir(), "sandustry-mod-path-"));
  const modsDir = join(root, "mods");
  mkdirSync(modsDir, { recursive: true });
  mkdirSync(join(modsDir, "template"), { recursive: true });
  mkdirSync(join(modsDir, "workshop-mod"), { recursive: true });
  writeFileSync(join(modsDir, "template", "modinfo.json"), '{"id":"template"}\n');
  writeFileSync(join(modsDir, "workshop-mod", "modinfo.json"), '{"id":"workshop-mod"}\n');

  mkdirSync(join(root, ".tmp"), { recursive: true });
  writeFileSync(join(root, ".tmp", "dev-owned-mods.json"), '{"gameNames":["template"]}\n');
  writeFileSync(join(root, ".tmp", "template-mod-by-folder.json"), '{"template":"template"}\n');

  const distPath = join(root, "dist");
  linkDirectory(modsDir, distPath);

  removeAllDistContents(root);

  assert.deepEqual(readdirSync(modsDir), []);
  assert.equal(readdirSync(join(root, ".tmp")).includes("dev-owned-mods.json"), false);
  assert.equal(readdirSync(join(root, ".tmp")).includes("template-mod-by-folder.json"), false);
});
