import { ELEMENT } from "../shared/ids.ts";

const api = sandkit.api;

function isGrabberUse(itemId: string | number): boolean {
  const grabber = sandkit.enums.ItemId.Grabber;
  return itemId === grabber || itemId === String(grabber);
}

/** Main-thread hooks. Keep sim work in element/worker.ts. */
export function registerMain(): void {
  const elementType = api.elements.getTypeById(ELEMENT);
  api.hooks.intercept("item:use", (args) => {
    if (!isGrabberUse(args.itemId)) return;
    const origin = api.input.getMouseCellPosition();
    if (!api.elements.isTypeAtCell(origin.x, origin.y, elementType)) return;
    api.ui.toast("Grabber used on Element", {});
  });
}
