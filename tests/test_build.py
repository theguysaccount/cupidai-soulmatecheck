"""The built site: pages, links, metadata, privacy promises and the optional keys."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://example.org/sc"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.scripts, self.meta, self.title, self.json = [], [], {}, "", []
        self._t = self._j = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("a", "link") and a.get("href"):
            self.links.append((a.get("rel", ""), a["href"]))
        if tag == "script":
            if a.get("src"):
                self.scripts.append(a["src"])
            self._j = a.get("type") in ("application/ld+json", "application/json")
        if tag == "meta" and (a.get("name") or a.get("property")):
            self.meta[a.get("name") or a.get("property")] = a.get("content", "")
        self._t = tag == "title"

    def handle_endtag(self, tag):
        self._t = False
        if tag == "script":
            self._j = False

    def handle_data(self, d):
        if self._t:
            self.title += d
        if self._j:
            self.json.append(d)


def build(out, **env):
    e = dict(os.environ, SITE_URL=SITE, BUILD_DATE="2026-10-25", GOATCOUNTER_URL="", KEEPSAKE_URL="")
    e.update(env)
    subprocess.run([sys.executable, str(ROOT / "pipeline" / "build.py"), "--out", str(out)], check=True, env=e, capture_output=True)


class BuildTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = Path(tempfile.mkdtemp()) / "dist"
        build(cls.out)
        cls.pages = {}
        for f in cls.out.rglob("*.html"):
            p = Page()
            p.feed(f.read_text(encoding="utf-8"))
            cls.pages[f.relative_to(cls.out).as_posix()] = p

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.out.parent)

    def test_pages_and_sitemap(self):
        self.assertEqual(set(self.pages), {"index.html", "check/index.html", "questions/index.html", "about/index.html", "404.html"})
        locs = re.findall(r"<loc>([^<]+)</loc>", (self.out / "sitemap.xml").read_text())
        self.assertEqual(locs, [f"{SITE}/", f"{SITE}/questions/", f"{SITE}/about/"])

    def test_links_resolve(self):
        for name, page in self.pages.items():
            if name == "404.html":
                continue
            for rel, href in page.links + [("", s) for s in page.scripts]:
                if href.startswith(("http", "mailto:", "#")):
                    continue
                target = urlparse(urljoin(f"http://x/{name}", href)).path.lstrip("/")
                target = target + "index.html" if target == "" or target.endswith("/") else target
                with self.subTest(page=name, href=href):
                    self.assertTrue((self.out / target).exists(), target)

    def test_metadata(self):
        for name, page in self.pages.items():
            with self.subTest(name):
                self.assertTrue(page.title.strip())
                self.assertGreater(len(page.meta.get("description", "")), 30)
                self.assertTrue((self.out / page.meta["og:image"][len(SITE) + 1:]).exists(), page.meta["og:image"])
                self.assertEqual(len([h for r, h in page.links if r == "canonical"]), 1)
                for block in page.json:
                    json.loads(block)
                self.assertEqual(page.meta.get("robots") == "noindex", name in ("check/index.html", "404.html"))

    def test_questions_page_lists_all_24(self):
        html = (self.out / "questions" / "index.html").read_text()
        q = json.loads((ROOT / "data" / "questions.json").read_text())["sets"]["1"]
        for item in q:
            self.assertIn(item["talk"].replace("'", "&#x27;"), html)
        self.assertEqual(html.count("<li><b>"), 24)

    def test_no_third_party_scripts_by_default(self):
        for name, page in self.pages.items():
            for src in page.scripts:
                self.assertFalse(src.startswith(("http", "//")), f"{name}: {src}")

    def test_app_pages_carry_the_questions(self):
        for name in ("index.html", "check/index.html"):
            html = (self.out / name).read_text()
            self.assertIn('id="questions"', html)
            self.assertIn('id="site-config"', html)

    def test_versioned_imports(self):
        ver = re.search(r"app\.js\?v=([0-9a-f]{10})", (self.out / "index.html").read_text()).group(1)
        self.assertIn(f'from "./core.js?v={ver}"', (self.out / "assets" / "app.js").read_text())
        self.assertIn(f'from "./patterns.js?v={ver}"', (self.out / "assets" / "selftest.js").read_text())

    def test_optional_keys(self):
        out = Path(tempfile.mkdtemp()) / "d"
        try:
            build(out, GOATCOUNTER_URL="https://x.goatcounter.com/count", KEEPSAKE_URL="https://example.org/keepsake")
            home = (out / "index.html").read_text()
            self.assertIn('data-goatcounter="https://x.goatcounter.com/count"', home)
            self.assertIn("https://example.org/keepsake", home)
        finally:
            shutil.rmtree(out.parent)


if __name__ == "__main__":
    unittest.main()
