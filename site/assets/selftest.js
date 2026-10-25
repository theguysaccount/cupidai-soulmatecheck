// End-to-end self-test, loaded only with ?selftest=1. It answers through the real buttons with the
// fixed patterns in patterns.js and checks the link, the score and the reply link.
// scripts/e2e.sh reads <body data-selftest="pass|fail: ...">.
import { decode, encode, compare } from "./core.js";
import { PEOPLE, answersFor } from "./patterns.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = fn();
    if (v) return v;
    await wait(20);
  }
  throw new Error("timed out waiting for " + what);
}

async function answerAll(box, answers) {
  for (let i = 0; i < answers.length; i++) {
    await until(() => box.querySelector(`#q-${i}`), `question ${i + 1}`);
    const { a, imp } = answers[i];
    box.querySelector(`[data-imp="${imp}"]`).click();
    if (!a) {
      box.querySelector("[data-skip]").click();
      continue;
    }
    box.querySelector(`[data-a="${a}"]`).click();
    box.querySelector("[data-next]").click();
  }
}

const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

async function home(ctx, log) {
  document.querySelector("#name").value = PEOPLE.A.name;
  document.querySelector("[data-start]").click();
  const want = answersFor("A", ctx.QUESTIONS.length);
  await answerAll(document.querySelector("[data-questions]"), want);
  const link = await until(() => document.querySelector("[data-link]").value, "the link");
  const frag = link.split("#")[1];
  const got = decode(frag, ctx.sets);
  if (got.name !== PEOPLE.A.name || !same(got.answers, want)) throw new Error("the link doesn't hold the answers given");
  if (frag !== encode({ name: PEOPLE.A.name, answers: want })) throw new Error("link not deterministic");
  log.push(`link ${link.length} chars`);
}

async function invite(ctx, log) {
  const landing = document.querySelector("#landing");
  await until(() => landing.querySelector("[data-begin]"), "landing");
  if (!landing.textContent.includes(`${PEOPLE.A.name} made a SoulmateCheck`)) throw new Error("landing doesn't name the maker");
  landing.querySelector("#name").value = PEOPLE.B.name;
  landing.querySelector("[data-begin]").click();
  const mine = answersFor("B", ctx.QUESTIONS.length);
  await answerAll(document.querySelector("[data-questions]"), mine);
  const shown = await until(() => document.querySelector("[data-match]")?.dataset.match, "the result");
  const A = decode(location.hash.slice(1).split(".")[0], ctx.sets);
  const want = compare(ctx.QUESTIONS, A.answers, mine, ctx.DIMS).match;
  if (Number(shown) !== want) throw new Error(`shown ${shown}%, expected ${want}%`);
  const back = document.querySelector("[data-backlink]").value.split("#")[1].split(".");
  const B = decode(back[1], ctx.sets);
  if (back[0] !== location.hash.slice(1) || B.name !== PEOPLE.B.name || !same(B.answers, mine)) throw new Error("reply link is wrong");
  log.push(`match ${shown}%`);
}

async function result(ctx, log) {
  const shown = await until(() => document.querySelector("[data-match]")?.dataset.match, "the result");
  const [a, b] = location.hash.slice(1).split(".");
  const want = compare(ctx.QUESTIONS, decode(a, ctx.sets).answers, decode(b, ctx.sets).answers, ctx.DIMS).match;
  if (Number(shown) !== want) throw new Error(`shown ${shown}%, expected ${want}%`);
  if (!document.querySelector(".bars .bar")) throw new Error("no area breakdown");
  log.push(`match ${shown}%`);
}

export async function run(page, ctx) {
  const log = [];
  try {
    const parts = location.hash.slice(1).split(".").filter(Boolean).length;
    if (page === "home") await home(ctx, log);
    else if (page === "check" && parts === 1) await invite(ctx, log);
    else if (page === "check" && parts === 2) await result(ctx, log);
    for (const el of document.querySelectorAll("button")) {
      if (el.offsetParent && !el.textContent.trim()) throw new Error("a visible button has no label");
    }
    document.body.dataset.selftest = "pass";
  } catch (e) {
    document.body.dataset.selftest = "fail: " + e.message;
  }
  const pre = document.createElement("pre");
  pre.id = "selftest";
  pre.textContent = document.body.dataset.selftest + "\n" + log.join("\n");
  document.body.appendChild(pre);
}

// Screenshot helper: ?demo=q3 shows question 3 answered; on an invite link, ?demo=answer plays it through.
export async function demo(page, what, ctx) {
  if (page === "home" && /^q\d+$/.test(what)) {
    document.querySelector("#name").value = PEOPLE.A.name;
    document.querySelector("[data-start]").click();
    const n = Number(what.slice(1));
    const want = answersFor("A", ctx.QUESTIONS.length).slice(0, n - 1);
    const box = document.querySelector("[data-questions]");
    for (let i = 0; i < want.length; i++) {
      box.querySelector(`[data-a="${want[i].a}"]`).click();
      box.querySelector("[data-next]").click();
    }
    box.querySelector('[data-a="2"]').click();
    box.querySelector('[data-imp="2"]').click();
  } else if (page === "home" && what === "done") {
    document.querySelector("#name").value = PEOPLE.A.name;
    document.querySelector("[data-start]").click();
    await answerAll(document.querySelector("[data-questions]"), answersFor("A", ctx.QUESTIONS.length));
  } else if (page === "check" && what === "answer") {
    await until(() => document.querySelector("[data-begin]"), "landing");
    document.querySelector("#landing #name").value = PEOPLE.B.name;
    document.querySelector("[data-begin]").click();
    await answerAll(document.querySelector("[data-questions]"), answersFor("B", ctx.QUESTIONS.length));
  }
  window.scrollTo(0, 0);
}
