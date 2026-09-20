import * as esbuild from "esbuild";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";
import { isSandustryAvailable, CdpConnection } from "./cdp.ts";
import { WORKER_MESSAGE } from "./clock.ts";
import { pauseEngineInPage } from "./helpers/engine.ts";
import { spawnChrome, stopChild, resolveChrome } from "./chrome.ts";
import { rewriteAssetJoinForHttp } from "./asset-join.ts";
import { companionSettings, copyTestMods, listWorkshopMods } from "./mods.ts";
import {
  extractedDistDir,
  SANDUSTRY_TEST_HTTP_PORT,
  sandustryTestMockPath,
  sandustryTestSavesDir,
  repoRoot,
  sandustryTestHostFile,
  sandustryTestModsDir,
  sandustryTestUserDataDir,
  SANDUSTRY_TEST_CDP_PORT,
} from "./paths.ts";
import {
  formatRendererReadySnapshot,
  GAME_READY_POLL_MS,
  GAME_READY_TIMEOUT_MS,
  isRendererReady,
  readRendererReadySnapshot,
} from "./readiness.ts";
import { parseSaveFile, readSaveMetaLine, installEmptySave } from "./saves.ts";
import { toPageExpression } from "./serialize.ts";
import { buildPatchedDistSources } from "./patched-dist.ts";

export type { HostWindowMode } from "./chrome.ts";
export { hostWindowMode } from "./chrome.ts";

export type HostStartResult = { ok: true; reused: boolean } | { ok: false; reason: string };

export type TestHttpServer = {
  port: number;
  distDir: string;
  saveId: string | null;
  origin: string;
  patchedJs: Map<string, string>;
  close: () => Promise<void>;
};

type HostRecord = {
  pid: number;
  port: string;
  launchedAt: number;
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".glsl": "text/plain",
};

const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cache-Control": "no-store",
  Connection: "close",
};

type Runtime = { http: TestHttpServer; chrome: ChildProcess | null };

let runtime: Runtime | null = null;

function send(
  response: ServerResponse,
  status: number,
  body: string | Buffer,
  contentType: string,
): void {
  response.writeHead(status, { ...ISOLATION_HEADERS, "Content-Type": contentType });
  response.end(body);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  send(response, status, `${JSON.stringify(value)}\n`, "application/json");
}

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const rel = decoded.replace(/^\/+/, "").replaceAll("/", sep);
  const full = normalize(join(root, rel));
  const relToRoot = relative(root, full);
  if (!relToRoot || relToRoot.startsWith("..") || relToRoot.startsWith(sep)) return null;
  return full;
}

function wrapIndexHtml(distDir: string): string {
  const html = readFileSync(join(distDir, "index.html"), "utf8");
  const injected = '<script src="/electron-mock.js"></script>\n    ';
  if (html.includes("/electron-mock.js")) return html;
  return html.replace(
    '<script type="module" src="js/bundle.js"></script>',
    `${injected}<script type="module" src="js/bundle.js"></script>`,
  );
}

function mergedSettingsJson(modIds: string[]): string {
  const companion = companionSettings(modIds);
  // Do not merge the developer Steam settings file. It seeds unrelated mod ids.
  return JSON.stringify({
    settingsVersion: 12,
    windowMode: "windowed",
    autosaveInterval: 0,
    locale: "en",
    customMaps: { showCustomMaps: true },
    sound: companion.sound,
    externalModSettings: companion.externalModSettings,
  });
}

function prepareSaves(): { saveId: string; ids: string[]; saves: Record<string, unknown> } {
  const dest = sandustryTestSavesDir();
  const installed = installEmptySave(dest);
  return { saveId: installed.id, ids: [installed.id], saves: { [installed.id]: installed.data } };
}

export function prepareSandustryTestUserData(options?: { ids?: readonly string[] }): {
  mods: string[];
  saveId: string | null;
} {
  mkdirSync(sandustryTestUserDataDir(), { recursive: true });
  const mods = copyTestMods(options?.ids ? { ids: options.ids } : undefined);
  const saves = prepareSaves();
  return { mods, saveId: saves.saveId };
}

async function buildElectronMock(
  saveIds: string[],
  lastPlayedRaw: string,
  saves: Record<string, unknown>,
  modIds: string[],
): Promise<void> {
  const entry = fileURLToPath(new URL("./electron-mock.ts", import.meta.url));
  mkdirSync(sandustryTestUserDataDir(), { recursive: true });
  await esbuild.build({
    absWorkingDir: repoRoot(),
    bundle: true,
    entryPoints: [entry],
    format: "iife",
    outfile: sandustryTestMockPath(),
    platform: "browser",
    target: "es2020",
    define: {
      __TEST_HOST_SETTINGS__: JSON.stringify(mergedSettingsJson(modIds)),
      __TEST_HOST_LAST_PLAYED__: JSON.stringify(lastPlayedRaw),
      __TEST_HOST_SAVE_IDS__: JSON.stringify(saveIds),
      __TEST_HOST_SAVES__: JSON.stringify(saves),
    },
  });
}

