import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { emptySaveFixturePath, installEmptySave, parseSaveFile } from "./saves.ts";
import { repoRoot } from "./paths.ts";

test("Empty.save fixture is a Void world with a gzip body", () => {
  const parsed = parseSaveFile(emptySaveFixturePath());
  assert.equal(typeof parsed.meta.id, "string");
  assert.ok(parsed.meta.id.length > 0);
  const name = parsed.meta.name;
  assert.equal(typeof name, "string");
  assert.ok(name && name.length > 0);
  assert.ok(parsed.data && typeof parsed.data === "object");
});

test("installEmptySave copies the fixture as {id}.save", () => {
  const dest = join(repoRoot(), ".tmp", "empty-save-unit");
  mkdirSync(dest, { recursive: true });
  const installed = installEmptySave(dest);
  const destFile = join(dest, `${installed.id}.save`);
  assert.equal(existsSync(destFile), true);
  assert.equal(readFileSync(destFile).equals(readFileSync(emptySaveFixturePath())), true);
});
