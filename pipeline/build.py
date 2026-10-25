"""Build the SoulmateCheck static site into dist/. Standard library only (Python 3.9+).

    python3 pipeline/build.py [--out dist]

Optional environment (GitHub repository variables in CI; see OPERATIONS.md):
    SITE_URL          canonical origin + path, no trailing slash (default: the GitHub Pages URL)
    GOATCOUNTER_URL   e.g. https://soulmatecheck.goatcounter.com/count -> cookieless analytics on
    KEEPSAKE_URL      link to a paid keepsake report on other hosting -> money slot shown
    BUILD_DATE        YYYY-MM-DD, to reproduce a build
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SITE_URL = "https://theguysaccount.github.io/cupidai-soulmatecheck"
REPO_URL = "https://github.com/theguysaccount/cupidai-soulmatecheck"
INDEXNOW_KEY = (ROOT / "site" / "indexnow-key.txt").read_text().strip()
BRAND = "SoulmateCheck"
e = html.escape


def attr(s):
    return html.escape(str(s), quote=True)


class Site:
    def __init__(self, out, today):
        self.out, self.today = out, today
        self.site_url = os.environ.get("SITE_URL", DEFAULT_SITE_URL).rstrip("/")
        self.goatcounter = os.environ.get("GOATCOUNTER_URL", "").strip()
        self.keepsake = os.environ.get("KEEPSAKE_URL", "").strip()
        self.q = json.loads((ROOT / "data" / "questions.json").read_text(encoding="utf-8"))
        self.questions = self.q["sets"]["1"]
        self.pages = []
        h = hashlib.sha1()
        for p in sorted((ROOT / "site" / "assets").rglob("*")):
            if p.is_file():
                h.update(p.name.encode() + p.read_bytes())
        h.update((ROOT / "data" / "questions.json").read_bytes())
        self.ver = h.hexdigest()[:10]

    def url(self, path):
        return f"{self.site_url}/{path}"

    def write(self, path, text):
        f = self.out / path
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text, encoding="utf-8")

    def layout(self, path, title, description, body, *, page="static", og="home", jsonld=None, noindex=False, current="", root=None, app=True):
        if root is None:
            depth = path.count("/")
            root = "../" * depth if depth else "./"
        here = ' aria-current="page"'
        nav = "".join(f'<a href="{root}{p}"{here if p == current else ""}>{t}</a>' for p, t in
                      [("", "Make yours"), ("questions/", "The 24 questions"), ("about/", "How it works")])
        ld = "".join('<script type="application/ld+json">%s</script>\n' % json.dumps(b, ensure_ascii=False).replace("</", "<\\/")
                     for b in (jsonld or []))
        cfg = json.dumps({"root": root, "siteUrl": self.site_url, "keepsakeUrl": self.keepsake})
        scripts = ""
        if app:
            qjson = json.dumps(self.q, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
            scripts = (f'<script type="application/json" id="site-config">{cfg}</script>\n'
                       f'<script type="application/json" id="questions">{qjson}</script>\n'
                       f'<script type="module" src="{root}assets/app.js?v={self.ver}"></script>\n')
        gc = (f'<script data-goatcounter="{attr(self.goatcounter)}" async src="https://gc.zgo.at/count.js"></script>\n'
              if self.goatcounter else "")
        privacy = ("We count page visits with GoatCounter (no cookies, no personal data). " if self.goatcounter else "") + \
            "Answers live only inside the links you share: no accounts, no cookies, nothing stored."
        return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{attr(description)}">
<link rel="canonical" href="{self.url(path)}">
{'<meta name="robots" content="noindex">' if noindex else ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:title" content="{attr(title)}">
<meta property="og:description" content="{attr(description)}">
<meta property="og:url" content="{self.url(path)}">
<meta property="og:image" content="{self.site_url}/assets/og/{og}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#b0234f">
<link rel="icon" href="{root}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{root}assets/site.css?v={self.ver}">
{ld}{scripts}{gc}</head>
<body data-page="{page}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
<a class="logo" href="{root}">Soulmate<span>Check</span></a>
<nav class="nav" aria-label="Main">{nav}</nav>
</div></header>
<main id="main" class="wrap">
{body}
</main>
<footer class="site-foot"><div class="wrap">
<nav aria-label="Footer"><a href="{root}">Make a SoulmateCheck</a><a href="{root}questions/">Compatibility questions</a><a href="{root}about/">How scoring works and privacy</a><a href="{REPO_URL}">Source code</a></nav>
<p>{privacy}</p>
<p>For fun and conversation. Not relationship, medical or legal advice. For adults 18 and over.</p>
</div></footer>
</body>
</html>
"""

    def home(self):
        dims = ", ".join(d["name"].lower() for d in self.q["dimensions"])
        keepsake = (f'<p><a class="btn secondary" href="{attr(self.keepsake)}" rel="noopener">Get a keepsake of your result</a></p>'
                    if self.keepsake else "")
        body = f"""
<section id="intro">
<h1>See how compatible you really are, beyond the photos</h1>
<p class="lede">Answer 24 questions about what actually makes or breaks relationships. Send your link to a date, partner or crush. They answer the same questions, and you both see where you line up and what to talk about.</p>
<div class="card">
<label class="name">Your first name or nickname (optional, shown to whoever opens your link) <input id="name" type="text" maxlength="24" autocomplete="given-name"></label>
<div class="btn-row"><button class="btn" type="button" data-start>Make my SoulmateCheck</button></div>
<p class="note">About three minutes. No account. Your answers live only inside the link you share.</p>
</div>
<h2>How it works</h2>
<ol class="steps">
<li><b>Answer 24 questions</b> about {e(dims)}. Mark what matters most, including dealbreakers.</li>
<li><b>Share your link</b> in a chat, a text or your dating profile. Your answers are packed into the link itself.</li>
<li><b>They answer the same questions</b> and see your compatibility: an overall score, a score for each area, where you agree, and the differences worth talking about.</li>
<li><b>They send the result back</b>, so you see the same breakdown.</li>
</ol>
<h2>Why these questions</h2>
<p>Swiping shows you faces. The things that decide whether two people last (children, money, conflict, family, time together) usually come up months later. SoulmateCheck puts them first, and weights each one by how much it matters to each of you. <a href="questions/">See all 24 questions →</a></p>
<h2>Private by design</h2>
<p>There's no database. Your answers are encoded after the “#” in your link, a part browsers never send to any server, including ours. Anyone you share the link with can read your answers, so share it with people you'd tell them to.</p>
{keepsake}
</section>
<section id="flow" hidden><div data-questions></div></section>
<section id="done" hidden>
<p class="eyebrow">Your SoulmateCheck is ready</p>
<h1>Send it to someone you're curious about</h1>
<p>Whoever opens it answers the same 24 questions and sees how you match. They can send the result back to you.</p>
<input class="link" data-link readonly aria-label="Your SoulmateCheck link">
<div data-share></div>
<p><a data-preview href="#" target="_blank" rel="noopener">Preview what they'll see</a></p>
<div class="callout"><p><b>Putting it in a dating profile?</b> Some apps don't allow links in bios. Sending it in a chat after you match works everywhere.</p>
<p><b>Keep it.</b> Nothing is saved anywhere. Bookmark or copy the link if you want to share it again later.</p></div>
</section>
"""
        ld = [{"@context": "https://schema.org", "@type": "WebApplication", "name": BRAND, "url": self.site_url + "/",
               "applicationCategory": "LifestyleApplication", "operatingSystem": "Any", "isAccessibleForFree": True,
               "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
               "description": "A free compatibility check: answer 24 questions, share a link, compare."}]
        self.write("index.html", self.layout("", "SoulmateCheck: a free compatibility test you send to a date or partner",
                                             "Answer 24 questions about kids, money, conflict and more, send the link, and see how compatible you are. No account, nothing stored.",
                                             body, page="home", jsonld=ld, current=""))
        self.pages.append("")

    def check(self):
        body = """
<section id="landing"><h1>Take a SoulmateCheck</h1><p class="lede">Loading…</p></section>
<section id="flow" hidden><div data-questions></div></section>
<section id="result" hidden><div data-result></div></section>
<noscript><p>SoulmateCheck needs JavaScript to read the answers in the link.</p></noscript>
"""
        self.write("check/index.html", self.layout("check/", f"Take a SoulmateCheck | {BRAND}",
                                                   "Someone sent you a SoulmateCheck. Answer the same 24 questions to see how compatible you are.",
                                                   body, page="check", noindex=True))

    def questions_page(self):
        root = "../"
        items = []
        for d in self.q["dimensions"]:
            qs = [q for q in self.questions if q["dim"] == d["id"]]
            items.append(f"<h2>{e(d['name'])}</h2><ol class='qlist' start='{self.questions.index(qs[0]) + 1}'>" + "".join(
                f"<li><b>{e(q['text'])}</b><br><span class='opts'>{e(' · '.join(q['options']))}</span><br>{e(q['why'])} "
                f"<i>Ask: {e(q['talk'])}</i></li>" for q in qs) + "</ol>")
        body = f"""
<h1>24 compatibility questions to ask before you get serious</h1>
<p class="lede">The questions that decide whether two people last usually come up months in. Here they are up front, with why each one matters and a follow-up to ask. Answer them together, or <a href="{root}">send them as a SoulmateCheck</a> and compare automatically.</p>
{''.join(items)}
<div class="share-box"><h3>Compare your answers automatically</h3><p>Make a SoulmateCheck, send the link, and see a score for each area, where you agree, and what to talk about.</p><p><a class="btn" href="{root}">Make my SoulmateCheck</a></p></div>
"""
        ld = [{"@context": "https://schema.org", "@type": "Article", "headline": "24 compatibility questions to ask before you get serious",
               "dateModified": self.today.isoformat(), "inLanguage": "en", "mainEntityOfPage": self.url("questions/"),
               "author": {"@type": "Organization", "name": BRAND}, "publisher": {"@type": "Organization", "name": BRAND}}]
        self.write("questions/index.html", self.layout("questions/", f"24 compatibility questions to ask your partner | {BRAND}",
                                                       "Kids, money, conflict, family, time together: 24 relationship compatibility questions, why each matters, and what to ask next.",
                                                       body, og="questions", jsonld=ld, current="questions/", app=False))
        self.pages.append("questions/")

    def about(self):
        body = f"""
<h1>How SoulmateCheck works</h1>
<p class="lede">24 questions, two people, one score per area. Here's exactly how it's calculated, and where the answers go.</p>
<h2>Scoring</h2>
<p>Every question has five answers on a scale. For each question you both answered, agreement is 100% for the same answer, 75% one step apart, 50% two steps, 25% three steps and 0% at opposite ends. Skipped questions don't count.</p>
<p>Each of you also marks how much each question matters: a little (weight 1), somewhat (3), a lot (9) or a dealbreaker (20). Your satisfaction is the agreement averaged with your weights; theirs uses their weights. The match is the geometric mean of the two satisfactions, so it's only high when both people get what matters to them. Area scores use the same formula on the four questions in each area.</p>
<p>Any question one of you marked as a dealbreaker, where your answers are two or more steps apart, is listed first under “Talk about these first”.</p>
<h2>What it isn't</h2>
<p>It's a structured conversation, not a prediction. No quiz can say whether a relationship will work, and the scores aren't calibrated against real couples' outcomes yet. Differences are listed as things to talk about, not reasons to leave.</p>
<h2>Privacy</h2>
<ul>
<li>There's no database and no account. Your answers are packed into the part of the link after the “#”, which browsers never send to a server.</li>
<li>Anyone who has your link can read your answers. A result link holds both people's answers, so share it only with the other person.</li>
<li>{'Visits are counted with GoatCounter, which sets no cookies and collects no personal data.' if self.goatcounter else 'No cookies and no analytics.'}</li>
<li>No questions about health, sexuality or anything you'd need to be identified for. Every question can be skipped.</li>
</ul>
<h2>For adults</h2>
<p>SoulmateCheck is meant for adults (18+). If a relationship involves pressure, control or fear, a quiz isn't the answer: in the US, the National Domestic Violence Hotline is at <a href="https://www.thehotline.org/">thehotline.org</a> or 1-800-799-7233.</p>
<h2>Open source</h2>
<p>The code is on <a href="{REPO_URL}">GitHub</a> (MIT). Questions or problems: <a href="{REPO_URL}/issues/new">open an issue</a>.</p>
"""
        self.write("about/index.html", self.layout("about/", f"How SoulmateCheck works: scoring and privacy",
                                                   "How the SoulmateCheck compatibility score is calculated, and why your answers never leave the link you share.",
                                                   body, current="about/", app=False))
        self.pages.append("about/")

    def not_found(self):
        after = self.site_url.split("://", 1)[1]
        prefix = "/" + after.split("/", 1)[1] + "/" if "/" in after else "/"
        body = f'<h1>Page not found</h1><p>That page doesn\'t exist.</p><p><a class="btn" href="{prefix}">Make a SoulmateCheck</a></p>'
        self.write("404.html", self.layout("404.html", f"Page not found | {BRAND}", "That page doesn't exist. Make a SoulmateCheck instead.",
                                           body, noindex=True, root=prefix, app=False))

    def meta_files(self):
        lastmod = self.today.isoformat()
        urls = "".join(f"<url><loc>{self.url(p)}</loc><lastmod>{lastmod}</lastmod></url>\n" for p in self.pages)
        self.write("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
        self.write("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {self.site_url}/sitemap.xml\n")
        self.write(f"{INDEXNOW_KEY}.txt", INDEXNOW_KEY)
        self.write(".nojekyll", "")
        (self.out / "urls.txt").write_text("".join(self.url(p) + "\n" for p in self.pages), encoding="utf-8")

    def build(self):
        if self.out.exists():
            shutil.rmtree(self.out)
        shutil.copytree(ROOT / "site" / "assets", self.out / "assets")
        for name in ("app.js", "selftest.js"):
            f = self.out / "assets" / name
            f.write_text(f.read_text(encoding="utf-8").replace('from "./core.js"', f'from "./core.js?v={self.ver}"')
                         .replace('from "./patterns.js"', f'from "./patterns.js?v={self.ver}"')
                         .replace('import("./selftest.js")', f'import("./selftest.js?v={self.ver}")'), encoding="utf-8")
        shutil.copy(ROOT / "site" / "favicon.svg", self.out / "favicon.svg")
        self.home()
        self.check()
        self.questions_page()
        self.about()
        self.not_found()
        self.meta_files()
        return self


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist"))
    args = ap.parse_args()
    today = dt.date.fromisoformat(os.environ["BUILD_DATE"]) if os.environ.get("BUILD_DATE") else dt.datetime.now(dt.timezone.utc).date()
    site = Site(Path(args.out), today).build()
    print(f"built {len(site.pages)} pages into {args.out}")


if __name__ == "__main__":
    main()
