/**
 * Simulation workers. Type against WorkerSandkitApi, not SandkitApi.
 * The game loads this script on every sim worker.
 * Restart the game after you change this file.
 */
import {
  registerWorker as registerElementWorker,
  resolveElementTypes,
} from "./element/worker.ts";

const workerApi = sandkit.api as unknown as WorkerSandkitApi;

let booted = false;

function boot(): void {
  if (booted) return;
  registerElementWorker(workerApi, resolveElementTypes(workerApi));
  booted = true;
}

try {
  boot();
} catch {
  workerApi.events.on("worker:update:post", () => {
    try {
      boot();
    } catch {
      /* main registration may still be in flight */
    }
  });
}
