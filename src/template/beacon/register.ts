import { NAME_KEY, SPRITE, STRUCTURE } from "../shared/ids.ts";

const api = sandkit.api;

/** Debug → Building → Example Beacon. Sprite: `mod/beacon.png`. */
export async function register(): Promise<void> {
  api.i18n.register("en", {
    [NAME_KEY.beacon]: "Example Beacon",
  });

  await api.sprites.loadFromMod(SPRITE.beacon, "beacon.png");

  api.structures.register({
    id: STRUCTURE.beacon,
    name: "Example Beacon",
    categoryKey: "logistics",
    buildModes: [{ type: "single" }],
    variants: [{ id: STRUCTURE.beacon, angles: [0] }],
    render: {
      imageName: SPRITE.beacon,
      size: { width: 16, height: 16 },
    },
    shape: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ],
  });

  api.player.buildings.unlockById(STRUCTURE.beacon);

  api.structures.processing.register(`${STRUCTURE.beacon}:process`, {
    structureType: STRUCTURE.beacon,
    intervalMs: 1000,
    process(structure, context) {
      let filled = 0;
      for (let dy = 0; dy < 4; dy += 1) {
        for (let dx = 0; dx < 4; dx += 1) {
          if (!context.isCellEmptyAtCell(structure.x + dx, structure.y + dy)) {
            filled += 1;
          }
        }
      }
      if (filled > 0) {
        console.log(`beacon process (${structure.x}, ${structure.y}) ${filled}/16 cells occupied`);
      }
    },
  });
}
