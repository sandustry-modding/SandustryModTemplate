/**
 * Main thread. Keep this file a list of register() calls.
 * Put feature code in folders. Do not add extra .ts files next to this one.
 *
 * Restart the game after worker.ts or patches.ts changes.
 */
import { isEnabled } from "@modkit/utils";
import { register as registerElement } from "./element/register.ts";
import { register as registerTerrain } from "./terrain/register.ts";
import { register as registerStructure } from "./structure/register.ts";
import { register as registerUi } from "./ui/register.ts";
import { register as registerInput } from "./input/register.ts";

if (isEnabled()) {
  registerElement();
  registerTerrain();
  void registerStructure();
  registerUi();
  registerInput();
}