function loadSavePayload(
  id: string,
): { success: true; data: unknown } | { success: false; error: string } {
  const filePath = join(sandustryTestSavesDir(), `${id}.save`);
  if (!existsSync(filePath)) return { success: false, error: `Save not found: "${id}"` };
  try {
    const parsed = parseSaveFile(filePath);
    return { success: true, data: parsed.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function listSaves(): unknown[] {
  if (!existsSync(sandustryTestSavesDir())) return [];
  const out: unknown[] = [];
  for (const name of readdirSync(sandustryTestSavesDir())) {
    if (!name.endsWith(".save")) continue;
    const meta = readSaveMetaLine(join(sandustryTestSavesDir(), name));
    if (meta) out.push(meta);
  }
  return out;
}

function isFile(filePath: string | null): filePath is string {
  return Boolean(filePath && existsSync(filePath) && statSync(filePath).isFile());
}

/**
 * Vanilla bundle textures use `/mods/<file>.png` under extracted `dist/mods/`.
 * Live test mods use `/mods/<id>/...` under the isolated test mods folder.
 */
export function resolveHostStaticFile(
  distDir: string,
  testModsDir: string,
  urlPath: string,
): string | null {
  const pathOnly = urlPath.split("?")[0] ?? "";
  if (pathOnly.startsWith("/mods/")) {
    const live = safeJoin(testModsDir, pathOnly.slice("/mods".length));
    if (isFile(live)) return live;
    const vanilla = safeJoin(distDir, pathOnly);
    return isFile(vanilla) ? vanilla : null;
  }
  const distFile = safeJoin(distDir, pathOnly);
  return isFile(distFile) ? distFile : null;
}

function sendResolvedFile(filePath: string, response: ServerResponse): void {
  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  send(response, 200, readFileSync(filePath), type);
}

function serveStatic(
  distDir: string,
  urlPath: string,
  response: ServerResponse,
  patchedJs: Map<string, string>,
): void {
  if (urlPath === "/" || urlPath.startsWith("/?")) {
    send(response, 200, wrapIndexHtml(distDir), "text/html; charset=utf-8");
    return;
  }
  if (urlPath === "/electron-mock.js" || urlPath.startsWith("/electron-mock.js?")) {
    send(
      response,
      200,
      readFileSync(sandustryTestMockPath()),
      "application/javascript; charset=utf-8",
    );
    return;
  }
  const pathOnly = urlPath.split("?")[0] ?? "";
  if (pathOnly === "/js/bundle.js") {
    const raw =
      patchedJs.get("js/bundle.js") ?? readFileSync(join(distDir, "js", "bundle.js"), "utf8");
    send(response, 200, rewriteAssetJoinForHttp(raw), "application/javascript; charset=utf-8");
    return;
  }
  if (pathOnly.startsWith("/js/") && patchedJs.has(pathOnly.slice(1))) {
    send(
      response,
      200,
      patchedJs.get(pathOnly.slice(1)) ?? "",
      "application/javascript; charset=utf-8",
    );
    return;
  }
  const resolved = resolveHostStaticFile(distDir, sandustryTestModsDir(), urlPath);
  if (resolved) {
    sendResolvedFile(resolved, response);
    return;
  }
  send(response, 404, "Not found", "text/plain; charset=utf-8");
}

async function startHttpHost(options?: { modIds?: readonly string[] }): Promise<TestHttpServer> {
  const distDir = extractedDistDir();
  if (!distDir) {
    throw new Error("No sandustry/source/dist. Run npm run setup.");
  }

  const prepared = prepareSandustryTestUserData(
    options?.modIds ? { ids: options.modIds } : undefined,
  );
  const lastPlayedRaw = prepared.saveId ? JSON.stringify({ id: prepared.saveId }) : "";
  const saveIds = prepared.saveId ? [prepared.saveId] : [];
  const saves: Record<string, unknown> = {};
  if (prepared.saveId) {
    const parsed = parseSaveFile(join(sandustryTestSavesDir(), `${prepared.saveId}.save`));
    saves[prepared.saveId] = parsed.data;
  }
  await buildElectronMock(saveIds, lastPlayedRaw, saves, prepared.mods);
  const patchedJs = buildPatchedDistSources(distDir);

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = request.url ?? "/";
    try {
      if (url.startsWith("/__host/load")) {
        const id = new URL(url, "http://127.0.0.1").searchParams.get("id") ?? "";
        sendJson(response, 200, loadSavePayload(id));
        return;
      }
      if (url.startsWith("/__host/saves")) {
        sendJson(response, 200, listSaves());
        return;
      }
      if (url.startsWith("/__host/mods")) {
        sendJson(response, 200, {
          ok: true,
          data: { mods: listWorkshopMods(), diagnostics: [] },
          error: null,
        });
        return;
      }
      serveStatic(distDir, url, response, patchedJs);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(SANDUSTRY_TEST_HTTP_PORT, "127.0.0.1", () => resolve());
  });

  return {
    port: SANDUSTRY_TEST_HTTP_PORT,
    distDir,
    saveId: prepared.saveId,
    origin: `http://127.0.0.1:${SANDUSTRY_TEST_HTTP_PORT}`,
    patchedJs,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}

function writeHostRecord(record: HostRecord): void {
  mkdirSync(dirname(sandustryTestHostFile()), { recursive: true });
  writeFileSync(sandustryTestHostFile(), `${JSON.stringify(record, null, 2)}\n`);
}

async function waitForGameReady(options?: { visible?: boolean }): Promise<boolean> {
  const deadline = Date.now() + GAME_READY_TIMEOUT_MS;
  let lastSnapshot = "no CDP snapshot";
  while (Date.now() < deadline) {
    if (!(await isSandustryAvailable(SANDUSTRY_TEST_CDP_PORT))) {
      await sleep(GAME_READY_POLL_MS);
      continue;
    }
    let cdp: CdpConnection | undefined;
    try {
      cdp = await CdpConnection.connect({ timeoutMs: 8000 });
      const snapshot = (await cdp.evaluate(
        toPageExpression(readRendererReadySnapshot),
      )) as ReturnType<typeof readRendererReadySnapshot>;
      lastSnapshot = formatRendererReadySnapshot(snapshot);
      if (isRendererReady(snapshot)) {
        await cdp.lockViewport({ visible: options?.visible === true });
        await cdp.evaluate(toPageExpression(pauseEngineInPage, [true, WORKER_MESSAGE.SetPaused]));
        cdp.close();
        return true;
      }
      cdp.close();
    } catch {
      cdp?.close();
    }
    await sleep(GAME_READY_POLL_MS);
  }
  console.error(`Integration host boot timed out: ${lastSnapshot}`);
  return false;
}

export async function stopSandustryTestHost(): Promise<void> {
  if (runtime) {
    stopChild(runtime.chrome);
    await runtime.http.close();
    runtime = null;
  } else {
    stopChild(null);
  }
  try {
    unlinkSync(sandustryTestHostFile());
  } catch {
    /* missing */
  }
}

export async function startSandustryTestHost(options?: {
  persist?: boolean;
  visible?: boolean;
  modIds?: readonly string[];
}): Promise<HostStartResult> {
  const visible = options?.visible === true;
  if (await isSandustryAvailable(SANDUSTRY_TEST_CDP_PORT)) {
    if (process.env.SANDUSTRY_TEST_HOST === "1" && !options?.persist) {
      return { ok: true, reused: true };
    }
    await stopSandustryTestHost();
  }
  if (process.env.SANDUSTRY_TEST_HOST === "1" && !options?.persist) {
    return { ok: false, reason: "Integration host did not start" };
  }

  const chrome = resolveChrome();
  if (!chrome) {
    return { ok: false, reason: "Chrome/Chromium not found. Set CHROME or install google-chrome." };
  }
  if (!extractedDistDir()) {
    return { ok: false, reason: "No sandustry/source/dist. Run npm run setup." };
  }
  if (visible && process.platform === "linux" && !process.env.DISPLAY) {
    return { ok: false, reason: "DISPLAY is missing" };
  }

  let http: TestHttpServer;
  try {
    http = await startHttpHost(options?.modIds ? { modIds: options.modIds } : undefined);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }

  const url = http.saveId
    ? `${http.origin}/?db_load=${encodeURIComponent(http.saveId)}`
    : http.origin;
  const child = spawnChrome(chrome, url, visible);
  runtime = { http, chrome: child };
  if (typeof child.pid === "number") {
    writeHostRecord({ pid: child.pid, port: SANDUSTRY_TEST_CDP_PORT, launchedAt: Date.now() });
  }

  const ready = await waitForGameReady({ visible });
  if (!ready) {
    await stopSandustryTestHost();
    return {
      ok: false,
      reason:
        "Game did not finish booting (game:ready and loading overlay). See .tmp/sandustry-test-chrome.log",
    };
  }
  return { ok: true, reused: false };
}
