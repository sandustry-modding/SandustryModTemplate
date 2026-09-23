import { modinfo } from "../modinfo.ts";

const root = modinfo.id;
const ns = `${root}:`;

export const ELEMENT = {
  sparkDust: ns + "sparkDust",
} as const;

export const NAME_KEY = {
  sparkDust: `${root}.element.sparkDust.name`,
  chalk: `${root}.terrain.chalk.name`,
  beacon: `${root}.structure.beacon.name`,
} as const;

export const TERRAIN = {
  chalk: ns + "chalk",
} as const;

export const STRUCTURE = {
  beacon: ns + "beacon",
} as const;

export const SPRITE = {
  beacon: ns + "beacon-sprite",
} as const;
