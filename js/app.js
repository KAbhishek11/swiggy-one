/* ============================================================
   Router + shell fit. Three screens, one page, iOS-style push.
   ============================================================ */
(function () {
  'use strict';

  var ORDER = ['home', 'detail', 'pay'];
  var TABS = ['home', 'instamart'];   // siblings, not a hierarchy
  var LOOSE = ['cart'];               // reachable only by picking that idea
  var DUR = 280;
  var stack = ['home'];
  var busy = false;

  var screens = {};
  ORDER.concat(TABS, LOOSE).forEach(function (id) { screens[id] = document.getElementById(id); });

  /* ---------- fit the phone to whatever window it opens in ---------- */
  var device = document.getElementById('device');
  function fit() {
    var k;
    if (window.matchMedia('(max-width:430px)').matches) {
      // a phone: the 360 canvas is scaled to the width of the window, and
      // shell.css divides that back out of 100dvh to get the screen height
      k = window.innerWidth / 360;
    } else {
      // unscaled device box: 10 + 830 + 18 padding, + 13 for the home indicator
      k = Math.min(1, (window.innerHeight - 32) / 871, (window.innerWidth - 32) / 380);
    }
    device.style.setProperty('--fit', k.toFixed(4));
    window.__fit = k;
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
  // the URL bar sliding away changes the height without firing resize on iOS
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  fit();

  function scrollerOf(el) { return el.querySelector('[data-scroll]') || el; }

  // restart a screen's entrance animations. Removing and re-adding the
  // class needs a forced reflow between, or the browser coalesces it
  // into no change at all and nothing replays.
  function play(el) {
    el.classList.remove('is-live');
    void el.offsetWidth;
    el.classList.add('is-live');
  }

  /* ---------- transitions ---------- */
  function show(el) { el.hidden = false; }

  function animate(el, from, to, done) {
    el.classList.remove('anim');
    el.classList.add(from);
    // force a frame so the browser sees the start state
    void el.offsetWidth;
    el.classList.add('anim');
    el.classList.remove(from);
    if (to) el.classList.add(to);
    setTimeout(function () { el.classList.remove('anim'); if (done) done(); }, DUR);
  }

  function push(id, silent) {
    if (busy || !screens[id] || stack[stack.length - 1] === id) return;
    busy = true;
    var out = screens[stack[stack.length - 1]];
    var incoming = screens[id];

    incoming.classList.add('is-over');
    show(incoming);
    scrollerOf(incoming).scrollTop = 0;   // a push always opens a screen at its top
    if (incoming.id === 'detail') syncDock();
    if (incoming.id === 'pay' && window.__payReset) window.__payReset();
    play(incoming);
    void incoming.offsetWidth;

    animate(incoming, 'is-over', null);
    animate(out, null, 'is-under', function () {
      busy = false;
    });

    stack.push(id);
    if (!silent) history.pushState({ screen: id }, '', '#' + id);
  }

  function pop() {
    if (busy || stack.length < 2) return;
    busy = true;
    var out = screens[stack.pop()];
    var back = screens[stack[stack.length - 1]];

    play(back);
    animate(back, 'is-under', null);
    animate(out, null, 'is-over', function () {
      out.hidden = true;
      out.classList.remove('is-over');
      busy = false;
    });
  }

  /* ------------------------------------------------------------
     Tabs are a swap, not a push. No slide, no new history entry --
     switching surface inside the app is lateral, so the stack entry
     is replaced and Back still leaves the way you came in.
     ------------------------------------------------------------ */
  function swap(id) {
    var cur = stack[stack.length - 1];
    if (busy || !screens[id] || cur === id || TABS.indexOf(cur) < 0) return;
    var out = screens[cur], next = screens[id];
    next.hidden = false;
    next.classList.remove('is-over', 'is-under');
    out.hidden = true;
    out.classList.remove('is-over', 'is-under');
    stack[stack.length - 1] = id;
    history.replaceState({ screen: id }, '', '#' + id);
    play(next);
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-tab]');
    if (tab) { e.preventDefault(); swap(tab.getAttribute('data-tab')); return; }
    var go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); push(go.getAttribute('data-go')); return; }
    if (e.target.closest('[data-back]')) { e.preventDefault(); history.back(); }
  });

  addEventListener('popstate', function (e) {
    var want = (e.state && e.state.screen) || (location.hash || '#home').slice(1);
    if (want === stack[stack.length - 1]) return;
    // forward/back arrived from history — never write a new entry for it
    if (TABS.indexOf(want) > -1 && TABS.indexOf(stack[stack.length - 1]) > -1) { swap(want); return; }
    if (stack.indexOf(want) > -1) { pop(); } else { push(want, true); }
  });

  // arrow keys, for presenting without aiming at a 100px button
  addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') push(ORDER[ORDER.indexOf(stack[stack.length - 1]) + 1]);
    if (e.key === 'ArrowLeft') history.back();
  });

  // a reload always lands on home: Chrome restores the last hash, which
  // would otherwise leave the URL and the visible screen disagreeing.
  /* ------------------------------------------------------------
     The floating CTA on the details page.

     It sits 12px off the bottom, 336 wide, for the whole read. The
     in-flow button at the end of the page is 320 wide and sits a
     little higher off the bottom edge -- so the last stretch of
     scroll walks the floating one down and in until the two are
     congruent, and fades out the scrim behind it as the page's own
     white bar arrives. Nothing swaps: the dock IS the button, it
     just comes to rest in the right place.
     ------------------------------------------------------------ */
  var syncDock = (function () {
    var screen = document.getElementById('detail');
    var scroller = screen && screen.querySelector('[data-scroll]');
    var dock = screen && screen.querySelector('.d-dock');
    var rest = screen && screen.querySelector('.d-join--rest');
    if (!scroller || !dock || !rest) return function () {};

    var MERGE = 130;        // px of scroll the landing takes
    var REST_BOTTOM = 12;   // the floating position, from Figma 104:296
    var REST_INSET = 12;
    var geom = null, queued = false;

    function measure() {
      var max = scroller.scrollHeight - scroller.clientHeight;
      var top = rest.offsetTop, p = rest.offsetParent;
      while (p && p !== scroller) { top += p.offsetTop; p = p.offsetParent; }
      geom = {
        max: max,
        bottom: scroller.clientHeight - (top + rest.offsetHeight - max),
        inset: rest.offsetLeft
      };
    }

    function paint() {
      queued = false;
      if (!geom) measure();
      var p = geom.max > 0
        ? Math.min(1, Math.max(0, (scroller.scrollTop - (geom.max - MERGE)) / MERGE))
        : 1;
      var e = p * p * (3 - 2 * p);   // smoothstep, so it settles rather than arrives
      dock.style.setProperty('--bot', (REST_BOTTOM + (geom.bottom - REST_BOTTOM) * e).toFixed(2) + 'px');
      dock.style.setProperty('--ins', (REST_INSET + (geom.inset - REST_INSET) * e).toFixed(2) + 'px');
      dock.style.setProperty('--scrim', (1 - e).toFixed(3));
    }

    function onScroll() { if (!queued) { queued = true; requestAnimationFrame(paint); } }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { geom = null; onScroll(); });

    return function () { geom = null; paint(); };
  })();

  /* ------------------------------------------------------------
     Payment: the UPI picker, and slide-to-pay.
     ------------------------------------------------------------ */
  (function payment() {
    var pay = document.getElementById('pay');
    if (!pay) return;

    /* ---- UPI radio group; the bar echoes the choice ---- */
    var group = pay.querySelector('[role="radiogroup"]');
    var barTile = pay.querySelector('.p-method-l .p-tile');
    var barName = pay.querySelector('[data-method]');

    group.addEventListener('click', function (e) {
      var opt = e.target.closest('[role="radio"]');
      if (!opt) return;
      group.querySelectorAll('[role="radio"]').forEach(function (o) {
        o.setAttribute('aria-checked', String(o === opt));
      });
      barName.textContent = opt.getAttribute('data-upi');
      var tile = opt.querySelector('.p-tile');
      barTile.className = tile.className;
      barTile.style.cssText = tile.style.cssText;
      barTile.innerHTML = tile.innerHTML;
    });

    /* ---- slide to pay ----
       A real drag: the knob follows the finger, snaps back if let go
       early, and completes past two thirds. Click and Enter/Space do
       the same thing, so it can be driven from a trackpad on stage. */
    var slide = pay.querySelector('.p-slide');
    var knob = slide.querySelector('.p-knob');
    var label = slide.querySelector('.p-slide-label');
    var LABEL = label.innerHTML;
    var travel = 0, startX = 0, dragging = false, done = false;

    function measure() { travel = slide.clientWidth - 10 - knob.offsetWidth; }

    function set(x) {
      var c = Math.max(0, Math.min(travel, x));
      slide.style.setProperty('--x', c + 'px');
      slide.style.setProperty('--lab', (1 - c / travel * 1.4).toFixed(3));
    }

    function settle(complete) {
      slide.classList.add('is-snapping');
      if (complete) {
        done = true;
        set(travel);
        label.innerHTML = 'Paid&nbsp; <i>|</i> &nbsp;&#8377;1';
        slide.style.setProperty('--lab', '1');
        slide.setAttribute('aria-disabled', 'true');
      } else {
        set(0);
      }
      setTimeout(function () { slide.classList.remove('is-snapping'); }, 280);
    }

    function reset() {
      done = false;
      label.innerHTML = LABEL;
      slide.removeAttribute('aria-disabled');
      settle(false);
    }

    slide.addEventListener('pointerdown', function (e) {
      if (done) { reset(); return; }
      measure();
      dragging = true; startX = e.clientX;
      slide.setPointerCapture(e.pointerId);
      slide.classList.remove('is-snapping');
    });
    slide.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      set((e.clientX - startX) / (window.__fit || 1));
    });
    slide.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      var moved = (e.clientX - startX) / (window.__fit || 1);
      // a tap rather than a drag still completes it, for demoing
      settle(moved > travel * 0.66 || moved < 4);
    });
    slide.addEventListener('pointercancel', function () {
      if (dragging) { dragging = false; settle(false); }
    });
    slide.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); measure();
      done ? reset() : settle(true);
    });

    window.__payReset = function () { measure(); reset(); };
  })();

  /* ------------------------------------------------------------
     Jumping between the ideas is not navigation -- they are rival
     answers, not steps -- so this drops the stack and lands hard
     on one screen rather than pushing or popping toward it.
     ------------------------------------------------------------ */
  window.__reset = function (id) {
    if (!screens[id]) return;
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.remove('is-over', 'is-under', 'anim');
      screens[k].hidden = (k !== id);
    });
    stack = [id];
    busy = false;
    scrollerOf(screens[id]).scrollTop = 0;
    if (id === 'detail') syncDock();
    history.replaceState({ screen: id }, '', '#' + id);
    play(screens[id]);
  };

  history.replaceState({ screen: 'home' }, '', '#home');
  play(screens.home);
})();
