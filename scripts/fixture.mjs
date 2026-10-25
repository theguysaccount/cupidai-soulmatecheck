// Prints the fixture links for the patterns in site/assets/patterns.js:
//   node scripts/fixture.mjs > tests/fixtures/links.json
import { readFileSync } from "node:fs";
import { encode, compare } from "../site/assets/core.js";
import { PEOPLE, answersFor } from "../site/assets/patterns.js";

const Q = JSON.parse(readFileSync(new URL("../data/questions.json", import.meta.url)));
const qs = Q.sets["1"];
const A = { name: PEOPLE.A.name, answers: answersFor("A", qs.length) };
const B = { name: PEOPLE.B.name, answers: answersFor("B", qs.length) };
const invite = encode(A);
const reply = encode(B);
console.log(JSON.stringify({ invite, result: `${invite}.${reply}`, match: compare(qs, A.answers, B.answers, Q.dimensions).match }, null, 1));
