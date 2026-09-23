/**
 * Simulation workers. `sandkit.api` is WorkerSandkitApi here because this file
 * matches tsconfig.worker.json (`worker.ts` / `*.worker.ts`).
 * The game loads this script on every sim worker.
 * Restart the game after you change this file.
 */
import {
  registerWorker as registerElementWorker,
  resolveElementTypes,
} from "./element/worker.ts";

const api = sandkit.api;

let booted = false;

function boot(): void {
  if (booted) return;
  registerElementWorker(api, resolveElementTypes(api));
  booted = true;
}

try {
  boot();
} catch {
  api.events.on("worker:update:post", () => {
    try {
      boot();
    } catch {
      /* main registration may still be in flight */
    }
  });
}
