import { defineModInfo } from "@modkit/modinfo";

export const modinfo = defineModInfo({
  manifestVersion: 1,
  id: "author.template",
  name: "Template",
  version: "0.0.2",
  apiVersion: 1,
  gameVersion: { minimum: "0.5.5" },
  entry: "main.js",
  workerEntry: "worker.js",
  author: "Your Name",
  description:
    "Starter mod. Toast on load. Spark Dust, chalk, beacon, overlay, and worker samples.",
  dependencies: [],
  loadOrder: 0,
  configSchema: {
    enabled: {
      type: "boolean",
      default: true,
      labelKey: "Mod enabled",
      descriptionKey: "Turn the mod off without unsubscribing.",
    },
  },
});
