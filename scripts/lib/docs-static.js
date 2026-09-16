/**
 * Static file server for the Docsify hash-mode site.
 * Directory URLs keep their own index.html so /tools/ is not rewritten to /.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative } from "node:path";

const TEXT_TYPES = new Set([
  "application/json",
  "application/javascript",
  "image/svg+xml",
  "text/css",
  "text/html",
  "text/javascript",
  "text/markdown",
  "text/plain",
]);

/** @type {Record<string, string>} */
const MIME = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".md": "text/markdown",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/**
 * @param {string} pathname
 * @returns {string[] | null}
 */
function urlSegments(pathname) {
  const parts = [];
  for (const part of pathname.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return null;
    parts.push(part);
  }
  return parts;
}

/**
 * @param {string} root
 * @param {string} requestUrl
 * @returns {
 *   | { kind: "file"; path: string; type: string }
 *   | { kind: "redirect"; location: string }
 *   | { kind: "not-found" }
 *   | { kind: "forbidden" }
 * }
 */
export function resolveStaticPath(root, requestUrl) {
  let pathname = String(requestUrl || "/").split("?")[0] || "/";
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return { kind: "forbidden" };
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const segments = urlSegments(pathname);
  if (!segments) return { kind: "forbidden" };

  const target = segments.length === 0 ? root : join(root, ...segments);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) return { kind: "forbidden" };

  if (!existsSync(target)) return { kind: "not-found" };

  const stat = statSync(target);
  if (stat.isDirectory()) {
    if (!pathname.endsWith("/")) {
      const query = String(requestUrl || "").includes("?")
        ? String(requestUrl).slice(String(requestUrl).indexOf("?"))
        : "";
      return { kind: "redirect", location: `${pathname}/${query}` };
    }
    const indexFile = join(target, "index.html");
    if (!existsSync(indexFile) || !statSync(indexFile).isFile()) {
      return { kind: "not-found" };
    }
    return { kind: "file", path: indexFile, type: contentType(indexFile) };
  }

  if (!stat.isFile()) return { kind: "not-found" };
  return { kind: "file", path: target, type: contentType(target) };
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function contentType(filePath) {
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  return TEXT_TYPES.has(type) ? `${type}; charset=utf-8` : type;
}

/**
 * @param {string} root
 * @returns {import("node:http").Server}
 */
export function createDocsStaticServer(root) {
  return createServer((req, res) => {
    const result = resolveStaticPath(root, req.url || "/");
    if (result.kind === "forbidden") {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Forbidden\n");
      return;
    }
    if (result.kind === "redirect") {
      res.writeHead(301, { location: result.location });
      res.end();
      return;
    }
    if (result.kind === "not-found") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found\n");
      return;
    }

    res.writeHead(200, {
      "content-type": result.type,
      "cache-control": "no-cache",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(result.path)
      .on("error", () => {
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        }
        res.end();
      })
      .pipe(res);
  });
}
