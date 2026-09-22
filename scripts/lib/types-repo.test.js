import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TYPES_REMOTE, ensureTypesRepo, syncTypesRepo, typesRepoPath } from "./types-repo.js";

test("ensureTypesRepo returns SandustryTypes/ when it is already a git clone", () => {
  const root = mkdtempSync(join(tmpdir(), "types-repo-"));
  try {
    const dest = typesRepoPath(root);
    mkdirSync(join(dest, ".git"), { recursive: true });
    const calls = [];
    assert.equal(
      ensureTypesRepo(root, {
        clone: (args) => {
          calls.push(args);
          return { status: 0 };
        },
      }),
      dest,
    );
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureTypesRepo rejects a non-git SandustryTypes/ folder", () => {
  const root = mkdtempSync(join(tmpdir(), "types-repo-"));
  try {
    mkdirSync(join(root, "SandustryTypes"));
    assert.throws(() => ensureTypesRepo(root, { clone: () => ({ status: 0 }) }), /not a git clone/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureTypesRepo clones the org types repo when SandustryTypes/ is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "types-repo-"));
  try {
    const calls = [];
    const dest = ensureTypesRepo(root, {
      clone: (args) => {
        calls.push(args);
        mkdirSync(join(root, "SandustryTypes", ".git"), { recursive: true });
        return { status: 0 };
      },
    });
    assert.equal(dest, join(root, "SandustryTypes"));
    assert.deepEqual(calls, [["clone", TYPES_REMOTE, "SandustryTypes"]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("syncTypesRepo fast-forwards when git fetch and pull succeed", () => {
  const root = mkdtempSync(join(tmpdir(), "types-repo-"));
  try {
    mkdirSync(join(root, "SandustryTypes", ".git"), { recursive: true });
    const calls = [];
    const result = syncTypesRepo(root, {
      run: (args, opts) => {
        calls.push({ args, cwd: opts.cwd });
        return { status: 0 };
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
      { args: ["fetch", "origin"], cwd: join(root, "SandustryTypes") },
      { args: ["pull", "--ff-only", "origin", "main"], cwd: join(root, "SandustryTypes") },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
