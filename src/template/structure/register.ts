import { config } from "../shared/config.ts";
import { NAME_KEY, STRUCTURE, STRUCTURE_SPRITE } from "../shared/ids.ts";

const api = sandkit.api;
const Block = sandkit.enums.CellType.Block;

/** Building. Debug → Building → Structure. Sprite: `mod/structure.png`. */
export async function register(): Promise<void> {
  api.i18n.register("en", {
    [NAME_KEY.structure]: "Structure",
  });

  await api.sprites.loadFromMod(STRUCTURE_SPRITE, "structure.png");

  api.structures.register({
    id: STRUCTURE,
    name: "Structure",
    categoryKey: "logistics",
    buildModes: [{ type: "single" }],
    variants: [{ id: STRUCTURE, angles: [0] }],
    render: {
      imageName: STRUCTURE_SPRITE,
      size: { width: 16, height: 16 },
    },
    shape: [
      [Block, Block, Block, Block],
      [Block, Block, Block, Block],
      [Block, Block, Block, Block],
      [Block, Block, Block, Block],
    ],
  });

  api.player.buildings.unlockById(STRUCTURE);

  api.structures.processing.register(`${STRUCTURE}:process`, {
    structureType: STRUCTURE,
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
      if (config.debug && filled > 0) {
        console.log(
          `structure process (${structure.x}, ${structure.y}) ${filled}/16 cells occupied`,
        );
      }
    },
  });
}
