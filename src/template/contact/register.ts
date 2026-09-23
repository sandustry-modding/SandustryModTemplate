import { ELEMENT } from "../shared/ids.ts";

const api = sandkit.api;

/** Contact reaction. Enable spark-dust register first. */
export function register(): void {
  const sparkDust = api.elements.getTypeById(ELEMENT.sparkDust);
  const water = api.elements.getTypeById("water");
  const steam = api.elements.getTypeById("steam");

  api.reactions.registerContact({
    inputA: sparkDust,
    inputB: water,
    outputA: steam,
    outputB: null,
    orientation: "any",
  });
}
