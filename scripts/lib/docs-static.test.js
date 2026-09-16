import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDocsStaticServer, resolveStaticPath } from "./docs-static.js";

function fixtureSite() {
  const root = mkdtempSync(join(tmpdir(), "docs-static-"));
  writeFileSync(join(root, "index.html"), "<html><body>docsify $docsify</body></html>\n");
  mkdirSync(join(root, "tools", "map"), { recursive: true });
  writeFileSync(
    join(root, "tools", "index.html"),
    "<html><body>Standalone browser tools</body></html>\n",
  );
  writeFileSync(join(root, "tools", "map", "index.html"), "<html><body>Map editor</body></html>\n");
  writeFileSync(join(root, "_sidebar.md"), "- Home\n");
  return root;
}

test("resolveStaticPath keeps /tools/ on the tools index", () => {
  const root = fixtureSite();
  const tools = resolveStaticPath(root, "/tools/");
  assert.equal(tools.kind, "file");
  assert.equal(tools.path, join(root, "tools", "index.html"));
  const home = resolveStaticPath(root, "/");
  assert.equal(home.kind, "file");
  assert.equal(home.path, join(root, "index.html"));
});

test("resolveStaticPath redirects /tools to /tools/", () => {
  const root = fixtureSite();
  assert.deepEqual(resolveStaticPath(root, "/tools"), {
    kind: "redirect",
    location: "/tools/",
  });
});

test("resolveStaticPath rejects parent segments", () => {
  const root = fixtureSite();
  assert.equal(resolveStaticPath(root, "/tools/../../package.json").kind, "forbidden");
});

test("HTTP /tools/ is not rewritten to the Docsify index", async () => {
  const root = fixtureSite();
  const server = createDocsStaticServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const tools = await fetch(`http://127.0.0.1:${port}/tools/`);
    const toolsText = await tools.text();
    assert.equal(tools.status, 200);
    assert.match(toolsText, /Standalone browser tools/);
    assert.doesNotMatch(toolsText, /\$docsify/);

    const map = await fetch(`http://127.0.0.1:${port}/tools/map/`);
    assert.match(await map.text(), /Map editor/);

    const home = await fetch(`http://127.0.0.1:${port}/`);
    assert.match(await home.text(), /\$docsify/);

    const sidebar = await fetch(`http://127.0.0.1:${port}/_sidebar.md`);
    assert.equal(await sidebar.text(), "- Home\n");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
