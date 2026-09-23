import { NAME_KEY, TERRAIN } from "../shared/ids.ts";

const api = sandkit.api;

/** Terrain. Debug → Terrain → Terrain. */
export function register(): void {
  api.i18n.register("en", {
    [NAME_KEY.terrain]: "Terrain",
  });

  const { cellType } = api.terrains.register({
    id: TERRAIN,
    nameKey: NAME_KEY.terrain,
    hp: 50,
    colorHSL: [0, 0, 0.92],
    materialId: 120,
  });

  api.discoveries.addTerrainByType(cellType);
}
