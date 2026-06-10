/* ============================================================
   MINERVA — Admin console app (admin.html)
   Roles: super-admin (hard-coded) can create Admin + VIP users and
   sees all users; a created admin can create VIP users only and sees
   VIP users only. Drives Manage Users, the new-user form, the launch
   counters, and the per-user Audit Log.
   ============================================================ */
(function () {
  'use strict';
  var V;
  // Wait for the engine to load AND for the live Supabase session to resolve
  // (V.ready, provided by assets/vip.js) before booting -- the session getters
  // (isAdmin / isSuperAdmin / account) are only valid after that resolves.
  function ready(fn) {
    if (window.MinervaVIP) {
      V = window.MinervaVIP;
      if (typeof V.ready === 'function') { V.ready(fn); return; }
      return fn();
    }
    setTimeout(function () { ready(fn); }, 40);
  }

  var root = document.getElementById('admRoot');
  var pendingConcierge = null;   // question typed in the top bar, asked once the concierge opens
  var topBar = { hidden: false };   // sidebar shell is always visible; no-op for legacy calls
  var LAST_NEW = 'minerva_admin_lastnew';
  var LAST_USER = 'minerva_admin_lastuser';
  // Holds the most recently created user (incl. its one-time password) so the
  // confirmation screen can show it once. Never persisted; never retrievable later.
  var JUST_CREATED = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }
  var ADM_LANGS = [['en', 'English'], ['nl', 'Nederlands'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['es', 'Español'], ['zh', '中文'], ['ja', '日本語']];
  function ADM_LANG_OPTS(sel) { return ADM_LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === sel ? ' selected' : '') + '>' + l[1] + '</option>'; }).join(''); }

  /* Console UI language: the user's profile language IF the console is translated
     for it (en, fr) — otherwise English. The website + email language keep the
     user's full choice; only the admin-console chrome falls back. */
  var CONSOLE_LANGS = ['en', 'fr'];
  function consoleLang() {
    var a = V.account ? V.account() : null;
    var l = (a && a.lang) ? a.lang : (function () { try { return localStorage.getItem('minerva-lang') || 'en'; } catch (e) { return 'en'; } })();
    return CONSOLE_LANGS.indexOf(l) >= 0 ? l : 'en';
  }
  var AT = {
    'Dashboard': { fr: 'Tableau de bord' }, 'Users': { fr: 'Utilisateurs' }, 'All users': { fr: 'Tous les utilisateurs' },
    'New user': { fr: 'Nouvel utilisateur' }, 'Vehicles': { fr: 'Véhicules' }, 'Registered vehicles': { fr: 'Véhicules immatriculés' },
    'Vehicle models': { fr: 'Modèles de véhicules' }, 'Certificates': { fr: 'Certificats' }, 'Web Statistics': { fr: 'Statistiques web' },
    'Counters': { fr: 'Compteurs' }, 'Audit Logs': { fr: "Journaux d'audit" }, 'Settings': { fr: 'Paramètres' }, 'Help': { fr: 'Aide' },
    'Profile': { fr: 'Profil' }, 'Help & Support': { fr: 'Aide et assistance' }, 'Sign out': { fr: 'Se déconnecter' },
    'Administration': { fr: 'Administration' }, 'User Management': { fr: 'Gestion des utilisateurs' },
    'Super-admin': { fr: 'Super-administrateur' }, 'Admin': { fr: 'Administrateur' },
    'New record': { fr: 'Nouvel enregistrement' }, 'Save record': { fr: "Enregistrer" }, 'Cancel': { fr: 'Annuler' },
    'Show': { fr: 'Afficher' }, 'records': { fr: 'enregistrements' }, 'Prev': { fr: 'Préc.' }, 'Next': { fr: 'Suiv.' },
    'Notifications': { fr: 'Notifications' }, 'Mark all read': { fr: 'Tout marquer comme lu' },
    'Search users, vehicles, certificates…': { fr: 'Rechercher utilisateurs, véhicules, certificats…' }
  };
  function T(s) { var cl = consoleLang(); return (cl === 'fr' && AT[s] && AT[s].fr) ? AT[s].fr : s; }
  // Translate the static topbar chrome (account menu, search, bell) to the console language.
  function applyConsoleLang() {
    var map = [['#admProfileLink', 'Profile'], ['#admHelpLink', 'Minerva Concierge'], ['#admSignout', 'Sign out'], ['#admBellClear', 'Mark all read']];
    map.forEach(function (m) {
      var el = document.querySelector(m[0]); if (!el) return;
      var svg = el.querySelector('svg'); var txt = T(m[1]);
      el.textContent = ''; if (svg) el.appendChild(svg); el.appendChild(document.createTextNode(txt));
    });
    var si = document.getElementById('admSearchInput'); if (si) si.placeholder = T('Ask the Minerva concierge…');
    var bh = document.querySelector('.bell-head span'); if (bh) bh.textContent = T('Notifications');
    var lbl = document.getElementById('admLbl'); if (lbl) lbl.textContent = T(V.isSuperAdmin() ? 'Administration' : 'User Management');
  }
  function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function toLogin() { location.href = 'login.html'; }

  /* ---- date helpers for the friendly picker ---- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(base, n) { var d = new Date(base); d.setDate(d.getDate() + n); return d; }
  function addMonths(base, n) { var d = new Date(base); d.setMonth(d.getMonth() + n); return d; }
  function daysBetween(aIso, bIso) { return Math.round((new Date(aIso + 'T00:00:00') - new Date(bIso + 'T00:00:00')) / 86400000); }
  function fmtDur(ms) {
    if (!ms) return '\u2014';
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + 'm ' + (r < 10 ? '0' : '') + r + 's';
    var h = Math.floor(m / 60); return h + 'h ' + (m % 60) + 'm';
  }

  /* ---------------- MENU / HOME ---------------- */
  var FAQ = [
    ['How do I add a new user?', 'Open <code>Manage Users</code> and press <code>New user</code> (top right). Enter their name and email. As super-admin you choose the type — <code>VIP</code> (time-limited guest access) or <code>Admin</code> (a manager who never expires). The system generates a unique password and sends an email invitation.'],
    ['What is the difference between VIP and Admin?', '<code>VIP</code> users get time-limited access to the private pages and always carry an end date. <code>Admin</code> users manage the console, can create VIP users, and never expire. Only the super-admin can create Admin users.'],
    ['Why must the VIP end date be filled in?', 'VIP access is always time-bound. The picker pre-selects one week ahead, allows up to three months, and cannot be left blank — so no guest is ever created with open-ended access by mistake. Use <code>Extend access</code> on their profile to renew.'],
    ['Can I extend or renew access?', 'Yes. Open <code>Manage Users</code>, click a name, enter a new date under <code>Extend access</code> and press <code>Execute</code>. It also re-grants access to a cancelled user.'],
    ['What is the Audit Log?', 'Every account keeps a dated trail — created, invitation sent, logins, login errors, website visits, access extended and cancelled. The log is retained even after access is cancelled, for future reference.'],
    ['What are the launch counters?', 'The Aegis and Sovereign counters track confirmed commissions against a target date. Adjust the count with the +/− controls and edit the target date inline. Visible to admins only.'],
    ['Is this data secure?', 'This is a front-end prototype — users, passwords and sessions live in this browser only. Before going live, connect the Supabase backend described in the handoff for real authentication, encrypted storage and email delivery.']
  ];

  function renderMenu() {
    topBar.hidden = false;
    var sup = V.isSuperAdmin();
    document.getElementById('admLbl').textContent = sup ? 'Administration' : 'User Management';


    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Admin Home">'
      +   ''
      +   '<p class="adm-sub">Manage privileged access to Minerva\u2019s private pages \u2014 provision users, set how long VIP access lasts, and review each account\u2019s audit trail.</p>'
      +   '<div class="adm-menu">'
      +     '<div class="adm-card" data-go="#dashboard"><span class="num">01</span><span class="title">Dashboard</span>'
      +       '<span class="desc">Traffic and membership at a glance \u2014 visits by audience, time on site and the most-visited pages.</span></div>'
      +     '<div class="adm-card" data-go="#users"><span class="num">02</span><span class="title">Users</span>'
      +       '<span class="desc">Review every account, add a new user, and open any profile to extend or cancel access.</span></div>'
      +     '<div class="adm-card" data-go="#stats"><span class="num">03</span><span class="title">Web Statistics</span>'
      +       '<span class="desc">Traffic analytics — visits, time on site, audience, devices, locations and the most-visited pages.</span></div>'
      +     '<div class="adm-card" data-go="#vehicles"><span class="num">04</span><span class="title">Vehicles</span>'
      +       '<span class="desc">The vehicle register, models catalogue and certificates of authenticity, with search.</span></div>'
      +     '<div class="adm-card" data-go="#audit"><span class="num">05</span><span class="title">Audit Logs</span>'
      +       '<span class="desc">The full event trail across all accounts \u2014 filter by event type, user and period.</span></div>'
      +     '<div class="adm-card" data-go="#counters"><span class="num">06</span><span class="title">Counters</span>'
      +       '<span class="desc">Launch counters \u2014 confirmed Aegis &amp; Sovereign commissions against their target dates.</span></div>'
      +     '<div class="adm-card" data-go="#faq"><span class="num">07</span><span class="title">FAQ</span>'
      +       '<span class="desc">Answers to common questions about users, access, the audit log and counters.</span></div>'
      +   '</div>'
      + '</div>';

    [].forEach.call(root.querySelectorAll('[data-go]'), function (c) {
      c.addEventListener('click', function () { location.hash = c.getAttribute('data-go'); render(); });
    });
  }

  /* ---------------- NEW USER ---------------- */
  function renderNew() {
    topBar.hidden = false;
    var sup = V.isSuperAdmin();
    var today = iso(new Date());
    var minDate = iso(addDays(new Date(), 1));
    var maxDate = iso(addMonths(new Date(), 3));
    var defDate = iso(addDays(new Date(), 7));

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="New User">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#users">Manage Users</a><span class="cr-sep">›</span><span class="cr-here">New user</span></p>'
      +   '<p class="adm-sub">The system generates a unique password and sends an email invitation. ' + (sup ? 'Choose the account type below.' : 'New accounts are VIP guests with time-limited access.') + '</p>'
      +   '<form class="adm-form" id="newForm" autocomplete="off" onsubmit="return false;">'
      // Phase 1: the backend provisions VIP guests only. The Admin account type
      // is intentionally hidden/disabled until admin provisioning is wired.
      +     (sup
          ? '<div class="ff"><label>Account type</label><div class="seg" id="segType">'
            + '<button type="button" data-type="vip" class="on">VIP guest</button>'
            + '<button type="button" data-type="admin">Admin</button>'
            + '<button type="button" data-type="heritage">Heritage</button></div>'
            + '<span class="field-hint" id="typeHint">VIP \u2014 time-limited access to the private pages.</span></div>'
          : '<input type="hidden" id="fixedType" value="vip">')
      +     '<div class="ff"><label for="nName">Full name</label><div class="ff-input"><input id="nName" type="text" placeholder="e.g. Alexandra Verhoeven"></div></div>'
      +     '<div class="ff"><label for="nEmail">Email address</label><div class="ff-input"><input id="nEmail" type="email" placeholder="e.g. guest@example.com"></div></div>'
      +     '<div class="ff"><label for="nLang">Language</label><div class="ff-input"><select id="nLang" class="ff-select">' + ADM_LANG_OPTS('en') + '</select></div>'
      +       '<span class="field-hint">The invitation email and the user\u2019s sign-in link are sent in this language.</span></div>'
      +     '<div class="ff" id="tierBlock" style="display:none;"><label for="nTier">Heritage tier</label><div class="ff-input"><select id="nTier" class="ff-select"><option value="admirer">Admirer</option><option value="custodian">Custodian</option><option value="commissioner">Commissioner</option></select></div>'
      +       '<span class="field-hint">Owner tiers (Custodian / Commissioner) require a VIN. Created members are active for 12 months.</span></div>'
      +     '<div class="ff" id="vinBlock" style="display:none;"><label for="nVin">Vehicle VIN</label><div class="ff-input"><input id="nVin" type="text" placeholder="The VIN of their Minerva"></div></div>'
      +     '<div class="ff" id="dateBlock">'
      +       '<label for="nEnd">Access valid until</label>'
      +       '<div class="ff-input"><input id="nEnd" type="date" value="' + defDate + '" min="' + minDate + '" max="' + maxDate + '"></div>'
      +       '<div class="dp-quick">'
      +         '<button type="button" class="dp-chip" data-add="7">+ 1 week</button>'
      +         '<button type="button" class="dp-chip" data-add="30">+ 1 month</button>'
      +         '<button type="button" class="dp-chip" data-add="90">+ 3 months</button>'
      +       '</div>'
      +       '<div class="dp-readout" id="dpRead"></div>'
      +       '<span class="field-hint">Required \u00b7 from tomorrow up to three months ahead. Pre-set to one week.</span>'
      +     '</div>'
      +     '<p class="adm-err" id="nErr"></p>'
      +     '<button class="btn btn-block" type="submit" id="nBtn">Create user &amp; send invitation</button>'
      +   '</form>'
      + '</div>';
    bindBack('#users');

    var type = 'vip';
    var dateBlock = document.getElementById('dateBlock');
    var endEl = document.getElementById('nEnd');
    var readEl = document.getElementById('dpRead');

    function refreshReadout() {
      var v = endEl.value;
      if (!v) { readEl.innerHTML = ''; return; }
      var rel = daysBetween(v, today);
      readEl.innerHTML = '<b>' + esc(V.fmtDate(v)) + '</b><span class="rel">in ' + rel + ' day' + (rel === 1 ? '' : 's') + '</span>';
    }
    function clampDate() {
      if (!endEl.value) return;
      if (endEl.value < minDate) endEl.value = minDate;
      if (endEl.value > maxDate) endEl.value = maxDate;
    }
    refreshReadout();
    endEl.addEventListener('change', function () { clampDate(); refreshReadout(); });
    [].forEach.call(root.querySelectorAll('.dp-chip'), function (chip) {
      chip.addEventListener('click', function () {
        endEl.value = iso(addDays(new Date(), +chip.getAttribute('data-add')));
        clampDate(); refreshReadout();
        [].forEach.call(root.querySelectorAll('.dp-chip'), function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
      });
    });

    var tierBlock = document.getElementById('tierBlock');
    var vinBlock = document.getElementById('vinBlock');
    var tierSel = document.getElementById('nTier');
    function syncVin() {
      var t = tierSel ? tierSel.value : 'admirer';
      if (vinBlock) vinBlock.style.display = (type === 'heritage' && t !== 'admirer') ? '' : 'none';
    }
    if (tierSel) tierSel.addEventListener('change', syncVin);
    if (sup) {
      var seg = document.getElementById('segType');
      var hint = document.getElementById('typeHint');
      [].forEach.call(seg.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          type = b.getAttribute('data-type');
          [].forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          var isVip = type === 'vip', isHeritage = type === 'heritage';
          dateBlock.style.display = isVip ? '' : 'none';
          if (tierBlock) tierBlock.style.display = isHeritage ? '' : 'none';
          syncVin();
          hint.textContent = isVip ? 'VIP \u2014 time-limited access to the private pages.'
            : isHeritage ? 'Heritage \u2014 a member account (Admirer / Custodian / Commissioner), active 12 months.'
            : 'Admin \u2014 full console access, never expires.';
        });
      });
    }

    function go() {
      var err = document.getElementById('nErr');
      err.textContent = '';
      var role = sup ? type : 'vip';
      var name = document.getElementById('nName').value.trim();
      var email = document.getElementById('nEmail').value.trim();
      if (!name) { err.textContent = 'Enter a full name'; return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email address'; return; }
      var end = null, tier = null, vin = null;
      if (role === 'vip') {
        end = endEl.value;
        if (!end) { err.textContent = 'Choose an access end date'; return; }
        if (end < minDate || end > maxDate) { err.textContent = 'End date must be within the next three months'; return; }
      } else if (role === 'heritage') {
        tier = document.getElementById('nTier').value;
        if (tier !== 'admirer') { vin = (document.getElementById('nVin').value || '').trim(); if (!vin) { err.textContent = 'Enter the vehicle VIN for an owner tier'; return; } }
      }
      var btn = document.getElementById('nBtn');
      if (btn) btn.disabled = true;
      // Async, Supabase-backed: duplicate check (cache) then create (provisions
      // the auth user + profile and sends the invitation email).
      Promise.resolve(V.store.findByEmail(email)).then(function (existing) {
        if (existing) { err.textContent = 'A user with this email already exists'; if (btn) btn.disabled = false; return; }
        return Promise.resolve(V.store.create(name, email, end, role, document.getElementById('nLang').value, tier, vin)).then(function (u) {
          V.logActivity('user-created', name);
          // The created user carries the one-time password (returned only at
          // creation time, never retrievable later) for the confirmation screen.
          JUST_CREATED = u;
          ssSet(LAST_NEW, u.id);
          location.hash = '#created'; render();
        });
      }).catch(function (e) {
        err.textContent = (e && e.message === 'email-taken') ? 'A user with this email already exists'
          : (e && e.message === 'super-only') ? 'Only the super-admin can create admin accounts'
          : 'Could not create the user. Please try again.';
        if (btn) btn.disabled = false;
      });
    }
    document.getElementById('newForm').addEventListener('submit', go);
    document.getElementById('nBtn').addEventListener('click', go);
  }

  /* ---------------- INVITATION SANDBOX ---------------- */
  function loginUrl() { return location.origin + location.pathname.replace(/admin\.html$/, 'login.html'); }
  function inviteLink(u) { return loginUrl() + '?invite=' + encodeURIComponent(u.id) + '&lang=' + encodeURIComponent(u.lang || 'en'); }

  function runInviteFlow(u, verb) {
    topBar.hidden = false;
    V.store.markInviteSent(u.id);
    var ov = document.createElement('div');
    ov.className = 'reg-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Minerva Sandbox');
    ov.innerHTML = ''
      + '<div class="ro-stage"><span class="ro-ring" aria-hidden="true"></span>'
      +   '<img class="ro-logo" src="uploads/minerva-logo-black.png" alt="Minerva"></div>'
      + '<div class="ro-msg"><p class="ro-thanks">Email invitation ' + (verb || 'sent') + '.<span class="ro-motto">' + esc(u.email) + '</span></p>'
      +   '<p class="ro-redirect">Returning you to the console\u2026</p></div>';
    document.body.appendChild(ov);
    document.body.classList.add('menu-open');
    ov.classList.add('show');
    requestAnimationFrame(function () { ov.classList.add('show'); });
    var stage = ov.querySelector('.ro-stage'), msg = ov.querySelector('.ro-msg');
    setTimeout(function () { stage.classList.add('hide'); msg.classList.add('show'); }, 2600);
    setTimeout(function () {
      ov.classList.remove('show'); document.body.classList.remove('menu-open');
      setTimeout(function () { ov.remove(); }, 600);
      location.hash = '#users'; render();
    }, 5000);

    // Use the user object we were handed (no re-fetch). The one-time password is
    // only present on a freshly-created user and cannot be read back from the
    // backend, so a resend simply omits the password row.
    var u2 = u;
    var pw = u2.pw || u2.password || null;
    var pwRow = pw
      ? '<div class="cred-row"><span class="k">One-time password</span><span class="v pw">' + esc(pw) + '</span></div>'
      : '<div class="cred-row"><span class="k">One-time password</span><span class="v">Delivered by email</span></div>';
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Invitation Sent">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#users">Manage Users</a><span class="cr-sep">›</span><span class="cr-here">Invitation ' + esc(verb || 'sent') + '</span></p>'
      +   '<p class="adm-sub">An email invitation has been sent to ' + esc(u2.email) + ' with a sign-in link and a one-time password.</p>'
      +   '<div class="cred-card">'
      +     '<div class="cred-row"><span class="k">Account type</span><span class="v">' + (u2.role === 'admin' ? 'Admin' : 'VIP guest') + '</span></div>'
      +     '<div class="cred-row"><span class="k">Name</span><span class="v">' + esc(u2.name) + '</span></div>'
      +     '<div class="cred-row"><span class="k">Email</span><span class="v">' + esc(u2.email) + '</span></div>'
      +     pwRow
      +     '<div class="cred-row"><span class="k">Access valid until</span><span class="v">' + (u2.endDate ? esc(V.fmtDate(u2.endDate)) : 'No expiry (admin)') + '</span></div>'
      +     '<p class="cred-deliver">Sign-in link \u00b7 <a href="' + esc(inviteLink(u2)) + '">' + esc(inviteLink(u2)) + '</a></p>'
      +   '</div>'
      + '</div>';
    bindBack('#users');
  }
  function renderCreated() {
    // Prefer the just-created user (it carries the one-time password the backend
    // never returns again); fall back to the cached record for a resend.
    var lastId = ss(LAST_NEW);
    var u = (JUST_CREATED && JUST_CREATED.id === lastId) ? JUST_CREATED : V.store.get(lastId);
    JUST_CREATED = null;
    if (!u) { location.hash = '#users'; render(); return; }
    runInviteFlow(u, 'sent');
  }

  /* ---------------- MANAGE USERS LIST ---------------- */
  var pageSize = (function(){ try { var n = parseInt(localStorage.getItem('minerva_admin_pagesize'),10); return [10,20,50].indexOf(n)>=0 ? n : 20; } catch(e){ return 20; } })();
  function setPageSize(n){ pageSize = n; try{ localStorage.setItem('minerva_admin_pagesize', String(n)); }catch(e){} }
  function sizeSelect(){ return '<div class="page-size"><label>Show</label><select class="pagesize-sel">' + [10,20,50].map(function(n){ return '<option value="'+n+'"'+(n===pageSize?' selected':'')+'>'+n+'</option>'; }).join('') + '</select><span>records</span></div>'; }
  var usersPage = 1, vehPage = 1;
  // Always-visible pager: "← Prev  Page X of Y · N results  Next →"
  function pagerBlock(page, count, noun, prevId, nextId) {
    var totalPages = Math.max(1, Math.ceil(count / pageSize));
    return '<div class="au-pager">'
      + '<button type="button" class="au-pg" id="' + prevId + '"' + (page <= 1 ? ' disabled' : '') + '>\u2190 Prev</button>'
      + '<span class="au-pg-info">Page ' + page + ' of ' + totalPages + ' \u00b7 ' + count + ' ' + noun + (count === 1 ? '' : 's') + '</span>'
      + '<button type="button" class="au-pg" id="' + nextId + '"' + (page >= totalPages ? ' disabled' : '') + '>Next \u2192</button>'
      + '</div>' + sizeSelect();
  }
  /* ---------------- HERITAGE MEMBERS (review + decision) ---------------- */
  var TIER_LABEL = { admirer: 'Admirer', custodian: 'Custodian', commissioner: 'Commissioner' };
  function renderHeritage() {
    topBar.hidden = false;
    var members = (V.heritageMembers ? V.heritageMembers() : []);
    var pending = members.filter(function (m) { return m.status === 'pending'; });
    var active = members.filter(function (m) { return m.status === 'active'; });
    var other = members.filter(function (m) { return m.status !== 'pending' && m.status !== 'active'; });

    function chip(status) {
      var c = status === 'active' ? '#3fb27f' : status === 'pending' ? '#c2a15a' : status === 'denied' ? '#c0556a' : '#8a8f98';
      return '<span style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:' + c + ';border:1px solid ' + c + '55;padding:3px 8px;">' + esc(status || '—') + '</span>';
    }
    function memberCard(m) {
      var actions;
      if (m.status === 'pending') {
        var tierSel = '<select class="ff-select hm-tier" style="flex:0 0 auto;">'
          + ['admirer', 'custodian', 'commissioner'].map(function (t) { return '<option value="' + t + '"' + (m.tier === t ? ' selected' : '') + '>' + TIER_LABEL[t] + '</option>'; }).join('')
          + '</select>';
        actions = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px;">'
          + '<label style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-dim);">Confirm tier</label>'
          + '<div class="ff-input" style="flex:0 0 auto;padding:0 10px;">' + tierSel + '</div></div>'
          + '<textarea class="hm-comment" rows="2" placeholder="Optional note included in the decision email…" style="width:100%;margin-top:10px;background:#0a0b0d;border:1px solid var(--line);color:var(--fg);font-family:var(--sans);font-size:14px;padding:10px;box-sizing:border-box;"></textarea>'
          + '<div style="display:flex;gap:10px;margin-top:10px;">'
          + '<button class="btn hm-accept" type="button" data-id="' + esc(m.id) + '">Accept</button>'
          + '<button class="btn-cancel hm-deny" type="button" data-id="' + esc(m.id) + '" style="border-color:#c0556a;color:#c0556a;">Deny</button></div>';
      } else if (m.status === 'active') {
        actions = '<div style="margin-top:12px;"><button class="btn-cancel hm-renew" type="button" data-id="' + esc(m.id) + '" style="border-color:var(--line);color:var(--fg-dim);">Renew 12 months</button></div>';
      } else { actions = ''; }
      return '<div class="hm-card" data-id="' + esc(m.id) + '" style="border:1px solid var(--line);padding:16px;margin-bottom:12px;background:linear-gradient(180deg,#070809,#050506);">'
        + '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;">'
        +   '<div><strong style="font-size:15px;">' + esc(m.name || '—') + '</strong> <span style="color:var(--fg-dim);font-size:13px;">' + esc(m.email) + '</span></div>'
        +   '<div style="display:flex;gap:8px;align-items:center;">' + chip(m.status) + '<span style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--platinum-deep);">' + esc(TIER_LABEL[m.tier] || m.tier || '') + '</span></div></div>'
        + (m.vin ? '<p style="color:var(--fg-dim);font-size:12px;margin:8px 0 0;font-family:var(--mono);letter-spacing:.08em;">VIN ' + esc(m.vin) + '</p>' : '')
        + (m.membership_end ? '<p style="color:var(--fg-dim);font-size:12px;margin:4px 0 0;">Renews ' + esc(V.fmtDate(m.membership_end)) + '</p>' : '')
        + actions
        + '<p class="hm-result" style="display:none;margin-top:10px;font-size:13px;color:#3fb27f;"></p></div>';
    }

    var body = '<p class="adm-section-h" style="margin:18px 0 10px;">Pending applications (' + pending.length + ')</p>'
      + (pending.length ? pending.map(memberCard).join('') : '<p class="adm-empty">No applications awaiting review.</p>')
      + '<p class="adm-section-h" style="margin:26px 0 10px;">Active members (' + active.length + ')</p>'
      + (active.length ? active.map(memberCard).join('') : '<p class="adm-empty">No active members yet.</p>')
      + (other.length ? '<p class="adm-section-h" style="margin:26px 0 10px;">Denied / lapsed</p>' + other.map(memberCard).join('') : '');

    root.innerHTML = '<div class="adm-wrap" data-screen-label="Heritage">'
      + '<p class="adm-crumb"><span class="cr-here">Heritage members</span></p>'
      + '<p class="adm-sub">Review applications, confirm the tier, and accept or deny. Accepting starts a 12-month membership and emails the applicant in their language.</p>'
      + body + '</div>';
    bindBack('#menu');

    function cardOf(b) { return b.closest('.hm-card'); }
    function lock(card, txt, ok) {
      [].forEach.call(card.querySelectorAll('button,select,textarea'), function (el) { el.disabled = true; });
      var r = card.querySelector('.hm-result'); if (r && txt) { r.style.display = 'block'; r.style.color = ok === false ? '#c0556a' : '#3fb27f'; r.textContent = txt; }
    }
    function unlock(card, msg) {
      [].forEach.call(card.querySelectorAll('button,select,textarea'), function (el) { el.disabled = false; });
      var r = card.querySelector('.hm-result'); if (r) { r.style.display = 'block'; r.style.color = '#c0556a'; r.textContent = msg || 'Could not complete. Try again.'; }
    }
    function wire(sel, run) { [].forEach.call(root.querySelectorAll(sel), function (b) { b.addEventListener('click', function () { run(b, cardOf(b)); }); }); }

    wire('.hm-accept', function (b, card) {
      var tier = card.querySelector('.hm-tier') ? card.querySelector('.hm-tier').value : null;
      var comment = card.querySelector('.hm-comment') ? card.querySelector('.hm-comment').value : '';
      lock(card, 'Accepting…');
      Promise.resolve(V.store.approveMember(b.getAttribute('data-id'), comment, tier)).then(function (res) {
        var sent = res && res.email ? (' · email sent: “' + res.email.subject + '”') : '';
        lock(card, 'Accepted — 12-month membership started' + sent);
        setTimeout(renderHeritage, 1500);
      }).catch(function (e) { unlock(card, (e && e.message) || 'Could not accept.'); });
    });
    wire('.hm-deny', function (b, card) {
      var comment = card.querySelector('.hm-comment') ? card.querySelector('.hm-comment').value : '';
      lock(card, 'Recording…');
      Promise.resolve(V.store.denyMember(b.getAttribute('data-id'), comment)).then(function () {
        lock(card, 'Denied — applicant notified by email.');
        setTimeout(renderHeritage, 1500);
      }).catch(function (e) { unlock(card, (e && e.message) || 'Could not deny.'); });
    });
    wire('.hm-renew', function (b, card) {
      lock(card, 'Renewing…');
      Promise.resolve(V.store.renewMember(b.getAttribute('data-id'))).then(function () {
        lock(card, 'Renewed for 12 months.');
        setTimeout(renderHeritage, 1500);
      }).catch(function (e) { unlock(card, (e && e.message) || 'Could not renew.'); });
    });
  }

  function renderUsers() {
    topBar.hidden = false;
    var sup = V.isSuperAdmin();
    var all = V.store.all().sort(function (a, b) { return a.no - b.no; });
    // Admins see VIP users only; super-admin sees everyone.
    var list = sup ? all : all.filter(function (u) { return (u.role || 'vip') !== 'admin'; });
    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (usersPage > totalPages) usersPage = totalPages;
    var pageList = list.slice((usersPage - 1) * pageSize, usersPage * pageSize);

    var cols = sup ? '34px 1.2fr 1.7fr 0.7fr 1fr 1.1fr' : '34px 1.3fr 1.9fr 1fr 1.1fr';
    var head = '<div class="adm-row head" style="--cols:' + cols + '">'
      + '<span class="c-no">\u2116</span><span class="c-name">Name</span><span class="c-email">Email</span>'
      + (sup ? '<span class="c-role">Role</span>' : '')
      + '<span class="c-end">End date</span><span class="c-login">Last login</span></div>';

    var rows;
    if (!list.length) {
      rows = '<p class="adm-empty">No users yet. Press \u201cNew user\u201d to add one.</p>';
    } else {
      rows = '<div class="adm-table">' + head
        + pageList.map(function (u) {
            var role = u.role || 'vip';
            var isSuperRow = String(u.email || '').toLowerCase() === 'admin@minervaluxurymotors.com';
            var roleLbl = isSuperRow ? 'Super admin' : (role === 'admin' ? 'Admin' : role === 'heritage' ? ('Heritage-' + (u.tier || 'admirer')) : 'VIP');
            var last = (u.logins && u.logins.length) ? V.fmtDateTime(u.logins[u.logins.length - 1]).split(' \u00b7 ')[0] : '\u2014';
            var endCls = role === 'admin' ? 'none' : (u.endDate ? (V.isExpired(u) ? 'exp' : '') : 'none');
            var endTxt = role === 'admin' ? 'No expiry' : (u.cancelled ? 'Cancelled' : (u.endDate ? (V.fmtDate(u.endDate) + (V.isExpired(u) ? ' \u00b7 expired' : '')) : 'No end date'));
            var flag = u.extReq ? ' \u2691' : '';
            return '<div class="adm-row" style="--cols:' + cols + '">'
              + '<span class="c-no">' + (u.no < 10 ? '0' : '') + u.no + '</span>'
              + '<span class="c-name"><a data-uid="' + esc(u.id) + '">' + esc(u.name) + flag + '</a></span>'
              + '<span class="c-email">' + esc(u.email) + '</span>'
              + (sup ? '<span class="c-role"><span class="role-chip ' + (isSuperRow || role === 'admin' ? 'admin' : 'vip') + '">' + roleLbl + '</span></span>' : '')
              + '<span class="c-end ' + endCls + '">' + esc(endTxt) + '</span>'
              + '<span class="c-login">' + esc(last) + '</span>'
              + '</div>';
          }).join('')
        + '</div>';
    }

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Manage Users">'
      +   '<div class="adm-listhead">'
      +     '<p class="adm-crumb"><span class="cr-here">Users</span></p>'
      +     '<button class="btn-new" id="newUserBtn" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New user</button>'
      +   '</div>'
      +   rows
      +   (list.length ? pagerBlock(usersPage, list.length, sup ? 'account' : 'guest', 'uPrev', 'uNext') : '')
      + '</div>';
    bindBack('#menu');
    document.getElementById('newUserBtn').addEventListener('click', function () { location.hash = '#new'; render(); });
    var up = document.getElementById('uPrev'); if (up) up.addEventListener('click', function () { if (usersPage > 1) { usersPage--; renderUsers(); } });
    var un = document.getElementById('uNext'); if (un) un.addEventListener('click', function () { usersPage++; renderUsers(); });
    [].forEach.call(root.querySelectorAll('[data-uid]'), function (a) {
      a.addEventListener('click', function () { ssSet(LAST_USER, a.getAttribute('data-uid')); location.hash = '#user'; render(); });
    });
  }

  /* ---------------- USER DETAIL + AUDIT LOG ---------------- */
  var EV_LABELS = {
    created: 'User created', invited: 'Invitation sent', 're-invited': 'Invitation sent',
    login: 'User login', 'login-error': 'User login error', extended: 'Access extended',
    restored: 'Access restored', extension: 'Access extension requested', cancelled: 'Access cancelled',
    visit: 'Website visit', 'password-changed': 'Password changed', 'password-reset': 'Password reset',
    'anon-visit': 'Website visit',
    'user-created': 'New user created', 'vehicle-created': 'New vehicle created', 'model-created': 'New model created', 'coa-created': 'New certificate created'
  };
  function renderUser() {
    topBar.hidden = false;
    var u = V.store.get(ss(LAST_USER));
    if (!u) { location.hash = '#users'; render(); return; }
    var role = u.role || 'vip';
    var isSuperRow = String(u.email || '').toLowerCase() === 'admin@minervaluxurymotors.com';
    var isAdminUser = role === 'admin';
    var expired = !isAdminUser && V.isExpired(u);
    var cancelled = !!u.cancelled;
    var statusTxt = cancelled ? 'Cancelled' : (isAdminUser ? 'Admin \u00b7 no expiry' : (!u.endDate ? 'Active \u00b7 no expiry' : (expired ? 'Expired' : 'Active')));
    var statusCls = (cancelled || expired) ? 'expired' : '';

    var extReqHtml = '';
    if (u.extReq) {
      extReqHtml = '<div class="adm-extreq"><b>\u2691 Extension requested</b> \u2014 on ' + esc(V.fmtDateTime(u.extReq.ts))
        + (u.extReq.from ? ' \u00b7 current end date ' + esc(V.fmtDate(u.extReq.from)) : ' \u00b7 no end date set')
        + '. Set a new date below to grant it.</div>';
    }

    var minDate = iso(addDays(new Date(), 1));
    var maxDate = iso(addMonths(new Date(), 3));

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="User Profile">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#users">Manage Users</a><span class="cr-sep">›</span><span class="cr-here">' + esc(u.name) + '</span></p>'
      +   '<div class="adm-detail-meta" style="margin-top:20px;">'
      +     '<span>Email <b>' + esc(u.email) + '</b></span>'
      +     '<span>Role <b>' + (isSuperRow ? 'Super admin' : role === 'admin' ? 'Admin' : role === 'heritage' ? ('Heritage-' + (u.tier || 'admirer')) : 'VIP') + '</b></span>'
      +     '<span class="adm-status ' + statusCls + '"><span class="pip"></span>' + statusTxt + '</span>'
      +     (isAdminUser ? '' : '<span>End date <b>' + (u.endDate ? esc(V.fmtDate(u.endDate)) : 'None') + '</b></span>')
      +   '</div>'
      +   extReqHtml
      +   '<p class="adm-section-h">Invitation</p>'
      +   '<div class="adm-detail-meta"><span>Invitation sent <b>' + (u.inviteSentAt ? esc(V.fmtDateTime(u.inviteSentAt)) : 'Not yet') + '</b></span></div>'
      +   '<div class="adm-extend"><button class="btn" type="button" id="resendBtn">Resend invitation</button></div>'
      +   (isAdminUser ? '' : (''
      +     '<p class="adm-section-h">Extend access</p>'
      +     (cancelled ? '<p class="field-hint" style="margin:-6px 0 12px;">Access is cancelled. Enter a future date and press Execute to grant access again.</p>' : '')
      +     '<form class="adm-extend" id="extForm" onsubmit="return false;">'
      +       '<div class="ff" style="flex:1;min-width:220px;"><label for="extDate">New end date</label>'
      +         '<div class="ff-input"><input id="extDate" type="date" value="' + (cancelled ? '' : (u.endDate || '')) + '" min="' + minDate + '" max="' + maxDate + '"></div>'
      +         '<div class="dp-quick"><button type="button" class="dp-chip" data-add="7">+ 1 week</button>'
      +           '<button type="button" class="dp-chip" data-add="30">+ 1 month</button>'
      +           '<button type="button" class="dp-chip" data-add="90">+ 3 months</button></div>'
      +         '<div class="dp-readout" id="extRead"></div></div>'
      +       '<button class="btn" type="submit" id="extBtn">Execute</button>'
      +     '</form>'
      +     '<p class="adm-okmsg" id="extMsg" style="margin-top:14px;"></p>'))
      +   ((V.isSuperAdmin && V.isSuperAdmin()) ? (''
      +     '<p class="adm-section-h">Change account type</p>'
      +     '<div class="ff"><label>New role</label><div class="seg" id="roleSeg">'
      +       '<button type="button" data-role="vip" class="on">VIP guest</button>'
      +       '<button type="button" data-role="admin">Admin</button>'
      +       '<button type="button" data-role="heritage">Heritage</button></div></div>'
      +     '<div class="ff" id="roleTierBlock" style="display:none;margin-top:14px;"><label>Heritage tier</label><div class="seg" id="roleTierSeg">'
      +       '<button type="button" data-tier="admirer" class="on">Admirer</button>'
      +       '<button type="button" data-tier="custodian">Custodian</button>'
      +       '<button type="button" data-tier="commissioner">Commissioner</button></div></div>'
      +     '<p class="field-hint" style="margin:10px 0;">VIP → 3-month access · Heritage → active 12-month member · Admin → full console access.</p>'
      +     '<div class="adm-extend"><button class="btn" type="button" id="roleBtn">Change role</button></div>'
      +     '<p class="adm-okmsg" id="roleMsg" style="margin-top:10px;"></p>') : '')
      +   '<p class="adm-section-h">' + (isAdminUser ? 'Remove admin' : 'Cancel access') + '</p>'
      +   (cancelled
           ? '<p class="adm-okmsg" style="color:var(--minerva-red-bright);">Access cancelled on ' + esc(V.fmtDateTime(u.cancelled)) + '</p>'
           : '<div class="adm-extend"><button class="btn-cancel" type="button" id="cancelBtn">' + (isAdminUser ? 'Revoke admin access' : 'Cancel access') + '</button></div>')
      + '</div>';
    bindBack('#users');

    document.getElementById('resendBtn').addEventListener('click', function () {
      ssSet(LAST_NEW, u.id); location.hash = '#created'; render();
    });
    var cancelEl = document.getElementById('cancelBtn');
    if (cancelEl) cancelEl.addEventListener('click', function () {
      if (confirm('Cancel access for ' + u.name + '? Their access is removed immediately and the action is recorded in the audit log (which is retained).')) {
        V.store.cancel(u.id); render();
      }
    });
    var f = document.getElementById('extForm');
    if (f) {
      var msg = document.getElementById('extMsg');
      var extDate = document.getElementById('extDate');
      var extRead = document.getElementById('extRead');
      var today = iso(new Date());
      function extReadout() {
        var v = extDate.value;
        if (!v) { extRead.innerHTML = ''; return; }
        var rel = daysBetween(v, today);
        extRead.innerHTML = '<b>' + esc(V.fmtDate(v)) + '</b><span class="rel">' + (rel >= 0 ? 'in ' + rel + ' day' + (rel === 1 ? '' : 's') : 'past') + '</span>';
      }
      extReadout();
      extDate.addEventListener('change', extReadout);
      [].forEach.call(f.querySelectorAll('.dp-chip'), function (chip) {
        chip.addEventListener('click', function () {
          extDate.value = iso(addDays(new Date(), +chip.getAttribute('data-add')));
          extReadout();
          [].forEach.call(f.querySelectorAll('.dp-chip'), function (c) { c.classList.remove('on'); });
          chip.classList.add('on');
        });
      });
      function go() {
        var d = document.getElementById('extDate').value || null;
        if (!d) { msg.style.color = 'var(--minerva-red-bright)'; msg.textContent = 'Choose an end date'; return; }
        if (d < minDate || d > maxDate) { msg.style.color = 'var(--minerva-red-bright)'; msg.textContent = 'Date must be within the next three months'; return; }
        V.store.extend(u.id, d);
        msg.style.color = '';
        msg.textContent = cancelled ? ('Access restored \u2014 valid until ' + V.fmtDate(d)) : ('Access extended to ' + V.fmtDate(d));
        setTimeout(function () { render(); }, 900);
      }
      f.addEventListener('submit', go);
      document.getElementById('extBtn').addEventListener('click', go);
    }

    var roleSeg = document.getElementById('roleSeg');
    if (roleSeg) {
      var roleTierBlock = document.getElementById('roleTierBlock');
      var roleTierSeg = document.getElementById('roleTierSeg');
      var roleMsg = document.getElementById('roleMsg');
      var roleBtn = document.getElementById('roleBtn');
      var newRole = (role === 'admin') ? 'admin' : 'vip';
      var newTier = 'admirer';
      [].forEach.call(roleSeg.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-role') === newRole); });
      function syncRoleTier() { roleTierBlock.style.display = (newRole === 'heritage') ? '' : 'none'; }
      syncRoleTier();
      [].forEach.call(roleSeg.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          newRole = b.getAttribute('data-role');
          [].forEach.call(roleSeg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
          b.classList.add('on'); syncRoleTier();
        });
      });
      if (roleTierSeg) [].forEach.call(roleTierSeg.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          newTier = b.getAttribute('data-tier');
          [].forEach.call(roleTierSeg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        });
      });
      function goRole() {
        if (newRole === 'admin' && !confirm('Grant full console access to ' + u.name + '? They will become an administrator.')) return;
        roleMsg.style.color = ''; roleMsg.textContent = 'Updating…'; if (roleBtn) roleBtn.disabled = true;
        Promise.resolve(V.store.setUserRole(u.id, newRole, newRole === 'heritage' ? newTier : null)).then(function () {
          if (V.logActivity) V.logActivity('role-changed', u.name + ' → ' + newRole);
          var ov = document.createElement('div');
          ov.className = 'reg-overlay';
          ov.innerHTML = '<div class="ro-stage"><span class="ro-ring" aria-hidden="true"></span><img class="ro-logo" src="uploads/minerva-logo-black.png" alt="Minerva"></div>';
          document.body.appendChild(ov);
          requestAnimationFrame(function () { ov.classList.add('show'); });
          setTimeout(function () { try { ov.remove(); } catch (e) {} location.hash = '#users'; render(); }, 1600);
        }).catch(function (e) {
          if (roleBtn) roleBtn.disabled = false;
          roleMsg.style.color = 'var(--minerva-red-bright)';
          roleMsg.textContent = (e && e.message === 'cannot-change-super') ? 'The super-admin account cannot be changed.'
            : (e && e.message === 'super-only') ? 'Only the super-admin can change account types.'
            : (e && e.message === 'cannot-change-self') ? 'You cannot change your own account.'
            : 'Could not change the account type. Please try again.';
        });
      }
      if (roleBtn) roleBtn.addEventListener('click', goRole);
    }
  }

  /* ---------------- AUDIT LOGS (dedicated page) ---------------- */
  var auditState = { types: [], users: [], period: 'all', page: 1, open: null };
  var PERIODS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']];
  var TYPE_FILTERS = [
    ['created', 'User created'], ['invited', 'Invitation sent'], ['login', 'User login'],
    ['login-error', 'Login error'], ['extended', 'Access extended'], ['cancelled', 'Access cancelled'],
    ['user-created', 'New user'], ['vehicle-created', 'New vehicle'], ['coa-created', 'New certificate'],
    ['visit', 'Website visit'], ['anon-visit', 'Visit (unregistered)']
  ];

  function periodStart(p) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    if (p === 'today') return d.getTime();
    if (p === 'week') { var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }
    if (p === 'month') { d.setDate(1); return d.getTime(); }
    return 0;
  }

  function renderAudit() {
    return renderComingSoon('Audit Logs', 'The full event trail across all accounts and visitors will appear here once activity logging is wired to the backend.');
    /* Phase 2: original implementation below (currently unreachable). */
    topBar.hidden = false;
    var all = V.auditEvents();
    // Created admins must not see admin-account activity in the audit log.
    if (!V.isSuperAdmin()) { all = all.filter(function (e) { return !(e.registered && e.role === 'admin'); }); }
    // 'invited' and 're-invited' both shown under "Invitation sent"
    function typeKey(t) { return t === 're-invited' ? 'invited' : (t === 'restored' ? 'extended' : (t === 'extension' ? 'extended' : t)); }

    // distinct users present in the stream (registered only) for the user filter
    var userMap = {};
    all.forEach(function (e) { if (e.registered) userMap[e.userId] = e.userName; });
    var userOpts = Object.keys(userMap).map(function (id) { return { id: id, name: userMap[id] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });

    function passes(e) {
      if (auditState.types.length && auditState.types.indexOf(typeKey(e.type)) < 0) return false;
      if (auditState.users.length) { if (!e.registered || auditState.users.indexOf(e.userId) < 0) return false; }
      if (auditState.period !== 'all' && e.ts < periodStart(auditState.period)) return false;
      return true;
    }
    var filtered = all.filter(passes);
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (auditState.page > totalPages) auditState.page = totalPages;
    var startI = (auditState.page - 1) * pageSize;
    var pageRows = filtered.slice(startI, startI + pageSize);

    // build dropdown option rows
    function ddPanel(items, key, emptyMsg) {
      if (!items.length) return '<div class="flt-empty" style="padding:11px 13px;">' + esc(emptyMsg || 'None') + '</div>';
      return items.map(function (o) {
        return '<div class="flt-opt' + (o.on ? ' on' : '') + '" data-' + key + '="' + esc(o.val) + '">'
          + '<span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>' + esc(o.label) + '</div>';
      }).join('');
    }
    var typeItems = TYPE_FILTERS.map(function (t) { return { val: t[0], label: t[1], on: auditState.types.indexOf(t[0]) >= 0 }; });
    var userItems = userOpts.map(function (u) { return { val: u.id, label: u.name, on: auditState.users.indexOf(u.id) >= 0 }; });
    var periodItems = PERIODS.map(function (p) { return { val: p[0], label: p[1], on: auditState.period === p[0] }; });
    var typeSummary = auditState.types.length ? (auditState.types.length + ' selected') : 'All events';
    var userSummary = auditState.users.length ? (auditState.users.length + ' selected') : 'All users';
    var periodSummary = (PERIODS.filter(function (p) { return p[0] === auditState.period; })[0] || PERIODS[3])[1];
    function dd(id, label, summary, panelHtml) {
      return '<div class="flt-group"><span class="flt-label">' + label + '</span>'
        + '<div class="flt-dd' + (auditState.open === id ? ' open' : '') + '" data-dd="' + id + '">'
        +   '<button type="button" class="flt-dd-btn" data-ddbtn="' + id + '"><span>' + esc(summary) + '</span><span class="caret">▾</span></button>'
        +   '<div class="flt-dd-panel">' + panelHtml + '</div>'
        + '</div></div>';
    }

    var rowsHtml = pageRows.length
      ? pageRows.map(function (e) {
          var cls = (e.type === 'cancelled') ? ' ev-cancelled' : (e.type === 'login-error' ? ' ev-error' : '');
          var who = e.registered
            ? '<span class="au-user">' + esc(e.userName) + '<span class="au-role">' + (e.role === 'admin' ? 'Admin' : 'VIP') + '</span></span>'
            : '<span class="au-user au-anon">Unregistered<span class="au-role">' + esc(e.device || 'Device') + '</span></span>';
          return '<div class="adm-row au-row" style="--cols:1.3fr 1.1fr 1fr">'
            + '<span class="au-ev' + cls + '">' + esc(EV_LABELS[e.type] || e.type) + '</span>'
            + who
            + '<span class="au-date">' + esc(V.fmtDateTime(e.ts)) + '</span></div>';
        }).join('')
      : '<p class="adm-empty">No events match these filters.</p>';

    // pager
    var pager = '';
    if (filtered.length) {
      pager = '<div class="au-pager">'
        + '<button type="button" class="au-pg" id="pgPrev"' + (auditState.page <= 1 ? ' disabled' : '') + '>\u2190 Prev</button>'
        + '<span class="au-pg-info">Page ' + auditState.page + ' of ' + totalPages + ' \u00b7 ' + filtered.length + ' event' + (filtered.length === 1 ? '' : 's') + '</span>'
        + '<button type="button" class="au-pg" id="pgNext"' + (auditState.page >= totalPages ? ' disabled' : '') + '>Next \u2192</button>'
        + '</div>' + sizeSelect();
    }

    var activeCount = auditState.types.length + auditState.users.length + (auditState.period !== 'all' ? 1 : 0);

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Audit Logs">'
      +   '<div class="adm-listhead"><p class="adm-crumb"><span class="cr-here">Audit Logs</span></p>'
      +     (activeCount ? '<button class="btn-new" id="clearFlt" type="button" style="background:transparent;color:var(--fg-dim);border-color:var(--line);">Clear filters (' + activeCount + ')</button>' : '')
      +   '</div>'
      +   '<p class="adm-sub">Every recorded event across all accounts and anonymous visitors. Prototype data \u2014 the full collection logic (IP / device fingerprint, unique-visitor counting) is specified for the backend.</p>'
      +   '<div class="au-filters"><div class="flt-row2">'
      +     dd('type', 'Event type', typeSummary, ddPanel(typeItems, 'type'))
      +     dd('user', 'User', userSummary, ddPanel(userItems, 'user', 'No registered users yet'))
      +     dd('period', 'Period', periodSummary, ddPanel(periodItems, 'period'))
      +   '</div></div>'
      +   '<div class="adm-table"><div class="adm-row head" style="--cols:1.3fr 1.1fr 1fr"><span>Event</span><span>User</span><span>Date &amp; time</span></div>'
      +     rowsHtml
      +   '</div>'
      +   pager
      + '</div>';
    bindBack('#menu');

    function toggle(arr, val) { var i = arr.indexOf(val); if (i < 0) arr.push(val); else arr.splice(i, 1); auditState.page = 1; renderAudit(); }
    [].forEach.call(root.querySelectorAll('[data-ddbtn]'), function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); var id = btn.getAttribute('data-ddbtn'); auditState.open = (auditState.open === id ? null : id); renderAudit(); });
    });
    [].forEach.call(root.querySelectorAll('.flt-opt[data-type]'), function (o) { o.addEventListener('click', function (e) { e.stopPropagation(); toggle(auditState.types, o.getAttribute('data-type')); }); });
    [].forEach.call(root.querySelectorAll('.flt-opt[data-user]'), function (o) { o.addEventListener('click', function (e) { e.stopPropagation(); toggle(auditState.users, o.getAttribute('data-user')); }); });
    [].forEach.call(root.querySelectorAll('.flt-opt[data-period]'), function (o) { o.addEventListener('click', function (e) { e.stopPropagation(); auditState.period = o.getAttribute('data-period'); auditState.open = null; auditState.page = 1; renderAudit(); }); });
    // close any open dropdown on an outside click
    if (auditState.open) {
      setTimeout(function () {
        document.addEventListener('click', function closer() { auditState.open = null; document.removeEventListener('click', closer); renderAudit(); }, { once: true });
      }, 0);
    }
    var clr = document.getElementById('clearFlt'); if (clr) clr.addEventListener('click', function () { auditState = { types: [], users: [], period: 'all', page: 1, open: null }; renderAudit(); });
    var prev = document.getElementById('pgPrev'); if (prev) prev.addEventListener('click', function () { if (auditState.page > 1) { auditState.page--; renderAudit(); } });
    var next = document.getElementById('pgNext'); if (next) next.addEventListener('click', function () { if (auditState.page < totalPages) { auditState.page++; renderAudit(); } });
  }

  /* ---------------- DASHBOARD ---------------- */
  var dashState = { period: 'last7', from: '', to: '', open: false };
  function dashRange() {
    if (dashState.period === 'custom' && (dashState.from || dashState.to)) {
      var f = dashState.from ? new Date(dashState.from + 'T00:00:00').getTime() : 0;
      var t = dashState.to ? new Date(dashState.to + 'T23:59:59').getTime() : Date.now() + 1;
      return [f, t];
    }
    if (dashState.period === 'last7') return [Date.now() - 7 * 86400000, Date.now() + 1];
    if (dashState.period === 'last30') return [Date.now() - 30 * 86400000, Date.now() + 1];
    return [0, Date.now() + 1]; // all
  }
  var DASH_PERIODS = [['last7', 'Last 7 days'], ['last30', 'Last 30 days'], ['all', 'All time'], ['custom', 'Custom range']];
  function dashSpanLabel(fromTs, toTs) {
    if (dashState.period !== 'custom' && dashState.period !== 'all') return '';   // only custom & all-time show a span
    if (!fromTs || fromTs <= 0) return '';
    var days = Math.max(1, Math.round((toTs - fromTs) / 86400000));
    var months = Math.floor(days / 30), rem = days % 30;
    var parts = [];
    if (months) parts.push(months + ' month' + (months === 1 ? '' : 's'));
    if (rem || !months) parts.push(rem + ' day' + (rem === 1 ? '' : 's'));
    return ' <span class="dash-span">\u00b7 ' + parts.join(' ') + ' (' + days + ' day' + (days === 1 ? '' : 's') + ')</span>';
  }
  function dashPeriodLabel() {
    if (dashState.period === 'custom') {
      var f = dashState.from ? V.fmtDate(dashState.from) : '…';
      var t = dashState.to ? V.fmtDate(dashState.to) : 'today';
      return f + ' – ' + t;
    }
    return (DASH_PERIODS.filter(function (p) { return p[0] === dashState.period; })[0] || DASH_PERIODS[0])[1];
  }

  function renderDashboard() {
    topBar.hidden = false;
    var d = V.dashboardData(0, Date.now() + 1);   // all-time totals

    // A null value means "not wired yet" -> show "Coming soon" instead of a number.
    function dsNum(v) { return (v == null) ? '<span class="ds-num ds-soon">Coming soon</span>' : '<span class="ds-num">' + esc(String(v)) + '</span>'; }

    var stats = [
      ['Heritage members', V.getMembersCount(), 'Total members on the register'],
      ['Vehicles produced', (80000 + (V.vehicleCount() || 0)).toLocaleString('en-US'), 'Est. since 1897 · +1 per new registration'],
      ['VIP users', d.vipUsers, 'Active memberships'],
      ['Admin users', d.adminUsers, 'With console access'],
    ];
    var statCards = stats.map(function (s) {
      return '<div class="dash-stat"><span class="ds-label">' + esc(s[0]) + '</span>' + dsNum(s[1]) + '<span class="ds-sub">' + esc(s[2]) + '</span></div>';
    }).join('');
    statCards += '<div class="dash-stat"><a class="ds-link" href="#vehicles" aria-label="Open the vehicle register"><svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg></a>'
      + '<span class="ds-label">Registered vehicles</span>' + dsNum(V.vehicleCount())
      + '<span class="ds-sub">Aegis &amp; Sovereign on the road</span></div>';

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Dashboard">'
      +   '<p class="adm-crumb"><span class="cr-here">Dashboard</span></p>'
      +   '<div class="dash-stats" style="margin-top:clamp(24px,4vh,38px);">' + statCards + '</div>'
      + '</div>';
    bindBack('#menu');
  }


  /* ---------------- "Coming soon" panel for not-yet-wired sections ----------------
     Phase 1 wires Dashboard (VIP/Admin counts), Users and Settings to the live
     Supabase backend. Vehicles, Web Statistics, Counters and Audit Logs have no
     backend yet, so they show a simple centered panel and stay reachable in the
     sidebar. */
  function renderComingSoon(label, blurb) {
    topBar.hidden = false;
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="' + esc(label) + '">'
      +   '<p class="adm-crumb"><span class="cr-here">' + esc(label) + '</span></p>'
      +   '<div class="adm-soon">'
      +     '<div class="adm-soon-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>'
      +     '<h2 class="adm-soon-title">' + esc(label) + '</h2>'
      +     '<p class="adm-soon-body">Coming soon \u2014 wiring in progress.</p>'
      +     (blurb ? '<p class="adm-soon-sub">' + esc(blurb) + '</p>' : '')
      +   '</div>'
      + '</div>';
    bindBack('#menu');
  }

  /* ---------------- VEHICLES (register · models · certificates · search) ---------------- */
  var vehTab = 'register';
  var vehQuery = '';
  var vehAdding = false;
  // Field schema + render/save per tab.
  var VEH_FIELDS = {
    register: [['vin', 'VIN', 'text'], ['firstReg', 'First registration', 'date'], ['model', 'Model', 'text'], ['modelDate', 'Model date', 'date'], ['owner', 'Owner', 'text'], ['email', 'Email', 'email']],
    models: [['name', 'Model', 'text'], ['line', 'Line', 'text'], ['launch', 'First made', 'date'], ['power', 'Powertrain', 'text'], ['units', 'Units', 'number'], ['status', 'Status', 'text']],
    coa: [['ref', 'Reference', 'text'], ['vin', 'VIN', 'text'], ['model', 'Model', 'text'], ['issued', 'Issued', 'date'], ['owner', 'Owner', 'text'], ['status', 'Status', 'text']]
  };
  function ffInput(id, label, type, extra) {
    return '<div class="ff"><label for="vf_' + id + '">' + esc(label) + '</label><div class="ff-input"><input id="vf_' + id + '" type="' + type + '"' + (type === 'date' ? '' : ' placeholder="' + esc(label) + '"') + (extra || '') + '></div></div>';
  }
  // Year-only picker (past years; no month/day). Used for model "First made" and vehicle "Model date".
  function ffYear(id, label, disabled) {
    var now = new Date().getFullYear();
    var opts = '<option value="">Year…</option>';
    for (var y = now; y >= 1900; y--) opts += '<option value="' + y + '">' + y + '</option>';
    return '<div class="ff"><label for="vf_' + id + '">' + esc(label) + '</label><div class="ff-input"><select id="vf_' + id + '" class="ff-select"' + (disabled ? ' disabled' : '') + '>' + opts + '</select></div></div>';
  }
  function vehNewForm() {
    var title = vehTab === 'models' ? 'New vehicle model' : (vehTab === 'coa' ? 'New certificate' : 'New registered vehicle');
    var grid;
    if (vehTab === 'register') {
      // Model is chosen from the Vehicle Models catalogue; "Other" reveals a free-text name.
      // Model date is auto-filled from the chosen model (read-only) and only typed manually for "Other".
      var models = (V.getModels && V.getModels()) || [];
      var opts = '<option value="">Select model…</option>';
      models.forEach(function (m) { if (m && m.name) opts += '<option value="' + esc(m.name) + '">' + esc(m.name) + '</option>'; });
      opts += '<option value="__other__">Other (not listed)…</option>';
      grid = ''
        + ffInput('vin', 'VIN', 'text')
        + ffInput('firstReg', 'First registration', 'date')
        + '<div class="ff"><label for="vf_model_select">Model</label><div class="ff-input"><select id="vf_model_select" class="ff-select">' + opts + '</select></div></div>'
        + ffYear('modelDate', 'Model date', true)
        + ffInput('owner', 'Owner', 'text')
        + ffInput('email', 'Email', 'email')
        + '<div class="ff" id="vfOtherWrap" style="display:none;"><label for="vf_modelOther">New model name</label><div class="ff-input"><input id="vf_modelOther" type="text" placeholder="Model name"></div></div>';
    } else {
      grid = VEH_FIELDS[vehTab].map(function (f) { return f[0] === 'launch' ? ffYear(f[0], f[1]) : ffInput(f[0], f[1], f[2]); }).join('');
    }
    return '<form class="veh-newform" id="vehForm" onsubmit="return false;">'
      + '<p class="adm-section-h" style="margin:0 0 14px;">' + title + '</p>'
      + '<div class="veh-newgrid">' + grid + '</div>'
      + '<p class="adm-err" id="vfErr"></p>'
      + '<div class="adm-extend"><button class="btn" type="submit" id="vfSave">Save record</button><button class="btn-cancel" type="button" id="vfCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
      + '</form>';
  }
  function renderVehicles() {
    topBar.hidden = false;
    var q = vehQuery.trim().toLowerCase();
    function match(obj) { return !q || Object.keys(obj).some(function (k) { return String(obj[k] || '').toLowerCase().indexOf(q) >= 0; }); }

    var tabTitle = vehTab === 'models' ? 'Vehicle models' : (vehTab === 'coa' ? 'Certificates of authenticity' : 'Registered vehicles');

    var body = '', count = 0;
    if (vehTab === 'register') {
      var list = V.getVehicles().filter(match); count = list.length;
      var cols = '1.3fr 1fr 1.1fr 1fr 1fr 1.4fr';
      body = '<div class="adm-table"><div class="adm-row head veh-row" style="--cols:' + cols + '"><span>VIN</span><span>First registration</span><span>Model</span><span>Model date</span><span>Owner</span><span>Email</span></div>'
        + (list.length ? list.slice((vehPage - 1) * pageSize, vehPage * pageSize).map(function (v) {
            return '<div class="adm-row veh-row" style="--cols:' + cols + '"><span class="veh-vin">' + esc(v.vin) + '</span>'
              + '<span class="veh-c">' + esc(v.firstReg ? V.fmtDate(v.firstReg) : '\u2014') + '</span>'
              + '<span class="veh-model">' + esc(v.model) + '</span>'
              + '<span class="veh-c">' + esc(v.modelDate ? String(v.modelDate) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(v.owner || '\u2014') + '</span>'
              + '<span class="veh-email">' + esc(v.email || '\u2014') + '</span></div>';
          }).join('') : '<p class="adm-empty">No vehicles match.</p>')
        + '</div>';
    } else if (vehTab === 'models') {
      var models = V.getModels().filter(match); count = models.length;
      var mcols = '1.4fr 0.9fr 1.1fr 1.3fr 0.7fr 1fr';
      body = '<div class="adm-table"><div class="adm-row head veh-row" style="--cols:' + mcols + '"><span>Model</span><span>Line</span><span>First made</span><span>Powertrain</span><span>Units</span><span>Status</span></div>'
        + (models.length ? models.slice((vehPage - 1) * pageSize, vehPage * pageSize).map(function (m) {
            return '<div class="adm-row veh-row" style="--cols:' + mcols + '"><span class="veh-model">' + esc(m.name) + '</span>'
              + '<span class="veh-c">' + esc(m.line) + '</span>'
              + '<span class="veh-c">' + esc(m.launch ? String(m.launch) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(m.power || '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(String(m.units != null ? m.units : '\u2014')) + '</span>'
              + '<span class="veh-c">' + esc(m.status || '\u2014') + '</span></div>';
          }).join('') : '<p class="adm-empty">No models match.</p>')
        + '</div>';
    } else {
      var coa = V.getCoa().filter(match); count = coa.length;
      var ccols = '1.2fr 1.4fr 1.1fr 1fr 1fr 0.8fr';
      body = '<div class="adm-table"><div class="adm-row head veh-row" style="--cols:' + ccols + '"><span>Reference</span><span>VIN</span><span>Model</span><span>Issued</span><span>Owner</span><span>Status</span></div>'
        + (coa.length ? coa.slice((vehPage - 1) * pageSize, vehPage * pageSize).map(function (c) {
            var st = (c.status || '').toLowerCase();
            return '<div class="adm-row veh-row" style="--cols:' + ccols + '"><span class="veh-vin">' + esc(c.ref) + '</span>'
              + '<span class="veh-vin">' + esc(c.vin) + '</span>'
              + '<span class="veh-model">' + esc(c.model) + '</span>'
              + '<span class="veh-c">' + esc(c.issued ? V.fmtDate(c.issued) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(c.owner || '\u2014') + '</span>'
              + '<span class="coa-badge ' + (st === 'issued' ? 'ok' : 'pend') + '">' + esc(c.status || '\u2014') + '</span></div>';
          }).join('') : '<p class="adm-empty">No certificates match.</p>')
        + '</div>';
    }

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Vehicles">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#vehicles">Vehicles</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(tabTitle) + '</span></p>'
      +   '<div class="veh-bar">'
      +     '<div class="veh-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      +       '<input id="vehSearch" type="search" placeholder="Search VIN, model, owner\u2026" value="' + esc(vehQuery) + '"></div>'
      +     '<button class="btn-new" id="vehNewBtn" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New record</button>'
      +   '</div>'
      +   (vehAdding ? vehNewForm() : '')
      +   body
      +   (count ? pagerBlock(vehPage, count, 'result', 'vPrev', 'vNext') : '')
      + '</div>';
    bindBack('#menu');
    var vp = document.getElementById('vPrev'); if (vp) vp.addEventListener('click', function () { if (vehPage > 1) { vehPage--; renderVehicles(); } });
    var vn = document.getElementById('vNext'); if (vn) vn.addEventListener('click', function () { vehPage++; renderVehicles(); });
    var nb = document.getElementById('vehNewBtn'); if (nb) nb.addEventListener('click', function () { vehAdding = !vehAdding; renderVehicles(); });
    var vfCancel = document.getElementById('vfCancel'); if (vfCancel) vfCancel.addEventListener('click', function () { vehAdding = false; renderVehicles(); });
    // Model dropdown (register tab): pick from catalogue -> auto-fill model date (read-only);
    // pick "Other" -> reveal a free-text model name and let the date be typed.
    var vmSel = document.getElementById('vf_model_select');
    if (vmSel) {
      var otherWrap = document.getElementById('vfOtherWrap');
      var mdInput = document.getElementById('vf_modelDate');
      var modelsByName = {};
      ((V.getModels && V.getModels()) || []).forEach(function (m) { if (m && m.name) modelsByName[m.name] = m; });
      vmSel.addEventListener('change', function () {
        var val = vmSel.value;
        if (val === '__other__') {
          if (otherWrap) otherWrap.style.display = '';
          if (mdInput) { mdInput.disabled = false; mdInput.value = ''; }
        } else if (val === '') {
          if (otherWrap) otherWrap.style.display = 'none';
          if (mdInput) { mdInput.disabled = true; mdInput.value = ''; }
        } else {
          if (otherWrap) otherWrap.style.display = 'none';
          var m = modelsByName[val];
          if (mdInput) { mdInput.disabled = true; mdInput.value = (m && m.launch != null && m.launch !== '') ? String(m.launch) : ''; }
        }
      });
    }
    var vfSave = document.getElementById('vfSave');
    if (vfSave) vfSave.addEventListener('click', function () {
      var err = document.getElementById('vfErr'), rec = {};
      function valOf(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
      if (vehTab === 'register') {
        rec.vin = valOf('vf_vin'); rec.firstReg = valOf('vf_firstReg');
        rec.owner = valOf('vf_owner'); rec.email = valOf('vf_email');
        var sel = valOf('vf_model_select');
        if (!rec.vin) { err.textContent = 'VIN is required'; return; }
        if (!sel) { err.textContent = 'Please choose a model (or "Other")'; return; }
        if (sel === '__other__') {
          rec.model = valOf('vf_modelOther');
          rec.modelDate = valOf('vf_modelDate');
          if (!rec.model) { err.textContent = 'New model name is required'; return; }
        } else {
          rec.model = sel;
          rec.modelDate = valOf('vf_modelDate');
        }
      } else {
        var fields = VEH_FIELDS[vehTab];
        fields.forEach(function (f) { var el = document.getElementById('vf_' + f[0]); rec[f[0]] = el ? el.value.trim() : ''; });
        var firstKey = fields[0][0];
        if (!rec[firstKey]) { err.textContent = fields[0][1] + ' is required'; return; }
      }
      var saveBtn = document.getElementById('vfSave');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
      var add = (vehTab === 'register') ? V.addVehicle(rec) : (vehTab === 'models') ? V.addModel(rec) : V.addCoa(rec);
      Promise.resolve(add).then(function () {
        vehAdding = false; vehPage = 1; renderVehicles();
      }).catch(function (e) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save record'; }
        err.textContent = (e && e.message) ? e.message : 'Could not save. Please try again.';
      });
    });

    [].forEach.call(root.querySelectorAll('[data-vtab]'), function (b) {
      b.addEventListener('click', function () { vehTab = b.getAttribute('data-vtab'); vehPage = 1; renderVehicles(); });
    });
    var s = document.getElementById('vehSearch');
    if (s) {
      s.addEventListener('input', function () {
        vehQuery = s.value; vehPage = 1;
        renderVehicles();
        var ns = document.getElementById('vehSearch'); if (ns) { ns.focus(); var v = ns.value; ns.value = ''; ns.value = v; }
      });
    }
  }

  /* ---------------- WEB STATISTICS ---------------- */
  var statsState = { period: 'last7', from: '', to: '', open: false };
  function statsRange() {
    if (statsState.period === 'custom' && (statsState.from || statsState.to)) {
      var f = statsState.from ? new Date(statsState.from + 'T00:00:00').getTime() : 0;
      var t = statsState.to ? new Date(statsState.to + 'T23:59:59').getTime() : Date.now() + 1;
      return [f, t];
    }
    if (statsState.period === 'last7') return [Date.now() - 7 * 86400000, Date.now() + 1];
    if (statsState.period === 'last30') return [Date.now() - 30 * 86400000, Date.now() + 1];
    return [0, Date.now() + 1];
  }
  function statsPeriodLabel() {
    if (statsState.period === 'custom') {
      var f = statsState.from ? V.fmtDate(statsState.from) : '\u2026';
      var t = statsState.to ? V.fmtDate(statsState.to) : 'today';
      return f + ' \u2013 ' + t;
    }
    return (DASH_PERIODS.filter(function (p) { return p[0] === statsState.period; })[0] || DASH_PERIODS[0])[1];
  }
  function statsSpanLabel(fromTs, toTs) {
    if (statsState.period !== 'custom' && statsState.period !== 'all') return '';
    if (!fromTs || fromTs <= 0) return '';
    var days = Math.max(1, Math.round((toTs - fromTs) / 86400000));
    var months = Math.floor(days / 30), rem = days % 30, parts = [];
    if (months) parts.push(months + ' month' + (months === 1 ? '' : 's'));
    if (rem || !months) parts.push(rem + ' day' + (rem === 1 ? '' : 's'));
    return ' <span class="dash-span">\u00b7 ' + parts.join(' ') + ' (' + days + ' day' + (days === 1 ? '' : 's') + ')</span>';
  }

  // Equirectangular projection → percentage coords on the world map.
  function mapXY(lat, lng) { return { x: (lng + 180) / 360 * 100, y: (90 - lat) / 180 * 100 }; }

  function renderStats() {
    return renderComingSoon('Web Statistics', 'Traffic analytics \u2014 visits, time on site, audience, devices and locations \u2014 will appear here once visit logging is wired to the backend.');
    /* Phase 2: original implementation below (currently unreachable). */
    topBar.hidden = false;
    var range = statsRange();
    var d = V.dashboardData(range[0], range[1]);
    var maxCount = d.pages.reduce(function (m, p) { return Math.max(m, p.count); }, 0) || 1;

    var periodOpts = DASH_PERIODS.map(function (p) {
      return '<div class="flt-opt' + (statsState.period === p[0] ? ' on' : '') + '" data-speriod="' + p[0] + '">'
        + '<span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>' + esc(p[1]) + '</div>';
    }).join('');
    var periodDD = '<div class="flt-group"><span class="flt-label">Period</span>'
      + '<div class="flt-dd dash-dd' + (statsState.open ? ' open' : '') + '">'
      +   '<button type="button" class="flt-dd-btn" id="sPeriodBtn"><span>' + esc(statsPeriodLabel()) + '</span><span class="caret">\u25be</span></button>'
      +   '<div class="flt-dd-panel">' + periodOpts + '</div></div></div>';
    var sMax = iso(new Date()), sMin = iso(addMonths(new Date(), -12));
    var customRow = statsState.period === 'custom'
      ? '<div class="dash-custom"><div class="ff" style="gap:6px;"><label for="sFrom">From</label><div class="ff-input"><input id="sFrom" type="date" value="' + esc(statsState.from) + '" min="' + sMin + '" max="' + sMax + '"></div></div>'
        + '<div class="ff" style="gap:6px;"><label for="sTo">To</label><div class="ff-input"><input id="sTo" type="date" value="' + esc(statsState.to) + '" min="' + sMin + '" max="' + sMax + '"></div></div></div>'
      : '';

    // stat cards: total visits + avg time
    var statCards = '<div class="dash-stat"><span class="ds-label">Total visits</span><span class="ds-num">' + d.visits.total + '</span>'
      + '<span class="ds-sub">Unregistered ' + d.visits.anon + ' \u00b7 VIP ' + d.visits.vip + ' \u00b7 Admin ' + d.visits.admin + '</span></div>'
      + '<div class="dash-stat"><span class="ds-label">Avg. time on site</span><span class="ds-num">' + fmtDur(d.avgTime) + '</span><span class="ds-sub">Per page view</span></div>';

    // visits by audience
    var visitsBar = '';
    if (d.visits.total) {
      var seg = [['anon', 'Unregistered', d.visits.anon], ['vip', 'VIP', d.visits.vip], ['admin', 'Admin', d.visits.admin]];
      visitsBar = '<div class="dash-split"><div class="dsplit-bar">'
        + seg.map(function (s) { var pct = (s[2] / d.visits.total * 100); return pct > 0 ? '<span class="dsplit-seg seg-' + s[0] + '" style="width:' + pct + '%"></span>' : ''; }).join('')
        + '</div><div class="dsplit-legend">'
        + seg.map(function (s) { return '<span class="dleg"><span class="dleg-dot seg-' + s[0] + '"></span>' + esc(s[1]) + ' \u00b7 ' + s[2] + '</span>'; }).join('')
        + '</div></div>';
    }

    // most visited pages
    var pagesRows = d.pages.length
      ? d.pages.map(function (p) {
          return '<div class="dash-page"><span class="dp-name">' + esc(p.page) + '</span>'
            + '<span class="dp-track"><span class="dp-fill" style="width:' + (p.count / maxCount * 100) + '%"></span></span>'
            + '<span class="dp-count">' + p.count + '</span><span class="dp-time">' + fmtDur(p.avg) + '</span></div>';
        }).join('')
      : '<p class="adm-empty">No page views recorded in this period yet.</p>';

    // visitor device (OS)
    var devTotal = d.devices.reduce(function (m, x) { return m + x.count; }, 0) || 1;
    var deviceRows = d.devices.length
      ? d.devices.map(function (x) {
          return '<div class="dash-page"><span class="dp-name">' + esc(x.os) + '</span>'
            + '<span class="dp-track"><span class="dp-fill" style="width:' + (x.count / devTotal * 100) + '%"></span></span>'
            + '<span class="dp-count">' + x.count + '</span><span class="dp-time">' + Math.round(x.count / devTotal * 100) + '%</span></div>';
        }).join('')
      : '<p class="adm-empty">No device data yet.</p>';

    // visitor location — dots on a world map
    var locTotal = d.locations.reduce(function (m, x) { return m + x.count; }, 0) || 1;
    var maxLoc = d.locations.reduce(function (m, x) { return Math.max(m, x.count); }, 0) || 1;
    var dots = d.locations.filter(function (l) { return l.lat != null; }).map(function (l) {
      var p = mapXY(l.lat, l.lng);
      var sz = 7 + Math.round(l.count / maxLoc * 16);
      return '<span class="map-dot" style="left:' + p.x.toFixed(2) + '%;top:' + p.y.toFixed(2) + '%;width:' + sz + 'px;height:' + sz + 'px;" title="' + esc(l.label) + ': ' + l.count + '"></span>';
    }).join('');
    var locList = d.locations.length
      ? d.locations.map(function (l) {
          return '<div class="loc-row"><span class="loc-dot"></span><span class="loc-name">' + esc(l.label) + '</span><span class="loc-count">' + l.count + '</span></div>';
        }).join('')
      : '<p class="adm-empty">No location data yet.</p>';

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Web Statistics">'
      +   '<p class="adm-crumb"><span class="cr-here">Web Statistics</span></p>'
      +   '<div class="au-filters" style="margin-top:clamp(20px,3vh,30px);"><div class="flt-row2" style="align-items:flex-end;">' + periodDD + customRow + '</div>'
      +     '<p class="dash-showing">Showing <b>' + esc(statsPeriodLabel()) + '</b>' + statsSpanLabel(statsState.period === 'all' ? d.firstTs : range[0], statsState.period === 'all' ? Date.now() : range[1]) + '</p></div>'
      +   '<div class="dash-stats">' + statCards + '</div>'
      +   (visitsBar ? ('<p class="adm-section-h">Visits by audience</p>' + visitsBar) : '')
      +   '<p class="adm-section-h">Most visited pages</p>'
      +   '<div class="dash-pages"><div class="dash-page dash-page-head"><span class="dp-name">Page</span><span class="dp-track"></span><span class="dp-count">Visits</span><span class="dp-time">Avg time</span></div>' + pagesRows + '</div>'
      +   '<p class="adm-section-h">Visitor device</p>'
      +   '<div class="dash-pages"><div class="dash-page dash-page-head"><span class="dp-name">Operating system</span><span class="dp-track"></span><span class="dp-count">Visits</span><span class="dp-time">Share</span></div>' + deviceRows + '</div>'
      +   '<p class="adm-section-h">Visitor location</p>'
      +   '<div class="stat-geo"><div class="geo-map">' + dots + '</div><div class="geo-list">' + locList + '</div></div>'
      +   '<p class="field-hint" style="margin-top:16px;">Device and location are derived in-browser (user-agent, time zone) as a prototype. Precise device classing and IP-based geo will be resolved server-side.</p>'
      + '</div>';
    bindBack('#menu');

    var pbtn = document.getElementById('sPeriodBtn');
    if (pbtn) pbtn.addEventListener('click', function (e) { e.stopPropagation(); statsState.open = !statsState.open; renderStats(); });
    [].forEach.call(root.querySelectorAll('[data-speriod]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); statsState.period = b.getAttribute('data-speriod'); statsState.open = false; renderStats(); });
    });
    if (statsState.open) { setTimeout(function () { document.addEventListener('click', function c() { statsState.open = false; document.removeEventListener('click', c); renderStats(); }, { once: true }); }, 0); }
    var sFrom = document.getElementById('sFrom'), sTo = document.getElementById('sTo');
    function clampPast(v) { if (!v) return v; if (v > sMax) return sMax; if (v < sMin) return sMin; return v; }
    if (sFrom) sFrom.addEventListener('change', function () { sFrom.value = clampPast(sFrom.value); statsState.from = sFrom.value; renderStats(); });
    if (sTo) sTo.addEventListener('change', function () { sTo.value = clampPast(sTo.value); statsState.to = sTo.value; renderStats(); });
  }

  /* ---------------- sidebar nav ---------------- */
  var ICON = {
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    users: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
    stats: '<path d="M4 19V9M9 19V5M14 19v-7M19 19V11"/>',
    vehicles: '<path d="M3 13l2-5h14l2 5M5 13h14v4H5z"/><circle cx="7.5" cy="17.5" r="1"/><circle cx="16.5" cy="17.5" r="1"/>',
    audit: '<path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2zM8 9h8M8 13h6"/>',
    counters: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 2h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 22h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z"/>',
    help: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4 1.8c0 1.5-2 2-2 3.2"/><circle cx="12" cy="17" r="0.5"/>',
    heritage: '<path d="M12 3l7 2.5v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V5.5z"/><path d="M9.5 12l1.8 1.8L15 10"/>'
  };
  // [route, label, iconKey, children?]  children = [[route,label],...]
  var NAV = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['users', 'Users', 'users', [['users', 'All users'], ['new', 'New user']]],
    ['heritage', 'Heritage', 'heritage'],
    ['vehicles', 'Vehicles', 'vehicles', [['vehicles', 'Registered vehicles'], ['vmodels', 'Vehicle models'], ['vcerts', 'Certificates']]],
    ['stats', 'Web Statistics', 'stats'],
    ['counters', 'Counters', 'counters'],
    ['audit', 'Audit Logs', 'audit'],
    ['settings', 'Settings', 'settings']
  ];
  // sub-routes map to their parent nav item for active highlighting
  var NAV_ALIAS = { menu: 'dashboard', created: 'users', user: 'users', faq: 'help' };
  // which top-level group a route belongs to (for keeping a group open)
  var ROUTE_GROUP = { users: 'users', new: 'users', created: 'users', user: 'users', vehicles: 'vehicles', vmodels: 'vehicles', vcerts: 'vehicles' };

  function curRoute() { return (location.hash || '#dashboard').replace('#', ''); }
  function groupOpenFor(route) { return ROUTE_GROUP[route] || null; }

  function buildNav() {
    var nav = document.getElementById('admNav');
    if (!nav) return;
    var openGroup = groupOpenFor(curRoute());
    nav.innerHTML = NAV.map(function (n) {
      var route = n[0], label = n[1], children = n[3];
      if (!children) {
        return '<a class="nav-row" data-route="' + route + '" href="#' + route + '"><svg class="ic" viewBox="0 0 24 24">' + ICON[n[2]] + '</svg><span class="lb">' + T(label) + '</span></a>';
      }
      var kids = children.map(function (c) {
        return '<a class="nav-sub" data-route="' + c[0] + '" href="#' + c[0] + '"><span class="lb">' + T(c[1]) + '</span></a>';
      }).join('');
      var isOpen = openGroup === route;
      return '<div class="nav-group' + (isOpen ? ' open' : '') + '" data-group="' + route + '">'
        + '<button class="nav-row nav-parent" type="button" data-route="' + route + '"><svg class="ic" viewBox="0 0 24 24">' + ICON[n[2]] + '</svg><span class="lb">' + T(label) + '</span><svg class="caret" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>'
        + '<div class="nav-subs">' + kids + '</div></div>';
    }).join('');

    // parent toggles its group open/closed (vertical expand/retract)
    [].forEach.call(nav.querySelectorAll('.nav-parent'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var grp = btn.closest('.nav-group');
        grp.classList.toggle('open');
      });
    });
    // leaf + sub links navigate
    [].forEach.call(nav.querySelectorAll('a[data-route]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); location.hash = '#' + a.getAttribute('data-route');
        document.body.classList.remove('adm-drawer-open'); render();
      });
    });
  }
  function highlightNav() {
    var route = curRoute();
    var active = NAV_ALIAS[route] || route;
    var group = groupOpenFor(route);
    [].forEach.call(document.querySelectorAll('#admNav [data-route]'), function (a) {
      a.classList.toggle('on', a.getAttribute('data-route') === active);
    });
    // keep the owning group expanded for the current route
    if (group) { var g = document.querySelector('#admNav .nav-group[data-group="' + group + '"]'); if (g) g.classList.add('open'); }
  }

  /* ---------------- PROFILE (in-app account) ---------------- */
  var EYE_SVG = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYEOFF_SVG = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.1M6.2 6.2A17.6 17.6 0 0 0 2 12s3.6 7 10 7a10.6 10.6 0 0 0 4.3-.9"/><path d="M9.5 10.6a3 3 0 0 0 4 4"/></svg>';
  function renderProfile() {
    topBar.hidden = false;
    var acct = V.account();
    if (!acct) { toLogin(); return; }
    var initials = (acct.name || 'M').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var roleLabel = acct.super ? 'Super-admin' : (acct.role === 'admin' ? 'Admin' : 'VIP');
    var validLine = (acct.super || acct.role === 'admin') ? 'No expiry' : (acct.endDate ? V.fmtDate(acct.endDate) : 'No end date');

    var pwSection;
    if (acct.super) {
      pwSection = '<p class="adm-section-h">Password</p>'
        + '<p class="adm-sub" style="max-width:60ch;">The master super-admin password is fixed in the system configuration and cannot be changed from this page. To rotate it, update it in the deployment settings (see the backend handoff).</p>';
    } else {
      pwSection = '<p class="adm-section-h">Change password</p>'
        + '<form id="pwForm" autocomplete="off" onsubmit="return false;" style="max-width:440px;">'
        +   '<div class="ff"><label for="curPw">Current password</label><div class="ff-input"><input id="curPw" type="password" placeholder="Enter your current password" autocomplete="current-password"><button class="ff-eye" type="button" data-eye="curPw" aria-label="Show password">' + EYE_SVG + '</button></div></div>'
        +   '<div class="ff"><label for="newPw">New password</label><div class="ff-input"><input id="newPw" type="password" placeholder="Choose a new password" autocomplete="new-password" disabled><button class="ff-eye" type="button" data-eye="newPw" aria-label="Show password">' + EYE_SVG + '</button></div></div>'
        +   '<div class="pw-rules" id="pwRules"></div>'
        +   '<div class="ff"><label for="newPw2">Confirm new password</label><div class="ff-input"><input id="newPw2" type="password" placeholder="Repeat the new password" autocomplete="new-password" disabled><button class="ff-eye" type="button" data-eye="newPw2" aria-label="Show password">' + EYE_SVG + '</button></div></div>'
        +   '<p class="acc-msg" id="pwMsg"></p>'
        +   '<button class="btn btn-block" type="submit" id="pwBtn" disabled>Set new password</button>'
        + '</form>';
    }

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Profile">'
      +   '<p class="adm-crumb"><span class="cr-here">Profile</span></p>'
      +   '<div class="acc-profile2"><div class="acc-avatar2">' + esc(initials) + '</div>'
      +     '<div class="acc-id2"><div class="nm">' + esc(acct.name) + '</div><div class="em">' + esc(acct.email) + '</div><span class="role">' + roleLabel + '</span></div></div>'
      +   '<div class="acc-meta2"><span>Role <b>' + roleLabel + '</b></span><span>Access valid until <b>' + esc(validLine) + '</b></span></div>'
      +   '<p class="adm-section-h">Language</p>'
      +   '<form id="langForm" onsubmit="return false;" style="max-width:440px;"><div class="ff"><label for="acLang">Preferred language</label><div class="ff-input"><select id="acLang" class="ff-select">' + ADM_LANG_OPTS(acct.lang || 'en') + '</select></div><span class="field-hint">This sets the language of the website while you are signed in.</span></div><p class="acc-msg" id="langMsg"></p></form>'
      +   pwSection
      + '</div>';

    [].forEach.call(root.querySelectorAll('[data-eye]'), function (btn) {
      btn.addEventListener('click', function () {
        var inp = document.getElementById(btn.getAttribute('data-eye')); if (!inp) return;
        var show = inp.type === 'password'; inp.type = show ? 'text' : 'password';
        btn.innerHTML = show ? EYEOFF_SVG : EYE_SVG;
      });
    });
    // language preference: save on the user + follow the site language live
    var acLang = document.getElementById('acLang');
    if (acLang) acLang.addEventListener('change', function () {
      var lng = acLang.value;
      if (acct.id) V.store.setLang(acct.id, lng);
      try { localStorage.setItem('minerva-lang', lng); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('minervalang', { detail: lng })); } catch (e) {}
      var lm = document.getElementById('langMsg'); if (lm) { lm.className = 'acc-msg ok'; lm.textContent = 'Language updated'; }
    });
    if (acct.super) return;

    var rulesEl = document.getElementById('pwRules');
    rulesEl.innerHTML = V.passwordChecks('').map(function (r) {
      return '<div class="pw-rule" data-rule="' + r.id + '"><span class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>' + esc(r.label) + '</div>';
    }).join('');
    var curPw = document.getElementById('curPw'), newPw = document.getElementById('newPw'), newPw2 = document.getElementById('newPw2');
    var msg = document.getElementById('pwMsg'), btn = document.getElementById('pwBtn');
    function gate() { var has = curPw.value.trim().length > 0; newPw.disabled = !has; newPw2.disabled = !has; }
    function refresh() {
      V.passwordChecks(newPw.value).forEach(function (c) { var el = rulesEl.querySelector('[data-rule="' + c.id + '"]'); if (el) el.classList.toggle('ok', c.ok); });
      var match = newPw.value && newPw.value === newPw2.value;
      btn.disabled = !(curPw.value.trim() && V.passwordValid(newPw.value) && match);
      msg.className = 'acc-msg';
      if (newPw2.value && !match) { msg.className = 'acc-msg err'; msg.textContent = 'Passwords do not match'; } else { msg.textContent = ''; }
    }
    curPw.addEventListener('input', function () { gate(); refresh(); });
    newPw.addEventListener('input', refresh); newPw2.addEventListener('input', refresh);
    document.getElementById('pwForm').addEventListener('submit', function () {
      var u = V.store.get(acct.id);
      if (!u || u.pw !== curPw.value) { msg.className = 'acc-msg err'; msg.textContent = 'Current password is incorrect'; return; }
      if (!V.passwordValid(newPw.value)) { msg.className = 'acc-msg err'; msg.textContent = 'New password does not meet the requirements'; return; }
      if (newPw.value !== newPw2.value) { msg.className = 'acc-msg err'; msg.textContent = 'Passwords do not match'; return; }
      V.store.setPassword(acct.id, newPw.value);
      msg.className = 'acc-msg ok'; msg.textContent = 'Password updated';
      curPw.value = ''; newPw.value = ''; newPw2.value = ''; gate(); refresh(); btn.disabled = true;
    });
  }

  /* ---------------- COUNTERS ---------------- */
  function renderCounters() {
    return renderComingSoon('Counters', 'The Aegis & Sovereign launch counters and their pre-sales start dates will appear here once the counters backend is connected.');
    /* Phase 2: original implementation below (currently unreachable). */
    topBar.hidden = false;
    var counters = V.getCounters();
    var ckeys = Object.keys(counters);
    var countersHtml = ckeys.map(function (k) {
      var c = counters[k];
      return '<div class="counter" data-counter="' + k + '">'
        + '<div class="c-label">' + esc(c.label) + '</div>'
        + '<div class="c-presale">Pre-sales open <b>' + (c.target ? esc(V.fmtDate(c.target)) : 'Not set') + '</b></div>'
        + '<div class="c-target">'
        +   '<span class="tl">Pre-sales start date</span>'
        +   '<div class="ff-input"><input type="date" data-target value="' + esc(c.target || '') + '"></div>'
        + '</div>'
        + '</div>';
    }).join('');

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Counters">'
      +   '<p class="adm-crumb"><span class="cr-here">Counters</span></p>'
      +   '<p class="adm-sub" style="margin-top:18px;">Set the <b>pre-sales start date</b> for each model. This date drives the live countdown on the model\u2019s page (Aegis, Sovereign) — the timer counts down to it.</p>'
      +   '<div class="counters" style="margin-top:clamp(26px,4vh,40px);">' + countersHtml + '</div>'
      + '</div>';
    bindBack('#menu');
    [].forEach.call(root.querySelectorAll('[data-counter]'), function (el) {
      var key = el.getAttribute('data-counter');
      el.querySelector('[data-target]').addEventListener('change', function (e) { V.setCounter(key, { target: e.target.value || null }); renderCounters(); });
    });
  }

  /* ---------------- FAQ ---------------- */
  function renderFaq() {
    topBar.hidden = false;
    var sugs = FAQ.slice(0, 4).map(function (q) { return '<button class="cc-sug" type="button" data-q="' + esc(q[0]) + '">' + esc(q[0]) + '</button>'; }).join('');
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Concierge">'
      +   '<p class="adm-crumb"><span class="cr-here">Minerva Concierge</span></p>'
      +   '<p class="adm-sub" style="margin-top:14px;">Ask about using the console. The concierge only answers within what your role is permitted to see.</p>'
      +   '<div class="cc-stream" id="ccStream"><div class="cc-msg bot">Good day. I am the Minerva concierge — ask me anything about managing users, access, vehicles or the Heritage programme.</div></div>'
      +   '<div class="cc-sugs">' + sugs + '</div>'
      +   '<form class="cc-bar" id="ccForm" onsubmit="return false;"><input id="ccInput" type="text" placeholder="Ask the concierge…" autocomplete="off"><button class="btn" id="ccSend" type="submit">Send</button></form>'
      + '</div>';
    bindBack('#dashboard');
    var stream = document.getElementById('ccStream');
    var input = document.getElementById('ccInput');
    var sendBtn = document.getElementById('ccSend');
    function add(text, who) { var d = document.createElement('div'); d.className = 'cc-msg ' + who; d.textContent = text; stream.appendChild(d); stream.scrollTop = stream.scrollHeight; return d; }
    function ask(q) {
      q = (q || '').trim(); if (!q) return;
      add(q, 'me'); input.value = '';
      if (sendBtn) sendBtn.disabled = true;
      var thinking = add('…', 'bot thinking');
      Promise.resolve(V.askConcierge ? V.askConcierge(q) : Promise.reject(new Error('unavailable'))).then(function (ans) {
        thinking.remove();
        add(ans || 'I do not have an answer for that. Please contact access@minervaluxurymotors.com.', 'bot');
      }).catch(function (e) {
        thinking.remove();
        var m = (e && e.message === 'concierge-not-configured') ? 'The concierge is not configured yet — a model key still needs to be set.' : 'Sorry, I could not reach the concierge just now.';
        add(m, 'bot');
      }).then(function () { if (sendBtn) sendBtn.disabled = false; input.focus(); });
    }
    document.getElementById('ccForm').addEventListener('submit', function () { ask(input.value); });
    [].forEach.call(root.querySelectorAll('[data-q]'), function (b) { b.addEventListener('click', function () { ask(b.getAttribute('data-q')); }); });
    input.focus();
    if (pendingConcierge) { var pq = pendingConcierge; pendingConcierge = null; ask(pq); }
  }

  function bindBack(hash) {
    [].forEach.call(root.querySelectorAll('.back-admin'), function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); location.hash = a.getAttribute('href') || hash || '#menu'; render(); });
    });
  }

  /* ---------------- SETTINGS ---------------- */
  function renderSettings() {
    topBar.hidden = false;
    var theme = (function () { try { return localStorage.getItem('minerva_admin_theme') || 'dark'; } catch (e) { return 'dark'; } })();
    function row(label, desc, ctrl) {
      return '<div class="set-row"><div class="set-meta"><div class="set-l">' + label + '</div><div class="set-d">' + desc + '</div></div>' + ctrl + '</div>';
    }
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Settings">'
      +   '<p class="adm-crumb"><span class="cr-here">Settings</span></p>'
      +   '<p class="adm-section-h" style="margin-top:clamp(20px,3vh,30px);">Appearance</p>'
      +   row('Theme', 'Switch the console between dark and light.', '<div class="seg" id="setTheme"><button type="button" data-theme="dark"' + (theme !== 'light' ? ' class="on"' : '') + '>Dark</button><button type="button" data-theme="light"' + (theme === 'light' ? ' class="on"' : '') + '>Light</button></div>')
      +   '<p class="adm-section-h">Notifications</p>'
      +   row('Push notifications', 'Show alerts in the console bell.', '<label class="set-toggle"><input type="checkbox" id="setNotif" checked><span class="tk"></span></label>')
      +   row('Email digests', 'A weekly summary of access activity.', '<label class="set-toggle"><input type="checkbox" id="setDigest"><span class="tk"></span></label>')
      +   '<p class="adm-section-h">Account</p>'
      +   row('Profile &amp; password', 'Manage your personal details and password.', '<a class="btn" href="#profile" id="setProfile" style="text-decoration:none;">Open profile</a>')
      +   '<p class="field-hint" style="margin-top:22px;">Settings are stored in this browser for the prototype. They will move to the account record once the backend is connected.</p>'
      + '</div>';
    bindBack('#dashboard');
    var st = document.getElementById('setTheme');
    if (st) [].forEach.call(st.querySelectorAll('[data-theme]'), function (b) {
      b.addEventListener('click', function () {
        var light = b.getAttribute('data-theme') === 'light';
        document.body.classList.toggle('adm-light', light);
        try { localStorage.setItem('minerva_admin_theme', light ? 'light' : 'dark'); } catch (e) {}
        [].forEach.call(st.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
    });
    var sp = document.getElementById('setProfile');
    if (sp) sp.addEventListener('click', function (e) { e.preventDefault(); location.hash = '#profile'; render(); });
  }

  /* ---------------- ROUTER ---------------- */
  /* ---------------- impersonation ("view as", super-admin only) ---------------- */
  function startImpersonation(id) {
    if (!V.setImpersonation || !V.setImpersonation(id)) return;
    var isMember = !!(V.heritageMembers && V.heritageMembers().some(function (m) { return m.id === id; }));
    var tu = V.store.get ? V.store.get(id) : null;
    var isAdminTarget = !!(tu && tu.role === 'admin');
    // Admin → see the console as that admin; member → portal; VIP → public site.
    location.href = isAdminTarget ? 'admin.html' : (isMember ? 'portal.html' : 'index.html');
  }
  function openImpersonatePicker() {
    if (!((V.isSuperAdmin && V.isSuperAdmin()) || (V.realIsAdmin && V.realIsAdmin()))) return;
    var members = (V.heritageMembers ? V.heritageMembers() : []);
    var memIds = {}; members.forEach(function (m) { memIds[m.id] = m; });
    var users = V.store.all().slice().sort(function (a, b) { return (a.no || 0) - (b.no || 0); });
    var ov = document.createElement('div');
    ov.className = 'imp-modal';
    ov.innerHTML = '<div class="imp-dialog" role="dialog" aria-label="Impersonate a user">'
      + '<div class="imp-dhead"><span>Impersonate a user</span><button class="imp-x" id="impX" type="button" aria-label="Close">✕</button></div>'
      + '<div class="imp-dsearch"><input id="impSearch" type="search" placeholder="Search name or email…" autocomplete="off"></div>'
      + '<div class="imp-dlist" id="impList"></div>'
      + '<p class="imp-dhint">You will see the site and console exactly as this user does. A red bar returns you to super-admin at any time.</p></div>';
    document.body.appendChild(ov);
    var isSup = !!(V.isSuperAdmin && V.isSuperAdmin());
    var SUPER_EMAIL = 'admin@minervaluxurymotors.com';
    function roleOf(u) { return memIds[u.id] ? 'heritage' : (u.role === 'admin' ? 'admin' : 'vip'); }
    function chip(u) {
      var r = roleOf(u);
      var lbl = r === 'admin' ? 'Admin'
        : r === 'heritage' ? ('Heritage' + (memIds[u.id] && memIds[u.id].tier ? ' · ' + memIds[u.id].tier : ''))
        : 'VIP';
      return '<span class="role-chip ' + (r === 'admin' ? 'admin' : 'vip') + '">' + esc(lbl) + '</span>';
    }
    function paint(q) {
      q = (q || '').toLowerCase();
      var list = users.filter(function (u) {
        // Never impersonate the super-admin account.
        if (String(u.email || '').toLowerCase() === SUPER_EMAIL) return false;
        // Only the super-admin may impersonate other admins; regular admins can't.
        if (roleOf(u) === 'admin' && !isSup) return false;
        return (!q || ((u.name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(q) >= 0);
      });
      document.getElementById('impList').innerHTML = list.length ? list.map(function (u) {
        return '<button class="imp-row" type="button" data-imp="' + esc(u.id) + '"><span class="imp-meta"><span class="imp-nm">' + esc(u.name || '—') + '</span><span class="imp-em">' + esc(u.email || '') + '</span></span>' + chip(u) + '</button>';
      }).join('') : '<p class="adm-empty" style="padding:20px;">No users match.</p>';
      [].forEach.call(ov.querySelectorAll('[data-imp]'), function (b) { b.addEventListener('click', function () { startImpersonation(b.getAttribute('data-imp')); }); });
    }
    paint('');
    var si = document.getElementById('impSearch'); if (si) { si.addEventListener('input', function () { paint(si.value); }); si.focus(); }
    document.getElementById('impX').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  }

  function render() {
    if (!V.isAdmin()) { toLogin(); return; }
    var so = document.getElementById('admSignout'); if (so) so.style.display = '';
    // account chip + role label
    var acct = V.account ? V.account() : null;
    var sup = V.isSuperAdmin();
    var lbl = document.getElementById('admLbl'); if (lbl) lbl.textContent = sup ? 'Administration' : 'User Management';
    if (acct) {
      var nm = document.getElementById('admAcctName'); if (nm) nm.textContent = acct.email || acct.name;
      var av = document.getElementById('admAv'); if (av) av.textContent = (acct.name || 'SA').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    }
    var impEl = document.getElementById('admImpersonate'); if (impEl) impEl.hidden = !(sup || (V.realIsAdmin && V.realIsAdmin()));
    var h = (location.hash || '#dashboard').replace('#', '');
    buildNav();
    highlightNav();
    applyConsoleLang();
    if (h === 'dashboard') return renderDashboard();
    if (h === 'counters') return renderCounters();
    if (h === 'settings') return renderSettings();
    if (h === 'help' || h === 'faq') return renderFaq();
    if (h === 'profile') return renderProfile();
    if (h === 'stats') return renderStats();
    if (h === 'vehicles') { vehTab = 'register'; vehPage = 1; return renderVehicles(); }
    if (h === 'vmodels') { vehTab = 'models'; vehPage = 1; return renderVehicles(); }
    if (h === 'vcerts') { vehTab = 'coa'; vehPage = 1; return renderVehicles(); }
    if (h === 'new') return renderNew();
    if (h === 'created') return renderCreated();
    if (h === 'users') { usersPage = 1; return renderUsers(); }
    if (h === 'heritage') return renderHeritage();
    if (h === 'audit') return renderAudit();
    if (h === 'user') return renderUser();
    return renderDashboard();   // sidebar replaces the old card menu
  }

  ready(function () {
    buildNav();
    document.getElementById('admSignout').addEventListener('click', function () {
      if (V.isSuperAdmin()) V.adminLogout(); else V.signOutVip();
      location.href = 'login.html';
    });
    var mb = document.getElementById('admMenuBtn'); if (mb) mb.addEventListener('click', function () { document.body.classList.toggle('adm-drawer-open'); });
    var sc = document.getElementById('admScrim'); if (sc) sc.addEventListener('click', function () { document.body.classList.remove('adm-drawer-open'); });
    var hl = document.getElementById('admHelpLink'); if (hl) hl.addEventListener('click', function (e) { e.preventDefault(); location.hash = '#help'; render(); });
    var pl = document.getElementById('admProfileLink'); if (pl) pl.addEventListener('click', function (e) { e.preventDefault(); location.hash = '#profile'; render(); });
    // collapsible rail (persisted)
    try { if (localStorage.getItem('minerva_admin_rail') === '1') document.body.classList.add('adm-rail'); } catch (e) {}
    var cb = document.getElementById('admCollapse');
    if (cb) cb.addEventListener('click', function () {
      var railed = document.body.classList.toggle('adm-rail');
      try { localStorage.setItem('minerva_admin_rail', railed ? '1' : '0'); } catch (e) {}
    });
    window.addEventListener('hashchange', render);
    // The bridge loads the live (async) Supabase data in the background and fires
    // this when its cache changes; re-render the current view so the user list /
    // dashboard counts fill in without a manual refresh.
    // Don't auto-re-render interactive form/chat pages — it would wipe in-progress
    // input (the concierge chat, the user-detail role/extend forms, the New User form).
    // These update explicitly after an action.
    window.addEventListener('minerva-admin-refresh', function () { try { var h = (location.hash || '').replace('#', ''); if (h === 'help' || h === 'faq' || h === 'user' || h === 'new') return; render(); } catch (e) {} });
    // "Show records" page-size dropdown under any list → refresh immediately
    root.addEventListener('change', function (e) {
      var sel = e.target.closest && e.target.closest('.pagesize-sel');
      if (!sel) return;
      setPageSize(parseInt(sel.value, 10) || 20);
      usersPage = 1; vehPage = 1; auditState.page = 1;
      render();
    });

    // theme toggle (persisted)
    try { if (localStorage.getItem('minerva_admin_theme') === 'light') document.body.classList.add('adm-light'); } catch (e) {}
    var themeBtn = document.getElementById('admTheme');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      var light = document.body.classList.toggle('adm-light');
      try { localStorage.setItem('minerva_admin_theme', light ? 'light' : 'dark'); } catch (e) {}
    });

    // notifications bell + badge
    var NOTES = [
      { t: 'A VIP guest requested an access extension.', m: '2h ago', read: false },
      { t: 'New website visit from an unregistered device.', m: '5h ago', read: false },
      { t: 'Certificate COA-2026-0003 is pending issue.', m: 'Yesterday', read: false }
    ];
    var bell = document.getElementById('admBell'), bellMenu = document.getElementById('admBellMenu');
    var bellList = document.getElementById('admBellList'), badge = document.getElementById('admBadge');
    function paintNotes() {
      var unread = NOTES.filter(function (n) { return !n.read; }).length;
      if (badge) { badge.textContent = unread; badge.hidden = unread === 0; }
      if (bellList) bellList.innerHTML = NOTES.length
        ? NOTES.map(function (n) { return '<div class="bell-item' + (n.read ? ' read' : '') + '"><span class="dot"></span><span class="bd"><span class="bt">' + esc(n.t) + '</span><span class="bm">' + esc(n.m) + '</span></span></div>'; }).join('')
        : '<div class="bell-empty">No notifications</div>';
    }
    paintNotes();
    if (bell) bell.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = bellMenu.hasAttribute('hidden');
      if (open) { bellMenu.removeAttribute('hidden'); setTimeout(function () { document.addEventListener('click', closeBell); }, 0); }
      else closeBell();
    });
    function closeBell() { bellMenu.setAttribute('hidden', ''); document.removeEventListener('click', closeBell); }
    var bellClear = document.getElementById('admBellClear');
    if (bellClear) bellClear.addEventListener('click', function (e) { e.stopPropagation(); NOTES.forEach(function (n) { n.read = true; }); paintNotes(); });

    // top search → routes to the matching list with the query
    var searchInput = document.getElementById('admSearchInput');
    if (searchInput) {
      document.getElementById('admSearch').addEventListener('submit', function () {
        var q = searchInput.value.trim();
        if (!q) return;
        vehQuery = q; vehTab = 'register'; vehPage = 1;
        location.hash = '#vehicles'; render();
        setTimeout(function () { var vs = document.getElementById('vehSearch'); if (vs) { vs.value = q; vs.focus(); } }, 0);
      });
    }
    // Open the native day/month/year calendar on a click anywhere in a date field.
    root.addEventListener('click', function (e) {
      var t = e.target.closest('input[type="date"]');
      if (t && typeof t.showPicker === 'function') { try { t.showPicker(); } catch (err) {} }
    });
    var imp = document.getElementById('admImpersonate');
    if (imp) imp.addEventListener('click', function (e) { e.preventDefault(); openImpersonatePicker(); });
    var topAsk = document.getElementById('admSearchInput');
    if (topAsk) topAsk.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); var q = (topAsk.value || '').trim(); if (!q) return; pendingConcierge = q; topAsk.value = ''; if (location.hash === '#help' || location.hash === '#faq') { render(); } else { location.hash = '#help'; } }
    });
    render();
  });
})();
