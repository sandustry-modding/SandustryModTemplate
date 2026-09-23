import assert from "node:assert/strict";
import * as esbuild from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  blockMainWorkerImportsPlugin,
  isWorkerModulePath,
} from "./block-main-worker-imports.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const FIXTURE_ROOT = join(ROOT, ".tmp", "block-main-worker-imports-test");

test("isWorkerModulePath matches worker entry naming", () => {
  assert.equal(isWorkerModulePath("/src/template/worker.ts"), true);
  assert.equal(isWorkerModulePath("/src/foo/bar.worker.ts"), true);
  assert.equal(isWorkerModulePath("/src/foo/main.ts"), false);
  assert.equal(
    isWorkerModulePath("/node_modules/modern-gif/dist/worker.js"),
    false,
  );
});

test("main bundle rejects imports of worker.ts", async () => {
  const featureDir = join(FIXTURE_ROOT, "feature");
  mkdirSync(featureDir, { recursive: true });
  writeFileSync(
    join(FIXTURE_ROOT, "main.ts"),
    'import "./feature/worker.ts";\nconsole.log("main");\n',
  );
  writeFileSync(join(featureDir, "worker.ts"), "export const x = 1;\n");

  const result = await esbuild
    .build({
      absWorkingDir: FIXTURE_ROOT,
      entryPoints: [join(FIXTURE_ROOT, "main.ts")],
      bundle: true,
      write: false,
      logLevel: "silent",
      plugins: [blockMainWorkerImportsPlugin()],
    })
    .catch((error) => error);

  assert.ok(result instanceof Error);
  assert.match(String(result), /Main bundle cannot import worker module/);
});

test("bundle without the plugin may import worker.ts", async () => {
  const result = await esbuild.build({
    absWorkingDir: FIXTURE_ROOT,
    entryPoints: [join(FIXTURE_ROOT, "main.ts")],
    bundle: true,
    write: false,
    logLevel: "silent",
  });

  assert.equal(result.errors.length, 0);
});
