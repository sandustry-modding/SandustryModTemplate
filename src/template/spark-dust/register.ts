import { ELEMENT, NAME_KEY } from "../shared/ids.ts";

const api = sandkit.api;

/** Register a powder. Debug → Element → Spark Dust. */
export function register(): void {
  api.i18n.register("en", {
    [NAME_KEY.sparkDust]: "Spark Dust",
  });

  const { elementType } = api.elements.register({
    id: ELEMENT.sparkDust,
    nameKey: NAME_KEY.sparkDust,
    density: 180,
    matterType: sandkit.enums.MatterType.Powder,
    metaColor: 0xffb43c,
    colors: {
      variants: [
        [255, 180, 60],
        [255, 140, 40],
        [220, 100, 30],
      ],
    },
    isGrabbable: true,
    isTransportable: true,
  });

  api.discoveries.addElementByType(elementType);

  const sand = api.elements.getTypeById("sand");
  api.structures.recipes.register("smelter", {
    input: elementType,
    outputs: [{ elementType: sand, chance: 1 }],
  });
}
