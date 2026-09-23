import { ELEMENT } from "../shared/ids.ts";

const api = sandkit.api;

function isGrabberUse(itemId: string | number): boolean {
  const grabber = sandkit.enums.ItemId.Grabber;
  return itemId === grabber || itemId === String(grabber);
}

/** Main-thread hooks. Keep sim work in spark-dust/worker.ts. */
export function registerMain(): void {
  const sparkDust = api.elements.getTypeById(ELEMENT.sparkDust);
  api.hooks.intercept("item:use", (args) => {
    if (!isGrabberUse(args.itemId)) return;
    const origin = api.input.getMouseCellPosition();
    if (!api.elements.isTypeAtCell(origin.x, origin.y, sparkDust)) return;
    api.ui.toast("Grabber used on Spark Dust", {});
  });
}
