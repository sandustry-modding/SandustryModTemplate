import { ELEMENT } from "../shared/ids.ts";

type ElementTypes = {
  element: number;
};

export function resolveElementTypes(api: WorkerSandkitApi): ElementTypes {
  return {
    element: api.elements.getTypeById(ELEMENT),
  };
}

/** Worker hooks. Pass `sandkit.api` from a worker entry (WorkerSandkitApi via tsconfig.worker.json). */
export function registerWorker(api: WorkerSandkitApi, types: ElementTypes): void {
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
    { guard: { elementType: types.element } },
  );
}
