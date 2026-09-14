import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DOCS_REMOTE, ensureDocsRepo } from "./docs-repo.js";

test("ensureDocsRepo returns docs/ when it is already a git clone", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-repo-"));
  try {
    const dest = join(root, "docs");
    mkdirSync(join(dest, ".git"), { recursive: true });
    const calls = [];
    assert.equal(
      ensureDocsRepo(root, {
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

test("ensureDocsRepo rejects a non-git docs/ folder", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-repo-"));
  try {
    mkdirSync(join(root, "docs"));
    assert.throws(
      () => ensureDocsRepo(root, { clone: () => ({ status: 0 }) }),
      /not a git clone/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureDocsRepo clones the org Pages repo when docs/ is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-repo-"));
  try {
    const calls = [];
    const dest = ensureDocsRepo(root, {
      clone: (args) => {
        calls.push(args);
        mkdirSync(join(root, "docs", ".git"), { recursive: true });
        return { status: 0 };
      },
    });
    assert.equal(dest, join(root, "docs"));
    assert.deepEqual(calls, [["clone", DOCS_REMOTE, "docs"]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ensureDocsRepo throws when git clone fails", () => {
  const root = mkdtempSync(join(tmpdir(), "docs-repo-"));
  try {
    assert.throws(
      () => ensureDocsRepo(root, { clone: () => ({ status: 1 }) }),
      /Failed to clone/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
