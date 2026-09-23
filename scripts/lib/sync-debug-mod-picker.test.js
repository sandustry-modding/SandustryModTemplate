import assert from "node:assert/strict";
import test from "node:test";
import { applyDebugModPickInput } from "./sync-debug-mod-picker.js";

test("applyDebugModPickInput writes pickString options without a default", () => {
  const launch = { version: "0.2.0", configurations: [], inputs: [] };
  applyDebugModPickInput(launch, ["template", "trees"]);
  assert.deepEqual(launch.inputs, [
    {
      id: "debugMod",
      type: "pickString",
      description: "Debug which mod?",
      options: ["template", "trees"],
    },
  ]);
});
