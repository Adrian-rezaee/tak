/* ============================================================
   TAK® — 3D hero scene (Three.js r128)
   Floating branded laptop · holographic screens · red studio
   ============================================================ */
(function () {
  "use strict";
  var canvas = document.getElementById("hero-canvas");
  if (!canvas) { return; }

  /* ---------- WebGL capability ---------- */
  function glOK() {
    try {
      var t = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (t.getContext("webgl") || t.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  if (!window.THREE || !glOK()) { document.body.classList.add("no-webgl"); return; }

  var renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (e) { document.body.classList.add("no-webgl"); return; }

  var reducedMotion = false;
  try { reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  canvas.addEventListener("webglcontextlost", function () { document.body.classList.add("no-webgl"); });

  /* ---------- renderer / scene / camera ---------- */
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);
  scene.fog = new THREE.FogExp2(0x050508, 0.048);

  var camera = new THREE.PerspectiveCamera(42, 2, 0.1, 90);
  var CAM = { x: 0, y: 1.85, z: 7.6, look: new THREE.Vector3(0.2, 1.55, 0) };

  /* ---------- helpers ---------- */
  function makeCanvas(w, h) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    return cv;
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function spaced(ctx, text, x, y, sp) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], cx, y);
      cx += ctx.measureText(text[i]).width + sp;
    }
    return cx;
  }
  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }
  function easeInOutCubic(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function easeOutBack(p) { var c = 1.35; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function seg(it, a, b) { return clamp((it - a) / (b - a), 0, 1); }

  var FONT = '"Space Grotesk", Arial, sans-serif';
  var MONO = '"Space Grotesk", monospace';
  var RED = "#ff2338", RED2 = "#ff4655", DEEP = "#770F1A", TXT = "#eef0f6", DIM = "rgba(238,240,246,.34)";

  /* ---------- procedural studio environment (for reflections) ---------- */
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envScene = new THREE.Scene();
  (function () {
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x0a0a10, side: THREE.BackSide })));
    function panel(w, h, color, x, y, z, rx, ry) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: color }));
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
      envScene.add(m);
    }
    panel(10, 4, 0xffffff, 0, 9, 0, Math.PI / 2, 0);        // key softbox
    panel(6, 8, 0xff2338, -9, 3, 0, 0, Math.PI / 2);        // red strip left
    panel(5, 7, 0x53111c, 9, 2, -2, 0, -Math.PI / 2);       // deep red right
    panel(8, 3, 0x2c3a58, 0, 3, -9, 0, 0);                  // cool back fill
    panel(20, 20, 0x131318, 0, -6, 0, -Math.PI / 2, 0);     // floor bounce
  })();
  var envTex = pmrem.fromScene(envScene, 0.035).texture;
  scene.environment = envTex;

  /* ---------- material palettes ---------- */
  var matMetal = new THREE.MeshPhysicalMaterial({
    color: 0x17171d, metalness: 0.9, roughness: 0.34,
    clearcoat: 0.7, clearcoatRoughness: 0.28, envMapIntensity: 1.25
  });
  var matMetalDark = new THREE.MeshPhysicalMaterial({
    color: 0x0e0e13, metalness: 0.92, roughness: 0.42,
    clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 1.0
  });
  var matGlowRed = new THREE.MeshBasicMaterial({ color: 0xff2338, toneMapped: false });

  /* ---------- glow sprite texture ---------- */
  var glowTex = (function () {
    var cv = makeCanvas(256, 256), ctx = cv.getContext("2d");
    var g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,.55)");
    g.addColorStop(0.6, "rgba(255,255,255,.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  })();
  function makeGlow(color, opacity, sx, sy) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.material.toneMapped = false;
    s.scale.set(sx, sy || sx, 1);
    return s;
  }

  /* ============================================================
     TEXTURES — laptop screen (boot + mini TAK site)
     ============================================================ */
  var screenCv = makeCanvas(1024, 640);
  var screenCtx = screenCv.getContext("2d");
  var screenTex = new THREE.CanvasTexture(screenCv);
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.encoding = THREE.sRGBEncoding;

  function drawSite(ctx) {
    var W = 1024, H = 640;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#07070c"; ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 1;
    for (var gx = 0; gx <= W; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy <= H; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    // red ambient glow
    var rg = ctx.createRadialGradient(140, 560, 40, 140, 560, 460);
    rg.addColorStop(0, "rgba(255,35,56,.28)"); rg.addColorStop(1, "rgba(255,35,56,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    // nav
    ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fillRect(0, 0, W, 66);
    ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(0, 65, W, 2);
    ctx.fillStyle = RED2; ctx.fillRect(48, 26, 14, 14);
    ctx.shadowColor = RED; ctx.shadowBlur = 14; ctx.fillRect(48, 26, 14, 14); ctx.shadowBlur = 0;
    ctx.fillStyle = TXT; ctx.font = "700 30px " + FONT;
    spaced(ctx, "TAK", 76, 50, 4);
    ctx.fillStyle = RED2; ctx.font = "700 20px " + FONT; ctx.fillText("®", 128, 36);
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = i === 0 ? "rgba(255,70,85,.85)" : "rgba(255,255,255,.16)";
      rr(ctx, 700 + i * 74, 26, 58, 14, 7); ctx.fill();
    }
    // eyebrow
    ctx.fillStyle = RED2; ctx.font = "500 15px " + MONO;
    spaced(ctx, "DIGITAL EXPERIENCE STUDIO", 70, 138, 6);
    // headline
    ctx.fillStyle = TXT; ctx.font = "700 96px " + FONT;
    ctx.fillText("DIGITAL", 62, 240);
    var hg = ctx.createLinearGradient(60, 0, 900, 0);
    hg.addColorStop(0, "#ff8a94"); hg.addColorStop(0.45, RED2); hg.addColorStop(1, "#8f1223");
    ctx.fillStyle = hg; ctx.fillText("EXPERIENCES", 62, 336);
    ctx.strokeStyle = "rgba(238,240,246,.5)"; ctx.lineWidth = 1.6;
    ctx.font = "700 52px " + FONT;
    ctx.strokeText("BEYOND REALITY", 66, 408);
    // paragraph bars
    ctx.fillStyle = DIM;
    rr(ctx, 70, 448, 430, 12, 6); ctx.fill();
    rr(ctx, 70, 474, 340, 12, 6); ctx.fill();
    // buttons
    var bg = ctx.createLinearGradient(90, 0, 300, 0);
    bg.addColorStop(0, "#a3122a"); bg.addColorStop(1, DEEP);
    ctx.fillStyle = bg; rr(ctx, 70, 512, 220, 52, 26); ctx.fill();
    ctx.strokeStyle = "rgba(255,70,85,.6)"; rr(ctx, 70, 512, 220, 52, 26); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "500 17px " + FONT;
    spaced(ctx, "START A PROJECT", 102, 545, 3);
    ctx.strokeStyle = "rgba(255,255,255,.22)"; rr(ctx, 310, 512, 170, 52, 26); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.75)"; spaced(ctx, "OUR WORK", 350, 545, 3);
    // stat chips bottom-right
    var chips = [["120+", "PROJECTS"], ["14", "AWARDS"], ["98%", "RETENTION"]];
    for (var c = 0; c < 3; c++) {
      var x = 560 + c * 150, y = 508;
      ctx.fillStyle = "rgba(255,255,255,.045)"; rr(ctx, x, y, 132, 84, 14); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.1)"; rr(ctx, x, y, 132, 84, 14); ctx.stroke();
      ctx.fillStyle = c === 1 ? RED2 : TXT; ctx.font = "700 30px " + FONT;
      ctx.fillText(chips[c][0], x + 16, y + 40);
      ctx.fillStyle = "rgba(238,240,246,.4)"; ctx.font = "500 11px " + MONO;
      spaced(ctx, chips[c][1], x + 16, y + 64, 3);
    }
    // red scan line accent
    var sg = ctx.createLinearGradient(0, 0, W, 0);
    sg.addColorStop(0, "rgba(255,35,56,0)"); sg.addColorStop(0.5, "rgba(255,35,56,.8)"); sg.addColorStop(1, "rgba(255,35,56,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, 636, W, 4);
  }

  function drawBoot(ctx, it) {
    var W = 1024, H = 640;
    // base site
    drawSite(ctx);
    // boot overlay
    var boot = seg(it, 0, 2.15);
    var fade = seg(it, 1.55, 2.15);           // 0 -> 1 overlay fades out
    var alpha = 1 - fade;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#040406"; ctx.fillRect(0, 0, W, H);
    // logo
    var la = easeOutCubic(seg(it, 0.15, 0.8));
    ctx.globalAlpha = alpha * la;
    ctx.textAlign = "center";
    ctx.fillStyle = TXT; ctx.font = "700 120px " + FONT;
    ctx.shadowColor = RED; ctx.shadowBlur = 40 * la;
    ctx.fillText("TAK", W / 2, H / 2 - 26);
    ctx.fillStyle = RED2; ctx.font = "700 44px " + FONT;
    ctx.fillText("®", W / 2 + 150, H / 2 - 86);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    // progress bar
    var p = easeInOutCubic(seg(it, 0.35, 1.75));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(255,255,255,.09)"; rr(ctx, W / 2 - 170, H / 2 + 42, 340, 5, 3); ctx.fill();
    var pg = ctx.createLinearGradient(W / 2 - 170, 0, W / 2 + 170, 0);
    pg.addColorStop(0, DEEP); pg.addColorStop(1, RED2);
    ctx.fillStyle = pg; ctx.shadowColor = RED; ctx.shadowBlur = 12;
    rr(ctx, W / 2 - 170, H / 2 + 42, Math.max(6, 340 * p), 5, 3); ctx.fill();
    ctx.shadowBlur = 0;
    // status text
    ctx.fillStyle = "rgba(238,240,246,.45)"; ctx.font = "500 14px " + MONO;
    ctx.textAlign = "center";
    var msgs = ["BOOTING TAK.OS", "LOADING 3D ENGINE", "CALIBRATING LIGHTS", "READY"];
    ctx.fillText(msgs[Math.min(3, Math.floor(p * 3.999))], W / 2, H / 2 + 92);
    ctx.textAlign = "left";
    ctx.restore();
  }
  drawBoot(screenCtx, 0);
  screenTex.needsUpdate = true;

  /* ---------- keyboard / deck texture ---------- */
  var keyCv = makeCanvas(1024, 660);
  (function (ctx) {
    ctx.fillStyle = "#0c0c11"; ctx.fillRect(0, 0, 1024, 660);
    // speaker grills
    ctx.fillStyle = "rgba(255,255,255,.05)";
    for (var s = 0; s < 5; s++) for (var d = 0; d < 22; d++) {
      ctx.fillRect(34 + s * 9, 150 + d * 13, 3, 7);
      ctx.fillRect(940 + s * 9, 150 + d * 13, 3, 7);
    }
    // keys
    var rows = 5, cols = 15, kx0 = 120, ky0 = 48, kw = 50, kh = 42, gap = 5;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = kx0 + c * (kw + gap), y = ky0 + r * (kh + gap);
        var isRed = (r === 1 && (c === 2 || c === 3)); // little accent keys
        ctx.fillStyle = isRed ? "rgba(255,35,56,.5)" : "#14141b";
        rr(ctx, x, y, kw, kh, 6); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.06)"; rr(ctx, x, y, kw, kh, 6); ctx.stroke();
      }
    }
    // spacebar row
    ctx.fillStyle = "#14141b"; rr(ctx, 300, ky0 + 5 * (kh + gap), 424, kh, 8); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.06)"; rr(ctx, 300, ky0 + 5 * (kh + gap), 424, kh, 8); ctx.stroke();
    // trackpad
    ctx.fillStyle = "#101017";
    rr(ctx, 342, 470, 340, 170, 14); ctx.fill();
    ctx.strokeStyle = "rgba(255,35,56,.35)"; rr(ctx, 342, 470, 340, 170, 14); ctx.stroke();
    // brand mark
    ctx.fillStyle = "rgba(255,70,85,.9)"; ctx.font = "700 22px " + FONT;
    ctx.textAlign = "center";
    spacedCenter(ctx, "TAK", 512, 448, 8);
    ctx.textAlign = "left";
    function spacedCenter(c2, txt, cx, y, sp) {
      var total = 0, i;
      for (i = 0; i < txt.length; i++) total += c2.measureText(txt[i]).width + sp;
      var x = cx - (total - sp) / 2;
      for (i = 0; i < txt.length; i++) { c2.fillText(txt[i], x, y); x += c2.measureText(txt[i]).width + sp; }
    }
  })(keyCv.getContext("2d"));
  var keyTex = new THREE.CanvasTexture(keyCv);
  keyTex.minFilter = THREE.LinearFilter;
  keyTex.encoding = THREE.sRGBEncoding;

  /* ---------- front brand strip texture ---------- */
  var stripCv = makeCanvas(512, 96);
  (function (ctx) {
    ctx.clearRect(0, 0, 512, 96);
    ctx.fillStyle = "#ff4655";
    ctx.shadowColor = "#ff2338"; ctx.shadowBlur = 22;
    ctx.font = "700 56px " + FONT;
    ctx.textAlign = "center";
    ctx.fillText("TAK", 256, 66);
    ctx.font = "700 26px " + FONT;
    ctx.fillText("®", 342, 34);
  })(stripCv.getContext("2d"));
  var stripTex = new THREE.CanvasTexture(stripCv);
  stripTex.minFilter = THREE.LinearFilter;
  stripTex.encoding = THREE.sRGBEncoding;

  /* ============================================================
     LAPTOP
     ============================================================ */
  var rig = new THREE.Group();
  scene.add(rig);

  var laptop = new THREE.Group();
  laptop.position.y = 1.02;
  rig.add(laptop);

  // deck
  var deck = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.13, 2.2), matMetal);
  laptop.add(deck);
  var deckTop = new THREE.Mesh(
    new THREE.PlaneGeometry(3.14, 2.04),
    new THREE.MeshBasicMaterial({ map: keyTex, toneMapped: false })
  );
  deckTop.rotation.x = -Math.PI / 2;
  deckTop.position.y = 0.0665;
  laptop.add(deckTop);
  // front brand strip
  var strip = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.2),
    new THREE.MeshBasicMaterial({ map: stripTex, transparent: true, toneMapped: false })
  );
  strip.position.set(0, 0.06, 1.102);
  laptop.add(strip);
  // front light bar
  var lightbar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.016, 0.012), matGlowRed);
  lightbar.position.set(0, -0.01, 1.101);
  laptop.add(lightbar);

  // hinge
  var hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.0, 20), matMetalDark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.1, -1.03);
  laptop.add(hinge);

  // lid
  var lid = new THREE.Group();
  lid.position.set(0, 0.1, -1.03);
  laptop.add(lid);
  var lidClosed = 1.42, lidOpen = 0.30;
  lid.rotation.x = lidClosed;

  var lidBody = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.1, 0.08), matMetal);
  lidBody.position.y = 1.03;
  lid.add(lidBody);

  var screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  var screen = new THREE.Mesh(new THREE.PlaneGeometry(3.02, 1.85), screenMat);
  screen.position.set(0, 1.03, 0.043);
  lid.add(screen);

  // under-laptop glow
  var underGlow = makeGlow(0xff2338, 0.55, 4.6, 2.6);
  underGlow.position.set(0, 0.35, 0);
  laptop.add(underGlow);

  /* ============================================================
     HOLOGRAPHIC PANELS
     ============================================================ */
  var panels = [];
  function panelTexture(cv, drawFn) {
    var ctx = cv.getContext("2d");
    drawFn(ctx);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function drawBrowserUI(ctx) {
    var W = 512, H = 352;
    ctx.fillStyle = "rgba(10,10,16,.94)"; rr(ctx, 0, 0, W, H, 18); ctx.fill();
    // window chrome
    ctx.fillStyle = "rgba(255,255,255,.06)"; rr(ctx, 0, 0, W, 40, 18); ctx.fill();
    ctx.fillRect(0, 26, W, 14);
    ctx.fillStyle = RED2; ctx.beginPath(); ctx.arc(26, 20, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(46, 20, 5.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(66, 20, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.07)"; rr(ctx, 96, 9, 250, 22, 11); ctx.fill();
    ctx.fillStyle = "rgba(238,240,246,.5)"; ctx.font = "500 12px " + MONO;
    spaced(ctx, "tak.studio/work", 112, 25, 2);
    // hero block
    var hg = ctx.createLinearGradient(24, 60, 300, 230);
    hg.addColorStop(0, "#5c0d1a"); hg.addColorStop(1, "#16060b");
    ctx.fillStyle = hg; rr(ctx, 24, 58, 268, 176, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,70,85,.35)"; rr(ctx, 24, 58, 268, 176, 12); ctx.stroke();
    // play glyph
    ctx.fillStyle = RED2; ctx.shadowColor = RED; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.moveTo(146, 130); ctx.lineTo(146, 162); ctx.lineTo(174, 146); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(238,240,246,.65)"; ctx.font = "500 11px " + MONO;
    spaced(ctx, "CASE STUDY", 108, 196, 3);
    // side content
    ctx.fillStyle = TXT; ctx.font = "700 20px " + FONT; ctx.fillText("NEBULA", 312, 88);
    ctx.fillStyle = RED2; ctx.font = "500 10px " + MONO; spaced(ctx, "FINTECH / DASHBOARD", 312, 110, 2);
    ctx.fillStyle = DIM;
    rr(ctx, 312, 130, 168, 8, 4); ctx.fill();
    rr(ctx, 312, 148, 140, 8, 4); ctx.fill();
    rr(ctx, 312, 166, 154, 8, 4); ctx.fill();
    // mini chart
    ctx.strokeStyle = RED2; ctx.lineWidth = 2; ctx.beginPath();
    var pts = [312, 300, 336, 284, 360, 292, 384, 268, 408, 274, 432, 252, 456, 258, 480, 236];
    ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    // footer chips
    ctx.fillStyle = "rgba(255,70,85,.14)"; rr(ctx, 24, 250, 84, 26, 13); ctx.fill();
    ctx.strokeStyle = "rgba(255,70,85,.4)"; rr(ctx, 24, 250, 84, 26, 13); ctx.stroke();
    ctx.fillStyle = RED2; ctx.font = "500 10px " + MONO;
    spaced(ctx, "WEBGL", 44, 267, 2);
    ctx.fillStyle = "rgba(255,255,255,.06)"; rr(ctx, 118, 250, 96, 26, 13); ctx.fill();
    ctx.fillStyle = "rgba(238,240,246,.55)"; spaced(ctx, "3D CONFIG", 136, 267, 2);
    // border
    ctx.strokeStyle = "rgba(255,70,85,.55)"; ctx.lineWidth = 2;
    rr(ctx, 1, 1, W - 2, H - 2, 17); ctx.stroke();
  }

  function drawAnalyticsUI(ctx) {
    var W = 512, H = 352;
    ctx.fillStyle = "rgba(10,10,16,.94)"; rr(ctx, 0, 0, W, H, 18); ctx.fill();
    ctx.fillStyle = TXT; ctx.font = "700 19px " + FONT; ctx.fillText("ORBIT — ANALYTICS", 26, 40);
    ctx.fillStyle = "rgba(238,240,246,.4)"; ctx.font = "500 10px " + MONO;
    spaced(ctx, "LIVE / REAL-TIME", 26, 60, 3);
    ctx.fillStyle = RED2; ctx.beginPath(); ctx.arc(150, 56, 3.5, 0, 7); ctx.fill();
    // KPI chips
    var kpis = [["+240%", "CONVERSION"], ["1.2M", "SESSIONS"], ["0.8s", "LCP"]];
    for (var k = 0; k < 3; k++) {
      var x = 26 + k * 158;
      ctx.fillStyle = "rgba(255,255,255,.05)"; rr(ctx, x, 82, 146, 58, 12); ctx.fill();
      ctx.fillStyle = k === 0 ? RED2 : TXT; ctx.font = "700 24px " + FONT;
      ctx.fillText(kpis[k][0], x + 14, 116);
      ctx.fillStyle = "rgba(238,240,246,.4)"; ctx.font = "500 9px " + MONO;
      spaced(ctx, kpis[k][1], x + 14, 132, 2);
    }
    // area chart
    var x0 = 26, y0 = 168, cw = 460, ch = 120;
    ctx.fillStyle = "rgba(255,255,255,.03)"; rr(ctx, x0, y0, cw, ch, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    for (var g2 = 1; g2 < 4; g2++) {
      ctx.beginPath(); ctx.moveTo(x0 + 10, y0 + g2 * ch / 4); ctx.lineTo(x0 + cw - 10, y0 + g2 * ch / 4); ctx.stroke();
    }
    var line = [], i;
    for (i = 0; i <= 20; i++) {
      var v = Math.sin(i * 0.55) * 22 + Math.sin(i * 0.21) * 16 + 62 - i * 0.6;
      line.push([x0 + 12 + i * (cw - 24) / 20, y0 + ch - 14 - v * 0.62]);
    }
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (i = 1; i < line.length; i++) ctx.lineTo(line[i][0], line[i][1]);
    var lg = ctx.createLinearGradient(0, y0, 0, y0 + ch);
    lg.addColorStop(0, "rgba(255,35,56,.4)"); lg.addColorStop(1, "rgba(255,35,56,0)");
    ctx.save();
    ctx.lineTo(line[line.length - 1][0], y0 + ch - 8);
    ctx.lineTo(line[0][0], y0 + ch - 8);
    ctx.closePath();
    ctx.fillStyle = lg; ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    for (i = 1; i < line.length; i++) ctx.lineTo(line[i][0], line[i][1]);
    ctx.strokeStyle = RED2; ctx.lineWidth = 2.4; ctx.shadowColor = RED; ctx.shadowBlur = 10; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = RED2; ctx.beginPath();
    ctx.arc(line[line.length - 1][0], line[line.length - 1][1], 4.5, 0, 7); ctx.fill();
    // footer bars
    for (var b = 0; b < 12; b++) {
      var bh = 10 + Math.abs(Math.sin(b * 1.3)) * 26;
      ctx.fillStyle = b % 4 === 3 ? "rgba(255,70,85,.85)" : "rgba(255,255,255,.14)";
      rr(ctx, 30 + b * 38, 326 - bh, 24, bh, 4); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,70,85,.55)"; ctx.lineWidth = 2;
    rr(ctx, 1, 1, W - 2, H - 2, 17); ctx.stroke();
  }

  function drawMobileUI(ctx) {
    var W = 384, H = 640;
    ctx.fillStyle = "rgba(8,8,13,.9)"; rr(ctx, 0, 0, W, H, 30); ctx.fill();
    // status bar
    ctx.fillStyle = "rgba(238,240,246,.5)"; ctx.font = "500 13px " + MONO;
    ctx.fillText("21:47", 34, 40);
    ctx.fillRect(288, 30, 60, 10);
    ctx.fillStyle = RED2; ctx.fillRect(338, 30, 10, 10);
    // hero
    var hg = ctx.createRadialGradient(192, 190, 20, 192, 190, 180);
    hg.addColorStop(0, "rgba(255,35,56,.55)"); hg.addColorStop(1, "rgba(255,35,56,.02)");
    ctx.fillStyle = hg; rr(ctx, 24, 66, 336, 250, 20); ctx.fill();
    ctx.strokeStyle = "rgba(255,70,85,.4)"; rr(ctx, 24, 66, 336, 250, 20); ctx.stroke();
    // pulse rings
    ctx.strokeStyle = "rgba(255,70,85,.5)";
    ctx.beginPath(); ctx.arc(192, 186, 52, 0, 7); ctx.stroke();
    ctx.strokeStyle = "rgba(255,70,85,.25)";
    ctx.beginPath(); ctx.arc(192, 186, 74, 0, 7); ctx.stroke();
    ctx.fillStyle = RED2; ctx.beginPath(); ctx.arc(192, 186, 22, 0, 7); ctx.fill();
    ctx.fillStyle = TXT; ctx.font = "700 24px " + FONT; ctx.textAlign = "center";
    ctx.fillText("PULSE", 192, 286);
    ctx.fillStyle = "rgba(238,240,246,.45)"; ctx.font = "500 11px " + MONO;
    spacedCenter2(ctx, "NOW STREAMING", 192, 306, 3);
    ctx.textAlign = "left";
    // track list
    var tracks = [["NEON DRIVE", "03:42", true], ["MIDNIGHT PROTOCOL", "04:15", false], ["RED SHIFT", "02:58", false], ["ORBITAL", "05:21", false]];
    for (var t = 0; t < 4; t++) {
      var y = 344 + t * 70;
      ctx.fillStyle = t === 0 ? "rgba(255,35,56,.12)" : "rgba(255,255,255,.045)";
      rr(ctx, 24, y, 336, 58, 14); ctx.fill();
      if (t === 0) { ctx.strokeStyle = "rgba(255,70,85,.45)"; rr(ctx, 24, y, 336, 58, 14); ctx.stroke(); }
      ctx.fillStyle = t === 0 ? RED2 : "rgba(255,255,255,.14)";
      rr(ctx, 40, y + 12, 34, 34, 8); ctx.fill();
      // eq bars
      if (t === 0) {
        ctx.fillStyle = RED2;
        for (var e = 0; e < 3; e++) { rr(ctx, 46 + e * 9, y + 34 - (8 + e * 5), 5, 8 + e * 5, 2); ctx.fill(); }
      } else {
        ctx.fillStyle = "rgba(238,240,246,.35)";
        ctx.beginPath(); ctx.moveTo(50, y + 22); ctx.lineTo(50, y + 36); ctx.lineTo(62, y + 29); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = t === 0 ? TXT : "rgba(238,240,246,.7)"; ctx.font = "500 15px " + FONT;
      ctx.fillText(tracks[t][0], 92, y + 27);
      ctx.fillStyle = "rgba(238,240,246,.35)"; ctx.font = "500 11px " + MONO;
      ctx.fillText(tracks[t][1], 316, y + 27);
    }
    ctx.strokeStyle = "rgba(255,70,85,.55)"; ctx.lineWidth = 2;
    rr(ctx, 1, 1, W - 2, H - 2, 29); ctx.stroke();
    function spacedCenter2(c2, txt, cx, y, sp) {
      var total = 0, i2;
      for (i2 = 0; i2 < txt.length; i2++) total += c2.measureText(txt[i2]).width + sp;
      var x2 = cx - (total - sp) / 2;
      for (i2 = 0; i2 < txt.length; i2++) { c2.fillText(txt[i2], x2, y); x2 += c2.measureText(txt[i2]).width + sp; }
    }
  }

  function drawCodeUI(ctx) {
    var W = 512, H = 352;
    ctx.fillStyle = "rgba(10,10,16,.94)"; rr(ctx, 0, 0, W, H, 18); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.05)"; rr(ctx, 0, 0, W, 36, 18); ctx.fill();
    ctx.fillRect(0, 24, W, 12);
    ctx.fillStyle = RED2; ctx.beginPath(); ctx.arc(24, 18, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(42, 18, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(60, 18, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(238,240,246,.45)"; ctx.font = "500 11px " + MONO;
    spaced(ctx, "tak-engine/src/scene.ts", 90, 23, 1);
    // code lines
    var lines = [
      ["kw", "const", "id", " studio", "pn", " =", "fn", " createStudio", "pn", "()"],
      ["in", "  lighting:", "str", " 'cinematic'"],
      ["in2", "  materials:", "str", " 'black-glass'"],
      ["in2", "  neon:", "num", " '#770F1A'"],
      ["in", "  return", "fn", " render", "pn", "( scene )"],
      ["pn", "}"]
    ];
    var colors = { kw: "#ff4655", id: "#eef0f6", str: "#c98a94", num: "#ff8a94", fn: "#ffb3ba", in: "#6d6d7c", in2: "#6d6d7c", pn: "#8a8a99" };
    var y = 66;
    for (var l = 0; l < lines.length; l++) {
      var x = 24, segs = lines[l];
      for (var s2 = 0; s2 < segs.length; s2 += 2) {
        var col = colors[segs[s2]] || "#fff", txt = segs[s2 + 1];
        ctx.fillStyle = col; ctx.font = "500 14px " + MONO;
        ctx.fillText(txt, x, y);
        x += ctx.measureText(txt).width + 2;
      }
      y += 27;
    }
    // terminal
    ctx.fillStyle = "rgba(255,35,56,.06)"; rr(ctx, 24, 236, 464, 92, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,70,85,.3)"; rr(ctx, 24, 236, 464, 92, 12); ctx.stroke();
    ctx.fillStyle = RED2; ctx.font = "500 12px " + MONO;
    ctx.fillText("> build --production", 40, 262);
    ctx.fillStyle = "rgba(238,240,246,.6)";
    ctx.fillText("✓ shaders compiled  128/128", 40, 284);
    ctx.fillText("✓ 60 fps · 2.1s load", 40, 306);
    ctx.strokeStyle = "rgba(255,70,85,.55)"; ctx.lineWidth = 2;
    rr(ctx, 1, 1, W - 2, H - 2, 17); ctx.stroke();
  }

  function addPanel(opts) {
    var group = new THREE.Group();
    var cv = makeCanvas(opts.cw, opts.ch);
    var tex = panelTexture(cv, opts.draw);
    var front = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.w, opts.h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false })
    );
    var backing = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.w + 0.06, opts.h + 0.06),
      new THREE.MeshPhysicalMaterial({
        color: 0x0c0c14, metalness: 0.9, roughness: 0.12, transparent: true, opacity: 0, side: THREE.DoubleSide
      })
    );
    backing.position.z = -0.014;
    var glow = makeGlow(0xff2338, 0.0, opts.w * 1.5, opts.h * 1.1);
    glow.position.z = -0.1;
    group.add(backing, front, glow);
    group.position.set(opts.x, opts.y, opts.z);
    group.rotation.set(opts.rx || 0, opts.ry || 0, 0);
    group.scale.setScalar(0.55);
    rig.add(group);
    panels.push({
      group: group, front: front, backing: backing, glow: glow,
      baseY: opts.y, phase: opts.phase || Math.random() * 6,
      baseRX: opts.rx || 0, baseRY: opts.ry || 0, delay: opts.delay || 0
    });
  }

  addPanel({ w: 2.05, h: 1.41, cw: 512, ch: 352, draw: drawBrowserUI,   x: -3.5, y: 2.35, z: 0.55, ry: 0.62,  rx: -0.05, delay: 0.0 });
  addPanel({ w: 1.9,  h: 1.31, cw: 512, ch: 352, draw: drawAnalyticsUI, x: 3.55, y: 2.6,  z: -0.3, ry: -0.62, rx: -0.03, delay: 0.16 });
  addPanel({ w: 1.24, h: 2.07, cw: 384, ch: 640, draw: drawMobileUI,    x: 2.5,  y: 1.15, z: 2.0,  ry: -0.42, rx: 0.02,  delay: 0.32 });
  addPanel({ w: 1.66, h: 1.14, cw: 512, ch: 352, draw: drawCodeUI,      x: -2.7, y: 0.75, z: 1.85, ry: 0.48,  rx: 0.05,  delay: 0.48 });

  /* ============================================================
     STUDIO ENVIRONMENT
     ============================================================ */
  var platform = new THREE.Group();
  scene.add(platform);
  var platMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.6, 0.16, 72), matMetalDark);
  platMesh.position.y = 0.08;
  platform.add(platMesh);
  var ring = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.014, 10, 140), matGlowRed.clone());
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.165;
  platform.add(ring);
  var platGlow = makeGlow(0x770F1A, 0.5, 9.5, 5);
  platGlow.position.y = 0.28;
  platform.add(platGlow);

  // floor
  var floor = new THREE.Mesh(
    new THREE.CircleGeometry(22, 72),
    new THREE.MeshStandardMaterial({ color: 0x08080c, metalness: 0.88, roughness: 0.38, envMapIntensity: 0.75 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  var grid = new THREE.GridHelper(30, 60, 0x5a1420, 0x14141c);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  scene.add(grid);

  // background halo + arcs
  var halo = makeGlow(0x770F1A, 0.55, 11, 7);
  halo.position.set(0, 2.4, -4.5);
  scene.add(halo);
  var arc1 = new THREE.Mesh(
    new THREE.TorusGeometry(4.1, 0.012, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xff2338, transparent: true, opacity: 0, toneMapped: false })
  );
  arc1.position.set(0, 2.1, -1.4);
  scene.add(arc1);
  var arc2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.35, 0.008, 8, 160, Math.PI * 1.25),
    new THREE.MeshBasicMaterial({ color: 0x8c1826, transparent: true, opacity: 0, toneMapped: false })
  );
  arc2.position.set(0, 2.1, -1.4);
  arc2.rotation.z = Math.PI * 0.4;
  scene.add(arc2);

  // floating debris shapes
  var shapes = [];
  var shapeGeos = [
    new THREE.OctahedronGeometry(0.15),
    new THREE.IcosahedronGeometry(0.11),
    new THREE.TetrahedronGeometry(0.14),
    new THREE.BoxGeometry(0.11, 0.11, 0.11)
  ];
  var shapePos = [[-4.6, 3.3, -1.5], [4.9, 1.1, 1.2], [-2.1, 3.8, -2.6], [4.2, 3.6, -2.2]];
  for (var si = 0; si < shapeGeos.length; si++) {
    var sh = new THREE.Mesh(shapeGeos[si], si === 1 ? matGlowRed.clone() : matMetal.clone());
    sh.position.set(shapePos[si][0], shapePos[si][1], shapePos[si][2]);
    sh.scale.setScalar(0.001);
    rig.add(sh);
    shapes.push({ mesh: sh, sp: 0.4 + si * 0.13, ph: si * 1.7, baseY: shapePos[si][1] });
  }

  // dust particles
  var PCOUNT = 420;
  var pGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(PCOUNT * 3);
  var pCol = new Float32Array(PCOUNT * 3);
  for (var pi = 0; pi < PCOUNT; pi++) {
    pPos[pi * 3] = (Math.random() - 0.5) * 20;
    pPos[pi * 3 + 1] = Math.random() * 6.5;
    pPos[pi * 3 + 2] = (Math.random() - 0.5) * 14 - 1;
    var red1 = Math.random() < 0.3;
    var cc = red1 ? [1, 0.22, 0.3] : [0.55, 0.6, 0.72];
    var dim2 = 0.35 + Math.random() * 0.65;
    pCol[pi * 3] = cc[0] * dim2; pCol[pi * 3 + 1] = cc[1] * dim2; pCol[pi * 3 + 2] = cc[2] * dim2;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  var softTex = (function () {
    var cv = makeCanvas(64, 64), ctx = cv.getContext("2d");
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.055, map: softTex, transparent: true, opacity: 0.5,
    vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  particles.material.toneMapped = false;
  scene.add(particles);

  // lights
  scene.add(new THREE.AmbientLight(0x20222c, 0.62));
  var key = new THREE.SpotLight(0xffffff, 1.05, 40, Math.PI / 5.2, 0.6);
  key.position.set(4.5, 9, 5.5);
  scene.add(key);
  var keyTarget = new THREE.Object3D();
  keyTarget.position.set(0, 1.4, 0);
  scene.add(keyTarget);
  key.target = keyTarget;
  var redL = new THREE.PointLight(0xff2338, 1.9, 17);
  redL.position.set(-5, 2.6, 0.5);
  scene.add(redL);
  var redR = new THREE.PointLight(0x8c1023, 1.35, 15);
  redR.position.set(6.5, 1.7, 2.5);
  scene.add(redR);
  var cool = new THREE.PointLight(0x33415e, 0.55, 22);
  cool.position.set(0, 4.5, -8);
  scene.add(cool);
  var screenLight = new THREE.PointLight(0xff4455, 0.75, 6);
  screenLight.position.set(0, 2.1, 1.5);
  scene.add(screenLight);
  var sprL = makeGlow(0xff2338, 0.4, 3.2); sprL.position.set(-5, 2.6, 0.5); scene.add(sprL);
  var sprR = makeGlow(0x770F1A, 0.45, 3.6); sprR.position.set(6.5, 1.7, 2.5); scene.add(sprR);

  /* ============================================================
     LAYOUT / RESIZE
     ============================================================ */
  var portrait = false;
  function onResize() {
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    portrait = w / h < 0.92;
    var dpr = Math.min(window.devicePixelRatio || 1, portrait ? 1.6 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = portrait ? 55 : 42;
    camera.updateProjectionMatrix();
    if (portrait) {
      rig.position.set(0, -0.62, 0);
      rig.scale.setScalar(0.82);
      platform.position.x = 0;
      CAM.look.set(0, 1.05, 0);
    } else {
      rig.position.set(1.75, 0, 0);
      rig.scale.setScalar(1);
      platform.position.x = 1.75;
      CAM.look.set(0.25, 1.5, 0);
    }
  }
  window.addEventListener("resize", onResize);
  onResize();

  /* ============================================================
     INTERACTION
     ============================================================ */
  var nx = 0, ny = 0;                     // pointer parallax
  var dragRX = 0, dragRY = 0;             // drag rotation targets
  var dragging = false, dragX0 = 0, dragY0 = 0, dragRX0 = 0, dragRY0 = 0;

  var heroEl = document.getElementById("home");
  heroEl.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    ny = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, { passive: true });

  canvas.addEventListener("pointerdown", function (e) {
    dragging = true; dragX0 = e.clientX; dragY0 = e.clientY;
    dragRX0 = dragRX; dragRY0 = dragRY;
    canvas.classList.add("grabbing");
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    dragRY = clamp(dragRY0 + (e.clientX - dragX0) * 0.0042, -0.65, 0.65);
    dragRX = clamp(dragRX0 + (e.clientY - dragY0) * 0.0022, -0.18, 0.24);
  });
  function endDrag() { dragging = false; canvas.classList.remove("grabbing"); }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  /* ============================================================
     INTRO + MAIN LOOP
     ============================================================ */
  var introAt = null;
  if (document.body.classList.contains("loaded")) introAt = performance.now();
  window.addEventListener("tak:intro", function () { if (introAt === null) introAt = performance.now(); });

  // redraw screen once webfont is ready
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      var it = introAt === null ? 3 : (performance.now() - introAt) / 1000;
      drawBoot(screenCtx, Math.max(it, 3.2));
      screenTex.needsUpdate = true;
    }).catch(function () {});
  }

  var clock = new THREE.Clock();
  var curRotX = 0, curRotY = 0;
  var heroH = 900;

  function tick() {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    var sy = window.scrollY || 0;
    if (sy > heroH * 1.7) return;                    // hero off-screen: skip render

    var t = clock.getElapsedTime();
    var it = introAt === null ? -1 : (performance.now() - introAt) / 1000;

    // --- intro states ---
    var lidP = it < 0 ? 0 : easeOutCubic(seg(it, 0.15, 2.05));
    lid.rotation.x = lidClosed + (lidOpen - lidClosed) * lidP;
    if (!reducedMotion) {
      laptop.position.y = 1.02 + Math.sin(t * 0.8) * 0.045 * lidP;
      laptop.rotation.z = Math.sin(t * 0.5) * 0.012 * lidP;
    }
    // screen boot animation
    if (it >= 0 && it < 3.3) {
      drawBoot(screenCtx, it);
      screenTex.needsUpdate = true;
    }
    // panels entrance
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      var pin = it < 0 ? 0 : seg(it, 0.95 + p.delay, 1.75 + p.delay);
      var sc = 0.55 + 0.45 * easeOutBack(pin);
      p.group.scale.setScalar(sc);
      p.front.material.opacity = 0.95 * easeOutCubic(pin);
      p.backing.material.opacity = 0.42 * easeOutCubic(pin);
      p.glow.material.opacity = 0.4 * pin;
      if (!reducedMotion) {
        p.group.position.y = p.baseY + Math.sin(t * 0.7 + p.phase) * 0.07 * pin;
        p.group.rotation.z = Math.sin(t * 0.42 + p.phase) * 0.02 * pin;
        p.group.rotation.x = p.baseRX + Math.sin(t * 0.55 + p.phase) * 0.018;
      }
    }
    // arcs + shapes entrance
    var ar = it < 0 ? 0 : easeOutCubic(seg(it, 1.3, 2.4));
    arc1.material.opacity = 0.32 * ar;
    arc2.material.opacity = 0.5 * ar;
    arc1.rotation.z += 0.0011;
    arc2.rotation.z -= 0.0007;
    for (var s3 = 0; s3 < shapes.length; s3++) {
      var sh2 = shapes[s3];
      var shin = it < 0 ? 0 : easeOutBack(seg(it, 1.1 + s3 * 0.14, 1.9 + s3 * 0.14));
      sh2.mesh.scale.setScalar(Math.max(0.001, shin));
      sh2.mesh.rotation.x += sh2.sp * 0.008;
      sh2.mesh.rotation.y += sh2.sp * 0.011;
      if (!reducedMotion) sh2.mesh.position.y = sh2.baseY + Math.sin(t * 0.6 + sh2.ph) * 0.14;
    }
    // dust
    if (!reducedMotion) {
      var pos = pGeo.attributes.position.array;
      for (var d2 = 0; d2 < PCOUNT; d2++) {
        pos[d2 * 3 + 1] += 0.0045;
        if (pos[d2 * 3 + 1] > 6.5) pos[d2 * 3 + 1] = 0;
      }
      pGeo.attributes.position.needsUpdate = true;
    }

    // --- rig rotation (drag + idle sway) ---
    if (!dragging) { dragRX *= 0.955; dragRY *= 0.955; }
    var sway = reducedMotion ? 0 : Math.sin(t * 0.16) * 0.045;
    curRotY += (dragRY + sway - curRotY) * 0.09;
    curRotX += (dragRX - curRotX) * 0.09;
    rig.rotation.y = curRotY;
    rig.rotation.x = curRotX * 0.5;

    // --- scroll drift ---
    var heroEl2 = document.getElementById("home");
    heroH = heroEl2 ? heroEl2.offsetHeight : 900;
    var sp = clamp(sy / Math.max(1, heroH), 0, 1);

    // --- camera ---
    var px = reducedMotion ? 0 : nx * 0.55;
    var py = reducedMotion ? 0 : ny * 0.3;
    var tx = CAM.x + px;
    var ty = CAM.y - py - sp * 1.1;
    var tz = CAM.z + sp * 1.6;
    camera.position.x += (tx - camera.position.x) * 0.05;
    camera.position.y += (ty - camera.position.y) * 0.05;
    camera.position.z += (tz - camera.position.z) * 0.05;
    camera.lookAt(CAM.look);

    // --- light flicker ---
    screenLight.intensity = 0.72 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 23.7) * 0.03;
    if (it >= 0 && it < 3.3) screenLight.intensity *= 0.4 + 0.6 * seg(it, 0.4, 2.1);

    renderer.render(scene, camera);
  }
  camera.position.set(CAM.x, CAM.y, CAM.z);
  camera.lookAt(CAM.look);
  if (reducedMotion) {
    // single static frame
    lid.rotation.x = lidOpen;
    setTimeout(function () {
      drawBoot(screenCtx, 4);
      screenTex.needsUpdate = true;
      renderer.render(scene, camera);
    }, 60);
  }
  tick();

  window.__tak3dReady = true;
})();
