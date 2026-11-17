// Snackio Solutions — chování stránky (navigace, scéna, filtry, kalkulačka, poptávka).
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scriptUrl = document.currentScript ? document.currentScript.src : document.baseURI;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  $('#year').textContent = new Date().getFullYear();

  // ---------- navigace ----------
  var header = $('#header'), nav = $('#nav'), menu = $('.menu-toggle');
  function closeMenu() {
    nav.classList.remove('is-open');
    requestTick();
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Otevřít navigaci');
  }
  menu.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    requestTick();
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-label', open ? 'Zavřít navigaci' : 'Otevřít navigaci');
  });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeMenu(); });

  // ---------- scéna: průběh podle scrollu ----------
  var stageEl = $('#top'), canvas = $('#stage-canvas');
  var beat1 = $('.beat-1'), beat2 = $('.beat-2');
  var steps = $('#steps'), stepItems = $$('.step', steps);
  var stageApi = null, ticking = false;

  function onScroll() {
    ticking = false;
    var vh = window.innerHeight;
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle('is-solid', y > 24 || nav.classList.contains('is-open'));

    var span = Math.max(1, stageEl.offsetHeight - vh);
    var p = clamp((y - stageEl.offsetTop) / span, 0, 1);
    var o1 = 1 - smooth(0.14, 0.4, p);
    var o2 = smooth(0.52, 0.78, p);
    var k = smooth(0.12, 0.82, p);
    stageEl.style.setProperty('--o1', o1.toFixed(3));
    stageEl.style.setProperty('--o2', o2.toFixed(3));
    stageEl.style.setProperty('--k', k.toFixed(3));
    beat1.classList.toggle('is-off', o1 < 0.02);
    beat2.classList.toggle('is-off', o2 < 0.02);
    if (stageApi) stageApi.setProgress(k);

    if (steps) {
      var r = steps.getBoundingClientRect();
      var sp = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3), 0, 1);
      steps.style.setProperty('--p', sp.toFixed(3));
      stepItems.forEach(function (li, i) { li.classList.toggle('is-on', sp > (i + 0.35) / stepItems.length); });
    }
  }
  function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  onScroll();

  // ---------- scéna: 3D automat ----------
  var hintText = $('#stage-hint-text');
  var vended = 0;
  canvas.addEventListener('snackio:ready', function () { stageEl.classList.add('is-live'); });
  canvas.addEventListener('snackio:lost', function () { stageEl.classList.remove('is-live'); });
  canvas.addEventListener('snackio:vend', function () {
    vended += 1;
    hintText.textContent = vended === 1
      ? 'Dobrou chuť. Takhle snadné to mají mít i vaši zákazníci.'
      : 'Vydáno ' + vended + '×. Klidně zkuste další.';
  });

  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function startStage() {
    if (!webglAvailable()) { noStage(); return; }
    var small = window.matchMedia('(max-width: 760px)').matches;
    var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    import(new URL('stage.min.js', scriptUrl).href).then(function (mod) {
      stageApi = mod.initStage(canvas, { reducedMotion: reducedMotion, lowPower: small || weak });
      if (!stageApi) { noStage(); return; }
      onScroll();
    }).catch(noStage);
  }
  function noStage() {
    stageEl.classList.add('no-3d');
    hintText.textContent = 'Posuňte stránku níž a vyberte typ místa.';
  }
  if ('requestIdleCallback' in window) requestIdleCallback(startStage, { timeout: 1200 }); else setTimeout(startStage, 200);

  // typ místa
  var caption = $('#venue-caption');
  $$('.venue').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.venue').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      caption.textContent = btn.dataset.caption;
      if (stageApi) stageApi.setVenue(btn.dataset.venue);
    });
  });

  // ---------- naklápění karet za ukazatelem ----------
  if (!reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (ev) {
        var r = card.getBoundingClientRect();
        var px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', ((px - 0.5) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 6).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  // ---------- katalog ----------
  $$('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('[data-filter]').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      $$('.product').forEach(function (card) {
        card.hidden = btn.dataset.filter !== 'all' && card.dataset.category !== btn.dataset.filter;
      });
    });
  });
  $$('.product-photo img').forEach(function (img) {
    var fail = function () { img.parentElement.classList.add('is-failed'); };
    img.addEventListener('error', fail);
    if (img.complete && !img.naturalWidth && img.currentSrc) fail();
  });

  // ---------- předvyplnění poptávky ----------
  var interest = $('#interest'), message = $('[name=message]');
  $$('[data-interest]').forEach(function (a) {
    a.addEventListener('click', function () { interest.value = a.dataset.interest; });
  });
  $$('[data-product]').forEach(function (a) {
    a.addEventListener('click', function () {
      interest.value = 'Chci koupit automat';
      message.value = 'Mám zájem o řešení: ' + a.dataset.product + '.\nLokalita: \n';
    });
  });

  // ---------- kalkulačka ----------
  var sales = $('#sales'), margin = $('#margin'), result = $('#result'), meter = $('#result-meter');
  var fmt = new Intl.NumberFormat('cs-CZ');
  var shown = 13500, target = 13500, raf = 0;
  function paintResult() {
    raf = 0;
    shown += (target - shown) * 0.22;
    if (Math.abs(target - shown) < 1) shown = target;
    result.textContent = fmt.format(Math.round(shown)) + ' Kč';
    if (shown !== target) raf = requestAnimationFrame(paintResult);
  }
  function calculate() {
    $('#sales-label').textContent = sales.value;
    $('#margin-label').textContent = margin.value + ' Kč';
    target = Number(sales.value) * Number(margin.value) * 30;
    meter.style.width = (target / (120 * 40 * 30) * 100).toFixed(1) + '%';
    if (reducedMotion) { shown = target; result.textContent = fmt.format(target) + ' Kč'; return; }
    if (!raf) raf = requestAnimationFrame(paintResult);
  }
  sales.addEventListener('input', calculate);
  margin.addEventListener('input', calculate);
  calculate();

  // ---------- poptávka ----------
  var dialog = $('#draft'), draft = $('#draft-text'), status = $('#copy-status');
  $('#inquiry').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var d = new FormData(ev.target);
    draft.value = 'Dobrý den, Snackio Solutions,\n\nmám zájem: ' + d.get('interest') + '\n\n' + d.get('message') + '\n\n' + d.get('name') + '\n' + d.get('email');
    status.textContent = '';
    dialog.showModal();
  });
  $('#close').addEventListener('click', function () { dialog.close(); });
  $('#copy').addEventListener('click', function () {
    var manual = function () {
      draft.focus(); draft.select();
      status.textContent = 'Označený text zkopírujte klávesami Ctrl+C.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(draft.value).then(function () { status.textContent = 'Zkopírováno.'; }, manual);
    } else { manual(); }
  });
})();
