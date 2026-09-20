import assert from "node:assert/strict";
import test from "node:test";
import { toPageExpression } from "./serialize.ts";

test("toPageExpression wraps the function and JSON args", () => {
  function add(n: number) {
    return n + 1;
  }
  const readN = (opts: { n: number }) => opts.n;
  assert.equal(toPageExpression(add, [2]), `(${add.toString()})(2)`);
  assert.equal(
    toPageExpression(() => 1),
    "(() => 1)()",
  );
  assert.equal(toPageExpression(readN, [{ n: 1 }]), `(${readN.toString()})({"n":1})`);
});

test("toPageExpression rejects values that JSON cannot serialize", () => {
  assert.throws(() => toPageExpression(() => 1, [undefined]), /JSON-serializable/);
  assert.throws(() => toPageExpression(() => 1, [() => 0]), /JSON-serializable/);
});

function helper(paused: boolean) {
  return paused;
}

test("toPageExpression declares included functions beside the call", () => {
  const expression = toPageExpression((p: boolean) => helper(p), [true], { include: [helper] });
  assert.match(expression, /const helper = /);
  assert.ok(
    expression.indexOf("const helper =") < expression.indexOf("return ("),
    "the declaration has to come before the call that uses it",
  );
  assert.equal(new Function(`return ${expression}`)(), true);
});

test("toPageExpression declares each included function once", () => {
  const expression = toPageExpression(() => helper(true), [], { include: [helper, helper] });
  assert.equal(expression.match(/const helper = /g)?.length, 1);
});

test("toPageExpression rejects an unnamed function to include", () => {
  assert.throws(() => toPageExpression(() => 1, [], { include: [(() => 1) as never] }), /named/);
});

test("toPageExpression without includes stays a bare call", () => {
  assert.equal(
    toPageExpression(() => 1),
    "(() => 1)()",
  );
});
