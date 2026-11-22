"""Weekly health check of the live site: python3 scripts/check_live.py https://theguysaccount.github.io/cupidai-soulmatecheck

Checks every sitemap URL answers 200 with its own canonical, the check page and assets load, and the
live site embeds the committed question set (so old links keep decoding). Exits 1 on any failure.
"""
import http.client
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "SoulmateCheckHealthCheck/1.0 (+https://github.com/theguysaccount/cupidai-soulmatecheck)"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        return r.status, r.read().decode("utf-8", errors="replace")


# Retries (added 2026-11-22). GitHub Pages now and then answers a single request with a 5xx; one 503
# failed LifeClock's self-test on 2026-11-17. get() above stays as the single attempt (get_once); the
# get() below wraps it and tries a failed fetch up to three more times, after 10, 20 and 30 seconds.
# An answer a retry won't change (403, 404 and the like) still fails at once, and a run gets at most
# six retries, so a site that is really down still fails within minutes.
get_once = get
RETRY_PAUSES = (10, 20, 30)  # seconds before the 2nd, 3rd and 4th tries
RETRY_BUDGET = 6  # retries per run
retries_used = 0


def transient(e):
    """True for a failure worth retrying: HTTP 408, 429 or 5xx, a timeout or a dropped connection."""
    if isinstance(e, urllib.error.HTTPError):
        return e.code in (408, 429) or e.code >= 500
    return isinstance(e, (OSError, http.client.HTTPException))


def get(url):
    global retries_used
    for pause in RETRY_PAUSES + (None,):
        try:
            return get_once(url)
        except Exception as e:
            if pause is None or not transient(e) or retries_used >= RETRY_BUDGET:
                raise
            retries_used += 1
            print(f"::warning::{url}: {e}; trying again in {pause} s", flush=True)
            time.sleep(pause)


def main(base):
    base = base.rstrip("/")
    problems = []
    urls = re.findall(r"<loc>([^<]+)</loc>", get(f"{base}/sitemap.xml")[1])
    if len(urls) < 3:
        problems.append(f"sitemap has {len(urls)} URLs")
    for u in urls + [f"{base}/check/"]:
        try:
            status, page = get(u)
            canon = re.search(r'<link rel="canonical" href="([^"]+)"', page)
            if status != 200 or not canon or canon.group(1) != u:
                problems.append(f"{u}: status {status}, canonical {canon.group(1) if canon else None}")
        except Exception as e:
            problems.append(f"{u}: {e}")
    try:
        page = get(f"{base}/check/")[1]
        live = json.loads(re.search(r'<script type="application/json" id="questions">(.*?)</script>', page, re.S).group(1))
        mine = json.loads((ROOT / "data" / "questions.json").read_text())
        if live["sets"]["1"] != mine["sets"]["1"]:
            problems.append("question set 1 on the live site differs from data/questions.json; old links would misread")
    except Exception as e:
        problems.append(f"questions: {e}")
    print(f"checked {len(urls) + 1} pages")
    for p in problems:
        print(f"::error::{p}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
