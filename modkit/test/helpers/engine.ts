/**
 * Page functions that reach into engine state.
 *
 * These run in the renderer, serialized by `toPageExpression`, so each one has
 * to stand on its own: page globals and its own arguments, nothing from this
 * module. Callers that are themselves serialized pass them through `include`.
 */

/**
 * Pause or resume the game, the way the pause menu does.
 *
 * Two loops have to be told. `session.paused` gates the renderer's frame loop,
 * which draws and hands queued world writes to the simulation. `SetPaused`
 * gates the manager worker, which is what actually ticks that simulation. Setting the renderer
 * flag alone leaves sand falling. The game's own pause is the same pair.
 *
 * `setPaused` is `WORKER_MESSAGE.SetPaused`, passed in because this function is
 * copied into the page without the module around it.
 */
export function pauseEngineInPage(paused: boolean, setPaused: number): void {
  const engineState = (
    globalThis as typeof globalThis & {
      sandkit?: {
        engine?: {
          state?: {
            session?: { paused?: boolean };
            environment?: { multithreading?: { simulation?: { manager?: Worker } } };
          };
        };
      };
    }
  ).sandkit?.engine?.state;
  if (!engineState?.session) throw new Error("Sandustry session state is unavailable");
  engineState.session.paused = paused;
  engineState.environment?.multithreading?.simulation?.manager?.postMessage([setPaused, paused]);
}

/**
 * Set the simulation speed multiplier the manager worker applies to each frame.
 *
 * `setSimulationSpeed` is `WORKER_MESSAGE.SetSimulationSpeed`, passed in for the
 * same reason as above.
 */
export function setSimulationSpeedInPage(setSimulationSpeed: number, speed: number): void {
  const engineState = (
    globalThis as typeof globalThis & {
      sandkit?: {
        engine?: {
          state?: { environment?: { multithreading?: { simulation?: { manager?: Worker } } } };
        };
      };
    }
  ).sandkit?.engine?.state;
  const manager = engineState?.environment?.multithreading?.simulation?.manager;
  if (!manager) throw new Error("Sandustry simulation workers are unavailable");
  manager.postMessage([setSimulationSpeed, speed]);
}
