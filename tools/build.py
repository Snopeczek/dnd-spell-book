#!/usr/bin/env python3
"""
Składa DnD Spell Book w jeden samodzielny plik HTML i buduje paczkę ZIP dla Windows.

Użycie:
    python tools/build.py            # dist/DnD Spell Book.html + dist/DnD Spell Book.zip
    python tools/build.py --no-zip   # tylko plik HTML

Paczka zawiera folder „DnD Spell Book” z: plikiem HTML, icon.ico, „DnD Spell Book.bat”,
„Zainstaluj skroty.bat” i „Usun skroty.bat”. Plik HTML w paczce jest identyczny
z dist/DnD Spell Book.html (i z wersją online).
"""
import glob, json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")
APP = "DnD Spell Book"


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def block(html, name, content):
    pat = re.compile(r"<!-- build:%s -->.*?<!-- /build:%s -->" % (name, name), re.S)
    if not pat.search(html):
        sys.exit(f"Brak znacznika build:{name} w index.html")
    return pat.sub(lambda m: content, html)


def build_html():
    html = read(os.path.join(SRC, "index.html"))
    css = read(os.path.join(SRC, "styles.css"))
    data = {}
    for v in ("2014", "2024"):
        data[v] = json.loads(read(os.path.join(SRC, "data", f"srd-{v}.json")))
    data_js = "window.SRD=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";"
    js_files = sorted(glob.glob(os.path.join(SRC, "js", "*.js")))
    js = "\n".join(f"/* ==== {os.path.basename(p)} ==== */\n" + read(p) for p in js_files)
    if "</script" in js.lower():
        sys.exit("Kod JS zawiera '</script' — to zepsułoby osadzenie.")
    html = block(html, "styles", f"<style>\n{css}\n</style>")
    html = block(html, "data", f"<script>{data_js}</script>")
    html = block(html, "scripts", f"<script>\n{js}\n</script>")
    return html


def main():
    os.makedirs(DIST, exist_ok=True)
    html = build_html()
    out = os.path.join(DIST, f"{APP}.html")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print(f"HTML: {out} ({os.path.getsize(out) // 1024} KB)")
    if "--no-zip" in sys.argv:
        return
    icon = os.path.join(ROOT, "assets", "icon.ico")
    if not os.path.exists(icon):
        sys.exit("Brak assets/icon.ico")
    zpath = os.path.join(DIST, f"{APP}.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(out, f"{APP}/{APP}.html")
        z.write(icon, f"{APP}/icon.ico")
        for bat in sorted(glob.glob(os.path.join(ROOT, "tools", "launcher", "*.bat"))):
            text = read(bat).replace("\r\n", "\n").replace("\n", "\r\n")  # CRLF dla cmd.exe
            text.encode("ascii")  # pliki .bat muszą być czystym ASCII
            z.writestr(f"{APP}/{os.path.basename(bat)}", text.encode("ascii"))
    print(f"ZIP:  {zpath} ({os.path.getsize(zpath) // 1024} KB)")


if __name__ == "__main__":
    main()
