/**
 * Main thread. Keep this file a list of register() calls.
 * Put feature code in folders. Do not add extra .ts files next to this one.
 *
 * Restart the game after worker.ts or patches.ts changes.
 */
import { isEnabled } from "@modkit/utils";
import { templateLiveConfig } from "./shared/config.ts";
import { register as registerBoot } from "./boot/register.ts";
import { register as registerElement } from "./element/register.ts";
import { registerMain as registerElementMain } from "./element/main.ts";
import { register as registerTerrain } from "./terrain/register.ts";
import { register as registerStructure } from "./structure/register.ts";
import { register as registerUi } from "./ui/register.ts";
import { register as registerInput } from "./input/register.ts";

templateLiveConfig.get();

if (isEnabled()) {
  registerBoot();
  registerElement();
  registerElementMain();
  registerTerrain();
  void registerStructure();
  registerUi();
  registerInput();
}
