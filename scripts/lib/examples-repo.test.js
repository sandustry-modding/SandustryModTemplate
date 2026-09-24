import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EXAMPLES_DIR, EXAMPLES_REMOTE, ensureExamplesRepo } from "./examples-repo.js";

test("ensureExamplesRepo returns src/examples when it is already a git clone", () => {
  const root = mkdtempSync(join(tmpdir(), "examples-repo-"));
  try {
    const dest = join(root, EXAMPLES_DIR);
    mkdirSync(join(dest, ".git"), { recursive: true });
    const calls = [];
    assert.equal(
      ensureExamplesRepo(root, {
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

test("ensureExamplesRepo rejects a non-git src/examples folder", () => {
  const root = mkdtempSync(join(tmpdir(), "examples-repo-"));
  try {
    mkdirSync(join(root, EXAMPLES_DIR), { recursive: true });
    assert.throws(
      () => ensureExamplesRepo(root, { clone: () => ({ status: 0 }) }),
      /not a git clone/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureExamplesRepo clones SandustryExamples into src/examples", () => {
  const root = mkdtempSync(join(tmpdir(), "examples-repo-"));
  try {
    const calls = [];
    const dest = ensureExamplesRepo(root, {
      clone: (args) => {
        calls.push(args);
        mkdirSync(join(root, EXAMPLES_DIR, ".git"), { recursive: true });
        return { status: 0 };
      },
    });
    assert.equal(dest, join(root, "src", "examples"));
    assert.deepEqual(calls, [["clone", EXAMPLES_REMOTE, EXAMPLES_DIR]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureExamplesRepo throws when git clone fails", () => {
  const root = mkdtempSync(join(tmpdir(), "examples-repo-"));
  try {
    assert.throws(
      () => ensureExamplesRepo(root, { clone: () => ({ status: 1 }) }),
      /Failed to clone/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
