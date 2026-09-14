/**
 * Local dev setup: check the machine, extract Sandustry from app.asar, link logs.
 * Usage: npm run setup
 *
 * Checks: Node major, root npm packages, per-mod node_modules,
 * Sandustry binary, app.asar, Steam [mods] beta, sandkit in the extracted bundle.
 *
 * Layout:
 *   sandustry/source/     app.asar files except node_modules (refreshed each setup)
 *   dist/                 symlink (Linux) / junction (Windows) to sandustry mods folder
 *   sandustry/logs/       symlink (Linux) / junction (Windows) to OS sandustry logs
 *   sandustry/saves/      link to OS saves
 *   sandustry/workshop/   link to Steam Workshop content
 *   docs/                 clone of sandustry-modding.github.io
 *                Linux: ~/.config/sandustry/logs
 *                Windows: %APPDATA%/sandustry/logs
 */
import { extractFile, listPackage } from "@electron/asar";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { asarExtractPath, asarRelPath } from "../lib/asar-path.js";
import {
  ensureDirectoryLink,
  sandustryLogsDir,
  sandustryModsDir,
  sandustrySavesDir,
  sandustryWorkshopDir,
  steamLibraryRoots,
} from "../lib/paths.js";
import { ensureAllModDebugSaves } from "../lib/debug-save.js";
import { DEFAULT_MOD_ROOTS, discoverMods, loadMods } from "../lib/mods.js";
import { syncLaunchDebugModPicker } from "../lib/sync-debug-mod-picker.js";
import { ensureDocsRepo } from "../lib/docs-repo.js";
import { ensureRepoDistLink } from "../lib/mod-path.js";
import { SANDUSTRY, SANDUSTRY_DIR } from "../lib/sandustry-common.js";
import {
  BUNDLE_RELS,
  ensureExtractRoot,
  gameSourceDir,
  readBundleSandkitFromAsar,
  readGameVersionFromAsar,
  resolveGameBranchKey,
  sandustryExtractRoot,
  SOURCE_DIR,
} from "../lib/sandustry-extract.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const ENV_EXAMPLE = join(ROOT, ".env.example");
const ENV_FILE = join(ROOT, ".env");
const ASAR = join(SANDUSTRY_DIR, "resources/app.asar");
const EXTRACT_ROOT = sandustryExtractRoot(ROOT);
const SOURCE_DEST = gameSourceDir(EXTRACT_ROOT);
const LOGS_SRC = sandustryLogsDir();
const LOGS_DEST = join(EXTRACT_ROOT, "logs");
const MODS_DIR = sandustryModsDir();
const SAVES_SRC = sandustrySavesDir();
const SAVES_DEST = join(EXTRACT_ROOT, "saves");
const WORKSHOP_DEST = join(EXTRACT_ROOT, "workshop");
const SANDUSTRY_APP_ID = "2764460";
/** Previous references/ folder (source extract, logs link, workshop copies). */
const LEGACY_REFERENCES = join(ROOT, "references");

function isExtractableAsarFile(relPath) {
  if (!relPath) return false;
  if (relPath === "node_modules" || relPath.startsWith("node_modules/")) return false;
  return true;
}

const IS_WIN = process.platform === "win32";

let failCount = 0;
let warnCount = 0;

function ok(message) {
  console.log(`ok    ${message}`);
}

function warn(message) {
  warnCount += 1;
  console.warn(`warn  ${message}`);
}

function fail(message) {
  failCount += 1;
  console.error(`FAIL  ${message}`);
}

function expectedNodeMajor() {
  try {
    return Number.parseInt(readFileSync(join(ROOT, ".nvmrc"), "utf8").trim(), 10);
  } catch {
    return 24;
  }
}

function checkNode() {
  const expected = expectedNodeMajor();
  const actual = Number.parseInt(process.versions.node, 10);
  if (actual === expected) {
    ok(`Node ${process.versions.node}`);
    return;
  }
  if (actual < expected) {
    fail(`Node ${process.versions.node} — this template needs Node ${expected} (.nvmrc).`);
    return;
  }
  warn(`Node ${process.versions.node} — this template targets Node ${expected}.`);
}

function checkRootInstall() {
  const esbuild = join(ROOT, "node_modules/esbuild");
  const asar = join(ROOT, "node_modules/@electron/asar");
  if (existsSync(esbuild) && existsSync(asar)) {
    ok("Root npm packages (esbuild, @electron/asar)");
    return;
  }
  fail("Root node_modules is incomplete. Run npm install in the repo root.");
}

function checkModPackageInstalls() {
  if (!existsSync(join(ROOT, "src"))) {
    fail("src/ folder is missing.");
    return;
  }

  /** @type {string[]} */
  const missing = [];
  for (const { folder, root, dir } of discoverMods()) {
    if (!existsSync(join(dir, "package.json"))) continue;
    if (!existsSync(join(dir, "node_modules"))) missing.push(`${root}/${folder}`);
  }

  if (missing.length === 0) {
    ok("Mod npm packages (package.json in src/ or examples/)");
    return;
  }
  fail(
    `Missing node_modules in ${missing.join(", ")}. Run npm install inside each of those folders (root npm install does not).`,
  );
}

