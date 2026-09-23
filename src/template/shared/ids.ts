import { modinfo } from "../modinfo.ts";

const ns = `${modinfo.id}:`;

export const ELEMENT = ns + "element";
export const TERRAIN = ns + "terrain";
export const STRUCTURE = ns + "structure";
export const STRUCTURE_SPRITE = ns + "structure-sprite";

export const NAME_KEY = {
  element: `${modinfo.id}.element.name`,
  terrain: `${modinfo.id}.terrain.name`,
  structure: `${modinfo.id}.structure.name`,
} as const;
