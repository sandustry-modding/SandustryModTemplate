import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildPatches } from "./build-patches.js";

test("buildPatches omits patches.json when a mod has no patches", async () => {
  const modDir = mkdtempSync(join(tmpdir(), "build-patches-mod-"));
  const outDir = mkdtempSync(join(tmpdir(), "build-patches-out-"));
  try {
    writeFileSync(
      join(modDir, "modinfo.json"),
      JSON.stringify({
        manifestVersion: 1,
        id: "author.test",
        name: "Test",
        version: "0.0.1",
        apiVersion: 1,
        entry: "main.js",
      }),
    );

    const patches = await buildPatches(outDir, {
      modDir,
      cachePrefix: "test-mod",
      label: "test/modinfo.json",
    });

    assert.deepEqual(patches, []);
    assert.equal(existsSync(join(outDir, "patches.json")), false);
  } finally {
    rmSync(modDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("buildPatches removes a stale patches.json when patches become empty", async () => {
  const modDir = mkdtempSync(join(tmpdir(), "build-patches-mod-"));
  const outDir = mkdtempSync(join(tmpdir(), "build-patches-out-"));
  try {
    writeFileSync(
      join(modDir, "modinfo.json"),
      JSON.stringify({
        manifestVersion: 1,
        id: "author.test",
        name: "Test",
        version: "0.0.1",
        apiVersion: 1,
        entry: "main.js",
      }),
    );
    writeFileSync(join(outDir, "patches.json"), "[]\n");

    await buildPatches(outDir, {
      modDir,
      cachePrefix: "test-mod",
      label: "test/modinfo.json",
    });

    assert.equal(existsSync(join(outDir, "patches.json")), false);
  } finally {
    rmSync(modDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("buildPatches still writes patches.json when patches exist", async () => {
  const modDir = mkdtempSync(join(tmpdir(), "build-patches-mod-"));
  const outDir = mkdtempSync(join(tmpdir(), "build-patches-out-"));
  try {
    writeFileSync(
      join(modDir, "modinfo.json"),
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
      join(modDir, "patches.json"),
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

    await buildPatches(outDir, {
      modDir,
      cachePrefix: "test-mod",
      label: "test/modinfo.json",
    });

    assert.equal(existsSync(join(outDir, "patches.json")), true);
  } finally {
    rmSync(modDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
});
