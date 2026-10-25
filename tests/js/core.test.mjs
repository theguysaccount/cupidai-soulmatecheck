// Link encoding and scoring: run with `node --test tests/js/*.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encode, decode, parseFragment, compare, label, cleanName, WEIGHTS } from "../../site/assets/core.js";
import { PEOPLE, answersFor } from "../../site/assets/patterns.js";

const Q = JSON.parse(readFileSync(new URL("../../data/questions.json", import.meta.url)));
const QS = Q.sets["1"];
const N = QS.length;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomAnswers = (r) => Array.from({ length: N }, () => ({ a: Math.floor(r() * 6), imp: Math.floor(r() * 4) }));
const fill = (a, imp = 1) => Array.from({ length: N }, () => ({ a, imp }));

test("links round-trip", () => {
  const r = rng(7);
  for (let k = 0; k < 500; k++) {
    const answers = randomAnswers(r);
    const link = encode({ name: "Alex", answers });
    assert.match(link, /^[A-Za-z0-9_-]+$/);
    const back = decode(link, Q.sets);
    assert.equal(back.name, "Alex");
    assert.deepEqual(back.answers, answers);
  }
});

test("names: unicode kept, junk stripped, length capped", () => {
  assert.equal(decode(encode({ name: "Zoë 💛", answers: fill(3) }), Q.sets).name, "Zoë 💛");
  assert.equal(cleanName("  <b>Sam</b>\n "), "bSam/b");
  assert.equal(cleanName("\u0000Al\u0007ex"), "Alex");
  const long = cleanName("é".repeat(100));
  assert.ok(new TextEncoder().encode(long).length <= 60);
  assert.equal(decode(encode({ answers: fill(1) }), Q.sets).name, "");
});

test("damaged links are rejected, not misread", () => {
  const link = encode({ name: "Alex", answers: answersFor("A", N) });
  assert.throws(() => decode(link.slice(0, -3), Q.sets));
  for (const pos of [3, 8, 15, 20]) {
    const c = link[pos] === "A" ? "B" : "A";
    assert.throws(() => decode(link.slice(0, pos) + c + link.slice(pos + 1), Q.sets), `flip at ${pos}`);
  }
  assert.throws(() => decode("not*base64", Q.sets));
  assert.throws(() => decode(encode({ answers: fill(2), set: 9 }), Q.sets), /question set/);
  assert.throws(() => encode({ answers: [{ a: 6, imp: 0 }] }));
});

test("fragments", () => {
  const a = encode({ name: "A", answers: fill(2) });
  const b = encode({ name: "B", answers: fill(4) });
  assert.equal(parseFragment(`#${a}`, Q.sets).b, null);
  assert.equal(parseFragment(`#${a}.${b}`, Q.sets).b.name, "B");
  assert.equal(parseFragment("", Q.sets), null);
  assert.equal(parseFragment(`#${a}.${b}.${a}`, Q.sets), null);
  assert.ok(parseFragment("#garbage", Q.sets).error);
});

test("scoring, worked by hand", () => {
  const A = fill(0), B = fill(0);
  A[0] = { a: 1, imp: 1 }; B[0] = { a: 1, imp: 0 };   // same answer
  A[1] = { a: 1, imp: 0 }; B[1] = { a: 5, imp: 2 };   // opposite ends
  // A: (3*1 + 1*0) / 4 = 0.75; B: (1*1 + 9*0) / 10 = 0.1; sqrt(0.075) = 0.2739
  const r = compare(QS, A, B, Q.dimensions);
  assert.deepEqual(WEIGHTS, [1, 3, 9, 20]);
  assert.equal(r.match, 27);
  assert.equal(r.common, 2);
  assert.equal(r.aligned.length, 1);
  assert.equal(r.gaps[0].i, 1);
  assert.equal(r.dealbreakers.length, 0);
});

test("scoring properties", () => {
  assert.equal(compare(QS, fill(3), fill(3), Q.dimensions).match, 100);
  assert.equal(compare(QS, fill(1), fill(5), Q.dimensions).match, 0);
  assert.equal(compare(QS, fill(2), fill(3), Q.dimensions).match, 75);
  assert.equal(compare(QS, fill(0), fill(3), Q.dimensions).match, null);
  const r = rng(11);
  for (let k = 0; k < 200; k++) {
    const A = randomAnswers(r), B = randomAnswers(r);
    const ab = compare(QS, A, B, Q.dimensions), ba = compare(QS, B, A, Q.dimensions);
    assert.equal(ab.match, ba.match, "symmetric");
    if (ab.match !== null) assert.ok(ab.match >= 0 && ab.match <= 100);
    for (const d of Object.values(ab.byDim)) if (d.match !== null) assert.ok(d.match >= 0 && d.match <= 100);
  }
});

test("dealbreakers need a real gap", () => {
  const A = fill(3), B = fill(3);
  A[0] = { a: 1, imp: 3 }; B[0] = { a: 2, imp: 1 };   // one step: not flagged
  A[1] = { a: 1, imp: 1 }; B[1] = { a: 4, imp: 3 };   // three steps, B's dealbreaker: flagged
  const r = compare(QS, A, B, Q.dimensions);
  assert.deepEqual(r.dealbreakers.map((x) => x.i), [1]);
  assert.ok(!r.gaps.some((x) => x.i === 1), "dealbreakers aren't repeated under gaps");
});

test("labels", () => {
  assert.equal(label(92), "Rare alignment");
  assert.equal(label(70), "Strong match");
  assert.equal(label(null), "Not enough answers to compare");
});

test("the end-to-end fixture matches the patterns", () => {
  const fx = JSON.parse(readFileSync(new URL("../fixtures/links.json", import.meta.url)));
  const invite = encode({ name: PEOPLE.A.name, answers: answersFor("A", N) });
  const reply = encode({ name: PEOPLE.B.name, answers: answersFor("B", N) });
  assert.equal(fx.invite, invite);
  assert.equal(fx.result, `${invite}.${reply}`);
  assert.equal(fx.match, compare(QS, answersFor("A", N), answersFor("B", N), Q.dimensions).match);
});

test("question set 1 is frozen", () => {
  assert.equal(N, 24);
  assert.ok(QS.every((q) => q.options.length === 5 && q.text && q.why && q.talk));
  assert.equal(new Set(QS.map((q) => q.id)).size, N);
  for (const d of Q.dimensions) assert.equal(QS.filter((q) => q.dim === d.id).length, 4);
});
