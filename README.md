# SoulmateCheck

**Live:** https://theguysaccount.github.io/cupidai-soulmatecheck/ · **Screens:** [docs/screens](docs/screens/)

A free compatibility check you send to a date, partner or crush. Answer 24 questions about what actually makes or breaks relationships (children, money, conflict, family, time together), mark what matters and what's a dealbreaker, and share your link. Whoever opens it answers the same questions and sees your match: an overall score, a score for each of six areas, where you line up, and the differences worth talking about. They can send the result back.

There's no server and no database. A check lives only in its link: answers are packed (5 bits each, plus a checksum) after the `#`, which browsers never send to a server. A full check is a 32-character fragment.

## How it runs

| What | Where | When |
|---|---|---|
| Tests, build, three end-to-end runs in headless Chrome, deploy, the same runs live, IndexNow | `.github/workflows/pages.yml` | every push |
| Tests, live end-to-end runs, page and question-set checks, keep-alive | `.github/workflows/selftest.yml` | weekly |

Details and the keys for the domain, keepsake reports and analytics: [OPERATIONS.md](OPERATIONS.md).

## Scoring

Agreement per question is `1 - |a - b| / 4` on a five-point scale. Each person weights questions by importance (1, 3, 9, 20 for a little, somewhat, a lot, dealbreaker); each person's satisfaction is their weighted mean agreement; the match is the geometric mean of the two. Dealbreakers two or more steps apart are listed first. Full explanation on the site's How it works page.

## Layout

```
data/questions.json     the 24 questions (set 1 is frozen so old links keep working), dimensions, importance labels
pipeline/build.py       static site generator (standard library only) -> dist/
site/assets/core.js     encoding, decoding and scoring; app.js the UI; selftest.js and patterns.js the end-to-end driver
scripts/                e2e.sh, screens.sh, og.py, fixture.mjs, indexnow.py, check_live.py, keepalive.sh
tests/                  Python build tests; tests/js encoding and scoring tests; tests/fixtures/links.json
```

## Run, test, deploy

```bash
python3 pipeline/build.py && python3 -m http.server -d dist 8000
python3 -m unittest discover -s tests
node --test tests/js/*.test.mjs
scripts/e2e.sh
```

Deploy is a push to `main`. License: MIT.
