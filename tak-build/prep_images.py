#!/usr/bin/env python3
"""Prepare all site imagery: crop/resize AI renders + generate procedural art."""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageEnhance

RAW = Path("tak-build/images/raw")
OPT = Path("tak-build/images/opt")
OPT.mkdir(parents=True, exist_ok=True)
random.seed(42)

RED      = (255, 70, 85)
RED_NEON = (255, 35, 56)
RED_DEEP = (119, 15, 26)
WHITE    = (235, 238, 245)
COOL     = (150, 170, 210)

def crop_ratio(img, ratio, anchor="center"):
    """Center-crop to w/h ratio. anchor 'top' keeps upper area."""
    w, h = img.size
    cur = w / h
    if cur > ratio:                      # too wide -> crop width
        nw = int(h * ratio)
        x0 = (w - nw) // 2
        box = (x0, 0, x0 + nw, h)
    else:                                # too tall -> crop height
        nh = int(w / ratio)
        if anchor == "top":
            y0 = int((h - nh) * 0.18)
        else:
            y0 = (h - nh) // 2
        box = (0, y0, w, y0 + nh)
    return img.crop(box)

def process_ai(name, out, ratio, width, anchor="center", q=66):
    img = Image.open(RAW / f"{name}.png").convert("RGB")
    orig = img.size
    img = crop_ratio(img, ratio, anchor)
    height = int(width / ratio)
    img = img.resize((width, height), Image.LANCZOS)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    img = ImageEnhance.Color(img).enhance(1.08)
    path = OPT / f"{out}.jpg"
    img.save(path, "JPEG", quality=q, optimize=True, progressive=True)
    px = img.resize((1, 1)).getpixel((0, 0))
    print(f"{out:10s} {orig}->{(width,height)}  {path.stat().st_size//1024}KB  avg={sum(px)//3}")

# ---------------------------------------------------------------- procedural
def vignette(img, strength=0.55):
    w, h = img.size
    mask = Image.radial_gradient("L").resize((w, h))
    mask = mask.point(lambda p: int(min(255, max(0, (p - 90)) * strength * 2.2)))
    black = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(black, img, mask)

def add_noise(img, alpha=0.05):
    w, h = img.size
    noise = Image.effect_noise((w, h), 22).convert("RGB")
    return Image.blend(img, noise, alpha)

