import { createLiveConfig } from "@modkit/utils/live-config";
import { modinfo } from "../modinfo.ts";

/** F3 debug knobs. Not player Options (`configSchema` in modinfo). */
export const templateConfigDefaults = {
  debug: false,
  elementDensity: 180,
};

export type TemplateConfig = typeof templateConfigDefaults;

export const templateLiveConfig = createLiveConfig({
  id: modinfo.id,
  title: modinfo.name,
  globalKey: "authorTemplate",
  defaults: templateConfigDefaults,
});

export const config = templateLiveConfig.config;

export function templateConfig(): TemplateConfig {
  return templateLiveConfig.get();
}
