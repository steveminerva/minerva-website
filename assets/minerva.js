/* MINERVA — shared interactions: menu, language, scroll reveals */

/* Load the VIP / Private-Access engine on every page (welcome banner +
   page gating live there). The engine is Supabase-backed, so it needs, in
   order: (1) assets/config.js (public URL + anon key), (2) the supabase-js v2
   CDN, then (3) assets/vip.js. Each is guarded so it loads only once, and
   vip.js is appended only after the first two are present so window.supabase
   and window.MINERVA_SUPABASE exist when it runs. */
(function loadVIP() {
  if (window.MinervaVIP || document.querySelector('script[data-vip-engine]')) return;

  function addOnce(attr, src, attrs, onload) {
    if (document.querySelector('script[' + attr + ']')) {
      var existing = document.querySelector('script[' + attr + ']');
      // already present — if it has loaded, fire onload synchronously-ish
      if (onload) { if (existing.dataset.loaded === '1') onload(); else existing.addEventListener('load', onload); }
      return existing;
    }
    var s = document.createElement('script');
    s.src = src;
    s.setAttribute(attr, '1');
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    s.addEventListener('load', function () { s.dataset.loaded = '1'; if (onload) onload(); });
    document.head.appendChild(s);
    return s;
  }

  // 1) public config → 2) supabase-js v2 CDN → 3) the engine, strictly chained
  // so window.MINERVA_SUPABASE and window.supabase both exist before vip.js runs.
  addOnce('data-vip-config', 'assets/config.js', null, function () {
    addOnce('data-vip-sdk', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', null, function () {
      addOnce('data-vip-engine', 'assets/vip.js');
    });
  });
})();

