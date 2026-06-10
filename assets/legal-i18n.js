/* MINERVA — localized legal documents loader
   English is authoritative and lives inline in privacy.html / terms.html.
   For any other language, this fetches legal/<doc>.<lang>.html and swaps the
   .legal-body content. If a translation file is missing, English is kept.
   Add languages incrementally by dropping in new legal/<doc>.<lang>.html files. */
(function () {
  'use strict';
  var main = document.querySelector('[data-legal-doc]');
  if (!main) return;
  var doc = main.getAttribute('data-legal-doc');
  var body = main.querySelector('.legal-body');
  if (!body) return;

  var enHTML = body.innerHTML;            // authoritative English, kept for fallback
  var base = location.pathname.replace(/[^/]*$/, '');  // directory of the current page

  function resolveLang() {
    try {
      var u = new URLSearchParams(location.search).get('lang');
      if (u) return u;
      return localStorage.getItem('minerva-lang') || 'en';
    } catch (e) { return 'en'; }
  }

  function apply(lang) {
    if (!lang || lang === 'en') { body.innerHTML = enHTML; return; }
    fetch(base + 'legal/' + doc + '.' + lang + '.html', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) { body.innerHTML = (html && html.trim()) ? html : enHTML; })
      .catch(function () { body.innerHTML = enHTML; });
  }

  apply(resolveLang());
  window.addEventListener('minervalang', function (e) { apply((e && e.detail) || resolveLang()); });
})();
