/**
 * Run TypeScript tests with the Node test runner (Node 24 strips types).
 * `--import` maps `@modkit/*` because Node does not use tsconfig paths.
 *
 * `npm test` — unit files only (no Chromium).
 * `npm run test:integration` — boot extracted dist in Chrome, then `*.integration.test.ts`.
 */
import { globSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startSandustryTestHost, stopSandustryTestHost } from "../../modkit/test/host.ts";
import { filterIntegrationFiles, integrationTestRepoPaths } from "./integration-select.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const REGISTER = join(ROOT, "scripts/test/register-modkit.js");

/** Strip integration-runner flags before mod/test selection. */
function integrationArgv(argv = process.argv.slice(2)) {
  return argv.filter((arg) => arg !== "--view");
}

function collectUnitFiles() {
  return [
    ...globSync("src/**/*.test.ts", { cwd: ROOT }),
    ...globSync("modkit/**/*.test.ts", { cwd: ROOT }),
    ...globSync("scripts/**/*.test.js", { cwd: ROOT }),
  ]
    .filter(
      (file) =>
        !file.endsWith(".integration.test.ts") &&
        !file.endsWith("/integration.test.ts") &&
        file !== "integration.test.ts",
    )
    .sort();
}

function collectIntegrationFiles() {
  const files = [
    ...globSync("src/**/*.integration.test.ts", { cwd: ROOT }),
    ...globSync("src/**/integration.test.ts", { cwd: ROOT }),
    ...globSync("modkit/**/*.integration.test.ts", { cwd: ROOT }),
    ...globSync("modkit/**/integration.test.ts", { cwd: ROOT }),
  ];
  return [...new Set(files)].sort();
}

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
function collectSelectedIntegrationFiles(argv) {
  return filterIntegrationFiles(collectIntegrationFiles(), integrationTestRepoPaths(argv));
}

function extraTestFlags() {
  return process.argv.slice(2).filter((arg) => arg.startsWith("--test-"));
}

function run(args, extraEnv) {
  return spawnSync(process.execPath, ["--import", REGISTER, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  });
}

/**
 * Async spawn so the integration host HTTP server can keep answering while
 * tests run. `spawnSync` freezes the host event loop and hangs page/Node fetches.
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 * @returns {Promise<{ status: number | null }>}
 */
function runAsync(args, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", REGISTER, ...args], {
      cwd: ROOT,
      stdio: "inherit",
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    });
    child.on("error", () => resolve({ status: 1 }));
    child.on("exit", (code, signal) => {
      resolve({ status: code ?? (signal ? 1 : 0) });
    });
  });
}

/**
 * @param {{
 *   integration?: boolean;
 *   modIds?: string[];
 *   visible?: boolean;
 *   argv?: string[];
 * }} [options]
 * @returns {Promise<number>}
 */
export async function runNodeTests(options) {
  const integration = options?.integration === true;
  const argv = integration
    ? integrationArgv(options?.argv ?? process.argv.slice(2))
    : process.argv.slice(2);
  let files;
  try {
    files = integration ? collectSelectedIntegrationFiles(argv) : collectUnitFiles();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (files.length === 0) {
    console.error(
      integration
        ? argv.some((arg) => arg === "--mod" || arg.startsWith("--mod=")) ||
          argv.some((arg) => !arg.startsWith("-"))
          ? "No integration tests match the selected mods."
          : "No integration tests found (*.integration.test.ts)."
        : "No tests found (src/**/*.test.ts, modkit/**/*.test.ts).",
    );
    return 1;
  }

  if (!integration) {
    const result = run(["--test", ...extraTestFlags(), ...files.map((file) => join(ROOT, file))]);
    return result.status ?? 1;
  }

  const host = await startSandustryTestHost({
    persist: true,
    visible: options?.visible === true,
    ...(options?.modIds ? { modIds: options.modIds } : {}),
  });
  if (!host.ok) {
    console.error(`Integration host failed: ${host.reason}`);
    return 1;
  }
  console.log(`Integration host ready (${options?.visible ? "window" : "headless"}, CDP :9224)`);
  if (options?.modIds) {
    console.log(`Integration tests: ${files.join(", ")}`);
  }

  let status = 1;
  try {
    const result = await runAsync(
      [
        "--test",
        "--test-concurrency=1",
        "--test-isolation=process",
        ...extraTestFlags(),
        ...files.map((file) => join(ROOT, file)),
      ],
      {
        SANDUSTRY_TEST_HOST: "1",
        ...(options?.visible === true ? { SANDUSTRY_TEST_VIEW: "1" } : {}),
      },
    );
    status = result.status ?? 1;
  } finally {
    await stopSandustryTestHost();
  }

  return status;
}
