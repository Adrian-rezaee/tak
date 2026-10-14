#!/usr/bin/env python3
"""Assemble the single-file TAK 3D website (all assets inlined as data URIs)."""
import base64
import pathlib
import sys

ROOT = pathlib.Path("/home/user")
B = ROOT / "tak-build"
SRC = B / "src"
OPT = B / "images" / "opt"
FONTS = B / "fonts"
OUT = ROOT / "TAK-3D-Website.html"

def read(p): return pathlib.Path(p).read_text(encoding="utf-8")
def b64(p, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())

def js_safe(code):
    # make inline-<script> safe
    return code.replace("</script>", "<\\/script>").replace("<!--", "<\\!--")

html = read(SRC / "index.template.html")
css = read(SRC / "style-base.css") + "\n" + read(SRC / "style-sections.css")
js_ui = js_safe(read(SRC / "app-ui.js"))
js_3d = js_safe(read(SRC / "app-3d.js"))
three = js_safe(read(B / "three.min.js"))

repl = {
    "__INLINE_CSS__": css,
    "__INLINE_THREE__": three,
    "__INLINE_JS_UI__": js_ui,
    "__INLINE_JS_3D__": js_3d,
    "__FONT_SG400__": b64(FONTS / "sg400.woff2", "font/woff2"),
    "__FONT_SG500__": b64(FONTS / "sg500.woff2", "font/woff2"),
    "__FONT_SG700__": b64(FONTS / "sg700.woff2", "font/woff2"),
    "__IMG_VANTA__": b64(OPT / "vanta.jpg", "image/jpeg"),
    "__IMG_NEBULA__": b64(OPT / "nebula.jpg", "image/jpeg"),
    "__IMG_AURA__": b64(OPT / "aura.jpg", "image/jpeg"),
    "__IMG_PULSE__": b64(OPT / "pulse.jpg", "image/jpeg"),
    "__IMG_ORBIT__": b64(OPT / "orbit.jpg", "image/jpeg"),
    "__IMG_HELIOS__": b64(OPT / "helios.jpg", "image/jpeg"),
    "__IMG_TEAM1__": b64(OPT / "team1.jpg", "image/jpeg"),
    "__IMG_TEAM2__": b64(OPT / "team2.jpg", "image/jpeg"),
    "__IMG_TEAM3__": b64(OPT / "team3.jpg", "image/jpeg"),
    "__IMG_TEAM4__": b64(OPT / "team4.jpg", "image/jpeg"),
    "__IMG_BLOG1__": b64(OPT / "blog1.jpg", "image/jpeg"),
    "__IMG_BLOG2__": b64(OPT / "blog2.jpg", "image/jpeg"),
    "__IMG_BLOG3__": b64(OPT / "blog3.jpg", "image/jpeg"),
    "__IMG_STUDIO__": b64(OPT / "studio.jpg", "image/jpeg"),
}
for k, v in repl.items():
    html = html.replace(k, v)

leftover = [k for k in repl if k in html]
if leftover:
    print("ERROR: unreplaced tokens:", leftover); sys.exit(1)

OUT.write_text(html, encoding="utf-8")
size = OUT.stat().st_size
print("Built %s — %.2f MB (%d bytes)" % (OUT, size / 1048576, size))
