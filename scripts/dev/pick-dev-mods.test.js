import assert from "node:assert/strict";
import test from "node:test";
import { resolveWatchModArgs, selectionToModArgs } from "../dev/pick-dev-mods.js";
import { parseEnvText, resolveDevModsSetting, watchModFolders } from "../lib/env.js";

test("selectionToModArgs is empty for all mods", () => {
  assert.deepEqual(selectionToModArgs(null), []);
  assert.deepEqual(selectionToModArgs({ all: true }), []);
});

test("selectionToModArgs expands folders", () => {
  assert.deepEqual(selectionToModArgs({ all: false, folders: ["template", "trees"] }), [
    "--mod",
    "template",
    "--mod",
    "trees",
  ]);
});

test("parseEnvText keeps inline option comments out of values", () => {
  const parsed = parseEnvText(`
# comment
DEV_MODS=all # selection | all
DEV_ALWAYS_MODS=a,b # companions
DEV_CLEANUP=false # false keep | true remove owned | all wipe dist/
SANDUSTRY="/path/with # hash"
EMPTY=
`);
  assert.equal(parsed.DEV_MODS, "all");
  assert.equal(parsed.DEV_ALWAYS_MODS, "a,b");
  assert.equal(parsed.DEV_CLEANUP, "false");
  assert.equal(parsed.SANDUSTRY, "/path/with # hash");
  assert.equal(parsed.EMPTY, "");
});

test("resolveDevModsSetting modes", () => {
  assert.deepEqual(resolveDevModsSetting("all", ""), { mode: "all", alwaysFolders: [] });
  assert.deepEqual(resolveDevModsSetting("selection", ""), {
    mode: "selection",
    alwaysFolders: [],
  });
  assert.deepEqual(resolveDevModsSetting("selection", "template, trees"), {
    mode: "selection",
    alwaysFolders: ["template", "trees"],
  });
  assert.deepEqual(resolveDevModsSetting("all", "template"), {
    mode: "all",
    alwaysFolders: [],
  });
});

test("watchModFolders merges always folders with selection", () => {
  const valid = new Set(["template", "trees", "irishbruse.pick-block"]);
  const setting = {
    mode: /** @type {const} */ ("selection"),
    alwaysFolders: ["irishbruse.pick-block", "missing"],
  };
  assert.deepEqual(watchModFolders({ all: false, folders: ["template"] }, setting, valid), [
    "irishbruse.pick-block",
    "template",
  ]);
});

test("watchModFolders selection-only ignores empty always list", () => {
  assert.deepEqual(
    watchModFolders(
      { all: false, folders: ["template"] },
      { mode: "selection", alwaysFolders: [] },
      new Set(["template", "trees"]),
    ),
    ["template"],
  );
});

test("resolveWatchModArgs merges for DEV_ALWAYS_MODS list", () => {
  const prevMods = process.env.DEV_MODS;
  const prevAlways = process.env.DEV_ALWAYS_MODS;
  process.env.DEV_MODS = "selection";
  process.env.DEV_ALWAYS_MODS = "irishbruse.pick-block";
  try {
    assert.deepEqual(
      resolveWatchModArgs(
        { all: false, folders: ["template"] },
        new Set(["template", "irishbruse.pick-block"]),
      ),
      ["--mod", "irishbruse.pick-block", "--mod", "template"],
    );
  } finally {
    if (prevMods === undefined) delete process.env.DEV_MODS;
    else process.env.DEV_MODS = prevMods;
    if (prevAlways === undefined) delete process.env.DEV_ALWAYS_MODS;
    else process.env.DEV_ALWAYS_MODS = prevAlways;
  }
});
