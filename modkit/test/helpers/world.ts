import { WORKER_MESSAGE } from "../clock.ts";
import { pauseEngineInPage } from "./engine.ts";

export type StructurePlacement = {
  type: string | number;
  x: number;
  y: number;
  options?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

/**
 * Red Block platform at the Empty.save void spawn (cellId 15).
 * Coordinates are native cells; max values are exclusive.
 */
export const TEST_WORLD_RESERVED_BOXES = [
  {
    name: "red platform",
    minX: 496,
    minY: 512,
    maxXExclusive: 528,
    maxYExclusive: 514,
  },
] as const;

export type StructureLayoutSymbol = Omit<StructurePlacement, "x" | "y">;

export type StructureLayoutPhase = {
  cells: readonly string[];
  legend: Readonly<Record<string, StructureLayoutSymbol>>;
};

export type ElementSeed = {
  x: number;
  y: number;
  element: string | number;
  count?: number;
};

export type StructureLayout = {
  origin: { x: number; y: number };
  cells?: readonly string[];
  legend?: Readonly<Record<string, StructureLayoutSymbol>>;
  phases?: readonly StructureLayoutPhase[];
  seeds?: readonly ElementSeed[];
};

type WorldSession = {
  evaluate<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
    ...args: TArgs
  ): Promise<TResult>;
  waitFor<TArgs extends unknown[], T>(
    read: (...args: TArgs) => T | Promise<T>,
    match: (value: T) => boolean,
    options?: { args?: TArgs; message?: string },
  ): Promise<T>;
  setSimulationPaused(paused: boolean): Promise<void>;
  resumeSimulation(): Promise<void>;
};

/** Build several structures in one renderer turn and wait for their anchors. */
export async function buildStructures(
  session: WorldSession,
  placements: readonly StructurePlacement[],
): Promise<void> {
  if (placements.length === 0) return;
  for (const placement of placements) {
    const overlaps = TEST_WORLD_RESERVED_BOXES.find(
      (box) =>
        placement.x < box.maxXExclusive &&
        placement.x + 4 > box.minX &&
        placement.y < box.maxYExclusive &&
        placement.y + 4 > box.minY,
    );
    if (overlaps) {
      throw new Error(
        `Cannot build ${String(placement.type)} at ${placement.x},${placement.y}: ` +
          `overlaps the reserved ${overlaps.name} box ` +
          `${overlaps.minX},${overlaps.minY}..${overlaps.maxXExclusive},${overlaps.maxYExclusive}`,
      );
    }
  }
  const priorPaused = await session.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        sandkit?: { engine?: { state?: { session?: { paused?: boolean } } } };
      }
    ).sandkit?.engine?.state?.session;
    if (!state) throw new Error("Sandustry session state is unavailable");
    return Boolean(state.paused);
  });
  try {
    await session.resumeSimulation();
    await session.evaluate((items: readonly StructurePlacement[]) => {
      const api = (
        globalThis as typeof globalThis & {
          sandkit?: {
            api?: {
              structures?: {
                buildAtCell?: (
                  x: number,
                  y: number,
                  type: string | number,
                  options?: Record<string, unknown>,
                ) => void;
              };
            };
          };
        }
      ).sandkit?.api;
      if (typeof api?.structures?.buildAtCell !== "function") {
        throw new Error("Sandustry structures.buildAtCell is unavailable");
      }
      for (const item of items) {
        api.structures.buildAtCell(item.x, item.y, item.type, {
          ...item.options,
          ...(item.data ? { data: item.data } : {}),
        });
      }
    }, placements);

    await session.waitFor(
      (items: readonly StructurePlacement[]) => {
        const api = (
          globalThis as typeof globalThis & {
            sandkit?: {
              api?: {
                structures?: { getAtCell?: (x: number, y: number) => unknown };
              };
            };
          }
        ).sandkit?.api;
        return items.map((item) => {
          const structure = api?.structures?.getAtCell?.(item.x, item.y) as
            | { x: number; y: number; type: string | number }
            | null
            | undefined;
          if (!structure || structure.type !== item.type) return null;
          return { x: structure.x, y: structure.y, type: structure.type };
        });
      },
      (structures) => structures.every((structure) => structure !== null),
      {
        args: [placements],
        message: "Structures were not built at every requested anchor",
      },
    );

    const withData = placements.filter((item) => item.data);
    if (withData.length > 0) {
      await session.evaluate((items: readonly StructurePlacement[]) => {
        const structures = (
          globalThis as typeof globalThis & {
            sandkit?: {
              api?: {
                structures?: {
                  getAtCell?: (x: number, y: number) => unknown;
                  setData?: (structure: unknown, data: Record<string, unknown>) => void;
                };
              };
            };
          }
        ).sandkit?.api?.structures;
        if (typeof structures?.getAtCell !== "function") {
          throw new Error("Sandustry structures.getAtCell is unavailable");
        }
        if (typeof structures.setData !== "function") {
          throw new Error("Sandustry structures.setData is unavailable");
        }
        for (const item of items) {
          const structure = structures.getAtCell(item.x, item.y);
          if (!structure || !item.data) {
            throw new Error(`Sandustry could not initialize structure data at ${item.x},${item.y}`);
          }
          structures.setData(structure, item.data);
        }
      }, withData);
    }
  } finally {
    await session.setSimulationPaused(priorPaused);
  }
}

