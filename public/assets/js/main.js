/* Thales clone — interactions */
(function () {
  'use strict';

  var mega = document.querySelector('.mega');
  var burger = document.querySelector('.hdr__burger');
  var megaClose = document.querySelector('.mega__close');
  var layer = document.querySelector('.searchlayer');
  var searchBtn = document.querySelector('.hdr__search');
  var layerClose = document.querySelector('.searchlayer .close');

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

  /* ---------- search overlay ---------- */
  function setSearch(open) {
    if (!layer || !searchBtn) return;
    layer.classList.toggle('is-open', open);
    searchBtn.setAttribute('aria-expanded', String(open));
    lock(open);
    if (open) { var i = layer.querySelector('input'); if (i) i.focus(); }
    else searchBtn.focus();
  }
  if (searchBtn) searchBtn.addEventListener('click', function () { setSearch(!layer.classList.contains('is-open')); });
  if (layerClose) layerClose.addEventListener('click', function () { setSearch(false); });
  if (layer) layer.querySelector('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = layer.querySelector('input').value.trim();
    if (v) alert('Search is not wired up in this front-end clone.\n\nQuery: ' + v);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (mega && mega.classList.contains('is-open')) setMega(false);
    if (layer && layer.classList.contains('is-open')) setSearch(false);
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

  /* ---------- key figures count-up ---------- */
  var figs = document.querySelectorAll('[data-count]');
  figs.forEach(function (el) {
    el.textContent = parseFloat(el.getAttribute('data-count')).toLocaleString('en-GB') +
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
          el.textContent = Math.round(v).toLocaleString('en-GB') + suffix;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.5 });
    figs.forEach(function (f) { fio.observe(f); });
  }

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