(function () {
  'use strict';

  /* ---- Shared site footer: inject identically on every page ---- */
  (function injectFooter() {
    if (document.querySelector('.site-foot')) return;
    var f = document.createElement('footer');
    f.className = 'site-foot';
    f.innerHTML = ''
      // PUBLIC footer — logged-out visitors & Heritage members
      + '<div class="foot-public" data-public-only>'
      +   '<div class="foot-cols">'
      +     '<div class="foot-col">'
      +       '<a class="foot-link" href="history.html" data-i18n="foot.history">History</a>'
      +       '<a class="foot-link" href="archives.html">Minerva Motors Heritage</a></div>'
      +   '</div>'
      +   '<div class="foot-base">'
      +     '<span class="f-mark">MINERVA</span>'
      +     '<span>\u00A9 2026 Minerva Motors Heritage vzw \u00B7 BE0783.597.177</span>'
      +   '</div>'
      + '</div>'
      // VIP / staff footer — full
      + '<div class="foot-vip" data-vip-only>'
      + '<div class="foot-cols">'
      +   '<div class="foot-col"><p class="foot-h" data-i18n="foot.social">Social</p>'
      +     '<a class="foot-link" href="#">Instagram</a>'
      +     '<a class="foot-link" href="#">LinkedIn</a></div>'
      +   '<div class="foot-col"><p class="foot-h" data-i18n="foot.company">Company</p>'
      +     '<a class="foot-link" href="investors.html" data-i18n="foot.investor">Investor Relations</a>'
      +     '<a class="foot-link" href="team.html" data-i18n="foot.join">Join the Team</a>'
      +     '<a class="foot-link" href="news.html" data-i18n="foot.news">News &amp; Events</a>'
      +     '<a class="foot-link" href="press.html" data-i18n="foot.press">Press</a></div>'
      +   '<div class="foot-col"><p class="foot-h" data-i18n="foot.locations">Locations</p>'
      +     '<span class="foot-link">Antwerpen</span>'
      +     '<span class="foot-link">Cousset</span>'
      +     '<span class="foot-link">Monaco</span></div>'
      +   '<div class="foot-col"><p class="foot-h" data-i18n="foot.heritage">Heritage</p>'
      +     '<a class="foot-link" href="history.html" data-i18n="foot.history">History</a>'
      +     '<a class="foot-link" href="archives.html" data-i18n="foot.archives">Archives</a></div>'
      + '</div>'
      + '<div class="foot-base">'
      +   '<span class="f-mark">MINERVA</span>'
      +   '<nav class="foot-legal" aria-label="Legal">'
      +     '<a class="cookie-settings" href="#" data-i18n="foot.cookie">Cookie settings</a>'
      +     '<a href="privacy.html" data-i18n="foot.privacy">Privacy &amp; Cookie Policy</a>'
      +     '<a href="terms.html" data-i18n="foot.terms">General Terms &amp; Conditions</a>'
      +   '</nav>'
      +   '<span>\u00A9 2026 Minerva Holding B.V. \u2014 a <a class="foot-vbv" href="https://www.vanbeirsventures.com" target="_blank" rel="noopener">Van Beirs Ventures</a> company</span>'
      + '</div>'
      + '</div>';
    var anchor = document.getElementById('tweaksRoot');
    if (anchor) { document.body.insertBefore(f, anchor); } else { document.body.appendChild(f); }
    // Translate the freshly-injected footer if the engine is present.
    if (window.MinervaI18n) { try { window.MinervaI18n.apply(window.MinervaI18n.lang); } catch (e) {} }
  })();

  /* ---- Small, discreet centred Minerva roundel on every page's top bar ---- */
  /* (skipped on the home/teaser page — it already features the large hero logo) */
  (function injectTopLogo() {
    if (document.body.classList.contains('home') || document.body.classList.contains('teaser')) return;
    var bar = document.querySelector('header.top');
    if (!bar || bar.querySelector('.top-logo')) return;
    var a = document.createElement('a');
    a.className = 'top-logo';
    a.href = 'index.html';
    a.setAttribute('aria-label', 'Minerva — home');
    a.innerHTML = '<img src="uploads/minerva-logo-black.png" alt="Minerva">';
    bar.appendChild(a);
  })();

  /* ---- Mini Minerva roundel at the top of the menu drawer (all pages) ---- */
  (function injectMenuLogo() {
    var inner = document.querySelector('.menu-overlay .menu-inner');
    var ov = document.querySelector('.menu-overlay');
    if (!ov || ov.querySelector('.menu-logo')) return;
    var a = document.createElement('a');
    a.className = 'menu-logo';
    a.href = 'index.html';
    a.setAttribute('aria-label', 'Minerva — home');
    a.innerHTML = '<img src="uploads/minerva-logo-black.png" alt="Minerva">';
    if (inner) { inner.insertBefore(a, inner.firstChild); } else { ov.appendChild(a); }
  })();

  /* ---- Hamburger drawer ---- */
  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('menu');
  if (btn && menu) {
    function setMenu(open) {
      btn.classList.toggle('open', open);
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('menu-open', open);
    }
    btn.addEventListener('click', function () {
      setMenu(!menu.classList.contains('open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false);
    });
  }

  /* ---- Language selector (visual state only for the teaser) ---- */
  var langRow = document.getElementById('langRow');
  if (langRow) {
    var stored = null;
    try { stored = localStorage.getItem('minerva-lang'); } catch (e) {}
    if (stored) {
      langRow.querySelectorAll('.lang').forEach(function (b) {
        b.classList.toggle('active', b.dataset.lang === stored);
      });
    }
    langRow.addEventListener('click', function (e) {
      var t = e.target.closest('.lang');
      if (!t) return;
      langRow.querySelectorAll('.lang').forEach(function (b) { b.classList.remove('active'); });
      t.classList.add('active');
      try { localStorage.setItem('minerva-lang', t.dataset.lang); } catch (err) {}
      window.dispatchEvent(new CustomEvent('minervalang', { detail: t.dataset.lang }));
    });
  }

  /* ---- Solid black top bar once scrolled (all pages) ---- */
  (function () {
    var onScrollBar = function () {
      document.body.classList.toggle('nav-solid', window.scrollY > 16);
    };
    window.addEventListener('scroll', onScrollBar, { passive: true });
    onScrollBar();
  })();

  /* ---- Mini-brand reveal after hero (home only) ---- */
  if (document.body.classList.contains('home')) {
    var onScroll = function () {
      var past = window.scrollY > window.innerHeight * 0.55;
      document.body.classList.toggle('scrolled', past);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Back-link: ride just above the footer, never overlapping it ---- */
  var backLink = document.querySelector('.back-link');
  if (backLink) {
    var BACK_GAP = 24;
    var onBack = function () {
      var foot = document.querySelector('.site-foot');
      var footTop = foot ? foot.getBoundingClientRect().top : Infinity;
      var inView = footTop < window.innerHeight;
      backLink.classList.toggle('show', inView);
      if (inView) {
        // pin the link just above the footer's top edge; it rises with the footer
        backLink.style.bottom = (window.innerHeight - footTop + BACK_GAP) + 'px';
      } else {
        backLink.style.bottom = '';
      }
    };
    window.addEventListener('scroll', onBack, { passive: true });
    window.addEventListener('resize', onBack, { passive: true });
    onBack();
  }

  /* ---- Scroll reveals ---- */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Countdown (30 days to next announcement) ---- */
  var cd = document.getElementById('countdown');
  if (cd) {
    var KEY = 'minerva-countdown-target';
    var target = null;
    try { target = parseInt(localStorage.getItem(KEY), 10); } catch (e) {}
    if (!target || isNaN(target) || target < Date.now()) {
      target = Date.now() + 30 * 24 * 60 * 60 * 1000;
      try { localStorage.setItem(KEY, String(target)); } catch (e) {}
    }
    var elD = document.getElementById('cdDays'),
        elH = document.getElementById('cdHours'),
        elM = document.getElementById('cdMins'),
        elS = document.getElementById('cdSecs');
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tick = function () {
      var diff = Math.max(0, target - Date.now());
      var s = Math.floor(diff / 1000);
      var d = Math.floor(s / 86400); s -= d * 86400;
      var h = Math.floor(s / 3600);  s -= h * 3600;
      var m = Math.floor(s / 60);    s -= m * 60;
      if (elD) elD.textContent = pad(d);
      if (elH) elH.textContent = pad(h);
      if (elM) elM.textContent = pad(m);
      if (elS) elS.textContent = pad(s);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- Sovereign countdown (days · hours · minutes) + rising reveal ----
     Wrapped in MinervaSovereign.init() so the VIP engine can re-run it after
     it injects the Aegis / Sovereign teaser markup at runtime (the nodes don't
     exist at first load on those gated pages). Safe to call repeatedly. */
  window.MinervaSovereign = window.MinervaSovereign || { init: initSovereign, _iv: null };
  function initSovereign() {
  var sov = document.getElementById('sovCountdown');
  if (sov) {
    if (window.MinervaSovereign._iv) { clearInterval(window.MinervaSovereign._iv); window.MinervaSovereign._iv = null; }
    var DAYS = parseInt(sov.dataset.days, 10) || 365;
    // Fixed launch date (data-target) so the countdown is identical for every
    // visitor and survives redeploys. Optional data-start anchors the reveal.
    var st = Date.parse(sov.dataset.target || '');
    var startMs = Date.parse(sov.dataset.start || '');
    if (isNaN(st)) { st = Date.now() + DAYS * 86400000; }
    if (isNaN(startMs)) { startMs = st - DAYS * 86400000; }
    var sD = document.getElementById('svDays'),
        sH = document.getElementById('svHours'),
        sMin = document.getElementById('svMins');
    var svReveal = document.getElementById('svReveal');
    var svCover = svReveal ? svReveal.querySelector('.sv-cover') : null;
    var svLine = svReveal ? svReveal.querySelector('.sv-hline') : null;
    var svPct = document.getElementById('svPct');
    var svBuilt = svReveal ? svReveal.querySelector('.sv-built') : null;
    var TOTAL = Math.max(1, st - startMs);     // full countdown window
    var REVEAL_BASE = (svReveal && svReveal.dataset.revealBase) ? parseFloat(svReveal.dataset.revealBase) : 0.086;
    var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var sTick = function () {
      var diff = Math.max(0, st - Date.now());
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      if (sD) sD.textContent = days;
      if (sH) sH.textContent = pad2(hours);
      if (sMin) sMin.textContent = pad2(mins);
      // Reveal rises from REVEAL_BASE (now) to 1.0 (launch) as time elapses.
      var progress = Math.min(1, Math.max(0, 1 - diff / TOTAL));
      var reveal = REVEAL_BASE + (1 - REVEAL_BASE) * progress;
      var hidden = ((1 - reveal) * 100).toFixed(2) + '%';
      if (svCover) svCover.style.height = hidden;
      if (svLine) svLine.style.top = hidden;
      if (svPct) { svPct.style.top = hidden; svPct.textContent = Math.round(reveal * 100) + '% ' + (window.MinervaI18n ? window.MinervaI18n.t('sv.design', window.MinervaI18n.lang) : 'design'); }
      // Once 60% revealed, retire the "being built" line.
      if (svBuilt) { svBuilt.style.opacity = reveal >= 0.60 ? '0' : '1'; }
    };
    sTick();
    window.MinervaSovereign._iv = setInterval(sTick, 15000);
  }
  }
  initSovereign();

  /* ---- Subscribe (teaser email capture) ---- */
  var subForm = document.getElementById('subscribeForm');
  if (subForm) {
    subForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('subEmail');
      var done = document.getElementById('subscribeDone');
      if (input && input.value && input.checkValidity()) {
        try { localStorage.setItem('minerva-subscriber', input.value); } catch (err) {}
        input.parentNode.style.display = 'none';
        if (done) done.hidden = false;
      } else if (input) {
        input.reportValidity();
      }
    });
  }

  /* ---- Archives: register interest ---- */
  var interestForm = document.getElementById('interestForm');
  if (interestForm) {
    var consentBox = document.getElementById('regEmailConsent');
    if (consentBox) {
      consentBox.addEventListener('change', function () { consentBox.setCustomValidity(''); });
    }
    interestForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('regEmail');
      if (!input || !input.value || !input.checkValidity()) {
        if (input) input.reportValidity();
        return;
      }
      var consent = document.getElementById('regEmailConsent');
      if (consent && !consent.checked) {
        consent.setCustomValidity('Please tick this box to give permission before registering your interest.');
        consent.reportValidity();
        return;
      }
      if (consent) { consent.setCustomValidity(''); }
      var interests = [].slice.call(interestForm.querySelectorAll('input[name="interest"]:checked'))
        .map(function (c) { return c.value; });
      try {
        localStorage.setItem('minerva-archive-interest', JSON.stringify({
          email: input.value,
          interests: interests,
          emailConsent: consent ? consent.checked : false,
          ts: Date.now()
        }));
      } catch (err) {}

      var overlay = document.getElementById('regOverlay');
      if (overlay) {
        var stage = overlay.querySelector('.ro-stage');
        var msg = overlay.querySelector('.ro-msg');
        overlay.hidden = false;
        document.body.classList.add('menu-open');
        requestAnimationFrame(function () { overlay.classList.add('show'); });
        setTimeout(function () {
          if (stage) stage.classList.add('hide');
          if (msg) msg.classList.add('show');
          var redirect = document.getElementById('roRedirect');
          var countEl = document.getElementById('roCount');
          if (redirect) redirect.hidden = false;
          var n = 10;
          var iv = setInterval(function () {
            n -= 1;
            if (countEl) countEl.textContent = n;
            if (n <= 0) { clearInterval(iv); window.location.href = 'index.html'; }
          }, 1000);
        }, 5000);
      } else {
        var done = document.getElementById('regDone');
        interestForm.querySelector('.reg-options').style.display = 'none';
        input.closest('.field').style.display = 'none';
        interestForm.querySelector('button[type="submit"]').style.display = 'none';
        if (done) done.hidden = false;
      }
    });
  }
})();

/* ============================================================
   MINERVA — GDPR cookie consent (central, multilingual)
   Horizontal top banner injected on every page. Stores a single
   consent record in localStorage and localises to the visitor's
   chosen language (minerva-lang).
   ============================================================ */
(function () {
  'use strict';
  if (window.MinervaCookies) return;

  var CONSENT_KEY = 'minerva-consent';
  var CONSENT_VERSION = 1;

  var T = {
    en: { title: 'Your privacy', msg: 'We use cookies to enhance your experience and analyse our traffic. You may accept all, reject non-essential cookies, or manage your preferences.', accept: 'Accept all', reject: 'Reject non-essential', manage: 'Manage', save: 'Save choices', policy: 'Cookie Policy', settings: 'Cookie settings', necessary: 'Strictly necessary', necessaryDesc: 'Required for the site to function. Always active.', analytics: 'Analytics', analyticsDesc: 'Help us understand how the site is used.', marketing: 'Marketing', marketingDesc: 'Used to personalise communications.' },
    nl: { title: 'Uw privacy', msg: 'Wij gebruiken cookies om uw ervaring te verbeteren en ons verkeer te analyseren. U kunt alles accepteren, niet-essentiële cookies weigeren of uw voorkeuren beheren.', accept: 'Alles accepteren', reject: 'Niet-essentiële weigeren', manage: 'Beheren', save: 'Keuzes opslaan', policy: 'Cookiebeleid', settings: 'Cookie-instellingen', necessary: 'Strikt noodzakelijk', necessaryDesc: 'Vereist voor de werking van de site. Altijd actief.', analytics: 'Analyse', analyticsDesc: 'Helpt ons begrijpen hoe de site wordt gebruikt.', marketing: 'Marketing', marketingDesc: 'Gebruikt om communicatie te personaliseren.' },
    fr: { title: 'Votre vie privée', msg: 'Nous utilisons des cookies pour améliorer votre expérience et analyser notre trafic. Vous pouvez tout accepter, refuser les cookies non essentiels ou gérer vos préférences.', accept: 'Tout accepter', reject: 'Refuser non essentiels', manage: 'Gérer', save: 'Enregistrer', policy: 'Politique cookies', settings: 'Paramètres des cookies', necessary: 'Strictement nécessaires', necessaryDesc: 'Nécessaires au fonctionnement du site. Toujours actifs.', analytics: 'Analyse', analyticsDesc: "Nous aident à comprendre l'utilisation du site.", marketing: 'Marketing', marketingDesc: 'Utilisés pour personnaliser les communications.' },
    de: { title: 'Ihre Privatsphäre', msg: 'Wir verwenden Cookies, um Ihr Erlebnis zu verbessern und unseren Datenverkehr zu analysieren. Sie können alle akzeptieren, nicht notwendige ablehnen oder Ihre Einstellungen verwalten.', accept: 'Alle akzeptieren', reject: 'Nicht notwendige ablehnen', manage: 'Verwalten', save: 'Auswahl speichern', policy: 'Cookie-Richtlinie', settings: 'Cookie-Einstellungen', necessary: 'Unbedingt erforderlich', necessaryDesc: 'Für den Betrieb der Website erforderlich. Immer aktiv.', analytics: 'Analyse', analyticsDesc: 'Helfen uns zu verstehen, wie die Website genutzt wird.', marketing: 'Marketing', marketingDesc: 'Dienen der Personalisierung der Kommunikation.' },
    it: { title: 'La tua privacy', msg: 'Utilizziamo i cookie per migliorare la tua esperienza e analizzare il traffico. Puoi accettare tutto, rifiutare i cookie non essenziali o gestire le preferenze.', accept: 'Accetta tutto', reject: 'Rifiuta non essenziali', manage: 'Gestisci', save: 'Salva scelte', policy: 'Informativa cookie', settings: 'Impostazioni cookie', necessary: 'Strettamente necessari', necessaryDesc: 'Necessari per il funzionamento del sito. Sempre attivi.', analytics: 'Analisi', analyticsDesc: 'Ci aiutano a capire come viene usato il sito.', marketing: 'Marketing', marketingDesc: 'Usati per personalizzare le comunicazioni.' },
    es: { title: 'Tu privacidad', msg: 'Utilizamos cookies para mejorar tu experiencia y analizar nuestro tráfico. Puedes aceptar todo, rechazar las no esenciales o gestionar tus preferencias.', accept: 'Aceptar todo', reject: 'Rechazar no esenciales', manage: 'Gestionar', save: 'Guardar opciones', policy: 'Política de cookies', settings: 'Configuración de cookies', necessary: 'Estrictamente necesarias', necessaryDesc: 'Necesarias para el funcionamiento del sitio. Siempre activas.', analytics: 'Analítica', analyticsDesc: 'Nos ayudan a entender cómo se usa el sitio.', marketing: 'Marketing', marketingDesc: 'Se usan para personalizar las comunicaciones.' },
    zh: { title: '您的隐私', msg: '我们使用 Cookie 来提升您的体验并分析网站流量。您可以接受全部、拒绝非必要 Cookie，或管理您的偏好设置。', accept: '全部接受', reject: '拒绝非必要', manage: '管理', save: '保存选择', policy: 'Cookie 政策', settings: 'Cookie 设置', necessary: '严格必要', necessaryDesc: '网站运行所必需，始终启用。', analytics: '分析', analyticsDesc: '帮助我们了解网站的使用情况。', marketing: '营销', marketingDesc: '用于个性化沟通内容。' },
    ja: { title: 'プライバシー', msg: '当サイトでは、体験の向上とトラフィック分析のために Cookie を使用します。すべて同意する、必須以外を拒否する、または設定を管理できます。', accept: 'すべて同意', reject: '必須以外を拒否', manage: '管理', save: '設定を保存', policy: 'Cookie ポリシー', settings: 'Cookie 設定', necessary: '必須', necessaryDesc: 'サイトの動作に必要です。常に有効。', analytics: '分析', analyticsDesc: 'サイトの利用状況の把握に役立ちます。', marketing: 'マーケティング', marketingDesc: 'コミュニケーションのパーソナライズに使用します。' }
  };

  function getLang() {
    var l = 'en';
    try { l = localStorage.getItem('minerva-lang') || 'en'; } catch (e) {}
    return T[l] ? l : 'en';
  }
  function getConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      return (c && c.v === CONSENT_VERSION) ? c : null;
    } catch (e) { return null; }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

  var bar = null;
  var state = { manage: false, analytics: false, marketing: false };

  function template(t) {
    return ''
      + '<div class="cookie-inner">'
      +   '<p class="cookie-text"><strong>' + esc(t.title) + '</strong>' + esc(t.msg) + ' <a href="#" data-cc="policy">' + esc(t.policy) + '</a></p>'
      +   '<div class="cookie-actions">'
      +     '<button class="cookie-btn" data-cc="manage">' + esc(t.manage) + '</button>'
      +     '<button class="cookie-btn" data-cc="reject">' + esc(t.reject) + '</button>'
      +     '<button class="cookie-btn solid" data-cc="accept">' + esc(t.accept) + '</button>'
      +   '</div>'
      + '</div>'
      + '<div class="cookie-manage"' + (state.manage ? '' : ' hidden') + '>'
      +   '<div class="cookie-cats">'
      +     cat(t.necessary, t.necessaryDesc, null, true, true)
      +     cat(t.analytics, t.analyticsDesc, 'analytics', state.analytics, false)
      +     cat(t.marketing, t.marketingDesc, 'marketing', state.marketing, false)
      +   '</div>'
      +   '<div class="cookie-save-row"><button class="cookie-btn solid" data-cc="save">' + esc(t.save) + '</button></div>'
      + '</div>';
  }
  function cat(name, desc, key, checked, disabled) {
    return ''
      + '<div class="cookie-cat">'
      +   '<div class="cookie-cat-h"><span class="cookie-cat-name">' + esc(name) + '</span>'
      +     '<span class="cc-toggle"><input type="checkbox"' + (key ? ' data-cat="' + key + '"' : '') + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + ' aria-label="' + esc(name) + '"><span class="cc-track"></span></span>'
      +   '</div>'
      +   '<p class="cookie-cat-desc">' + esc(desc) + '</p>'
      + '</div>';
  }

  function render() {
    if (!bar) return;
    bar.innerHTML = template(T[getLang()]);
  }
  function measure() {
    if (!bar) return;
    requestAnimationFrame(function () {
      document.documentElement.style.setProperty('--cookie-h', bar.offsetHeight + 'px');
    });
  }
  function build() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', T[getLang()].title);
    document.body.appendChild(bar);
    render();
    bar.addEventListener('click', onClick);
    bar.addEventListener('change', onChange);
  }
  function show() {
    build();
    document.body.classList.add('has-cookie');
    requestAnimationFrame(function () { bar.classList.add('show'); measure(); });
  }
  function hide() {
    if (!bar) return;
    bar.classList.remove('show');
    setTimeout(function () {
      document.body.classList.remove('has-cookie');
      document.documentElement.style.setProperty('--cookie-h', '0px');
    }, 600);
  }
  function persist(analytics, marketing) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        v: CONSENT_VERSION, necessary: true, analytics: !!analytics, marketing: !!marketing, ts: Date.now()
      }));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('minervaconsent', { detail: { analytics: !!analytics, marketing: !!marketing } }));
  }
  function onClick(e) {
    var b = e.target.closest('[data-cc]');
    if (!b) return;
    var a = b.dataset.cc;
    if (a === 'policy') { e.preventDefault(); return; }
    if (a === 'manage') { state.manage = true; render(); measure(); return; }
    if (a === 'accept') { persist(true, true); hide(); return; }
    if (a === 'reject') { persist(false, false); hide(); return; }
    if (a === 'save') { persist(state.analytics, state.marketing); hide(); return; }
  }
  function onChange(e) {
    var i = e.target.closest('input[data-cat]');
    if (!i) return;
    state[i.dataset.cat] = i.checked;
  }

  // Re-localise live when the visitor changes language.
  window.addEventListener('minervalang', function () {
    if (bar) { render(); measure(); }
  });

  // Reopen from any "Cookie settings" affordance.
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-cookie-open], .cookie-settings');
    if (s) { e.preventDefault(); MinervaCookies.open(true); }
  });

  window.MinervaCookies = {
    open: function (manage) {
      var c = getConsent();
      state.manage = !!manage;
      state.analytics = c ? !!c.analytics : false;
      state.marketing = c ? !!c.marketing : false;
      build(); render(); show();
    },
    reset: function () { try { localStorage.removeItem(CONSENT_KEY); } catch (e) {} window.MinervaCookies.open(false); },
    get: getConsent
  };

  // First-visit: show banner until a choice is recorded.
  if (!getConsent()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show);
    } else { show(); }
  }
})();

/* ============================================================
   Microsoft Clarity — analytics, loaded ONLY after the visitor
   accepts analytics cookies (GDPR-gated via the consent banner).
   ============================================================ */
(function () {
  'use strict';
  var CLARITY_ID = 'x1tbqvsetq';
  var loaded = false;
  function analyticsOk() {
    try { var c = JSON.parse(localStorage.getItem('minerva-consent')); return !!(c && c.analytics); }
    catch (e) { return false; }
  }
  function loadClarity() {
    if (loaded || window.clarity) return;
    loaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }
  if (analyticsOk()) loadClarity();
  window.addEventListener('minervaconsent', function (e) {
    if (e && e.detail && e.detail.analytics) loadClarity();
  });
})();
