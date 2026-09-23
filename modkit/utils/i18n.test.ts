import assert from "node:assert/strict";
import { test } from "node:test";
import { t } from "./i18n.ts";

type SandkitMock = {
  api: {
    i18n: {
      t: (key: string, params?: Record<string, string | number>) => string;
    };
  };
};

function withSandkit(mock: SandkitMock, fn: () => void): void {
  const g = globalThis as { sandkit?: unknown };
  const previous = g.sandkit;
  g.sandkit = mock;
  try {
    fn();
  } finally {
    if (previous === undefined) delete g.sandkit;
    else g.sandkit = previous;
  }
}

test("t returns a good i18n translation", () => {
  withSandkit(
    {
      api: {
        i18n: {
          t(key) {
            return key === "mods|demo|title" ? "Demo title" : key;
          },
        },
      },
    },
    () => {
      assert.equal(t("mods|demo|title"), "Demo title");
    },
  );
});

test("t uses fallback when translation is missing or equals the key", () => {
  withSandkit(
    {
      api: {
        i18n: {
          t(key) {
            return key;
          },
        },
      },
    },
    () => {
      assert.equal(t("mods|missing|key", "Fallback"), "Fallback");
      assert.equal(t("mods|missing|key"), "mods|missing|key");
    },
  );
});

test("t interpolates params only on the fallback path", () => {
  withSandkit(
    {
      api: {
        i18n: {
          t(key, params) {
            if (key === "mods|demo|greeting") {
              return `Hello, ${params?.name ?? ""}`;
            }
            return key;
          },
        },
      },
    },
    () => {
      assert.equal(t("mods|demo|greeting", undefined, { name: "Ada" }), "Hello, Ada");
      assert.equal(t("mods|missing|hello", "Hi, {name}", { name: "Bob" }), "Hi, Bob");
    },
  );
});

test("t does not throw when i18n.t throws", () => {
  withSandkit(
    {
      api: {
        i18n: {
          t() {
            throw new Error("i18n unavailable");
          },
        },
      },
    },
    () => {
      assert.equal(t("mods|err|key", "Safe"), "Safe");
    },
  );
});

test("t treats empty i18n results as missing", () => {
  withSandkit(
    {
      api: {
        i18n: {
          t() {
            return "";
          },
        },
      },
    },
    () => {
      assert.equal(t("mods|empty|key", "Filled"), "Filled");
    },
  );
});
