// SoulmateCheck logic, shared by the browser (app.js) and the Node tests. No DOM access here.
//
// Answers travel only inside the link, after the "#" (browsers never send that part to a server).
// A check is packed into bytes and written in base64url:
//   [0] format (1)  [1] question set (1)  [2] name length n  [3..3+n) name in UTF-8
//   then 5 bits per question: 3 bits answer (0 = skipped, 1-5), 2 bits importance (0-3)
//   then a 2-byte checksum, so a link cut short by a chat app is caught instead of misread.
// An invite is "#<check>"; a result is "#<check>.<check>" (the person who made it first).

export const FORMAT = 1;
export const WEIGHTS = [1, 3, 9, 20]; // A little, Somewhat, A lot, Dealbreaker
export const DEALBREAKER = 3;
export const MAX_NAME_BYTES = 60;

function fnv16(bytes) {
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  h >>>= 0;
  return (h ^ (h >>> 16)) & 0xffff;
}

function toBase64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str) {
  if (!/^[A-Za-z0-9_-]+$/.test(str)) throw new Error("bad characters");
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function cleanName(name) {
  let n = String(name || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  const enc = new TextEncoder();
  while (enc.encode(n).length > MAX_NAME_BYTES) n = n.slice(0, -1);
  return n;
}

export function encode({ name = "", answers, set = 1 }) {
  const nameBytes = new TextEncoder().encode(cleanName(name));
  const bits = [];
  for (const { a = 0, imp = 1 } of answers) {
    if (!(a >= 0 && a <= 5 && imp >= 0 && imp <= 3)) throw new Error("answer out of range");
    for (let k = 2; k >= 0; k--) bits.push((a >> k) & 1);
    for (let k = 1; k >= 0; k--) bits.push((imp >> k) & 1);
  }
  const packed = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => { if (bit) packed[i >> 3] |= 0x80 >> (i & 7); });
  const body = Uint8Array.from([FORMAT, set, nameBytes.length, ...nameBytes, ...packed]);
  const sum = fnv16(body);
  return toBase64url(Uint8Array.from([...body, sum >> 8, sum & 0xff]));
}

export function decode(str, sets) {
  const bytes = fromBase64url(str);
  if (bytes.length < 5) throw new Error("too short");
  const body = bytes.slice(0, -2);
  if (fnv16(body) !== ((bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1])) throw new Error("checksum");
  if (body[0] !== FORMAT) throw new Error("unknown format");
  const set = body[1];
  const questions = sets[String(set)];
  if (!questions) throw new Error("unknown question set");
  const n = body[2];
  if (n > MAX_NAME_BYTES || 3 + n > body.length) throw new Error("bad name");
  const name = cleanName(new TextDecoder().decode(body.slice(3, 3 + n)));
  const packed = body.slice(3 + n);
  if (packed.length !== Math.ceil((questions.length * 5) / 8)) throw new Error("wrong length");
  const bit = (i) => (packed[i >> 3] >> (7 - (i & 7))) & 1;
  const answers = questions.map((_, q) => {
    const o = q * 5;
    const a = (bit(o) << 2) | (bit(o + 1) << 1) | bit(o + 2);
    const imp = (bit(o + 3) << 1) | bit(o + 4);
    if (a > 5) throw new Error("bad answer");
    return { a, imp };
  });
  return { name, set, answers };
}

// "#abc" -> {a}, "#abc.def" -> {a, b}; null when there's nothing usable.
export function parseFragment(hash, sets) {
  const parts = String(hash || "").replace(/^#/, "").split(".").filter(Boolean);
  if (!parts.length || parts.length > 2) return null;
  try {
    const a = decode(parts[0], sets);
    const b = parts[1] ? decode(parts[1], sets) : null;
    if (b && b.set !== a.set) return null;
    return { a, b };
  } catch (e) {
    return { error: e.message };
  }
}

// Compatibility in the style of a two-sided weighted match: each person's satisfaction is the
// importance-weighted agreement on questions both answered (agreement = 1 - |a - b| / 4 on a
// five-point scale), and the match is the geometric mean of the two, so it's high only when both
// people get what matters to them.
export function compare(questions, A, B, dims) {
  const rows = [];
  questions.forEach((q, i) => {
    const a = A[i], b = B[i];
    if (!a || !b || !a.a || !b.a) return;
    const gap = Math.abs(a.a - b.a);
    rows.push({ i, q, a: a.a, b: b.a, impA: a.imp, impB: b.imp, gap, agree: 1 - gap / 4, w: WEIGHTS[a.imp] + WEIGHTS[b.imp] });
  });
  const mean = (list) => {
    if (!list.length) return null;
    const sat = (key) => {
      const wsum = list.reduce((s, r) => s + WEIGHTS[r[key]], 0);
      return list.reduce((s, r) => s + WEIGHTS[r[key]] * r.agree, 0) / wsum;
    };
    return Math.round(Math.sqrt(sat("impA") * sat("impB")) * 100);
  };
  const byDim = {};
  for (const d of dims || []) {
    const list = rows.filter((r) => r.q.dim === d.id);
    byDim[d.id] = { name: d.name, match: mean(list), n: list.length };
  }
  const aligned = rows.filter((r) => r.gap === 0).sort((x, y) => y.w - x.w || x.i - y.i).slice(0, 4);
  const isDeal = (r) => (r.impA === DEALBREAKER || r.impB === DEALBREAKER) && r.gap >= 2;
  const dealbreakers = rows.filter(isDeal);
  const gaps = rows.filter((r) => r.gap >= 2 && !isDeal(r)).sort((x, y) => y.gap - x.gap || y.w - x.w || x.i - y.i).slice(0, 4);
  return { match: mean(rows), common: rows.length, byDim, aligned, gaps, dealbreakers };
}

export function label(match) {
  if (match === null) return "Not enough answers to compare";
  if (match >= 85) return "Rare alignment";
  if (match >= 70) return "Strong match";
  if (match >= 55) return "A good foundation, with things to talk about";
  if (match >= 40) return "Different in ways that matter";
  return "Very different, and that's worth knowing";
}

export const MIN_COMMON = 8;
