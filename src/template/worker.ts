/**
 * Simulation workers. Type against WorkerSandkitApi, not SandkitApi.
 * The game loads this script on every sim worker.
 * Restart the game after you change this file.
 */
import { templateLiveConfig } from "./config.ts";
import {
  registerWorker as registerSparkDustWorker,
  resolveSparkDustTypes,
} from "./spark-dust/worker.ts";

const workerApi = sandkit.api as unknown as WorkerSandkitApi;

templateLiveConfig.get();
templateLiveConfig.listen(workerApi);

let booted = false;

function boot(): void {
  if (booted) return;
  registerSparkDustWorker(workerApi, resolveSparkDustTypes(workerApi));
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