function checkGameBinary() {
  if (existsSync(SANDUSTRY)) {
    ok(`Sandustry binary: ${SANDUSTRY}`);
    return true;
  }

  fail(`Sandustry binary not found: ${SANDUSTRY}`);
  if (IS_WIN) {
    fail(
      'Set SANDUSTRY to Sandustry.exe, for example: $env:SANDUSTRY="C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sandustry\\Sandustry.exe"',
    );
  } else {
    fail(
      "Set SANDUSTRY to the sandustry binary, for example: export SANDUSTRY=/path/to/steamapps/common/Sandustry/sandustry",
    );
  }
  return false;
}

function checkAsar() {
  if (existsSync(ASAR)) {
    ok(`Game asar: ${ASAR}`);
    return true;
  }
  fail(`Game asar not found: ${ASAR}`);
  fail("Install Sandustry from Steam and opt into the [mods] beta.");
  return false;
}

/** @param {string} installDir */
function appManifestPath(installDir) {
  const besideInstall = join(dirname(installDir), `appmanifest_${SANDUSTRY_APP_ID}.acf`);
  if (existsSync(besideInstall)) return besideInstall;

  for (const root of steamLibraryRoots()) {
    const candidate = join(root, "steamapps", `appmanifest_${SANDUSTRY_APP_ID}.acf`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** @param {string} acfPath */
function readSteamBetaKey(acfPath) {
  const text = readFileSync(acfPath, "utf8");
  const match = text.match(/"(?:BetaKey|betakey)"\s+"([^"]*)"/i);
  return match ? match[1].trim() : "";
}

function checkSteamModsBeta() {
  const acf = appManifestPath(SANDUSTRY_DIR);
  if (!acf) {
    warn(
      "Steam appmanifest_2764460.acf not found. Could not confirm the [mods] beta. Setup still checks sandkit in the asar.",
    );
    return;
  }

  const beta = readSteamBetaKey(acf);
  if (beta.toLowerCase() === "mods") {
    ok(`Steam [mods] beta (${acf})`);
    return;
  }
  if (!beta) {
    warn(
      `Steam listing has no BetaKey (${acf}). Opt into [mods] (Library → Properties → Betas) if mods do not load.`,
    );
    return;
  }
  ok(`Steam beta "${beta}" (${acf})`);
}

function removeLegacyReferencesDir() {
  if (!existsSync(LEGACY_REFERENCES)) return;
  rmSync(LEGACY_REFERENCES, { recursive: true, force: true });
  console.log("Removed legacy references/");
}

function removeLegacyRepoLogsLink() {
  const legacy = join(ROOT, "logs");
  if (!existsSync(legacy)) return;
  rmSync(legacy, { recursive: true, force: true });
  console.log("Removed legacy logs/ link at repo root.");
}

/** @param {string[]} listed @param {string | null | undefined} betaKey */
function resolveExtractProbe(listed, betaKey) {
  const version = readGameVersionFromAsar(ASAR, listed);
  const bundleProbe = readBundleSandkitFromAsar(ASAR, listed);
  const branchKey = resolveGameBranchKey(betaKey, bundleProbe?.hasSandkit ?? false);
  return {
    version,
    branchKey,
    bundleRel: bundleProbe?.rel ?? null,
  };
}

/** @param {string[]} listed */
function extractGameSource(listed) {
  rmSync(SOURCE_DEST, { recursive: true, force: true });
  mkdirSync(SOURCE_DEST, { recursive: true });

  let count = 0;
  for (const entry of listed) {
    const relPath = asarRelPath(entry);
    if (!isExtractableAsarFile(relPath)) continue;

    const dest = join(SOURCE_DEST, relPath);
    mkdirSync(dirname(dest), { recursive: true });
    try {
      writeFileSync(dest, extractFile(ASAR, asarExtractPath(entry)));
    } catch {
      continue;
    }
    count += 1;
  }

  if (count === 0) {
    fail("Extracted 0 files from app.asar.");
    return false;
  }

  ok(`Extracted ${count} asar files -> sandustry/${SOURCE_DIR}/`);
  return true;
}

/** @param {string | null} bundleRel @param {string | null | undefined} version @param {string} branchKey */
function checkSandkitInBundle(bundleRel, version, branchKey) {
  if (!bundleRel) {
    fail(`No ${BUNDLE_RELS.join(" or ")} in app.asar. Opt into the Steam [mods] beta.`);
    return;
  }

  const bundlePath = join(SOURCE_DEST, bundleRel);
  if (!existsSync(bundlePath)) {
    fail(`Extracted asar is missing ${bundleRel}.`);
    return;
  }

  const bundle = readFileSync(bundlePath, "utf8");
  if (bundle.includes("sandkit")) {
    const versionLabel = version ? `game ${version}` : "game";
    ok(`sandkit in sandustry/${SOURCE_DIR}/${bundleRel} (${versionLabel}, ${branchKey})`);
    return;
  }
  fail(
    `sandustry/${SOURCE_DIR}/${bundleRel} has no sandkit. Opt into the Steam [mods] beta (Library → Properties → Betas).`,
  );
}

function ensureUserDataDirs() {
  mkdirSync(MODS_DIR, { recursive: true });
  mkdirSync(LOGS_SRC, { recursive: true });
  mkdirSync(SAVES_SRC, { recursive: true });
  ok(`Game mods folder: ${MODS_DIR}`);
  ok(`Game logs folder: ${LOGS_SRC}`);
  ok(`Game saves folder: ${SAVES_SRC}`);
}

function syncDist() {
  try {
    const status = ensureRepoDistLink(ROOT, { quiet: true });
    if (status === "already") {
      ok(`Link dist/ -> ${MODS_DIR} (already linked)`);
      return;
    }
    if (status === "migrated") {
      ok(`Migrated dist/ per-mod links -> ${MODS_DIR}`);
      return;
    }
    ok(`Linked dist/ -> ${MODS_DIR}`);
  } catch (err) {
    fail(`Could not link dist/ to ${MODS_DIR}: ${err instanceof Error ? err.message : err}`);
  }
}

/** @param {string} label @param {"already" | "linked"} status @param {string} target */
function reportDirLink(label, status, target) {
  if (status === "already") {
    ok(`Link ${label} -> ${target} (already linked)`);
    return;
  }
  ok(`Linked ${label} -> ${target}`);
}

function syncLogs() {
  try {
    reportDirLink("sandustry/logs/", ensureDirectoryLink(LOGS_SRC, LOGS_DEST), LOGS_SRC);
  } catch (err) {
    fail(
      `Could not link sandustry/logs/ to ${LOGS_SRC}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

function syncSaves() {
  try {
    reportDirLink("sandustry/saves/", ensureDirectoryLink(SAVES_SRC, SAVES_DEST), SAVES_SRC);
  } catch (err) {
    fail(
      `Could not link sandustry/saves/ to ${SAVES_SRC}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

function syncWorkshop() {
  try {
    const target = sandustryWorkshopDir(SANDUSTRY);
    reportDirLink("sandustry/workshop/", ensureDirectoryLink(target, WORKSHOP_DEST), target);
  } catch (err) {
    fail(
      `Could not link sandustry/workshop/ to Steam Workshop content: ${err instanceof Error ? err.message : err}`,
    );
  }
}

function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    ok("Env file .env (already present)");
    return;
  }
  if (!existsSync(ENV_EXAMPLE)) {
    warn("Missing .env.example — skip creating .env");
    return;
  }
  copyFileSync(ENV_EXAMPLE, ENV_FILE);
  ok("Created .env from .env.example");
}

console.log("Sandustry mod template setup");
console.log("");

ensureEnvFile();
try {
  ensureDocsRepo(ROOT);
  ok("Docs site clone (docs/)");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Docs site clone: ${message}`);
}
checkNode();
checkRootInstall();
checkModPackageInstalls();

const haveBinary = checkGameBinary();
const haveAsar = haveBinary && checkAsar();
if (haveBinary) checkSteamModsBeta();

removeLegacyReferencesDir();
removeLegacyRepoLogsLink();

if (haveAsar) {
  ensureExtractRoot(EXTRACT_ROOT);
  const listed = listPackage(ASAR, { isPack: false });
  const acf = appManifestPath(SANDUSTRY_DIR);
  const betaKey = acf ? readSteamBetaKey(acf) : "";
  const probe = resolveExtractProbe(listed, betaKey);
  if (extractGameSource(listed)) {
    checkSandkitInBundle(probe.bundleRel, probe.version, probe.branchKey);
  }
}

ensureUserDataDirs();
syncDist();
syncLogs();
syncSaves();
syncWorkshop();
try {
  const folders = syncLaunchDebugModPicker();
  ok(`F5 mod picker (${folders.length} mod${folders.length === 1 ? "" : "s"})`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  warn(`F5 mod picker: ${message}`);
}
try {
  const mods = await loadMods([]);
  const srcMods = mods.filter((mod) => DEFAULT_MOD_ROOTS.includes(mod.root));
  const results = ensureAllModDebugSaves(srcMods);
  const created = results.filter((row) => row.created).length;
  ok(`Debug saves (${created} new, ${results.length} mod${results.length === 1 ? "" : "s"})`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  warn(`Debug saves: ${message}`);
}

console.log("");
if (failCount > 0) {
  console.error(`Setup failed (${failCount} error${failCount === 1 ? "" : "s"}).`);
  console.error("Fix the FAIL lines, then run npm run setup again.");
  console.error("Help: README.md (Troubleshooting).");
  process.exit(1);
}

if (warnCount > 0) {
  console.log(`Setup finished with ${warnCount} warning${warnCount === 1 ? "" : "s"}.`);
} else {
  console.log("Setup is ready.");
}
console.log("Next: npm run dev");
