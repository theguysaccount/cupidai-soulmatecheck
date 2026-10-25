// SoulmateCheck UI. Logic lives in core.js. Nothing is stored or sent: a check exists only in its link.
import { encode, parseFragment, compare, label, cleanName, MIN_COMMON } from "./core.js";

const CFG = JSON.parse(document.getElementById("site-config").textContent);
const Q = JSON.parse(document.getElementById("questions").textContent);
const SET = "1";
const QUESTIONS = Q.sets[SET];
const DIMS = Q.dimensions;
const DIM_NAME = Object.fromEntries(DIMS.map((d) => [d.id, d.name]));
const page = document.body.dataset.page;
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function track(name, detail) {
  try {
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: `event/${name}${detail ? "/" + detail : ""}`, title: name, event: true });
  } catch (e) { /* analytics must never break the check */ }
}

const checkUrl = (...parts) => `${CFG.siteUrl}/check/#${parts.join(".")}`;

// ---------- the 24-question flow ----------
function runQuestions(box, { onDone }) {
  const answers = QUESTIONS.map(() => ({ a: 0, imp: 1 }));
  let i = 0;
  const render = () => {
    const q = QUESTIONS[i];
    const cur = answers[i];
    box.innerHTML = `
      <div class="qhead"><span>${esc(DIM_NAME[q.dim])}</span><span>${i + 1} of ${QUESTIONS.length}</span></div>
      <div class="progress" aria-hidden="true"><span style="width:${(i / QUESTIONS.length) * 100}%"></span></div>
      <h2 class="qtext" id="q-${i}" tabindex="-1">${esc(q.text)}</h2>
      <div class="options" role="radiogroup" aria-labelledby="q-${i}">
        ${q.options.map((o, k) => `<button type="button" class="option" role="radio" aria-checked="${cur.a === k + 1}" data-a="${k + 1}">${esc(o)}</button>`).join("")}
      </div>
      <p class="imp-label" id="imp-${i}">How much does this matter to you?</p>
      <div class="imps" role="radiogroup" aria-labelledby="imp-${i}">
        ${Q.importance.map((t, k) => `<button type="button" class="imp${k === 3 ? " deal" : ""}" role="radio" aria-checked="${cur.imp === k}" data-imp="${k}">${esc(t)}</button>`).join("")}
      </div>
      <div class="btn-row nav-row">
        <button type="button" class="btn secondary" data-back ${i === 0 ? "disabled" : ""}>Back</button>
        <button type="button" class="btn secondary" data-skip>Skip</button>
        <button type="button" class="btn" data-next ${cur.a ? "" : "disabled"}>${i === QUESTIONS.length - 1 ? "Finish" : "Next"}</button>
      </div>`;
    box.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => {
      cur.a = Number(b.dataset.a);
      box.querySelectorAll("[data-a]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      box.querySelector("[data-next]").disabled = false;
    }));
    box.querySelectorAll("[data-imp]").forEach((b) => b.addEventListener("click", () => {
      cur.imp = Number(b.dataset.imp);
      box.querySelectorAll("[data-imp]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    }));
    box.querySelector("[data-back]").addEventListener("click", () => { i--; render(); });
    box.querySelector("[data-skip]").addEventListener("click", () => { cur.a = 0; advance(); });
    box.querySelector("[data-next]").addEventListener("click", advance);
    $(`#q-${i}`, box).focus({ preventScroll: true });
    if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: "start" });
  };
  const advance = () => {
    if (i < QUESTIONS.length - 1) { i++; render(); } else onDone(answers);
  };
  render();
}

// ---------- sharing ----------
function shareRow(url, text, subject, what) {
  const enc = encodeURIComponent;
  return `<div class="btn-row">
    ${navigator.share ? `<button class="btn small" type="button" data-native>Share…</button>` : ""}
    <a class="btn small secondary" href="sms:?&body=${enc(text + " " + url)}" data-t="${what}-sms">Text it</a>
    <a class="btn small secondary" href="https://wa.me/?text=${enc(text + " " + url)}" target="_blank" rel="noopener" data-t="${what}-whatsapp">WhatsApp</a>
    <a class="btn small secondary" href="mailto:?subject=${enc(subject)}&body=${enc(text + "\n\n" + url)}" data-t="${what}-email">Email it</a>
    <button class="btn small secondary" type="button" data-copy>Copy link</button>
  </div>`;
}

function wireShare(el, url, text, subject, what) {
  const native = el.querySelector("[data-native]");
  if (native) native.addEventListener("click", async () => {
    track("share", what + "-native");
    try { await navigator.share({ title: subject, text, url }); } catch (e) { /* cancelled */ }
  });
  el.querySelector("[data-copy]").addEventListener("click", async (ev) => {
    track("share", what + "-copy");
    try {
      await navigator.clipboard.writeText(url);
      ev.target.textContent = "Copied ✓";
    } catch (e) { window.prompt("Copy this link:", url); }
  });
  el.querySelectorAll("[data-t]").forEach((a) => a.addEventListener("click", () => track("share", a.dataset.t)));
}

// ---------- results ----------
function answerText(i, a) {
  return a ? QUESTIONS[i].options[a - 1] : "Skipped";
}

function renderResult(box, A, B, { justAnswered }) {
  const r = compare(QUESTIONS, A.answers, B.answers, DIMS);
  const nameA = A.name || "They";
  const nameB = B.name || (justAnswered ? "You" : "Their match");
  const pair = `${esc(nameA)} + ${esc(nameB)}`;
  const row = (x) => `<li><b>${esc(x.q.text)}</b><br><span class="ans">${esc(nameA)}: ${esc(answerText(x.i, x.a))}</span><span class="ans">${esc(nameB)}: ${esc(answerText(x.i, x.b))}</span>${x.gap ? `<br><span class="talk">Talk about it: ${esc(x.q.talk)}</span>` : ""}</li>`;
  box.innerHTML = `
    <p class="eyebrow">${pair}</p>
    <p class="score" data-match="${r.match ?? ""}">${r.match === null ? "?" : r.match + "%"}</p>
    <p class="verdict">${esc(label(r.match))}</p>
    ${r.common < MIN_COMMON ? `<p class="note">Only ${r.common} questions were answered by both of you, so treat this loosely.</p>` : ""}
    ${r.dealbreakers.length ? `<div class="callout deal"><h3>Talk about these first</h3><p>One of you marked these as dealbreakers, and your answers are far apart.</p><ul class="pairs">${r.dealbreakers.map(row).join("")}</ul></div>` : ""}
    <h3>By area</h3>
    <div class="bars">${DIMS.map((d) => {
      const m = r.byDim[d.id].match;
      return `<div class="bar"><span>${esc(d.name)}</span><span class="track"><span style="width:${m ?? 0}%"></span></span><b>${m === null ? "–" : m + "%"}</b></div>`;
    }).join("")}</div>
    ${r.aligned.length ? `<h3>Where you line up</h3><ul class="pairs">${r.aligned.map(row).join("")}</ul>` : ""}
    ${r.gaps.length ? `<h3>Worth talking about</h3><ul class="pairs">${r.gaps.map(row).join("")}</ul>` : ""}
    <p class="note">For fun and conversation. A quiz can't predict a relationship, and differences aren't failures: they're what to talk about.</p>
    <div data-actions></div>`;
  return r;
}

// ---------- pages ----------
function initHome() {
  const intro = $("#intro");
  const flow = $("#flow");
  const done = $("#done");
  const nameInput = $("#name");
  document.querySelectorAll("[data-start]").forEach((b) => b.addEventListener("click", () => {
    intro.hidden = true;
    flow.hidden = false;
    track("create_start");
    runQuestions($("[data-questions]", flow), {
      onDone: (answers) => {
        const name = cleanName(nameInput.value);
        const link = checkUrl(encode({ name, answers }));
        flow.hidden = true;
        done.hidden = false;
        const field = $("[data-link]", done);
        field.value = link;
        $("[data-preview]", done).href = link;
        const text = name ? `${name} made a SoulmateCheck. Answer 24 questions and see how compatible we are:` : "I made a SoulmateCheck. Answer 24 questions and see how compatible we are:";
        $("[data-share]", done).innerHTML = shareRow(link, text, "Take my SoulmateCheck", "invite");
        wireShare(done, link, text, "Take my SoulmateCheck", "invite");
        done.scrollIntoView({ block: "start" });
        track("check_created");
      },
    });
  }));
  $("[data-select]")?.addEventListener("click", () => $("[data-link]").select());
}

function initCheck() {
  const landing = $("#landing");
  const flow = $("#flow");
  const result = $("#result");
  const show = () => {
    const parsed = parseFragment(location.hash, Q.sets);
    landing.hidden = flow.hidden = result.hidden = true;
    if (!parsed || parsed.error) {
      landing.hidden = false;
      landing.innerHTML = parsed && parsed.error
        ? `<h1>This link looks incomplete</h1><p class="lede">Part of it may have been cut off when it was copied. Ask for the link again, or make your own SoulmateCheck.</p><p><a class="btn" href="../">Make my SoulmateCheck</a></p>`
        : `<h1>Take a SoulmateCheck</h1><p class="lede">A SoulmateCheck link holds someone's answers to 24 questions. Open the link they sent you to compare, or make your own.</p><p><a class="btn" href="../">Make my SoulmateCheck</a></p>`;
      return;
    }
    const A = parsed.a;
    if (parsed.b) {
      result.hidden = false;
      const r = renderResult($("[data-result]", result), A, parsed.b, { justAnswered: false });
      $("[data-actions]", result).innerHTML = `<div class="share-box"><h3>Want your own?</h3><p>Make a SoulmateCheck and send it to someone you're curious about.</p><p><a class="btn" href="../" data-own>Make my SoulmateCheck</a></p></div>`;
      $("[data-own]", result).addEventListener("click", () => track("own_from_result"));
      track("result_opened", String(r.match));
      return;
    }
    landing.hidden = false;
    const who = A.name || "Someone";
    landing.innerHTML = `
      <p class="eyebrow">SoulmateCheck</p>
      <h1>${esc(who)} made a SoulmateCheck</h1>
      <p class="lede">Answer the same 24 questions (about three minutes) to see how compatible you are, where you line up, and what's worth talking about.</p>
      <label class="name">Your first name (optional, shown on the result) <input id="name" type="text" maxlength="24" autocomplete="given-name"></label>
      <p><button class="btn" type="button" data-begin>Start</button></p>
      <p class="note">${esc(who)}'s answers are inside this link, and yours will be inside the result link. Nothing is stored anywhere else: no account, no cookies.</p>`;
    track("check_opened");
    $("[data-begin]", landing).addEventListener("click", () => {
      const myName = cleanName($("#name", landing).value);
      landing.hidden = true;
      flow.hidden = false;
      runQuestions($("[data-questions]", flow), {
        onDone: (answers) => {
          const B = { name: myName, set: Number(SET), answers };
          flow.hidden = true;
          result.hidden = false;
          const r = renderResult($("[data-result]", result), A, B, { justAnswered: true });
          const back = checkUrl(location.hash.replace(/^#/, "").split(".")[0], encode(B));
          const text = `${myName || "I"} took your SoulmateCheck: we're a ${r.match}% match. See the breakdown:`;
          $("[data-actions]", result).innerHTML = `
            <div class="share-box"><h3>Send your result to ${esc(who)}</h3><p>The link shows ${esc(who)} the same breakdown. It holds both of your answers, so share it only with them.</p><div data-back-share></div>
            <input class="link" data-backlink readonly value="${esc(back)}" aria-label="Result link"></div>
            <div class="share-box"><h3>Make your own</h3><p>Curious how others match with you? It takes three minutes.</p><p><a class="btn" href="../" data-own>Make my SoulmateCheck</a></p></div>`;
          $("[data-back-share]", result).innerHTML = shareRow(back, text, "Our SoulmateCheck result", "result");
          wireShare(result, back, text, "Our SoulmateCheck result", "result");
          $("[data-own]", result).addEventListener("click", () => track("own_from_result"));
          result.scrollIntoView({ block: "start" });
          track("check_answered", String(Math.round((r.match ?? 0) / 10) * 10));
        },
      });
    });
  };
  window.addEventListener("hashchange", show);
  show();
}

({ home: initHome, check: initCheck })[page]?.();

if (/[?&]selftest=1\b/.test(location.search)) {
  import("./selftest.js").then((m) => m.run(page, { QUESTIONS, sets: Q.sets, DIMS })).catch((e) => { document.body.dataset.selftest = "fail: " + e.message; });
}
const demo = new URLSearchParams(location.search).get("demo");
if (demo) import("./selftest.js").then((m) => m.demo(page, demo, { QUESTIONS }));
