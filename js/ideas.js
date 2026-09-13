/* ============================================================
   The idea switcher.

   Six designs answer the same question in different places, so
   the prototype has to be able to show any one of them on
   demand rather than committing to a single flow. Each entry
   names a base screen and, where the idea is an interruption
   rather than a screen, the overlay to raise over it.
   ============================================================ */
(function () {
  'use strict';

  var IDEAS = {
    'banner':     { screen: 'home',      ov: null },
    'home-modal': { screen: 'home',      ov: 'home-modal' },
    'im-modal':   { screen: 'instamart', ov: 'im-modal' },
    'auto-b':     { screen: 'home',      ov: 'auto-b' },
    'auto-c':     { screen: 'home',      ov: 'auto-c' },
    'cart':       { screen: 'cart',      ov: null }
  };
  var KEYS = ['banner', 'home-modal', 'im-modal', 'auto-b', 'auto-c', 'cart'];

  var panel = document.getElementById('ideas');
  var toggle = document.getElementById('ideas-toggle');
  var list = document.getElementById('ideas-list');
  var cart = document.getElementById('cart');
  if (!panel || !list) return;

  var overlays = {};
  [].forEach.call(document.querySelectorAll('.ov[data-idea]'), function (el) {
    overlays[el.getAttribute('data-idea')] = el;
  });
  var buttons = [].slice.call(list.querySelectorAll('[data-idea-go]'));

  function go(key) {
    var idea = IDEAS[key];
    if (!idea) return;

    for (var k in overlays) overlays[k].hidden = (k !== idea.ov);
    if (cart) cart.classList.remove('is-asking');
    if (window.__reset) window.__reset(idea.screen);

    buttons.forEach(function (b) {
      b.setAttribute('aria-current', String(b.getAttribute('data-idea-go') === key));
    });
  }

  /* Dismissing is part of the design, not a way out of it: the
     point of a modal is what it leaves behind, so closing one
     drops you on the screen it interrupted. The entry stays
     marked, so clicking it again brings the design back. */
  function dismiss() {
    for (var k in overlays) overlays[k].hidden = true;
    if (cart) cart.classList.remove('is-asking');
  }

  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-idea-go]');
    if (b) go(b.getAttribute('data-idea-go'));
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-idea-dismiss]') || e.target.classList.contains('ov-scrim')) {
      e.preventDefault();
      dismiss();
      return;
    }
    /* The tooltip is an answer, so it waits to be asked: taking the
       count on the one row down to zero is the question. */
    if (e.target.closest('[data-cart-remove]')) {
      e.preventDefault();
      cart.classList.add('is-asking');
    }
  });

  toggle.addEventListener('click', function () {
    var shut = panel.classList.toggle('is-shut');
    toggle.setAttribute('aria-expanded', String(!shut));
  });

  // 1-6 jump straight to an idea, for presenting without aiming
  addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (+e.key >= 1 && +e.key <= KEYS.length) { e.preventDefault(); go(KEYS[+e.key - 1]); }
    if (e.key === 'Escape') dismiss();
  });

  /* on a phone the panel would sit on top of the design it is there to
     switch between, so it opens shut and the toggle is the only furniture */
  if (window.matchMedia('(max-width:430px)').matches) {
    panel.classList.add('is-shut');
    toggle.setAttribute('aria-expanded', 'false');
  }

  go('banner');
})();
