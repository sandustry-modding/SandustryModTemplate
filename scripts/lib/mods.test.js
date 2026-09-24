import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  hasModManifest,
  loadModManifestExports,
  modManifestSource,
  readModinfoJsonManifest,
} from "./mod-manifest.js";
import { parseModFilters, resolveModRoots, DEFAULT_MOD_ROOTS, MOD_ROOTS } from "./mods.js";

test("parseModFilters reads --mod and --mod=", () => {
  assert.deepEqual(parseModFilters(["--mod", "examples", "--debug"]), ["examples"]);
  assert.deepEqual(parseModFilters(["--mod=template", "--mod", "examples"]), [
    "template",
    "examples",
  ]);
});

test("resolveModRoots searches src and mods when --mod is set", () => {
  assert.deepEqual(resolveModRoots([]), DEFAULT_MOD_ROOTS);
  assert.deepEqual(DEFAULT_MOD_ROOTS, ["src", "mods"]);
  assert.deepEqual(MOD_ROOTS, ["src", "mods"]);
  assert.deepEqual(resolveModRoots(["--mod", "examples"]), MOD_ROOTS);
});

test("readModinfoJsonManifest strips $schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "mod-manifest-"));
  try {
    writeFileSync(
      join(dir, "modinfo.json"),
      JSON.stringify({
        $schema: "https://example.test/modinfo.json",
        manifestVersion: 1,
        id: "author.test",
        name: "Test",
        version: "0.0.1",
        apiVersion: 1,
        entry: "main.js",
      }),
    );
    assert.equal(hasModManifest(dir), true);
    assert.equal(modManifestSource(dir), "json");
    const manifest = readModinfoJsonManifest(dir);
    assert.equal(manifest.id, "author.test");
    assert.equal("$schema" in manifest, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadModManifestExports reads patches.json when modinfo.json is the manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mod-manifest-"));
  try {
    writeFileSync(
      join(dir, "modinfo.json"),
      JSON.stringify({
        manifestVersion: 1,
        id: "author.test",
        name: "Test",
        version: "0.0.1",
        apiVersion: 1,
        entry: "main.js",
      }),
    );
    writeFileSync(
      join(dir, "patches.json"),
      JSON.stringify([
        {
          id: "demo",
          file: "js/bundle.js",
          find: "x",
          operation: "replace",
          code: "y",
          expectedMatches: 1,
        },
      ]),
    );
    const loaded = await loadModManifestExports(dir, "test-mod", "test/modinfo.json");
    assert.equal(loaded.patches?.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadModManifestExports reads patches.ts when modinfo.json is the manifest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mod-manifest-"));
  try {
    writeFileSync(
      join(dir, "modinfo.json"),
      JSON.stringify({
        manifestVersion: 1,
        id: "author.test",
        name: "Test",
        version: "0.0.1",
        apiVersion: 1,
        entry: "main.js",
      }),
    );
    writeFileSync(
      join(dir, "patches.ts"),
      `export const patches = [{ id: "demo", file: "js/bundle.js", find: "x", operation: "replace", code: "y", expectedMatches: 1 }];`,
    );
    const loaded = await loadModManifestExports(dir, "test-mod", "test/modinfo.json");
    assert.equal(loaded.modinfo.id, "author.test");
    assert.equal(loaded.patches?.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadModManifestExports reads patches.json when modinfo.ts has no patch exports", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mod-manifest-"));
  try {
    writeFileSync(
      join(dir, "modinfo.ts"),
      `export const modinfo = {
        manifestVersion: 1,
        id: "author.test",
        name: "Test",
        version: "0.0.1",
        apiVersion: 1,
        entry: "main.js",
      };`,
    );
    writeFileSync(
      join(dir, "patches.json"),
      JSON.stringify([
        {
          id: "demo",
          file: "js/bundle.js",
          find: "x",
          operation: "replace",
          code: "y",
          expectedMatches: 1,
        },
      ]),
    );
    const loaded = await loadModManifestExports(dir, "test-mod-ts-json", "test/modinfo.ts");
    assert.equal(loaded.modinfo.id, "author.test");
    assert.equal(loaded.patches?.length, 1);
    assert.equal(loaded.patches[0].id, "demo");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
