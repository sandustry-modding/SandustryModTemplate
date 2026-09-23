import { definePatches } from "@modkit/patches";

/**
 * Prefer Sandkit before patches. Find strings break on game updates.
 * Restart the game after changes. Empty list writes no patches.json.
 */
export const patches = definePatches([]);
