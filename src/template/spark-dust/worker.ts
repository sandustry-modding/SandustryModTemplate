import { ELEMENT } from "../shared/ids.ts";

type SparkDustTypes = {
  sparkDust: number;
};

export function resolveSparkDustTypes(api: WorkerSandkitApi): SparkDustTypes {
  return {
    sparkDust: api.elements.getTypeById(ELEMENT.sparkDust),
  };
}

/** Worker hooks. Cast sandkit.api to WorkerSandkitApi in worker.ts. */
export function registerWorker(api: WorkerSandkitApi, types: SparkDustTypes): void {
  api.hooks.intercept(
    "element:update",
    (args) => {
      const record = args as {
        x: number;
        y: number;
        elementIndex: number;
        elementData: { hasDuration: { [index: number]: number } };
      };
      if (record.elementData.hasDuration[record.elementIndex] === 1) return;
      api.elements.setDurationAtCell(record.x, record.y, 30, { updateMax: true });
    },
    { guard: { elementType: types.sparkDust } },
  );
}
