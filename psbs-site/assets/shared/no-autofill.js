/* PSBS – turn browser autofill off on every field, including fields created later by scripts. */
(function () {
  'use strict';
  var SKIP = { checkbox: 1, radio: 1, hidden: 1, submit: 1, button: 1, reset: 1, image: 1, file: 1, range: 1, color: 1 };
  function fix(el) {
    if (!el || el.nodeType !== 1) return;
    var t = el.tagName;
    if (t === 'FORM') { el.setAttribute('autocomplete', 'off'); return; }
    if (t !== 'INPUT' && t !== 'TEXTAREA' && t !== 'SELECT') return;
    if (t === 'INPUT' && SKIP[(el.getAttribute('type') || 'text').toLowerCase()]) return;
    var pw = t === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'password';
    var v = pw ? 'new-password' : 'off';
    if (el.getAttribute('autocomplete') !== v) el.setAttribute('autocomplete', v);
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', 'true');
    el.setAttribute('data-bwignore', 'true');
    el.setAttribute('data-form-type', 'other');
  }
  function sweep(root) {
    if (!root || !root.querySelectorAll) return;
    fix(root);
    var n = root.querySelectorAll('form,input,textarea,select');
    for (var i = 0; i < n.length; i++) fix(n[i]);
  }
  /* fields created in code get the attributes the moment they are made */
  var ce = document.createElement;
  document.createElement = function () {
    var el = ce.apply(this, arguments);
    var t = el.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'FORM' || t === 'SELECT') fix(el);
    return el;
  };
  /* fields added to the page later (modals, editors, rendered lists) */
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var a = muts[i].addedNodes;
      for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) sweep(a[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { sweep(document); });
  else sweep(document);
})();
