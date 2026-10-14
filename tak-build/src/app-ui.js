/* ============================================================
   TAK® — UI interactions
   ============================================================ */
(function () {
  "use strict";
  var doc = document;
  var reducedMotion = false;
  try { reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var coarse = false;
  try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (e) {}

  /* ---------------- preloader ---------------- */
  var preBar = doc.querySelector("#preloader .pre-bar i");
  var prePct = doc.querySelector("#preloader .pre-status");
  (function preload() {
    var p = 0, start = null, DUR = reducedMotion ? 200 : 1350;
    function tick(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / DUR);
      p = Math.round(100 * (1 - Math.pow(1 - t, 3)));
      if (preBar) preBar.style.width = p + "%";
      if (prePct) prePct.textContent = "INITIALIZING EXPERIENCE — " + p + "%";
      if (t < 1) { requestAnimationFrame(tick); }
      else {
        doc.body.classList.add("loaded");
        try { dispatchEvent(new CustomEvent("tak:intro", { detail: { at: performance.now() } })); }
        catch (e) { dispatchEvent(new CustomEvent("tak:intro")); }
      }
    }
    requestAnimationFrame(tick);
  })();

  /* ---------------- custom cursor ---------------- */
  if (!coarse && !reducedMotion) {
    var dot = doc.querySelector(".cursor-dot"), ring = doc.querySelector(".cursor-ring");
    if (dot && ring) {
      var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, shown = false;
      addEventListener("pointermove", function (e) {
        mx = e.clientX; my = e.clientY;
        if (!shown) { shown = true; doc.body.classList.add("cursor-on"); }
      }, { passive: true });
      (function loop() {
        rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
        dot.style.transform = "translate(" + (mx - 3) + "px," + (my - 3) + "px)";
        ring.style.transform = "translate(" + (rx - 17) + "px," + (ry - 17) + "px)";
        requestAnimationFrame(loop);
      })();
      doc.addEventListener("pointerover", function (e) {
        var t = e.target;
        if (t && t.closest && t.closest("a,button,[data-tilt],.work-card,input,select,textarea")) doc.body.classList.add("cursor-hover");
      });
      doc.addEventListener("pointerout", function (e) {
        var t = e.target;
        if (t && t.closest && t.closest("a,button,[data-tilt],.work-card,input,select,textarea")) doc.body.classList.remove("cursor-hover");
      });
    }
  }

  /* ---------------- smooth scroll helper ---------------- */
  function smoothTo(y) {
    if (reducedMotion) { try { scrollTo(0, y); } catch (e) {} return; }
    var start = window.scrollY || 0, dist = y - start, t0 = null;
    var dur = Math.min(1300, 420 + Math.abs(dist) * 0.28);
    if (Math.abs(dist) < 2) return;
    (function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      try { scrollTo(0, start + dist * e); } catch (err) {}
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  /* ---------------- nav ---------------- */
  var nav = doc.getElementById("nav");
  var toTop = doc.getElementById("to-top");
  var progressBar = doc.getElementById("scroll-progress");
  var heroContent = doc.querySelector(".hero-content");
  var hero = doc.getElementById("home");
  var ticking = false;

  function onScroll() {
    var sy = window.scrollY || 0;
    if (nav) nav.classList.toggle("scrolled", sy > 30);
    if (toTop) toTop.classList.toggle("show", sy > 700);
    if (progressBar) {
      var max = Math.max(1, (doc.documentElement.scrollHeight - innerHeight));
      progressBar.style.transform = "scaleX(" + Math.min(1, sy / max) + ")";
    }
    if (hero && heroContent && !reducedMotion) {
      var vh = hero.offsetHeight || innerHeight;
      var p = Math.min(1, Math.max(0, sy / (vh * 0.9)));
      heroContent.style.transform = "translateY(" + (sy * 0.24) + "px)";
      heroContent.style.opacity = String(1 - p);
    }
    ticking = false;
  }
  addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener("click", function () { smoothTo(0); });

  /* anchor links */
  doc.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute("href");
    if (!id || id === "#") return;
    var target = doc.querySelector(id);
    if (!target) return;
    e.preventDefault();
    doc.body.classList.remove("menu-open");
    var y = target.getBoundingClientRect().top + (window.scrollY || 0) - 70;
    smoothTo(Math.max(0, y));
  });

  /* mobile menu */
  var burger = doc.querySelector(".burger");
  if (burger) burger.addEventListener("click", function () { doc.body.classList.toggle("menu-open"); });

  /* section spy */
  var sections = [].slice.call(doc.querySelectorAll("main section[id]"));
  var navLinks = [].slice.call(doc.querySelectorAll(".nav-links a"));
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.getAttribute("id");
        navLinks.forEach(function (l) {
          l.classList.toggle("active", l.getAttribute("href") === "#" + id);
        });
      });
    }, { rootMargin: "-42% 0px -52% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- reveal on scroll ---------------- */
  var revealEls = [].slice.call(doc.querySelectorAll("[data-reveal]"));
  if ("IntersectionObserver" in window && !reducedMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- counters ---------------- */
  var counters = [].slice.call(doc.querySelectorAll("[data-count]"));
  function runCounter(el) {
    if (el.__done) return; el.__done = true;
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var t0 = null, dur = 1700;
    if (reducedMotion) { el.textContent = target + suffix; return; }
    (function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { runCounter(en.target); cio.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  } else counters.forEach(runCounter);

  /* ---------------- 3D tilt cards ---------------- */
  if (!coarse && !reducedMotion) {
    [].slice.call(doc.querySelectorAll("[data-tilt]")).forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--rx", (-py * 6).toFixed(2) + "deg");
        card.style.setProperty("--ry", (px * 8).toFixed(2) + "deg");
        card.style.setProperty("--mx", (px * 100 + 50).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100 + 50).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------------- process timeline activation ---------------- */
  var steps = [].slice.call(doc.querySelectorAll(".t-item"));
  if ("IntersectionObserver" in window && steps.length) {
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("active");
          var rail = doc.querySelector(".t-rail i");
          if (rail) {
            var railBox = doc.querySelector(".t-rail").getBoundingClientRect();
            var box = en.target.getBoundingClientRect();
            var p = (box.top - railBox.top + 14) / Math.max(1, railBox.height);
            rail.style.height = Math.min(100, Math.max(0, p * 100)) + "%";
          }
        }
      });
    }, { threshold: 0.35 });
    steps.forEach(function (s) { pio.observe(s); });
  } else {
    steps.forEach(function (s) { s.classList.add("active"); });
    var rail = doc.querySelector(".t-rail i"); if (rail) rail.style.height = "100%";
  }

  /* ---------------- testimonial slider ---------------- */
  (function () {
    var track = doc.querySelector(".tslides");
    if (!track) return;
    var slides = [].slice.call(track.children);
    var prev = doc.querySelector(".tnav.prev"), next = doc.querySelector(".tnav.next");
    var dotsWrap = doc.querySelector(".tdots");
    var idx = 0, timer = null;

    var dots = [];
    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var b = doc.createElement("button");
        b.setAttribute("aria-label", "Go to testimonial " + (i + 1));
        b.addEventListener("click", function () { go(i); restart(); });
        dotsWrap.appendChild(b); dots.push(b);
      });
    }
    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = "translateX(-" + idx * 100 + "%)";
      dots.forEach(function (d, j) { d.classList.toggle("on", j === idx); });
    }
    function restart() {
      if (timer) clearInterval(timer);
      if (!reducedMotion) timer = setInterval(function () { go(idx + 1); }, 6000);
    }
    if (prev) prev.addEventListener("click", function () { go(idx - 1); restart(); });
    if (next) next.addEventListener("click", function () { go(idx + 1); restart(); });
    var wrap = doc.querySelector(".tslider");
    if (wrap) {
      wrap.addEventListener("pointerenter", function () { if (timer) clearInterval(timer); });
      wrap.addEventListener("pointerleave", restart);
      var sx = null;
      wrap.addEventListener("pointerdown", function (e) { sx = e.clientX; });
      wrap.addEventListener("pointerup", function (e) {
        if (sx === null) return;
        var dx = e.clientX - sx;
        if (Math.abs(dx) > 44) { go(idx + (dx < 0 ? 1 : -1)); restart(); }
        sx = null;
      });
    }
    go(0); restart();
  })();

  /* ---------------- contact form ---------------- */
  (function () {
    var form = doc.getElementById("contact-form");
    if (!form) return;
    var success = doc.getElementById("form-success");
    var btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { try { form.reportValidity(); } catch (err) {} return; }
      if (btn) btn.classList.add("loading");
      setTimeout(function () {
        form.hidden = true;
        if (success) { success.hidden = false; success.classList.add("in"); }
      }, 950);
    });
  })();

  /* ---------------- footer year ---------------- */
  var yr = doc.getElementById("year");
  if (yr) yr.textContent = String(new Date().getFullYear());

  window.__takReady = true;
})();
