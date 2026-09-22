import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  TYPES_REMOTE,
  ensureTypesRepo,
  isNpmTypesStub,
  syncTypesRepo,
  typesRepoPath,
} from "./types-repo.js";

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

test("ensureTypesRepo rejects a non-git SandustryTypes/ folder with package.json", () => {
  const root = mkdtempSync(join(tmpdir(), "types-repo-"));
  try {
    const dest = join(root, "SandustryTypes");
    mkdirSync(dest);
    writeFileSync(join(dest, "package.json"), "{}\n");
    assert.equal(isNpmTypesStub(dest), false);
    assert.throws(() => ensureTypesRepo(root, { clone: () => ({ status: 0 }) }), /not a git clone/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureTypesRepo replaces an npm ci stub and clones", () => {
  const root = mkdtempSync(join(tmpdir(), "types-repo-"));
  try {
    const dest = join(root, "SandustryTypes");
    mkdirSync(join(dest, "node_modules"), { recursive: true });
    assert.equal(isNpmTypesStub(dest), true);

    const removed = [];
    const calls = [];
    assert.equal(
      ensureTypesRepo(root, {
        remove: (path) => {
          removed.push(path);
          rmSync(path, { recursive: true, force: true });
        },
        clone: (args) => {
          calls.push(args);
          mkdirSync(join(root, "SandustryTypes", ".git"), { recursive: true });
          return { status: 0 };
        },
      }),
      dest,
    );
    assert.deepEqual(removed, [dest]);
    assert.deepEqual(calls, [["clone", TYPES_REMOTE, "SandustryTypes"]]);
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