def glow_layer(size, draw_fn, blur):
    """Draw on black layer, blur, return for additive composite."""
    layer = Image.new("RGB", size, (0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    return layer.filter(ImageFilter.GaussianBlur(blur))

def base_bg(w, h, glow_center=(0.5, 0.35), glow_color=RED_DEEP, glow_scale=1.0):
    img = Image.new("RGB", (w, h), (5, 5, 8))
    d = ImageDraw.Draw(img)
    for y in range(h):                              # vertical gradient
        t = y / h
        c = (int(8 + 8 * t), int(7 + 7 * t), int(11 + 10 * t))
        d.line([(0, y), (w, y)], fill=c)
    # soft red radial glow
    gl = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(gl)
    cx, cy = int(w * glow_center[0]), int(h * glow_center[1])
    r = int(max(w, h) * 0.55 * glow_scale)
    for i in range(60, 0, -1):
        a = i / 60
        col = (int(glow_color[0] * a * 0.5), int(glow_color[1] * a * 0.5), int(glow_color[2] * a * 0.5))
        gd.ellipse([cx - r * a, cy - r * a * 0.7, cx + r * a, cy + r * a * 0.7], fill=col)
    gl = gl.filter(ImageFilter.GaussianBlur(60))
    return ImageChops.screen(img, gl)

def blog_waves(w, h):
    img = base_bg(w, h, (0.5, 0.45), (110, 12, 22), 0.9)
    waves = []
    for k in range(6):
        amp = h * (0.05 + 0.035 * random.random())
        freq = random.uniform(1.2, 2.6)
        phase = random.uniform(0, math.pi * 2)
        ybase = h * (0.30 + 0.09 * k + random.uniform(-0.03, 0.03))
        pts = []
        for x in range(0, w + 8, 8):
            y = ybase + amp * math.sin(x / w * math.pi * 2 * freq + phase + k)
            pts.append((x, y))
        waves.append(pts)
    def draw_waves(d, glow=False):
        for i, pts in enumerate(waves):
            t = i / max(1, len(waves) - 1)
            col = (int(255 * (1 - t * 0.55)), int(70 * (1 - t) + 15), int(85 * (1 - t) + 26))
            if glow:
                col = (col[0] // 3, col[1] // 3, col[2] // 3)
            wd = 7 if glow else 2
            d.line(pts, fill=col, width=wd, joint="curve")
    img = ImageChops.screen(img, glow_layer((w, h), draw_waves, 16))
    img = ImageChops.screen(img, glow_layer((w, h), draw_waves, 3))
    d = ImageDraw.Draw(img)                          # particles
    for _ in range(90):
        x, y = random.uniform(0, w), random.uniform(0, h * 0.9)
        r = random.uniform(0.8, 2.4)
        a = random.randint(90, 220)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(a, a // 3, a // 2 + 20))
    return vignette(img, 0.5)

def blog_holo(w, h):
    img = base_bg(w, h, (0.35, 0.4), (100, 14, 24), 0.8)
    def panels(d):
        boxes = [(0.08, 0.12, 0.55, 0.62), (0.48, 0.30, 0.92, 0.86), (0.22, 0.55, 0.72, 0.92)]
        for (x0, y0, x1, y1) in boxes:
            b = [x0 * w, y0 * h, x1 * w, y1 * h]
            d.rectangle(b, outline=(120, 20, 32), width=3)
            d.line([(b[0], b[1] + 18), (b[0] + 90, b[1] + 18)], fill=(200, 40, 55), width=3)
            for i in range(4):
                yy = b[1] + 44 + i * 26
                d.line([(b[0] + 14, yy), (b[0] + 14 + (b[2] - b[0] - 28) * (0.4 + 0.5 * random.random()), yy)],
                       fill=(90, 14, 22), width=2)
            for i in range(3):
                d.ellipse([b[2] - 34, b[1] + 16 + i * 22, b[2] - 22, b[1] + 28 + i * 22], outline=(160, 30, 44), width=2)
    img = ImageChops.screen(img, glow_layer((w, h), panels, 12))
    d = ImageDraw.Draw(img)
    panels(d)
    # crosshair + nodes
    cx, cy = int(w * 0.78), int(h * 0.26)
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=RED, width=2)
    d.line([(cx - 44, cy), (cx + 44, cy)], fill=(150, 40, 52), width=1)
    d.line([(cx, cy - 44), (cx, cy + 44)], fill=(150, 40, 52), width=1)
    for _ in range(28):
        x, y = random.uniform(0, w), random.uniform(0, h)
        d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(220, 120, 130))
    # scanlines
    for y in range(0, h, 3):
        d.line([(0, y), (w, y)], fill=(4, 4, 6))
    return vignette(img, 0.45)

def blog_speed(w, h):
    img = base_bg(w, h, (0.5, 0.5), (110, 10, 20), 1.0)
    cx, cy = int(w * 0.5), int(h * 0.56)
    R = int(h * 0.62)
    def gauge(d, glow):
        a0, a1 = 130, 410
        steps = 56
        for i in range(steps):
            t = i / (steps - 1)
            ang = a0 + (a1 - a0) * t
            bright = t > 0.62
            col = RED if bright else (110, 60, 70)
            if glow:
                col = (col[0] // 4, col[1] // 4, col[2] // 4)
            wd = 8 if glow else 3
            r0, r1 = R, R - int(h * (0.09 if i % 7 == 0 else 0.05))
            d.arc([cx - r1, cy - r1 * 0.98, cx + r1, cy + r1 * 0.98], ang, ang + (a1 - a0) / steps, fill=col, width=wd)
        # needle
        na = a0 + (a1 - a0) * 0.72
        nx = cx + math.cos(math.radians(na)) * (R * 0.78)
        ny = cy + math.sin(math.radians(na)) * (R * 0.78 * 0.98)
        d.line([(cx, cy), (nx, ny)], fill=RED if not glow else (70, 12, 18), width=10 if glow else 4)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=RED if not glow else (70, 12, 18))
    img = ImageChops.screen(img, glow_layer((w, h), lambda d: gauge(d, True), 14))
    d = ImageDraw.Draw(img)
    gauge(d, False)
    # speed streaks
    for _ in range(26):
        y = random.uniform(h * 0.08, h * 0.92)
        x = random.uniform(0, w * 0.8)
        ln = random.uniform(30, 160)
        d.line([(x, y), (x + ln, y)], fill=(150, 30, 42), width=1)
    # readout ticks
    for i in range(5):
        d.rectangle([w * 0.14 + i * 22, h * 0.86 - (14 + i * 7), w * 0.14 + i * 22 + 10, h * 0.86],
                    fill=RED_DEEP if i < 3 else RED)
    return vignette(img, 0.5)

def studio_scene(w, h):
    img = base_bg(w, h, (0.5, 0.34), (95, 10, 20), 1.15)
    d = ImageDraw.Draw(img)
    horizon = int(h * 0.66)
    vpx = w // 2
    # perspective floor grid
    def grid(dd, glow):
        col = (90, 16, 26) if glow else (52, 10, 18)
        wd = 4 if glow else 1
        for i in range(-14, 15):
            x_bottom = vpx + i * (w / 8.5)
            dd.line([(vpx + i * (w / 46), horizon), (x_bottom, h)], fill=col, width=wd)
        y = horizon
        step = 2
        while y < h:
            dd.line([(0, y), (w, y)], fill=col, width=wd)
            step *= 1.35
            y += step
    img = ImageChops.screen(img, glow_layer((w, h), lambda dd: grid(dd, True), 6))
    grid(d, False)
    # neon horizon strip
    img = ImageChops.screen(img, glow_layer((w, h), lambda dd: dd.line([(0, horizon), (w, horizon)], fill=(180, 26, 40), width=6), 22))
    # workstation glows (rows of screens)
    def screens(dd):
        for row, sy in enumerate((0.18, 0.34, 0.5)):
            n = 7 - row
            for i in range(n):
                x = w * (0.08 + 0.84 * i / max(1, n - 1)) + random.uniform(-14, 14)
                y = h * (sy + random.uniform(-0.01, 0.01))
                bw, bh = w * 0.052, h * 0.11
                warm = random.random() > 0.55
                col = (150, 40, 55) if warm else (120, 135, 170)
                dd.rectangle([x, y, x + bw, y + bh], fill=col)
    img = ImageChops.screen(img, glow_layer((w, h), screens, 10))
    # hanging red lights
    def lamps(dd):
        for i in range(4):
            x = w * (0.15 + 0.23 * i)
            dd.line([(x, 0), (x, h * 0.12)], fill=(140, 20, 32), width=3)
            dd.ellipse([x - 8, h * 0.12, x + 8, h * 0.15], fill=(220, 40, 58))
    img = ImageChops.screen(img, glow_layer((w, h), lamps, 8))
    return add_noise(vignette(img, 0.6), 0.04)

def gen_proc(name, fn, w, h, q=64):
    img = fn(w, h)
    path = OPT / f"{name}.jpg"
    img.save(path, "JPEG", quality=q, optimize=True, progressive=True)
    px = img.resize((1, 1)).getpixel((0, 0))
    print(f"{name:10s} {(w,h)}  {path.stat().st_size//1024}KB  avg={sum(px)//3}")

if __name__ == "__main__":
    # AI renders
    for n in ("vanta", "nebula", "aura", "pulse", "orbit", "helios"):
        process_ai(n, n, 16 / 10, 880)
    for i in range(1, 5):
        process_ai(f"team{i}", f"team{i}", 3 / 4, 620)
    # procedural art
    gen_proc("blog1", blog_waves,   760, 475)
    gen_proc("blog2", blog_holo,    760, 475)
    gen_proc("blog3", blog_speed,   760, 475)
    gen_proc("studio", studio_scene, 1600, 686, q=58)
    print("DONE")
