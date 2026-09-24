import assert from "node:assert/strict";
import test from "node:test";
import {
  filterIntegrationFiles,
  integrationTestRepoPaths,
  normalizeIntegrationArgv,
} from "./integration-select.js";

const discovered = [
  { folder: "examples", root: "src", repoPath: "src/examples" },
  { folder: "template", root: "src", repoPath: "src/template" },
];

const files = [
  "src/examples/examples.integration.test.ts",
  "modkit/test/game.integration.test.ts",
  "src/template/template.integration.test.ts",
];

test("normalizeIntegrationArgv turns positional folders into --mod", () => {
  assert.deepEqual(normalizeIntegrationArgv(["--view", "examples"]), [
    "--view",
    "--mod",
    "examples",
  ]);
  assert.deepEqual(normalizeIntegrationArgv(["template", "examples"]), [
    "--mod",
    "template",
    "--mod",
    "examples",
  ]);
  assert.deepEqual(normalizeIntegrationArgv(["--mod", "template", "--view"]), [
    "--mod",
    "template",
    "--view",
  ]);
});

test("filterIntegrationFiles keeps the full list when no prefixes are set", () => {
  assert.deepEqual(filterIntegrationFiles(files, null), [...files].sort());
  assert.deepEqual(filterIntegrationFiles(files, []), [...files].sort());
});

test("filterIntegrationFiles keeps files under a selected mod folder", () => {
  assert.deepEqual(filterIntegrationFiles(files, ["src/examples"]), [
    "src/examples/examples.integration.test.ts",
  ]);
  assert.deepEqual(filterIntegrationFiles(files, ["src/template"]), [
    "src/template/template.integration.test.ts",
  ]);
});

test("filterIntegrationFiles does not match a sibling prefix", () => {
  assert.deepEqual(filterIntegrationFiles(files, ["src/example"]), []);
});

test("integrationTestRepoPaths maps --mod folders", () => {
  assert.deepEqual(integrationTestRepoPaths(["--mod", "examples"], discovered), ["src/examples"]);
  assert.deepEqual(
    integrationTestRepoPaths(["--mod", "examples", "--mod", "template"], discovered),
    ["src/examples", "src/template"],
  );
});

test("integrationTestRepoPaths maps positional mod folders", () => {
  assert.deepEqual(integrationTestRepoPaths(["examples"], discovered), ["src/examples"]);
  assert.deepEqual(integrationTestRepoPaths(["--view", "template"], discovered), ["src/template"]);
});

test("integrationTestRepoPaths returns null when no mod is selected", () => {
  assert.equal(integrationTestRepoPaths(["--view"], discovered), null);
});

test("integrationTestRepoPaths rejects unknown --mod", () => {
  assert.throws(
    () => integrationTestRepoPaths(["--mod", "missing"], discovered),
    /Unknown mod "missing"/,
  );
});
