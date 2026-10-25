# Operations

SoulmateCheck is a static site on GitHub Pages with no server and no data: a check exists only inside the link people share. Actions runs the deploy and a weekly self-test. Nothing needs a person.

**Live:** https://theguysaccount.github.io/cupidai-soulmatecheck/
**Repo:** https://github.com/theguysaccount/cupidai-soulmatecheck

## Automated jobs

| Job | Workflow | When | What it does | How it fails safe |
|---|---|---|---|---|
| Deploy | `pages.yml` | every push to `main` | Python and JS tests (link encoding, damaged-link rejection, scoring worked by hand, symmetry, fixture sync), build, three end-to-end runs in headless Chrome (make a check, answer an invite, open a result), deploy, the same three runs against the live site, IndexNow | Any failure stops before deploy, so the last good site stays live. |
| Self-test + keep-alive | `selftest.yml` | Thursdays 16:53 UTC | Unit tests; the three end-to-end runs on the **live** site; every sitemap page and `/check/` answers 200 with its own canonical; the live question set equals `data/questions.json` | On failure, opens (or comments on) one `ops-alert` issue, and GitHub emails the repo owner. |
| Keep-alive | `selftest.yml` → `scripts/keepalive.sh` | weekly | Re-enables the scheduled workflow through the API; empty `[skip ci]` commit when the last commit is 45+ days old | Nothing else commits here, so without it GitHub would disable the schedule after 60 days. |

There is no data refresh: questions are fixed, and answers are never stored.

## What to watch

- **Open `ops-alert` issues.**
- **Never edit question set 1.** Existing links decode against it. To change questions, add set `"2"` in `data/questions.json`, encode new checks with it, and keep set 1 for old links. The self-test fails if the live set 1 drifts from the repo.

## Run anything by hand

```bash
python3 pipeline/build.py && scripts/e2e.sh
scripts/e2e.sh https://theguysaccount.github.io/cupidai-soulmatecheck/
python3 scripts/check_live.py https://theguysaccount.github.io/cupidai-soulmatecheck
node scripts/fixture.mjs > tests/fixtures/links.json   # after an intended encoding change
```

## Keys Jack can turn later

### 1. Custom domain: soulmatecheck.com

`soulmatecheck.com` is in the portfolio (Namecheap, registered 2022-06-08, renews 2027-06-08). **Something is live on it now:** nameservers are SiteGround's, the apex resolves to `35.215.81.164` (the same SiteGround server as getlifeclock.com) behind SiteGround's robot challenge, and `www` has no record. It's probably Jack's 2022 personal "resonance check" page. Check it before changing anything.

Steps once Jack decides:
1. In the DNS zone (SiteGround, or Namecheap if the nameservers move back): `A @` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `AAAA @` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`; `CNAME www` → `theguysaccount.github.io`.
2. GitHub → Settings → Pages → Custom domain `soulmatecheck.com`, wait for the certificate, tick **Enforce HTTPS**.
3. Repo variable `SITE_URL` = `https://soulmatecheck.com`; run `gh workflow run pages.yml -R theguysaccount/cupidai-soulmatecheck`.
4. Old github.io links (including ones people already shared) redirect to the domain with their `#` part intact, so they keep working.
5. The note's `soulmatecheck.com/bumble` idea is a path for later: a page that explains how to share a check from a dating profile.

### 2. Money: keepsake reports

Pages is non-commercial. The slot is a "Get a keepsake of your result" button on the home page, hidden until `KEEPSAKE_URL` is set (repo variable) to a product on other hosting (for example a Stripe Payment Link for a printed or designed report). The brief's paid matchmaking service and video intros need a server, consent flows for recordings, signed releases for marketing videos, and BIPA/GDPR review for any face data; none of that is built.

### 3. Analytics (activation metric)

Off by default. Events in the code: `create_start`, `check_created` (**activation for makers**), `check_opened`, `check_answered/<score bucket>` (**activation for responders**), `share/<invite|result>-<channel>`, `result_opened`, `own_from_result` (**the viral loop**). Set repo variable `GOATCOUNTER_URL` = `https://<code>.goatcounter.com/count` and redeploy.

### 4. Calibration with married couples

The scoring is a transparent weighted-agreement formula, not calibrated on real couples (the About page says so). Calibrating needs people (recruit happily married couples, collect their answer pairs with consent, fit weights) and somewhere to store answers, so it's a human key. The code is ready for new weights: they're one array (`WEIGHTS`) in `site/assets/core.js`.

### 5. Search Console

Verify in Google Search Console (Jack's Google account) and submit `/sitemap.xml`. IndexNow runs on every deploy.
