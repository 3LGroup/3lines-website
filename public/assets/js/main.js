/* Thales clone — interactions */
(function () {
  'use strict';

  var mega = document.querySelector('.mega');
  var burger = document.querySelector('.hdr__burger');
  var megaClose = document.querySelector('.mega__close');

  function lock(on) { document.body.style.overflow = on ? 'hidden' : ''; }

  /* ---------- mega menu ---------- */
  function setMega(open) {
    if (!mega || !burger) return;
    mega.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    lock(open);
    if (open) {
      var f = mega.querySelector('button, a');
      if (f) f.focus();
    } else burger.focus();
  }
  if (burger) burger.addEventListener('click', function () { setMega(!mega.classList.contains('is-open')); });
  if (megaClose) megaClose.addEventListener('click', function () { setMega(false); });
  if (mega) mega.addEventListener('click', function (e) { if (e.target.closest('.megapanel__links a, .megapanel__cta a')) setMega(false); });

  /* The clone's search overlay never ships (SearchLayer renders null), so the
     bindings that drove it — and its English-only alert() — are gone with it. */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (mega && mega.classList.contains('is-open')) setMega(false);
  });

  /* ---------- mega menu tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.megatab'));
  function activate(key, focus) {
    tabs.forEach(function (t) {
      var on = t.dataset.target === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    document.querySelectorAll('.megapanel').forEach(function (p) {
      p.classList.toggle('is-on', p.dataset.panel === key);
    });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activate(t.dataset.target); });
    t.addEventListener('mouseenter', function () { activate(t.dataset.target); });
    t.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(t), n = tabs.length, next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabs[(i + 1) % n];
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabs[(i - 1 + n) % n];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs[n - 1];
      if (next) { e.preventDefault(); activate(next.dataset.target, true); }
    });
  });
  if (tabs.length) activate(tabs[0].dataset.target);

  /* ---------- hero rotating words ---------- */
  /* The renderer emits every word with `is-on` on the first; the stylesheet
     shows only `.is-on`. Nothing ever cycled the class, so words 2..n were
     authored, stored, exported — and never once rendered. Static under
     prefers-reduced-motion, where the first word simply stays. */
  var rotators = document.querySelectorAll('.rotator');
  if (rotators.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Array.prototype.forEach.call(rotators, function (rot) {
      var words = rot.querySelectorAll('span');
      if (words.length < 2) return;
      var wi = 0;
      setInterval(function () {
        wi = (wi + 1) % words.length;
        Array.prototype.forEach.call(words, function (w, k) {
          w.classList.toggle('is-on', k === wi);
        });
      }, 2600);
    });
  }

  /* ---------- key figures count-up ---------- */
  /* Grouping follows the page language rather than a hardcoded en-GB, so the
     Arabic page is not the only place on the site with English digit grouping.
     Latin digits either way — the site renders Latin numerals in both trees. */
  var numLocale = (document.documentElement.lang || 'en') === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB';
  var figs = document.querySelectorAll('[data-count]');
  figs.forEach(function (el) {
    el.textContent = parseFloat(el.getAttribute('data-count')).toLocaleString(numLocale) +
      (el.getAttribute('data-suffix') || '');
  });
  if ('IntersectionObserver' in window && figs.length) {
    var fio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; fio.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1400, t0 = performance.now();
        (function step(t) {
          var p = Math.min((t - t0) / dur, 1);
          var v = target * (1 - Math.pow(1 - p, 3));
          el.textContent = Math.round(v).toLocaleString(numLocale) + suffix;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.5 });
    figs.forEach(function (f) { fio.observe(f); });
  }

  /* ---------- click-to-load map ----------
     The server renders only a placeholder and the coordinates. Nothing else on
     this site fetches third-party code — the fonts are self-hosted precisely so
     there are no external requests — so the Google embed is built here, on
     click, and never before. The button's own note says that is what it does. */
  Array.prototype.forEach.call(document.querySelectorAll('.mapembed'), function (box) {
    var btn = box.querySelector('.mapembed__load');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var lat = box.getAttribute('data-lat');
      var lng = box.getAttribute('data-lng');
      if (!lat || !lng) return;
      var zoom = box.getAttribute('data-zoom') || 16;
      // Locale so the map's own labels match the page it sits on.
      var lang = (document.documentElement.lang || 'en').slice(0, 2);
      var frame = document.createElement('iframe');
      frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng) +
                  '&z=' + encodeURIComponent(zoom) + '&hl=' + encodeURIComponent(lang) + '&output=embed';
      frame.title = box.getAttribute('data-title') || 'Map';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.setAttribute('allowfullscreen', '');
      box.classList.add('is-loaded');
      box.innerHTML = '';
      box.appendChild(frame);
    });
  });

  /* ---------- light logo detection ----------
     Seven partner marks are drawn white-on-transparent (Airbus, NPCO, OPTOKON,
     SAMI, SAMI AEC, SAMI Aerospace, TAM — three of them pure #fff), so they
     vanish against the light strip. The ingest already flags this, but only for
     .svg files and only by regex-matching `fill="white"`, which misses every
     PNG/WEBP and any SVG that carries its white in a style attribute instead.

     So sample the decoded pixels, the way the reference clone does
     (3lines-website/assets/enhance.js §16b tagMonoLogos), and reuse the
     data-invert hook the stylesheet already has rather than inventing a class.
     The transparency guard is the important part of that heuristic: a mark baked
     onto an opaque white CARD (armite-lubricants.jpg) must NOT be inverted or
     the whole card turns into a black block. */
  (function lightLogos() {
    var logos = document.querySelectorAll('.logos img:not([data-invert])');
    if (!logos.length) return;

    function sample(im, bitmap) {
      try {
        var w = 24, h = 24, c = document.createElement('canvas');
        c.width = w; c.height = h;
        var x = c.getContext('2d');
        if (!x) return;
        /* Stretched to fill, deliberately. Letterboxing leaves cleared canvas
           either side, and that empty space counts as transparency — which is
           enough to fool the guard below into inverting a logo baked onto an
           opaque white card. Distortion is irrelevant to a luminance statistic,
           and passing explicit dimensions also renders SVGs that carry no
           intrinsic size. */
        x.drawImage(bitmap, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h).data;
        var sumLum = 0, opaque = 0, coloured = 0, dark = 0, transparent = 0, total = 0;
        for (var i = 0; i < d.length; i += 4) {
          total++;
          if (d[i + 3] < 30) { transparent++; continue; }
          var r = d[i], g = d[i + 1], b = d[i + 2];
          var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          var px = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          sumLum += px;
          opaque++;
          if (mx && (mx - mn) / mx > 0.3) coloured++;
          if (px < 0.35) dark++;
        }
        if (!opaque) return;
        var lum = sumLum / opaque, colourFrac = coloured / opaque, transFrac = transparent / total,
            darkFrac = dark / opaque;
        /* Genuinely transparent background, bright overall, and either very
           bright or carrying almost no real colour — AND essentially free of
           dark pixels. That last clause is what separates a white-on-
           transparent mark from a colourful emblem that merely averages
           bright: an emblem always carries dark outlines and lettering, and a
           white logo carries none. Without it, the Land Forces, Border Guard
           and USASAC crests — bright, low-saturation, transparent-backed —
           sampled as "white" and inverted into black blobs. */
        if (transFrac > 0.1 && lum > 0.6 && darkFrac < 0.08 && (lum > 0.78 || colourFrac < 0.25)) {
          im.setAttribute('data-invert', '1');
        }
      } catch (e) { /* undecodable or tainted: leave it showing its real colour */ }
    }

    /* Decode through a detached Image rather than reading the element in the
       page. The strip is ~8000px wide and its cells are loading="lazy", so most
       of them have not decoded yet — sampling the live elements caught only
       half of them, and the rest would pop in mid-scroll. Same URL, so this
       costs one cache hit and is independent of when the cell scrolls up. */
    Array.prototype.forEach.call(logos, function (im) {
      var src = im.getAttribute('src');
      if (!src) return;
      var probe = new Image();
      probe.onload = function () { sample(im, probe); };
      probe.src = src;
    });
  })();

  /* ---------- slider ----------
     The markup and CSS for this shipped complete but were never driven: four
     .heroslide panes stacked in one grid area, all but the first left at
     opacity:0, and four dot buttons in a role="tablist" styled by
     .dot[aria-current="true"]. Nothing toggled either, so three of the four
     "Why 3Lines" messages were unreachable and the dots were inert.
     This only flips those two states; it adds no markup and no styles. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-slider]'), function (root) {
    var slides = root.querySelectorAll('.heroslide');
    if (slides.length < 2) return;
    /* Dots live inside the stage here, but the hero variant puts its .dots
       alongside it. Look inside first, then fall back to a .dots container in
       the parent — scoped to .dots so this never grabs the unrelated 4px
       .ncard__meta .dot separators elsewhere on the page. */
    var dots = root.querySelectorAll('.dots .dot');
    if (!dots.length && root.parentNode) dots = root.parentNode.querySelectorAll(':scope > .dots .dot');
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var i = 0, timer = null;

    function show(n) {
      i = (n + slides.length) % slides.length;
      Array.prototype.forEach.call(slides, function (s, k) { s.classList.toggle('is-on', k === i); });
      Array.prototype.forEach.call(dots, function (d, k) {
        d.setAttribute('aria-current', String(k === i));
        d.setAttribute('tabindex', k === i ? '0' : '-1');
      });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    /* Reduced motion still gets a working slider — it just never advances on
       its own, so the dots remain the way through all four messages. */
    function play() { if (calm) return; stop(); timer = setInterval(function () { show(i + 1); }, 6000); }

    Array.prototype.forEach.call(dots, function (d, k) {
      d.addEventListener('click', function () { show(k); play(); });
      d.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        show(i + (e.key === 'ArrowRight' ? 1 : -1));
        play();
        if (dots[i]) dots[i].focus();
      });
    });

    // Don't advance the copy out from under someone reading or tabbing it.
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', play);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', play);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });

    show(0);
    play();
  });

  /* ---------- reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 3, 2) * 80) + 'ms';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }
})();