/** Build a readable 4-cell-grid fixture, optionally in explicit phases. */
export async function buildLayout(session: WorldSession, layout: StructureLayout): Promise<void> {
  const phases =
    layout.phases ??
    (layout.cells && layout.legend ? [{ cells: layout.cells, legend: layout.legend }] : []);
  if (phases.length === 0) {
    throw new Error("A structure layout needs cells and legend, or at least one phase");
  }
  if (layout.phases && (layout.cells || layout.legend)) {
    throw new Error("A structure layout cannot mix top-level cells/legend with phases");
  }
  for (const [index, phase] of phases.entries()) {
    const placements: StructurePlacement[] = [];
    const width = phase.cells[0]?.length ?? 0;
    if (width === 0 || phase.cells.some((row) => row.length !== width)) {
      throw new Error(`Structure layout phase ${index} must contain a non-empty rectangle`);
    }
    for (let row = 0; row < phase.cells.length; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const symbol = phase.cells[row]?.[column];
        if (!symbol || symbol === ".") continue;
        const definition = phase.legend[symbol];
        const isSeed = layout.seeds?.some((seed) => seed.x === column && seed.y === row);
        if (!definition && isSeed) continue;
        if (!definition) {
          throw new Error(`Structure layout phase ${index} has no legend entry for "${symbol}"`);
        }
        placements.push({
          ...definition,
          x: layout.origin.x + column * 4,
          y: layout.origin.y + row * 4,
        });
      }
    }
    await buildStructures(session, placements);
  }
  if (layout.seeds?.length) {
    await session.evaluate(
      (origin, seeds) => {
        for (const seed of seeds) {
          const elementType =
            typeof seed.element === "number"
              ? seed.element
              : sandkit.api.elements.getTypeById(seed.element);
          if (typeof elementType !== "number") {
            throw new Error(`Unknown seeded element: ${String(seed.element)}`);
          }
          const count = seed.count ?? 1;
          if (!Number.isInteger(count) || count < 1 || count > 16) {
            throw new Error(`Element seed count must be an integer from 1 to 16: ${count}`);
          }
          const cellX = origin.x + seed.x * 4;
          const cellY = origin.y + seed.y * 4;
          for (let index = 0; index < count; index += 1) {
            sandkit.api.elements.createAtCell(
              cellX + (index % 4),
              cellY + Math.floor(index / 4),
              elementType,
            );
          }
        }
      },
      layout.origin,
      layout.seeds,
    );
  }
}

/** Pause or resume the simulation without opening the in-game pause UI. */
export async function setSimulationPaused(session: WorldSession, paused: boolean): Promise<void> {
  await session.evaluate(pauseEngineInPage, paused, WORKER_MESSAGE.SetPaused);
}

export async function pauseSimulation(session: WorldSession): Promise<void> {
  await setSimulationPaused(session, true);
}

export async function resumeSimulation(session: WorldSession): Promise<void> {
  await setSimulationPaused(session, false);
}

/** Run the simulation for a wall-clock interval, then restore its prior state. */
export async function runSimulation(session: WorldSession, durationMs: number): Promise<void> {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(`Simulation duration must be a non-negative finite number: ${durationMs}`);
  }
  const priorPaused = await session.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        sandkit?: { engine?: { state?: { session?: { paused?: boolean } } } };
      }
    ).sandkit?.engine?.state?.session;
    if (!state) throw new Error("Sandustry session state is unavailable");
    return Boolean(state.paused);
  });
  try {
    await session.resumeSimulation();
    await session.evaluate(
      (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration)),
      durationMs,
    );
  } finally {
    await session.setSimulationPaused(priorPaused);
  }
}
