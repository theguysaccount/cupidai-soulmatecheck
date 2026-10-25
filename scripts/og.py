"""Render the 1200x630 Open Graph cards in site/assets/og/ with headless Chrome: python3 scripts/og.py"""
import html
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "og"
CHROME = os.environ.get("CHROME") or next(
    (c for c in [shutil.which("google-chrome"), shutil.which("chromium"),
                 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"] if c and Path(c).exists()), None)
CARD = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1200px;height:630px;overflow:hidden}}
body{{background:linear-gradient(135deg,#2a0f1d,#5b1736);color:#fff;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 display:flex;flex-direction:column;justify-content:space-between;padding:60px 72px;box-sizing:border-box}}
.top{{font-size:36px;font-weight:800}} .top span{{color:#ff8fb1}}
.big{{font-size:150px;font-weight:900;line-height:1;color:#ff8fb1;letter-spacing:-.03em}}
h1{{font-size:54px;line-height:1.12;margin:14px 0 0;max-width:1000px}}
p{{font-size:28px;color:#f3cbd8;margin:0}}
</style></head><body>
<div class="top">Soulmate<span>Check</span></div>
<div><div class="big">{big}</div><h1>{title}</h1></div>
<p>{sub}</p>
</body></html>"""


def render(name, big, title, sub, work):
    page = work / f"{name}.html"
    page.write_text(CARD.format(big=html.escape(big), title=html.escape(title), sub=html.escape(sub)), encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", f"--user-data-dir={work / 'p'}",
                    "--window-size=1200,630", "--virtual-time-budget=2000", f"--screenshot={OUT / (name + '.png')}", page.as_uri()],
                   check=True, capture_output=True)
    print(OUT / f"{name}.png")


if __name__ == "__main__":
    if not CHROME:
        raise SystemExit("Chrome not found; set CHROME")
    OUT.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp())
    try:
        render("home", "82%", "How compatible are we, really?", "24 questions that matter. Send the link, compare answers. Nothing stored.", work)
        render("questions", "24", "Compatibility questions to ask before you get serious", "Kids, money, conflict, family, time together.", work)
    finally:
        shutil.rmtree(work)
