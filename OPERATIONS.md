# Operations

SoulmateCheck is a static site on GitHub Pages with no server and no data: a check exists only inside the link people share. Actions runs the deploy and a weekly self-test. Nothing needs a person.

**Live:** https://app.soulmatecheck.com/ (since 2026-11-22; the first address, https://theguysaccount.github.io/cupidai-soulmatecheck/, redirects there, and links shared on it keep their `#` part)
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
- **Retried fetches.** Since 2026-11-22 the self-test and the smoke test after each deploy load a page again after 10, 20 and 30 seconds when GitHub Pages answers with a 5xx, times out or drops the connection: at most six retries per run in `scripts/check_live.py` and four in `scripts/e2e.sh`, so a site that's really down still fails within minutes. Each retry leaves a warning on the run, and only a page that still fails counts. A 403 or 404 fails at once.
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

**Switched on 2026-11-22 to `app.soulmatecheck.com`.** A subdomain, so the apex and whatever SiteGround serves there stay as they are. `app` has a CNAME to `theguysaccount.github.io` in the zone that answers for soulmatecheck.com (SiteGround's nameservers). The domain rollout session made it the Pages custom domain (certificate approved, HTTPS enforced), set `SITE_URL` = `https://app.soulmatecheck.com` and redeployed at 08:22 UTC. A self-test three minutes later failed only because the CDN still held the old home page (see step 4 below).

#### Exact commands to switch the base URL (added 2026-11-22)

The steps above as commands, for the domain rollout session or anyone with `gh` signed in as theguysaccount: to redo the switch, move to another name, or undo it. Every address the build writes into the site (canonicals, sitemap, robots.txt, Open Graph tags, JSON-LD, IndexNow) comes from the one repo variable `SITE_URL`, and the deploy smoke test and the weekly self-test follow it too, so no file needs editing. DNS is the domain rollout session's job; nothing in this repo changes DNS. Don't add a `CNAME` file: this site deploys through Actions, which ignores one.

```bash
REPO=theguysaccount/cupidai-soulmatecheck
DOMAIN=app.soulmatecheck.com   # the chosen name: no https://, no trailing slash

# 0. DNS must already point at GitHub. Ask a public resolver (a local cache can be stale):
curl -s "https://dns.google/resolve?name=$DOMAIN&type=A"   # expect theguysaccount.github.io. and 185.199.108-111.153

# 1. Make it the Pages custom domain. GitHub requests a certificate, and github.io starts redirecting to it.
gh api -X PUT "repos/$REPO/pages" -f cname="$DOMAIN"

# 2. Enforce HTTPS once the certificate exists (minutes, sometimes hours). This tries every 2 minutes for 2 hours.
for i in $(seq 60); do gh api -X PUT "repos/$REPO/pages" -F https_enforced=true --silent 2>/dev/null && break; sleep 120; done
gh api "repos/$REPO/pages" --jq '{cname, https_enforced, certificate: .https_certificate.state}'   # expect true, "approved"

# 3. Switch the base URL and redeploy.
gh variable set SITE_URL -R "$REPO" --body "https://$DOMAIN"
gh workflow run pages.yml -R "$REPO"
sleep 20; gh run watch -R "$REPO" --exit-status "$(gh run list -R "$REPO" --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')"

# 4. Pages' CDN keeps each page for up to 10 minutes (max-age=600), so wait before checking canonicals.
#    Then, from a checkout of this repo. (A machine whose DNS cache doesn't know the new name yet fails
#    these with "nodename nor servname provided"; the selftest.yml run on GitHub's runners still counts.)
sleep 600
scripts/e2e.sh "https://$DOMAIN/"
python3 scripts/check_live.py "https://$DOMAIN"
curl -sI "https://theguysaccount.github.io/${REPO#*/}/" | grep -i '^location'   # expect https://$DOMAIN/
gh workflow run selftest.yml -R "$REPO"
```

Afterwards: `gh repo edit "$REPO" --homepage "https://$DOMAIN"`, put the new address in the **Live:** line at the top, and add the domain to Google Search Console (key 5). To undo: `gh variable delete SITE_URL -R "$REPO"`, `gh api -X PUT "repos/$REPO/pages" -F cname=null`, then `gh workflow run pages.yml -R "$REPO"`.

### 2. Money: keepsake reports

Pages is non-commercial. The slot is a "Get a keepsake of your result" button on the home page, hidden until `KEEPSAKE_URL` is set (repo variable) to a product on other hosting (for example a Stripe Payment Link for a printed or designed report). The brief's paid matchmaking service and video intros need a server, consent flows for recordings, signed releases for marketing videos, and BIPA/GDPR review for any face data; none of that is built.

### 3. Analytics (activation metric)

Off by default. Events in the code: `create_start`, `check_created` (**activation for makers**), `check_opened`, `check_answered/<score bucket>` (**activation for responders**), `share/<invite|result>-<channel>`, `result_opened`, `own_from_result` (**the viral loop**). Set repo variable `GOATCOUNTER_URL` = `https://<code>.goatcounter.com/count` and redeploy.

### 4. Calibration with married couples

The scoring is a transparent weighted-agreement formula, not calibrated on real couples (the About page says so). Calibrating needs people (recruit happily married couples, collect their answer pairs with consent, fit weights) and somewhere to store answers, so it's a human key. The code is ready for new weights: they're one array (`WEIGHTS`) in `site/assets/core.js`.

### 5. Search Console

Verify in Google Search Console (Jack's Google account) and submit `/sitemap.xml`. IndexNow runs on every deploy.
