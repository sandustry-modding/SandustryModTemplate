/**
 * Build a page expression from a function and JSON arguments.
 * Closures do not capture Node locals. Pass values as `args`.
 */
export function toPageExpression(
  fn: { toString(): string },
  args: readonly unknown[] = [],
  options?: { include?: readonly PageFunction[] },
): string {
  const serialized = args.map(serializeArg).join(", ");
  const call = `(${fn.toString()})(${serialized})`;
  const include = options?.include ?? [];
  if (include.length === 0) return call;
  return `(() => {\n${declarations(include)}\nreturn ${call};\n})()`;
}

/**
 * A named function whose source is copied into the page beside the caller.
 *
 * It has to stand on its own once it lands there: it may use page globals and
 * its own arguments, and nothing else from the module it was written in.
 */
export type PageFunction = { name: string; toString(): string };

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Declare each included function under its own name, so the serialized body can
 * call it the same way the TypeScript did.
 */
function declarations(include: readonly PageFunction[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const fn of include) {
    if (!IDENTIFIER.test(fn.name ?? "")) {
      throw new Error("@modkit/test page functions must be named to be included in a page call");
    }
    if (seen.has(fn.name)) continue;
    seen.add(fn.name);
    out.push(`const ${fn.name} = ${fn.toString()};`);
  }
  return out.join("\n");
}

function serializeArg(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new Error("@modkit/test evaluate args must be JSON-serializable");
  }
  return json;
}
