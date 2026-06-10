/* ============================================================
   MINERVA — VIP / Private Access engine (Supabase-backed)
   Exposes window.MinervaVIP for admin.html and login.html.

   The UI is UNCHANGED from the prototype: the same injected CSS,
   the welcome / admin / expired banners, the language re-render,
   the menu gating and the silent hide. Only the DATA SOURCE has
   moved from this browser's localStorage to Supabase:
     - Auth        -> supabase.auth (JWT session, magic-link invites)
     - VIP records -> public.profiles / public.vip_events (RLS)
     - Admin ops   -> Edge Functions (service_role)
     - Private content (Aegis / Sovereign / Team) -> public.protected_content
       fetched at runtime only for an authed session that has access.

   Public values (project URL + anon key) come from window.MINERVA_SUPABASE
   (assets/config.js). The supabase-js v2 CDN must be loaded before this file.
   ============================================================ */
(function () {
  'use strict';
  if (window.MinervaVIP) return;

  /* ---------------- Supabase client ---------------- */
  var CFG = window.MINERVA_SUPABASE || {};
  var sb = null;
  try {
    if (window.supabase && CFG.url && CFG.anonKey) {
      sb = window.supabase.createClient(CFG.url, CFG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
  } catch (e) { sb = null; }

  /* ---------------- cached session state ---------------- */
  // Populated by refreshSession(); the synchronous getters below read these so
  // login.html / admin.html keep working with the same method names.
  var _profile = null;   // the caller's profiles row (VIP) — null for anon/admin
  var _isAdmin = false;  // true when the signed-in user's profile.is_admin
  var _isHeritage = false; // true when the signed-in user is a Heritage member (profile.tier set, not admin)
  var _ready = false;    // becomes true after the first session resolution
  var _readyWaiters = [];

  function markReady() {
    _ready = true;
    var w = _readyWaiters.slice(); _readyWaiters.length = 0;
    w.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  // Resolve once the first session check has completed.
  function whenReady(fn) { if (_ready) return fn(); _readyWaiters.push(fn); }

  /* ---------------- date helpers (unchanged) ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function fmtDate(ds) {
    if (!ds) return '';
    var p = String(ds).split('-');
    if (p.length < 3) return ds;
    return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function fmtDateTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return pad(d.getDate()) + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear()
         + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function genPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    var rnd = null;
    try { rnd = crypto.getRandomValues(new Uint32Array(12)); } catch (e) {}
    var out = '';
    for (var i = 0; i < 12; i++) {
      var r = rnd ? rnd[i] : Math.floor(Math.random() * 1e9);
      out += chars[r % chars.length];
      if (i === 3 || i === 7) out += '-';
    }
    return out;
  }

  /* ---------------- access predicate (mirrors SQL has_access) ---------------- */
  function isExpired(u) {
    if (!u) return false;
    var end = u.endDate || u.end_date || null;
    return !!(end && todayStr() > end);
  }
  function profileHasAccess(p) {
    if (!p) return false;
    if (p.cancelled_at || p.cancelled) return false;
    return !isExpired(p);
  }

  /* ---------------- Edge Function helper ---------------- */
  // Calls an Edge Function with the user's JWT; returns its JSON (or throws).
  function fn(name, body) {
    if (!sb) return Promise.reject(new Error('supabase-unavailable'));
    return sb.functions.invoke(name, { body: body || {} }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  /* ---------------- profile shaping for the admin UI ---------------- */
  function ms(v) { if (v == null) return null; var t = (typeof v === 'number') ? v : Date.parse(v); return isNaN(t) ? null : t; }
  // Normalises a server profile/row into the shape the admin.html UI expects
  // (no, id, name, email, endDate, inviteSentAt, cancelled, logins, events...).
  function shapeUser(row) {
    if (!row) return null;
    var u = {
      no: row.no, id: row.id, name: row.name, email: row.email,
      // end_date is a calendar date ('YYYY-MM-DD') — keep it as a string.
      endDate: row.endDate || row.end_date || null,
      // timestamps normalised to epoch-millis so the admin UI's numeric sort
      // and fmtDateTime keep working (Supabase returns ISO strings).
      inviteSentAt: ms(row.inviteSentAt || row.invite_sent_at || null),
      cancelled: ms(row.cancelledAt || row.cancelled_at || null),
      created: ms(row.createdAt || row.created_at || null),
      lang: row.lang || 'en',
      logins: [],
      events: [],
      extReq: null
    };
    var ll = ms(row.lastLogin);
    if (ll) u.logins = [ll];
    return u;
  }

  /* ---------------- store: Supabase-backed ----------------
     Every method maps to an Edge Function (admin ops) or a read. Async; the
     admin.html inline script awaits them. */
  var store = {
    // List all VIP users (admin-list).
    all: function () {
      return fn('admin-list').then(function (d) {
        return (d.users || []).map(shapeUser);
      });
    },
    list: function () { return store.all(); },
    // Create a VIP (admin-create-vip): provisions the auth user + profile and
    // sends the invitation email. Returns the shaped user + one-time password.
    create: function (name, email, endDate, lang) {
      return fn('admin-create-vip', { name: name, email: email, endDate: endDate || null, lang: lang || 'en' })
        .then(function (d) {
          return { id: d.id, name: name, email: String(email || '').toLowerCase(), endDate: endDate || null, password: d.password, inviteSentAt: Date.now() };
        });
    },
    // One profile + full event log (admin-detail).
    get: function (id) {
      return fn('admin-detail', { id: id }).then(function (d) {
        if (!d || !d.user) return null;
        var u = shapeUser(d.user);
        u.events = (d.events || []).map(function (e) { return { type: e.type, ts: ms(e.ts) }; });
        // last login from the event log (for the register's "last login")
        var lastLogin = null;
        u.events.forEach(function (e) { if (e.type === 'login' && e.ts && (!lastLogin || e.ts > lastLogin)) lastLogin = e.ts; });
        u.logins = lastLogin ? [lastLogin] : [];
        // Surface an outstanding extension request as the UI's extReq flag.
        // Events are returned newest-first; an 'extension' as the most recent
        // event is treated as a pending request (an admin grant via admin-extend
        // also logs 'extension', but renders the same prompt — set a new date).
        var newest = u.events.length ? u.events[0] : null;
        if (newest && newest.type === 'extension') {
          u.extReq = { ts: newest.ts, from: u.endDate || null };
        }
        return u;
      });
    },
    // Set / clear end date, clearing cancellation (admin-extend).
    extend: function (id, date) { return fn('admin-extend', { id: id, endDate: date || null }); },
    // Cancel access immediately (admin-cancel).
    cancel: function (id) { return fn('admin-cancel', { id: id }); },
    // Mark the invitation as (re)sent. The initial invite email is sent by
    // admin-create-vip at creation time; a dedicated resend Edge Function is a
    // documented TODO, so this resolves quietly to keep the resend UX working.
    markInviteSent: function (/* id */) { return Promise.resolve({ ok: true }); },
    // A signed-in VIP asks for more time (vip-request-extension).
    requestExtension: function (id) { return fn('vip-request-extension', { id: id }); }
  };

  /* ---------------- session refresh ----------------
     Reads the current Supabase session and caches the caller's profile +
     admin flag. Safe to call repeatedly (e.g. on auth state change). */
  function refreshSession() {
    if (!sb) { _profile = null; _isAdmin = false; _isHeritage = false; return Promise.resolve(); }
    return sb.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (!session || !session.user) { _profile = null; _isAdmin = false; _isHeritage = false; return; }
      return sb.from('profiles')
        .select('id, no, name, email, end_date, cancelled_at, invite_sent_at, is_admin, lang, tier, status, membership_end')
        .eq('id', session.user.id).single()
        .then(function (pr) {
          var p = pr && pr.data ? pr.data : null;
          _isAdmin = !!(p && p.is_admin);
          _isHeritage = !!(p && p.tier && !p.is_admin);
          _profile = p;
        });
    }).catch(function () { _profile = null; _isAdmin = false; _isHeritage = false; });
  }

  /* ---------------- public getters (sync, read the cache) ---------------- */
  function shapeProfileForBanner(p) {
    return { id: p.id, name: p.name, email: p.email, endDate: p.end_date || null };
  }
  // A signed-in VIP whose access is still valid (grants access). Shaped for UI.
  function currentVip() {
    if (_isAdmin) return null;
    if (_profile && _profile.tier) return null;   // Heritage members are not VIPs
    if (_profile && profileHasAccess(_profile)) return shapeProfileForBanner(_profile);
    return null;
  }
  // A signed-in VIP whose access has lapsed (shown the expired banner).
  function expiredVip() {
    if (_isAdmin) return null;
    if (_profile && !_profile.cancelled_at && isExpired(_profile)) return shapeProfileForBanner(_profile);
    return null;
  }
  function isAdmin() { return !!_isAdmin; }
  function isHeritage() { return !!_isHeritage; }
  function memberTier() { return _profile ? (_profile.tier || null) : null; }
  function memberStatus() { return _profile ? (_profile.status || null) : null; }
  function memberPending() { return !!(_profile && _profile.status === 'pending'); }
  function heritageActive() { return !!(_isHeritage && _profile && _profile.status === 'active' && (!_profile.membership_end || todayStr() <= _profile.membership_end)); }
  function hasAccess() { return _isAdmin || !!currentVip() || heritageActive(); }

  /* ---------------- auth actions (async) ---------------- */
  // Super-admin: sign in, then confirm the profile is_admin. No password is
  // stored client-side — the admin authenticates against Supabase Auth.
  function adminLogin(email, pw) {
    if (!sb) return Promise.resolve(false);
    return sb.auth.signInWithPassword({ email: String(email || '').trim(), password: pw || '' })
      .then(function (res) {
        if (res.error || !res.data || !res.data.user) return false;
        return sb.from('profiles').select('is_admin').eq('id', res.data.user.id).single()
          .then(function (pr) {
            if (pr && pr.data && pr.data.is_admin) { return refreshSession().then(function () { return true; }); }
            // Not an admin — don't leave them signed in as admin.
            return sb.auth.signOut().then(function () { return false; });
          });
      })
      .catch(function () { return false; });
  }

  // VIP guest: sign in, then check has_access; map failures to reasons.
  function authVip(email, pw) {
    if (!sb) return Promise.resolve({ ok: false, reason: 'invalid' });
    return sb.auth.signInWithPassword({ email: String(email || '').trim(), password: pw || '' })
      .then(function (res) {
        if (res.error || !res.data || !res.data.user) return { ok: false, reason: 'invalid' };
        var uid = res.data.user.id;
        return sb.from('profiles')
          .select('id, name, email, end_date, cancelled_at, tier, status')
          .eq('id', uid).single()
          .then(function (pr) {
            var p = pr && pr.data ? pr.data : null;
            if (!p) { return sb.auth.signOut().then(function () { return { ok: false, reason: 'invalid' }; }); }
            if (p.tier) {
              // Heritage member — valid session; routed to the member portal (not the VIP website).
              return refreshSession().then(function () { return { ok: true, heritage: true, tier: p.tier, status: p.status, user: shapeProfileForBanner(p) }; });
            }
            if (p.cancelled_at) { return sb.auth.signOut().then(function () { return { ok: false, reason: 'cancelled', user: shapeProfileForBanner(p) }; }); }
            if (isExpired(p)) { return sb.auth.signOut().then(function () { return { ok: false, reason: 'expired', user: shapeProfileForBanner(p) }; }); }
            // Valid — cache + log the login.
            return refreshSession().then(function () {
              return sb.from('vip_events').insert({ user_id: uid, type: 'login' })
                .then(function () { return { ok: true, user: shapeProfileForBanner(p) }; })
                .catch(function () { return { ok: true, user: shapeProfileForBanner(p) }; });
            });
          });
      })
      .catch(function () { return { ok: false, reason: 'invalid' }; });
  }

  // Magic-link / invite sign-in is handled by Supabase automatically via
  // detectSessionInUrl (the token in the URL is consumed by supabase-js on
  // load). This resolves the resulting session and maps the same reasons.
  function loginByInvite() {
    if (!sb) return Promise.resolve({ ok: false, reason: 'invalid' });
    return refreshSession().then(function () {
      if (_isAdmin) return { ok: true };
      if (!_profile) return { ok: false, reason: 'invalid' };
      if (_profile.cancelled_at) return { ok: false, reason: 'cancelled', user: shapeProfileForBanner(_profile) };
      if (isExpired(_profile)) return { ok: false, reason: 'expired', user: shapeProfileForBanner(_profile) };
      return { ok: true, user: shapeProfileForBanner(_profile) };
    });
  }

  function signOutVip() {
    var done = function () { _profile = null; _isAdmin = false; _isHeritage = false; };
    if (!sb) { done(); return Promise.resolve(); }
    return sb.auth.signOut().then(done, done);
  }
  function adminLogout() { return signOutVip(); }

  window.MinervaVIP = {
    store: store, genPassword: genPassword, todayStr: todayStr, isExpired: isExpired,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    currentVip: currentVip, expiredVip: expiredVip, authVip: authVip, loginByInvite: loginByInvite, signOutVip: signOutVip,
    adminLogin: adminLogin, isAdmin: isAdmin, adminLogout: adminLogout, hasAccess: hasAccess,
    isHeritage: isHeritage, memberTier: memberTier, memberStatus: memberStatus, memberPending: memberPending,
    // async readiness hooks (used by login.html / admin.html so the sync getters
    // above reflect the resolved session before they're read):
    ready: whenReady, refresh: refreshSession,
    // protected-content loader (exposed for completeness / testing):
    loadProtected: loadProtected
  };

  /* ============================================================
     Auto behaviour on content pages (skipped on admin/vip pages)
     (UI below is UNCHANGED from the prototype.)
     ============================================================ */
  var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var SKIP = (file === 'admin.html' || file === 'login.html');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }

  function injectStyles() {
    if (document.getElementById('vip-style')) return;
    var css = ''
      + 'html.vip-denied-full body[data-vip-restrict="full"] main{display:none!important;}'
      + 'html.vip-denied-team .team-grid,html.vip-denied-team [data-i18n="about.teamHead"]{display:none!important;}'
      /* persistent welcome banner */
      + 'body.has-vip{padding-top:calc(var(--cookie-h,0px) + var(--vip-h,0px));}'
      + 'body.has-vip .top{top:calc(var(--cookie-h,0px) + var(--vip-h,0px));}'
      + '.vip-banner{position:fixed;left:0;right:0;top:var(--cookie-h,0px);z-index:94;'
      +   'background:#07090d;border-bottom:1px solid var(--line);'
      +   'box-shadow:0 14px 40px rgba(0,0,0,.5);transform:translateY(-101%);'
      +   'transition:transform .55s var(--ease);}'
      + '.vip-banner.show{transform:translateY(0);}'
      + '.vip-banner-inner{max-width:1640px;margin:0 auto;padding:10px var(--pad);'
      +   'display:flex;align-items:center;gap:14px 18px;flex-wrap:wrap;}'
      + '.vip-dot{width:6px;height:6px;border-radius:50%;background:var(--platinum-bright);'
      +   'box-shadow:0 0 0 4px rgba(184,188,194,.12);flex:none;}'
      + '.vip-dot.exp{background:var(--minerva-red-bright);box-shadow:0 0 0 4px rgba(177,29,42,.18);}'
      + '.vip-welcome{font-family:var(--sans);font-weight:300;font-size:.92rem;letter-spacing:.02em;color:var(--fg-dim);}'
      + '.vip-welcome strong{color:var(--fg);font-weight:500;}'
      + '.vip-valid{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);}'
      + '.vip-valid strong{color:var(--platinum);font-weight:500;}'
      + '.vip-valid.lapsing strong{color:var(--minerva-red-bright);}'
      + '.vip-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}'
      + '.vip-act{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;'
      +   'color:var(--fg-dim);background:transparent;border:1px solid var(--line);padding:7px 14px;'
      +   'cursor:pointer;transition:color .35s var(--ease),border-color .35s var(--ease);white-space:nowrap;}'
      + '.vip-act:hover{color:var(--fg);border-color:var(--platinum-deep);}'
      + '.vip-act.ghost{border-color:transparent;padding:7px 6px;color:var(--mute);}'
      + '.vip-act.ghost:hover{color:var(--platinum-bright);}'
      + '.vip-note{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--platinum);}'
      /* collapse handle + re-open tab */
      + '.vip-collapse{position:absolute;left:50%;bottom:-12px;transform:translateX(-50%);width:30px;height:22px;'
      +   'display:flex;align-items:center;justify-content:center;background:#07090d;border:1px solid var(--line);'
      +   'border-top:none;border-radius:0 0 5px 5px;cursor:pointer;color:var(--platinum-deep);'
      +   'transition:color .35s var(--ease);padding:0;}'
      + '.vip-collapse:hover{color:var(--platinum-bright);}'
      + '.vip-collapse svg{width:13px;height:13px;stroke:currentColor;stroke-width:1.6;fill:none;}'
      + '.vip-reopen{position:fixed;top:var(--cookie-h,0px);left:50%;transform:translateX(-50%);z-index:94;display:none;'
      +   'align-items:center;gap:8px;background:#07090d;border:1px solid var(--line);border-top:none;'
      +   'border-radius:0 0 5px 5px;padding:8px 13px;cursor:pointer;font-family:var(--mono);font-size:10px;'
      +   'letter-spacing:.2em;text-transform:uppercase;color:var(--fg-dim);'
      +   'transition:color .35s var(--ease),border-color .35s var(--ease);}'
      + '.vip-reopen.show{display:inline-flex;}'
      + '.vip-reopen:hover{color:var(--platinum-bright);border-color:var(--platinum-deep);}'
      + '.vip-reopen .vip-dot{width:5px;height:5px;}'
      + '.vip-reopen svg{width:11px;height:11px;stroke:currentColor;stroke-width:1.6;fill:none;}'
      /* full-page lock */
      + '.vip-lock{min-height:78vh;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      +   'text-align:center;gap:clamp(14px,2.2vh,22px);padding:clamp(120px,18vh,200px) var(--pad) clamp(70px,10vh,110px);}'
      + '.vip-lock-mark{width:34px;height:34px;border:1px solid var(--line);border-radius:50%;display:flex;'
      +   'align-items:center;justify-content:center;margin-bottom:6px;}'
      + '.vip-lock-mark::before{content:"";width:11px;height:9px;border:1.5px solid var(--platinum);border-bottom:none;'
      +   'border-radius:6px 6px 0 0;}'
      + '.vip-lock-mark::after{content:"";position:absolute;width:18px;height:14px;border:1px solid var(--platinum-deep);'
      +   'border-radius:2px;margin-top:11px;}'
      + '.vip-lock-eyebrow{font-family:var(--mono);font-size:clamp(10px,1vw,12px);letter-spacing:.36em;'
      +   'text-transform:uppercase;color:var(--platinum-deep);}'
      + '.vip-lock-title{font-weight:300;font-size:clamp(2.2rem,7vw,4.6rem);letter-spacing:.12em;line-height:1;}'
      + '.vip-lock-body{max-width:46ch;font-weight:300;font-size:clamp(.98rem,1.7vw,1.18rem);line-height:1.65;'
      +   'color:var(--fg-dim);text-wrap:pretty;margin-top:6px;}'
      + '.vip-lock-actions{display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:clamp(14px,2.4vh,26px);}'
      + '.vip-lock-btn{display:inline-block;background:var(--fg);color:#000;border:1px solid var(--fg);'
      +   'font-family:var(--mono);font-size:12px;letter-spacing:.24em;text-transform:uppercase;padding:15px 40px;'
      +   'transition:background .4s var(--ease),color .4s var(--ease);}'
      + '.vip-lock-btn:hover{background:transparent;color:var(--fg);}'
      + '.vip-lock-home{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--mute);}'
      + '.vip-lock-home:hover{color:var(--platinum-bright);}'
      /* team lock (inline) */
      + '.vip-team-lock{border:1px solid var(--line);padding:clamp(28px,4vw,48px);text-align:center;'
      +   'display:flex;flex-direction:column;align-items:center;gap:14px;margin:clamp(28px,4vh,46px) 0;'
      +   'background:linear-gradient(180deg,#070809,#050506);}'
      + '.vip-team-lock .vip-lock-title{font-size:clamp(1.4rem,3.4vw,2.2rem);letter-spacing:.04em;}'
      + '.vip-team-lock .vip-lock-body{font-size:clamp(.92rem,1.5vw,1.05rem);}'
      + '@media (max-width:620px){.vip-banner-inner{gap:8px 12px;}.vip-actions{width:100%;}}';
    var st = document.createElement('style');
    st.id = 'vip-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function measureBanner(b) {
    document.documentElement.style.setProperty('--vip-h', b.offsetHeight + 'px');
  }
  // Reveal reliably (don't depend on rAF, which throttles in hidden/preview frames);
  // a forced reflow before adding .show keeps the slide-in transition when visible.
  function revealBanner(b) {
    void b.offsetHeight;
    b.classList.add('show');
    measureBanner(b);
  }
  // On resize, only reserve space when the banner is actually shown; when it's
  // collapsed, keep --vip-h at 0 so no empty black strip appears.
  function syncBannerHeight(b) {
    if (b.classList.contains('show')) measureBanner(b);
    else document.documentElement.style.setProperty('--vip-h', '0px');
  }

  // Collapse handle on the banner + a small re-open tab when hidden.
  // No persistence — the banner shows open on every page load; closing is manual.
  function wireToggle(b, exp, label) {
    var close = document.createElement('button');
    close.className = 'vip-collapse';
    close.type = 'button';
    close.setAttribute('aria-label', 'Hide access banner');
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
    b.appendChild(close);

    var tab = document.createElement('button');
    tab.className = 'vip-reopen' + (exp ? ' exp' : '');
    tab.type = 'button';
    tab.setAttribute('aria-label', 'Show access banner');
    tab.innerHTML = '<span class="vip-dot' + (exp ? ' exp' : '') + '" aria-hidden="true"></span>' + (label || 'VIP')
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    document.body.appendChild(tab);

    close.addEventListener('click', function () {
      b.classList.remove('show');
      document.documentElement.style.setProperty('--vip-h', '0px');
      tab.classList.add('show');
    });
    tab.addEventListener('click', function () {
      tab.classList.remove('show');
      b.classList.add('show');
      measureBanner(b);
    });
  }

  /* ---- i18n helpers for the application banner/messages ---- */
  function T(key, fallback) {
    try { var v = window.MinervaI18n && window.MinervaI18n.t(key, window.MinervaI18n.lang); return (v != null) ? v : fallback; }
    catch (e) { return fallback; }
  }
  var LOCALES = { en: 'en-GB', nl: 'nl-NL', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', es: 'es-ES', zh: 'zh-CN', ja: 'ja-JP' };
  function fmtDateLoc(ds) {
    if (!ds) return '';
    var p = String(ds).split('-'); if (p.length < 3) return fmtDate(ds);
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var lang = (window.MinervaI18n && window.MinervaI18n.lang) || 'en';
    try { return d.toLocaleDateString(LOCALES[lang] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return fmtDate(ds); }
  }
  function clearBanner() {
    var b = document.querySelector('.vip-banner'); if (b) b.parentNode.removeChild(b);
    var t = document.querySelector('.vip-reopen'); if (t) t.parentNode.removeChild(t);
    document.body.classList.remove('has-vip');
    document.documentElement.style.setProperty('--vip-h', '0px');
  }
  // (Re)render the access banner for the current language / session state.
  function renderBanner() {
    clearBanner();
    if (isAdmin()) { showAdminBanner(); return; }
    if (isHeritage()) { showHeritageBanner(); return; }
    var vip = currentVip();
    if (vip) { showBanner(vip); return; }
    var exp = expiredVip();
    if (exp) showExpiredBanner(exp);
  }
  function showHeritageBanner() {
    if (document.querySelector('.vip-banner')) return;
    var pending = memberPending();
    var tk = memberTier() || 'admirer';
    var tierTxt = T('app.tier.' + tk, tk.charAt(0).toUpperCase() + tk.slice(1));
    var stateTxt = pending
      ? esc(T('app.member.review', 'Membership under review'))
      : ((_profile && _profile.membership_end)
          ? esc(T('app.member.renews', 'Member · renews')) + ' <strong>' + esc(fmtDateLoc(_profile.membership_end)) + '</strong>'
          : esc(T('app.member.active', 'Member in good standing')));
    var b = document.createElement('div');
    b.className = 'vip-banner';
    b.setAttribute('role', 'status');
    b.innerHTML = ''
      + '<div class="vip-banner-inner">'
      +   '<span class="vip-dot" aria-hidden="true"></span>'
      +   '<span class="vip-welcome">' + esc(T('app.vip.welcome', 'Welcome,')) + ' <strong>' + esc((_profile && _profile.name) || 'Member') + '</strong> <em style="font-style:normal;opacity:.7;">· ' + esc(tierTxt) + '</em></span>'
      +   '<span class="vip-valid">' + stateTxt + '</span>'
      +   '<span class="vip-actions">'
      +     '<a class="vip-act" href="portal.html">' + esc(T('app.member.portal', 'Heritage portal')) + '</a>'
      +     '<button class="vip-act ghost" data-vip-out type="button">' + esc(T('app.vip.signout', 'Sign out')) + '</button>'
      +   '</span>'
      + '</div>';
    document.body.appendChild(b);
    document.body.classList.add('has-vip');
    revealBanner(b);
    window.addEventListener('resize', function () { syncBannerHeight(b); }, { passive: true });
    wireToggle(b, false, 'Heritage');
    b.addEventListener('click', function (e) {
      if (e.target.closest('[data-vip-out]')) { signOutVip().then(function () { location.reload(); }); }
    });
  }
  // Re-render the banner when the visitor switches language.
  window.addEventListener('minervalang', function () {
    if (document.querySelector('.vip-banner') || document.querySelector('.vip-reopen')) renderBanner();
  });

  function showBanner(user) {
    if (document.querySelector('.vip-banner')) return;
    var validTxt, lapsing = '';
    if (user.endDate) {
      validTxt = esc(T('app.vip.validUntil', 'VIP access valid until')) + ' <strong>' + esc(fmtDateLoc(user.endDate)) + '</strong>';
      // flag if within 14 days of expiry
      var days = Math.ceil((new Date(user.endDate + 'T23:59:59') - Date.now()) / 86400000);
      if (days <= 14) lapsing = ' lapsing';
    } else {
      validTxt = '<strong>' + esc(T('app.vip.noExpiry', 'VIP access — no expiry')) + '</strong>';
    }
    var b = document.createElement('div');
    b.className = 'vip-banner';
    b.setAttribute('role', 'status');
    b.innerHTML = ''
      + '<div class="vip-banner-inner">'
      +   '<span class="vip-dot" aria-hidden="true"></span>'
      +   '<span class="vip-welcome">' + esc(T('app.vip.welcome', 'Welcome,')) + ' <strong>' + esc(user.name || 'Guest') + '</strong></span>'
      +   '<span class="vip-valid' + lapsing + '">' + validTxt + '</span>'
      +   '<span class="vip-actions">'
      +     (user.endDate ? '<button class="vip-act" data-vip-ext type="button">' + esc(T('app.vip.requestExt', 'Request extension')) + '</button>' : '')
      +     '<button class="vip-act ghost" data-vip-out type="button">' + esc(T('app.vip.signout', 'Sign out')) + '</button>'
      +   '</span>'
      + '</div>';
    document.body.appendChild(b);
    document.body.classList.add('has-vip');
    revealBanner(b);
    window.addEventListener('resize', function () { syncBannerHeight(b); }, { passive: true });
    wireToggle(b, false);

    b.addEventListener('click', function (e) {
      var ext = e.target.closest('[data-vip-ext]');
      var out = e.target.closest('[data-vip-out]');
      if (out) { signOutVip().then(function () { location.reload(); }); return; }
      if (ext) {
        store.requestExtension(user.id);
        var actions = b.querySelector('.vip-actions');
        actions.innerHTML = '<span class="vip-note">' + esc(T('app.vip.extRequested', 'Extension requested · the atelier will be in touch')) + '</span>'
          + '<button class="vip-act ghost" data-vip-out type="button">' + esc(T('app.vip.signout', 'Sign out')) + '</button>';
        measureBanner(b);
      }
    });
  }

  function showAdminBanner() {
    if (document.querySelector('.vip-banner')) return;
    var b = document.createElement('div');
    b.className = 'vip-banner';
    b.setAttribute('role', 'status');
    b.innerHTML = ''
      + '<div class="vip-banner-inner">'
      +   '<span class="vip-dot" aria-hidden="true"></span>'
      +   '<span class="vip-welcome">' + esc(T('app.vip.welcome', 'Welcome,')) + ' <strong>' + esc(T('app.vip.superadmin', 'Super-admin')) + '</strong></span>'
      +   '<span class="vip-valid">' + esc(T('app.vip.fullAccess', 'Full access — no time limitation')) + '</span>'
      +   '<span class="vip-actions">'
      +     '<a class="vip-act" href="admin.html">' + esc(T('app.vip.adminConsole', 'Admin console')) + '</a>'
      +     '<button class="vip-act ghost" data-vip-adminout type="button">' + esc(T('app.vip.signout', 'Sign out')) + '</button>'
      +   '</span>'
      + '</div>';
    document.body.appendChild(b);
    document.body.classList.add('has-vip');
    revealBanner(b);
    window.addEventListener('resize', function () { syncBannerHeight(b); }, { passive: true });
    wireToggle(b, false, 'Admin');
    b.addEventListener('click', function (e) {
      if (e.target.closest('[data-vip-adminout]')) { adminLogout().then(function () { location.reload(); }); }
    });
  }

  function showExpiredBanner(user) {
    if (document.querySelector('.vip-banner')) return;
    var on = user.endDate ? (esc(T('app.vip.lapsedOn', 'Access lapsed on')) + ' <strong>' + esc(fmtDateLoc(user.endDate)) + '</strong>') : esc(T('app.vip.lapsed', 'Access lapsed'));
    var b = document.createElement('div');
    b.className = 'vip-banner expired';
    b.setAttribute('role', 'status');
    b.innerHTML = ''
      + '<div class="vip-banner-inner">'
      +   '<span class="vip-dot exp" aria-hidden="true"></span>'
      +   '<span class="vip-welcome">' + esc(user.name || 'Guest') + ', <strong>' + esc(T('app.vip.expiredMsg', 'your VIP access has expired')) + '</strong></span>'
      +   '<span class="vip-valid lapsing">' + on + '</span>'
      +   '<span class="vip-actions">'
      +     '<button class="vip-act" data-vip-extend type="button">' + esc(T('app.vip.extendAccess', 'Extend access')) + '</button>'
      +     '<button class="vip-act ghost" data-vip-out type="button">' + esc(T('app.vip.signout', 'Sign out')) + '</button>'
      +   '</span>'
      + '</div>';
    document.body.appendChild(b);
    document.body.classList.add('has-vip');
    revealBanner(b);
    window.addEventListener('resize', function () { syncBannerHeight(b); }, { passive: true });
    wireToggle(b, true);

    b.addEventListener('click', function (e) {
      var extend = e.target.closest('[data-vip-extend]');
      var out = e.target.closest('[data-vip-out]');
      if (out) { signOutVip().then(function () { location.reload(); }); return; }
      if (extend) {
        store.requestExtension(user.id);
        var actions = b.querySelector('.vip-actions');
        actions.innerHTML = '<span class="vip-note">' + esc(T('app.vip.extRequested', 'Extension requested · the atelier will be in touch')) + '</span>'
          + '<button class="vip-act ghost" data-vip-out type="button">' + esc(T('app.vip.signout', 'Sign out')) + '</button>';
        measureBanner(b);
      }
    });
  }

  // Silent gating — no lock screen, no message, no redirect. The protected
  // content is simply not shown, so a visitor never learns it exists.
  function denyFullSilent() { document.documentElement.classList.add('vip-denied-full'); }
  function denyTeamSilent() { document.documentElement.classList.add('vip-denied-team'); }

  // Remove the VIP-only pages from the main menu for visitors without access,
  // then renumber the remaining items so the index stays sequential.
  function gateMenu() {
    var main = document.querySelector('.menu-main');
    if (!main) return;
    ['aegis.html', 'sovereign.html'].forEach(function (href) {
      var a = main.querySelector('a[href="' + href + '"]');
      if (a && a.parentNode) a.parentNode.removeChild(a);
    });
    [].forEach.call(main.querySelectorAll('.menu-item .mi-idx'), function (idx, i) {
      idx.textContent = (i + 1 < 10 ? '0' : '') + (i + 1);
    });
  }

  /* ---------------- protected content loader ----------------
     The real Aegis / Sovereign / Team markup is NOT in the static HTML —
     it lives in public.protected_content behind RLS. For an authed session
     that has access (VIP or admin), fetch the row and inject it into the
     page's shell container [data-protected="<key>"]. Anonymous / lapsed
     sessions get nothing back (RLS) and the shell stays empty — silent. */
  function loadProtected(key, container) {
    if (!sb || !container) return Promise.resolve(false);
    return sb.from('protected_content').select('body_html').eq('key', key).single()
      .then(function (res) {
        var row = res && res.data ? res.data : null;
        if (!row || !row.body_html) return false;
        container.innerHTML = row.body_html;
        rehydrateInjected(container);
        return true;
      })
      .catch(function () { return false; });
  }
  // Re-apply page behaviours to the freshly-injected nodes:
  //   - i18n: translate the inserted [data-i18n] / [data-i18n-html] elements.
  //   - <image-slot> custom elements upgrade themselves on insertion (their
  //     connectedCallback runs automatically), so nothing to do there.
  //   - the Sovereign/Aegis teaser is wired once by minerva.js at load, before
  //     this content existed; re-run that wiring via the exposed hook.
  function rehydrateInjected(container) {
    try { if (window.MinervaI18n) window.MinervaI18n.apply(window.MinervaI18n.lang); } catch (e) {}
    try { if (window.MinervaSovereign && window.MinervaSovereign.init) window.MinervaSovereign.init(); } catch (e) {}
    // Nudge any size-dependent layout (the reveal % is derived from element size).
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  // Map the current page -> its protected key + shell container.
  function fillProtectedForPage() {
    var key = null;
    if (file === 'aegis.html') key = 'aegis';
    else if (file === 'sovereign.html') key = 'sovereign';
    else if (file === 'about.html') key = 'team';
    if (!key) return;
    var container = document.querySelector('[data-protected="' + key + '"]');
    if (!container) return;
    loadProtected(key, container);
  }

  // Visitors without access: hide VIP-only menu items and silently drop any
  // protected content (no lock, no mention) so they don't know it exists.
  function finishGating(access) {
    var restrict = document.body ? document.body.getAttribute('data-vip-restrict') : null;
    if (!access) {
      gateMenu();
      if (restrict === 'team') denyTeamSilent();
      else if (restrict === 'full') denyFullSilent();
    }
  }

  /* ---------------- init (async — awaits the session) ---------------- */
  function init() {
    injectStyles();
    if (!sb) {
      // No client configured (placeholders unfilled): behave as anonymous —
      // remove the checking guard, gate menus, hide protected surfaces.
      document.documentElement.classList.remove('vip-checking');
      _ready = true;
      if (!SKIP) finishGating(false);
      markReady();
      return;
    }

    refreshSession().then(function () {
      document.documentElement.classList.remove('vip-checking');
      markReady();
      if (SKIP) return;

      var access = hasAccess();
      renderBanner();

      if (access) {
        // Authed with access: pull the private content into the page shell.
        fillProtectedForPage();
      } else {
        finishGating(false);
      }
    });

    // Keep the cache + banner in sync if auth state changes mid-session
    // (e.g. token refresh, sign-out in another tab).
    try {
      sb.auth.onAuthStateChange(function () {
        refreshSession().then(function () { if (!SKIP) renderBanner(); });
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
