import { NAME_KEY, TERRAIN } from "../shared/ids.ts";

const api = sandkit.api;

/** Register a terrain. Debug → Terrain → Example Chalk. */
export function register(): void {
  api.i18n.register("en", {
    [NAME_KEY.chalk]: "Example Chalk",
  });

  const { cellType } = api.terrains.register({
    id: TERRAIN.chalk,
    nameKey: NAME_KEY.chalk,
    hp: 50,
    colorHSL: [0, 0, 0.92],
    materialId: 120,
  });

  api.discoveries.addTerrainByType(cellType);
}
