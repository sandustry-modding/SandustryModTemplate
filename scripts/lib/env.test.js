import assert from "node:assert/strict";
import test from "node:test";
import { envFlag, parseEnvText, resolveDevCleanup, resolveDevModsSetting } from "./env.js";

test("parseEnvText skips blank and comment lines", () => {
  assert.deepEqual(parseEnvText("\n# hi\n\nFOO=bar\n"), { FOO: "bar" });
});

test("envFlag accepts common truthy forms", () => {
  const prev = process.env.DEV_CLEANUP;
  try {
    process.env.DEV_CLEANUP = "yes";
    assert.equal(envFlag("DEV_CLEANUP", false), true);
    process.env.DEV_CLEANUP = "off";
    assert.equal(envFlag("DEV_CLEANUP", true), false);
  } finally {
    if (prev === undefined) delete process.env.DEV_CLEANUP;
    else process.env.DEV_CLEANUP = prev;
  }
});

test("resolveDevCleanup defaults off", () => {
  const prev = process.env.DEV_CLEANUP;
  try {
    delete process.env.DEV_CLEANUP;
    assert.equal(resolveDevCleanup(), "off");
    process.env.DEV_CLEANUP = "true";
    assert.equal(resolveDevCleanup(), "owned");
    process.env.DEV_CLEANUP = "all";
    assert.equal(resolveDevCleanup(), "all");
  } finally {
    if (prev === undefined) delete process.env.DEV_CLEANUP;
    else process.env.DEV_CLEANUP = prev;
  }
});

test("resolveDevModsSetting empty is selection", () => {
  assert.deepEqual(resolveDevModsSetting("", ""), { mode: "selection", alwaysFolders: [] });
});

test("resolveSandustryMonitor defaults to primary", async () => {
  const { resolveSandustryMonitor } = await import("./env.js");
  const prev = process.env.SANDUSTRY_MONITOR;
  try {
    delete process.env.SANDUSTRY_MONITOR;
    assert.equal(resolveSandustryMonitor(), "primary");
    process.env.SANDUSTRY_MONITOR = "primary";
    assert.equal(resolveSandustryMonitor(), "primary");
  } finally {
    if (prev === undefined) delete process.env.SANDUSTRY_MONITOR;
    else process.env.SANDUSTRY_MONITOR = prev;
  }
});

test("watchModFolders all mode returns empty filter", async () => {
  const { watchModFolders } = await import("./env.js");
  assert.deepEqual(
    watchModFolders({ all: false, folders: ["template"] }, { mode: "all", alwaysFolders: [] }),
    [],
  );
});
