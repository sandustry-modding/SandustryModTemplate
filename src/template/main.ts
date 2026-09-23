/**
 * Main thread. Keep this file a list of register() calls.
 * Put feature code in folders. Do not add extra .ts files next to this one.
 *
 * Restart the game after worker.ts or patches.ts changes.
 */
import { isEnabled } from "@modkit/utils";
import { templateLiveConfig } from "./config.ts";
import { register as registerBoot } from "./boot/register.ts";
import { register as registerSparkDust } from "./spark-dust/register.ts";
import { registerMain as registerSparkDustMain } from "./spark-dust/main.ts";
import { register as registerChalk } from "./chalk/register.ts";
import { register as registerBeacon } from "./beacon/register.ts";
import { register as registerContact } from "./contact/register.ts";
import { register as registerUi } from "./ui/register.ts";
import { register as registerInput } from "./input/register.ts";
import { register as registerRuntime } from "./runtime/register.ts";

templateLiveConfig.get();

if (isEnabled()) {
  registerBoot();
  registerSparkDust();
  registerSparkDustMain();
  registerChalk();
  void registerBeacon();
  registerContact();
  registerUi();
  registerInput();
  registerRuntime();
}
