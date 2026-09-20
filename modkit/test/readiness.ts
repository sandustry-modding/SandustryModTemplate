/** Void `?db_load=` can spend ~30s in shader warmup after scene switches to Game. */
export const GAME_READY_TIMEOUT_MS = 120_000;
export const GAME_READY_POLL_MS = 500;

export type RendererReadySnapshot = {
  api: boolean;
  scene: number | null;
  game: number | null;
  gameReady: boolean;
  loading: boolean;
};

export function isRendererReady(snapshot: RendererReadySnapshot): boolean {
  return (
    snapshot.api &&
    snapshot.game != null &&
    snapshot.scene === snapshot.game &&
    snapshot.gameReady &&
    !snapshot.loading
  );
}

/**
 * Runs in the Chromium renderer via CDP.
 * Scene Game alone is too early: boot can still be rasterizing and compiling shaders.
 */
export function readRendererReadySnapshot(): RendererReadySnapshot {
  const g = globalThis as typeof globalThis & {
    sandkit?: {
      api?: unknown;
      enums?: { Scene?: { Game?: number } };
      engine?: {
        state?: {
          store?: { scene?: { active?: number } };
          sandkit?: { gameReady?: boolean };
        };
      };
    };
  };
  const sk = typeof sandkit !== "undefined" ? sandkit : g.sandkit;
  const state = sk?.engine?.state as
    | {
        store?: { scene?: { active?: number } };
        sandkit?: { gameReady?: boolean };
      }
    | undefined;
  return {
    api: Boolean(sk?.api),
    scene: state?.store?.scene?.active ?? null,
    game: sk?.enums?.Scene?.Game ?? null,
    gameReady: Boolean(state?.sandkit?.gameReady),
    loading: Boolean(document.getElementById("loading")),
  };
}

export function formatRendererReadySnapshot(snapshot: RendererReadySnapshot): string {
  try {
    return JSON.stringify(snapshot);
  } catch {
    return String(snapshot);
  }
}
