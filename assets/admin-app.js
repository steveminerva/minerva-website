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
  function ready(fn) { if (window.MinervaVIP) { V = window.MinervaVIP; if (V.ready) { V.ready(fn); return; } return fn(); } setTimeout(function () { ready(fn); }, 40); }

  var root = document.getElementById('admRoot');
  var topBar = { hidden: false };   // sidebar shell is always visible; no-op for legacy calls
  var LAST_NEW = 'minerva_admin_lastnew';
  var LAST_USER = 'minerva_admin_lastuser';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }
  function fmtN(n) { return String(n == null ? 0 : n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // compact, uniform table date — "09 Jun 2026" (abbreviated month), matches the last-login column
  function dateShort(s) {
    if (!s) return '\u2014';
    var dt = new Date(s);
    if (isNaN(dt.getTime())) { try { return V.fmtDate(s); } catch (e) { return String(s); } }
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()];
    return (dt.getDate() < 10 ? '0' : '') + dt.getDate() + ' ' + mon + ' ' + dt.getFullYear();
  }
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
    'User types': { fr: "Types d'utilisateur" }, 'User roles': { fr: "Rôles d'utilisateur" }, 'User permissions': { fr: 'Autorisations' }, 'Audit logs': { fr: "Journaux d'audit" }, 'Main': { fr: 'Principal' },
    'Actions': { fr: 'Actions' }, 'Notifications': { fr: 'Notifications' }, 'Notification logs': { fr: 'Journaux de notifications' }, 'Triggers': { fr: 'Déclencheurs' }, 'Widgets': { fr: 'Widgets' }, 'Events': { fr: 'Événements' }, 'Event logs': { fr: "Journaux d'événements" }, 'Messages': { fr: 'Messages' }, 'Automations': { fr: 'Automatisations' },
    'Profile': { fr: 'Profil' }, 'Help & Support': { fr: 'Aide et assistance' }, 'Minerva Concierge': { fr: 'Concierge Minerva' }, 'Sign out': { fr: 'Se déconnecter' },
    'User groups': { fr: "Groupes d'utilisateurs" }, 'Marketing': { fr: 'Marketing' }, 'Heritage': { fr: 'Patrimoine' }, 'News': { fr: 'Actualités' }, 'Campaigns': { fr: 'Campagnes' },
    'Subscriptions': { fr: 'Abonnements' }, 'Invoices': { fr: 'Factures' }, 'Payments': { fr: 'Paiements' }, 'Subscription types': { fr: "Types d'abonnement" }, 'Integrations': { fr: 'Intégrations' },
    'Administration': { fr: 'Administration' }, 'User Management': { fr: 'Gestion des utilisateurs' },
    'Super-admin': { fr: 'Super-administrateur' }, 'Admin': { fr: 'Administrateur' },
    'New record': { fr: 'Nouvel enregistrement' }, 'Save record': { fr: "Enregistrer" }, 'Cancel': { fr: 'Annuler' },
    'Show': { fr: 'Afficher' }, 'records': { fr: 'enregistrements' }, 'Prev': { fr: 'Préc.' }, 'Next': { fr: 'Suiv.' },
    'Notifications': { fr: 'Notifications' }, 'Mark all read': { fr: 'Tout marquer comme lu' },
    'Search users, vehicles, certificates…': { fr: 'Rechercher utilisateurs, véhicules, certificats…' },
    'Ask the Minerva concierge…': { fr: 'Demandez au concierge Minerva…' }
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
    var lbl = document.getElementById('admLbl'); if (lbl) lbl.textContent = (V.isHeritage && V.isHeritage()) ? 'Heritage' : T(V.isSuperAdmin() ? 'Administration' : 'User Management');
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
      +   ''
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

  /* ---------------- USER GROUPS ---------------- */
  var groupSel = null, groupAdding = false, groupSelected = {}, groupMemberQuery = '';
  function groupName(id) { var g = V.getGroups().filter(function (x) { return x.id === id; })[0]; return g ? g.name : ''; }
  function renderGroups() {
    topBar.hidden = false;
    var list = V.getGroups();
    var users = (V.store.all ? V.store.all() : []) || [];
    function memCount(g) { return (g.members || []).filter(function (id) { return users.some(function (u) { return u.id === id; }); }).length; }
    var cols = '38px 220px 360px 110px';
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span class="c-check"><input type="checkbox" class="rowsel-all" aria-label="Select all"></span><span>Group</span><span>Description</span><span>Members</span></div>'
      + list.map(function (g) {
          return '<div class="adm-row" style="--cols:' + cols + '"><span class="c-check"><input type="checkbox" class="rowsel" data-sel="' + esc(g.id) + '"' + (groupSelected[g.id] ? ' checked' : '') + '></span>'
            + '<span class="c-name"><a data-grp="' + esc(g.id) + '">' + esc(g.name) + '</a></span>'
            + '<span class="c-email">' + esc(g.desc || '\u2014') + '</span>'
            + '<span class="veh-c">' + memCount(g) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No user groups yet. Press \u201cNew group\u201d to create one.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="User groups"><div class="adm-listhead">'
      + '<p class="adm-crumb"><a class="cr-root" href="#users">Users</a><span class="cr-sep">\u203a</span><span class="cr-here">User groups</span></p>'
      + '<button class="btn-new" id="grpNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New group</button></div>'
      + (groupAdding ? groupCreateForm() : '')
      + '<div class="bulk-bar" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 6px;">' + bulkControlsHtml([['delete', 'Delete selected']]) + '</div>'
      + rows + '</div>';
    bindBack('#dashboard');
    var nb = document.getElementById('grpNew'); if (nb) nb.addEventListener('click', function () { groupAdding = !groupAdding; renderGroups(); });
    if (groupAdding) wireGroupCreate();
    [].forEach.call(root.querySelectorAll('[data-grp]'), function (a) { a.addEventListener('click', function () { groupSel = a.getAttribute('data-grp'); groupMemberQuery = ''; location.hash = '#grouprec'; render(); }); });
    wireBulk(root.querySelector('.adm-wrap'), groupSelected, function (action, ids) {
      if (action !== 'delete') return;
      var recs = V.getGroups().filter(function (g) { return ids.indexOf(g.id) >= 0; });
      mvBulkModal({ title: 'Delete user groups', verb: 'permanently delete', noun: 'group', confirmLabel: 'Delete', confirmCls: 'danger',
        items: recs.map(function (g) { return { cells: [g.name, (g.members || []).length + ' members'] }; }),
        run: function () { V.setGroups(V.getGroups().filter(function (g) { return ids.indexOf(g.id) < 0; })); recs.forEach(function (g) { if (V.logActivity) V.logActivity('updated', 'Group deleted \u00b7 ' + g.name); }); return { done: recs.length, skipped: 0 }; },
        onClose: function () { groupSelected = {}; renderGroups(); } });
    });
  }
  function groupCreateForm() {
    return '<form class="veh-newform" id="grpForm" onsubmit="return false;" style="max-width:560px;margin-bottom:8px;">'
      + '<div class="ff"><label for="gName">Group name</label><div class="ff-input"><input id="gName" type="text" placeholder="Founding Commissioners" autocomplete="off"></div></div>'
      + '<div class="ff"><label for="gDesc">Description</label><div class="ff-input"><input id="gDesc" type="text" placeholder="A short note on who belongs here" autocomplete="off"></div></div>'
      + '<p class="adm-okmsg" id="gMsg" style="min-height:14px;"></p>'
      + '<div class="adm-extend"><button class="btn" type="submit" id="gSave">Create group</button></div></form>';
  }
  function wireGroupCreate() {
    var b = document.getElementById('gSave');
    if (b) b.addEventListener('click', function () {
      var name = (document.getElementById('gName').value || '').trim();
      if (!name) { var m = document.getElementById('gMsg'); if (m) m.textContent = 'A group name is required.'; return; }
      var g = { id: 'grp_' + Date.now(), name: name, desc: (document.getElementById('gDesc').value || '').trim(), members: [] };
      V.setGroups([g].concat(V.getGroups()));
      if (V.logActivity) V.logActivity('updated', 'Group created \u00b7 ' + name);
      groupAdding = false; groupSel = g.id; location.hash = '#grouprec'; render();
    });
  }
  function renderGroup() {
    topBar.hidden = false;
    var g = V.getGroups().filter(function (x) { return x.id === groupSel; })[0];
    if (!g) { location.hash = '#groups'; render(); return; }
    var users = (V.store.all ? V.store.all() : []) || [];
    var members = users.filter(function (u) { return (g.members || []).indexOf(u.id) >= 0; });
    var q = groupMemberQuery.trim().toLowerCase();
    var candidates = users.filter(function (u) {
      if ((g.members || []).indexOf(u.id) >= 0) return false;
      if (!q) return true;
      return (u.name || '').toLowerCase().indexOf(q) >= 0 || (u.email || '').toLowerCase().indexOf(q) >= 0;
    }).slice(0, 8);
    function roleChip(u) { var r = u.role || 'vip'; var lab = r === 'heritage' ? (TIER_LABEL[u.tier] || 'Heritage') : (r === 'admin' ? 'Admin' : 'VIP'); return '<span class="role-chip ' + r + '">' + esc(lab) + '</span>'; }
    var mcols = '40px 200px 240px 120px';
    var memberRows = members.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + mcols + '"><span></span><span>Name</span><span>Email</span><span>Type</span></div>'
      + members.map(function (u) {
          return '<div class="adm-row" style="--cols:' + mcols + '"><span class="c-check"><a data-grpremove="' + esc(u.id) + '" title="Remove from group" style="color:var(--minerva-red-bright);cursor:pointer;font-family:var(--mono);font-size:14px;">\u00d7</a></span>'
            + '<span class="c-name">' + esc(u.name) + '</span><span class="c-email">' + esc(u.email) + '</span><span class="c-status">' + roleChip(u) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No members yet \u2014 add accounts below.</p>';
    var candRows = candidates.map(function (u) {
      return '<div class="grp-cand" data-grpadd="' + esc(u.id) + '"><span class="gc-name">' + esc(u.name) + '</span><span class="gc-email">' + esc(u.email) + '</span><span class="gc-add">+ Add</span></div>';
    }).join('') || '<p class="field-hint" style="padding:8px 0;">No matching accounts.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Group">'
      + '<p class="adm-crumb"><a class="cr-root" href="#groups">User groups</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(g.name) + '</span></p>'
      + '<div class="adm-detail-meta" style="margin-top:18px;"><span>' + esc(g.desc || 'No description') + '</span><span>Members <b>' + members.length + '</b></span></div>'
      + '<form class="veh-newform" id="grpEdit" onsubmit="return false;" style="max-width:560px;margin-top:18px;">'
      +   '<div class="adm-extend"><div class="ff" style="flex:1;"><label for="geName">Group name</label><div class="ff-input"><input id="geName" type="text" value="' + esc(g.name) + '"></div></div>'
      +     '<div class="ff" style="flex:1.4;"><label for="geDesc">Description</label><div class="ff-input"><input id="geDesc" type="text" value="' + esc(g.desc || '') + '"></div></div>'
      +     '<button class="btn" type="submit" id="geSave">Save</button></div>'
      +   '<p class="adm-okmsg" id="geMsg" style="min-height:14px;"></p></form>'
      + '<p class="adm-section-h">Members</p>' + memberRows
      + '<p class="adm-section-h">Add members</p>'
      + '<div class="grp-add"><div class="ff-input grp-search"><input id="grpSearch" type="search" placeholder="Search name or email\u2026" value="' + esc(groupMemberQuery) + '" autocomplete="off"></div>'
      +   '<div class="grp-cands">' + candRows + '</div></div>'
      + '<p class="adm-section-h">Delete group</p>'
      + '<div class="adm-extend"><button class="btn-cancel" type="button" id="grpDel">Delete group</button></div>'
      + '</div>';
    bindBack('#groups');
    var save = document.getElementById('geSave');
    if (save) save.addEventListener('click', function () {
      var nm = (document.getElementById('geName').value || '').trim(); if (!nm) return;
      saveGroup(g.id, { name: nm, desc: (document.getElementById('geDesc').value || '').trim() });
      var m = document.getElementById('geMsg'); if (m) m.textContent = 'Saved.';
    });
    [].forEach.call(root.querySelectorAll('[data-grpremove]'), function (a) { a.addEventListener('click', function () { var id = a.getAttribute('data-grpremove'); saveGroup(g.id, { members: (V.getGroups().filter(function (x) { return x.id === g.id; })[0].members || []).filter(function (m) { return m !== id; }) }); renderGroup(); }); });
    [].forEach.call(root.querySelectorAll('[data-grpadd]'), function (a) { a.addEventListener('click', function () { var id = a.getAttribute('data-grpadd'); var cur = (V.getGroups().filter(function (x) { return x.id === g.id; })[0].members || []).slice(); if (cur.indexOf(id) < 0) cur.push(id); saveGroup(g.id, { members: cur }); renderGroup(); }); });
    var srch = document.getElementById('grpSearch');
    if (srch) srch.addEventListener('input', function () { groupMemberQuery = srch.value; var box = root.querySelector('.grp-cands'); var qq = srch.value.trim().toLowerCase(); var cs = users.filter(function (u) { if ((V.getGroups().filter(function (x) { return x.id === g.id; })[0].members || []).indexOf(u.id) >= 0) return false; if (!qq) return true; return (u.name || '').toLowerCase().indexOf(qq) >= 0 || (u.email || '').toLowerCase().indexOf(qq) >= 0; }).slice(0, 8); box.innerHTML = cs.map(function (u) { return '<div class="grp-cand" data-grpadd="' + esc(u.id) + '"><span class="gc-name">' + esc(u.name) + '</span><span class="gc-email">' + esc(u.email) + '</span><span class="gc-add">+ Add</span></div>'; }).join('') || '<p class="field-hint" style="padding:8px 0;">No matching accounts.</p>'; [].forEach.call(box.querySelectorAll('[data-grpadd]'), function (a) { a.addEventListener('click', function () { var id = a.getAttribute('data-grpadd'); var cur = (V.getGroups().filter(function (x) { return x.id === g.id; })[0].members || []).slice(); if (cur.indexOf(id) < 0) cur.push(id); saveGroup(g.id, { members: cur }); renderGroup(); }); }); });
    document.getElementById('grpDel').addEventListener('click', function () {
      if (confirm('Delete \u201c' + g.name + '\u201d?')) { V.setGroups(V.getGroups().filter(function (x) { return x.id !== g.id; })); if (V.logActivity) V.logActivity('updated', 'Group deleted \u00b7 ' + g.name); groupSel = null; location.hash = '#groups'; render(); }
    });
  }
  function saveGroup(id, patch) {
    V.setGroups(V.getGroups().map(function (g) { return g.id === id ? Object.assign({}, g, patch) : g; }));
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
      +   ''
      +   '<form class="adm-form" id="newForm" autocomplete="off" onsubmit="return false;">'
      +     (sup
          ? '<div class="ff"><label>Account type</label><div class="seg" id="segType">'
            + '<button type="button" data-type="vip" class="on">VIP guest</button>'
            + '<button type="button" data-type="admin">Admin</button>'
            + '<button type="button" data-type="heritage">Heritage</button></div>'
            + '<span class="field-hint" id="typeHint">VIP \u2014 time-limited access to the private pages.</span></div>'
          : '<input type="hidden" id="fixedType" value="vip">')
      +     '<div class="ff" id="heritBlock" style="display:none;">'
      +       '<label for="nTier">Membership tier</label>'
      +       '<div class="ff-input"><select id="nTier" class="ff-select"><option value="admirer">Admirer</option><option value="custodian">Custodian</option><option value="commissioner">Commissioner</option></select></div>'
      +       '<label for="nVin" style="margin-top:12px;">Vehicle VIN (owner tiers)</label>'
      +       '<div class="ff-input"><input id="nVin" type="text" placeholder="Optional \u2014 the member\u2019s Minerva"></div>'
      +       '<span class="field-hint">Created by an admin, the member is active immediately.</span>'
      +     '</div>'
      +     '<div class="ff"><label for="nName">Full name</label><div class="ff-input"><input id="nName" type="text" placeholder="e.g. Alexandra Verhoeven"></div></div>'
      +     '<div class="ff"><label for="nEmail">Email address</label><div class="ff-input"><input id="nEmail" type="email" placeholder="e.g. guest@example.com"></div></div>'
      +     '<div class="ff"><label for="nLang">Language</label><div class="ff-input"><select id="nLang" class="ff-select">' + ADM_LANG_OPTS('en') + '</select></div>'
      +       '<span class="field-hint">The invitation email and the user\u2019s sign-in link are sent in this language.</span></div>'
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

    if (sup) {
      var seg = document.getElementById('segType');
      var hint = document.getElementById('typeHint');
      [].forEach.call(seg.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          type = b.getAttribute('data-type');
          [].forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          if (type === 'admin') {
            dateBlock.style.display = 'none';
            document.getElementById('heritBlock').style.display = 'none';
            hint.textContent = 'Admin \u2014 full console access, never expires.';
          } else if (type === 'heritage') {
            dateBlock.style.display = 'none';
            document.getElementById('heritBlock').style.display = '';
            hint.textContent = 'Heritage \u2014 tiered member portal (vehicles, archive, news).';
          } else {
            dateBlock.style.display = '';
            document.getElementById('heritBlock').style.display = 'none';
            hint.textContent = 'VIP \u2014 time-limited access to the private pages.';
          }
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
      if (V.store.findByEmail(email)) { err.textContent = 'A user with this email already exists'; return; }
      var end = null;
      if (role === 'vip') {
        end = endEl.value;
        if (!end) { err.textContent = 'Choose an access end date'; return; }
        if (end < minDate || end > maxDate) { err.textContent = 'End date must be within the next three months'; return; }
      }
      var u;
      if (role === 'heritage') {
        var tierSel = document.getElementById('nTier').value;
        u = V.store.create(name, email, null, 'heritage', document.getElementById('nLang').value, { tier: tierSel, vin: document.getElementById('nVin').value.trim() || null, status: 'active' });
        V.logActivity('user-created', name + ' (' + (TIER_LABEL[tierSel] || 'Heritage') + ')');
      } else {
        u = V.store.create(name, email, end, role, document.getElementById('nLang').value);
        V.logActivity('user-created', name);
      }
      ssSet(LAST_NEW, u.id);
      location.hash = '#created'; render();
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

    var u2 = V.store.get(u.id);
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Invitation Sent">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#users">Manage Users</a><span class="cr-sep">›</span><span class="cr-here">Invitation ' + esc(verb || 'sent') + '</span></p>'
      +   '<p class="adm-sub">An email invitation has been sent to ' + esc(u2.email) + ' with a sign-in link and a one-time password.</p>'
      +   '<div class="cred-card">'
      +     '<div class="cred-row"><span class="k">Account type</span><span class="v">' + (u2.role === 'admin' ? 'Admin' : 'VIP guest') + '</span></div>'
      +     '<div class="cred-row"><span class="k">Name</span><span class="v">' + esc(u2.name) + '</span></div>'
      +     '<div class="cred-row"><span class="k">Email</span><span class="v">' + esc(u2.email) + '</span></div>'
      +     '<div class="cred-row"><span class="k">One-time password</span><span class="v pw">' + esc(u2.pw) + '</span></div>'
      +     '<div class="cred-row"><span class="k">Access valid until</span><span class="v">' + (u2.endDate ? esc(V.fmtDate(u2.endDate)) : 'No expiry (admin)') + '</span></div>'
      +     '<p class="cred-deliver">Sign-in link \u00b7 <a href="' + esc(inviteLink(u2)) + '">' + esc(inviteLink(u2)) + '</a></p>'
      +   '</div>'
      + '</div>';
    bindBack('#users');
  }
  function renderCreated() {
    var u = V.store.get(ss(LAST_NEW));
    if (!u) { location.hash = '#users'; render(); return; }
    runInviteFlow(u, 'sent');
  }

  /* ---------------- MANAGE USERS LIST ---------------- */
  var pageSize = (function(){ try { var n = parseInt(localStorage.getItem('minerva_admin_pagesize'),10); return [10,20,50].indexOf(n)>=0 ? n : 20; } catch(e){ return 20; } })();
  function setPageSize(n){ pageSize = n; try{ localStorage.setItem('minerva_admin_pagesize', String(n)); }catch(e){} }
  function sizeSelect(){ return '<div class="page-size"><label>Show</label><select class="pagesize-sel">' + [10,20,50].map(function(n){ return '<option value="'+n+'"'+(n===pageSize?' selected':'')+'>'+n+'</option>'; }).join('') + '</select><span>records</span></div>'; }
  var usersPage = 1, vehPage = 1;
  var vehSelected = {};  // bulk-select on the vehicles tabs
  var usersSelected = {};  // bulk-select on the users page: { userId: true }
  var userEditing = false;  // edit-mode toggle on the user detail page
  var subAssigning = false; // assign/edit-subscription toggle on the user detail page
  function subSectionHtml(u, roleKey) {
    var sub = u.subscription;
    var html = '';
    if (subAssigning) {
      var plans = V.getSubscriptions().filter(function (p) { return !p.roles || !p.roles.length || p.roles.indexOf(roleKey) >= 0; });
      if (!plans.length) {
        return html + '<p class="adm-okmsg" style="color:var(--mute);margin:-2px 0 12px;">No subscription plans available for this role. Create one under Settings \u203a Subscription types.</p>'
          + '<div class="adm-extend"><button class="btn-cancel" type="button" id="subCancelAssign" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>';
      }
      var curId = sub && sub.planId;
      var opts = plans.map(function (p) { return '<option value="' + esc(p.id) + '"' + (curId === p.id ? ' selected' : '') + '>' + esc(p.name) + ' \u00b7 ' + capPeriod(p.period) + ' \u00b7 ' + esc(p.price || '\u2014') + '</option>'; }).join('');
      var today = new Date().toISOString().slice(0, 10);
      return html + '<form class="adm-form" id="subAssignForm" onsubmit="return false;" style="margin-top:14px;max-width:560px;">'
        + '<div class="ff"><label for="usPlan">Plan</label><div class="ff-input"><select id="usPlan" class="ff-select">' + opts + '</select></div></div>'
        + '<div class="ff"><label for="usStart">Start date</label><div class="ff-input"><input id="usStart" type="date" value="' + esc((sub && sub.start) || today) + '"></div></div>'
        + '<div class="ff"><label class="set-toggle-row" style="display:flex;align-items:center;gap:14px;cursor:pointer;justify-content:space-between;max-width:320px;"><span>Renewal reminder</span><label class="set-toggle"><input type="checkbox" id="usReminder"' + ((sub ? sub.reminder : true) ? ' checked' : '') + '><span class="tk"></span></label></label></div>'
        + '<p class="field-hint">End date is set automatically from the plan period.</p>'
        + '<div class="adm-extend"><button class="btn" type="button" id="usSave">Save subscription</button><button class="btn-cancel" type="button" id="subCancelAssign" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
        + '</form>';
    }
    if (sub) {
      return html + '<div class="adm-detail-meta">'
        + '<span>Plan <b>' + esc(sub.name) + '</b></span>'
        + '<span>Period <b>' + capPeriod(sub.period) + '</b></span>'
        + '<span>Start <b>' + (sub.start ? esc(V.fmtDate(sub.start)) : '\u2014') + '</b></span>'
        + '<span>End <b>' + (sub.end ? esc(V.fmtDate(sub.end)) : '\u2014') + '</b></span>'
        + '<span>Price <b>' + esc(sub.price || '\u2014') + '</b></span>'
        + '<span>Payment <b>' + capPeriod(sub.payment) + '</b></span>'
        + '<span>Renewal reminder <b>' + (sub.reminder ? 'Active' : 'Not active') + '</b></span>'
        + '</div>'
        + '<div class="adm-extend"><button class="btn-new" type="button" id="subEditBtn"><svg viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>Edit subscription</button><button class="btn-cancel" type="button" id="subRemoveBtn" style="border-color:var(--line);color:var(--fg-dim);">Remove</button></div>';
    }
    return html + '<p class="adm-okmsg" style="color:var(--mute);margin:-2px 0 12px;">No subscription assigned.</p>'
      + '<div class="adm-extend"><button class="btn" type="button" id="subAssignBtn">Assign subscription</button></div>';
  }
  // Always-visible pager: "← Prev  Page X of Y · N results  Next →"
  function pagerBlock(page, count, noun, prevId, nextId) {
    var totalPages = Math.max(1, Math.ceil(count / pageSize));
    return '<div class="au-pager">'
      + '<button type="button" class="au-pg" id="' + prevId + '"' + (page <= 1 ? ' disabled' : '') + '>\u2190 Prev</button>'
      + '<span class="au-pg-info">Page ' + page + ' of ' + totalPages + ' \u00b7 ' + count + ' ' + noun + (count === 1 ? '' : 's') + '</span>'
      + '<button type="button" class="au-pg" id="' + nextId + '"' + (page >= totalPages ? ' disabled' : '') + '>Next \u2192</button>'
      + '</div>' + sizeSelect();
  }
  function userStatus(u) {
    var role = u.role || 'vip';
    if (u.cancelled) return { label: 'Cancelled', cls: 'st-red' };
    if (role === 'heritage') {
      if (u.status === 'denied') return { label: 'Denied', cls: 'st-red' };
      if (u.status === 'pending') return { label: 'Pending', cls: 'st-amber' };
      if (V.isExpired(u)) return { label: 'Lapsed', cls: 'st-red' };
      return { label: 'Active', cls: 'st-green' };
    }
    if (role === 'admin') return { label: 'Active', cls: 'st-green' };
    if (V.isExpired(u)) return { label: 'Expired', cls: 'st-red' };
    return { label: 'Active', cls: 'st-green' };
  }
  var usersFilter = { status: 'all', type: 'all', tier: 'all' };
  function usrFilterRow(f) {
    var ST = [['all', 'All statuses'], ['active', 'Active'], ['pending', 'Pending'], ['denied', 'Denied'], ['lapsed', 'Lapsed'], ['expired', 'Expired'], ['cancelled', 'Cancelled']];
    var TY = [['all', 'All types'], ['admin', 'Admin'], ['vip', 'VIP'], ['heritage', 'Heritage']];
    var TR = [['all', 'All tiers'], ['admirer', 'Admirer'], ['custodian', 'Custodian'], ['commissioner', 'Commissioner']];
    function o(a, s) { return a.map(function (x) { return '<option value="' + x[0] + '"' + (s === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join(''); }
    var ss = 'background:var(--fld-bg);border:1px solid var(--line);color:var(--fg);font-family:var(--mono);font-size:11px;letter-spacing:.08em;padding:8px 10px;cursor:pointer;';
    var ls = 'display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--platinum-deep);';
    return '<div style="display:flex;gap:18px;flex-wrap:wrap;margin:clamp(14px,2vh,20px) 0 2px;">'
      + '<label style="' + ls + '">Type<select id="fltType" class="usr-sel">' + o(TY, f.type) + '</select></label>'
      + '<label style="' + ls + '">Status<select id="fltStatus" class="usr-sel">' + o(ST, f.status) + '</select></label>'
      + '<label style="' + ls + '">Tier<select id="fltTier" class="usr-sel">' + o(TR, f.tier) + '</select></label>'
      + '<label style="' + ls + '">Action<select id="bulkAction" class="usr-sel"><option value="">Bulk action\u2026</option><option value="approve">Approve membership</option><option value="resend">Resend invite</option><option value="cancel-sub">Cancel subscription</option><option value="revert">Revert membership to pending</option><option value="cancel-mem">Revoke membership</option></select></label>'
      + '<button type="button" id="bulkExec" class="bulk-exec" hidden>Execute</button>'
      + '<span id="bulkCount" class="bulk-count"></span>'
      + '</div>';
  }
  // branded confirmation modal for bulk user actions
  var BULK_META = {
    'approve':    { title: 'Approve membership', verb: 'approve the membership of', go: 'Approve', cls: 'go' },
    'resend':     { title: 'Resend invitation', verb: 'resend the invitation to', go: 'Send invitations', cls: 'go' },
    'cancel-sub': { title: 'Cancel subscription', verb: 'cancel the subscription of', go: 'Cancel subscriptions', cls: 'danger' },
    'cancel-mem': { title: 'Revoke membership', verb: 'revoke the membership of', go: 'Revoke memberships', cls: 'danger' },
    'revert':     { title: 'Revert to pending', verb: 'revert to pending the membership of', go: 'Revert to pending', cls: 'danger' }
  };
  // generic branded bulk-confirmation modal (reused by every table)
  // o: { title, verb, noun, items:[{cells:[..]}], confirmLabel, confirmCls('go'|'danger'), run:fn->{done,skipped}, onClose }
  function mvBulkModal(o) {
    var n = o.items.length;
    var rowsHtml = o.items.map(function (it) {
      return '<div class="mv-sb-row">' + it.cells.map(function (c, i) { return '<span class="' + (i === 0 ? 'nm' : (i === 1 ? 'em' : '')) + '">' + esc(c) + '</span>'; }).join('') + '</div>';
    }).join('');
    var noun = o.noun || 'record';
    var modal = document.createElement('div');
    modal.className = 'mv-modal';
    modal.innerHTML = ''
      + '<div class="mv-dialog" role="dialog" aria-modal="true">'
      +   '<div class="mv-dhead"><span>' + esc(o.title) + '</span><button class="mv-x" type="button" aria-label="Close">\u00d7</button></div>'
      +   '<div class="mv-dbody">'
      +     '<p class="mv-dmsg">You are about to <b>' + esc(o.verb) + '</b> <span class="gold">' + n + '</span> ' + esc(n === 1 ? noun : noun + 's') + '.</p>'
      +     '<div class="mv-sandbox"><div class="mv-sb-head"><span>Affected records</span><span>' + n + '</span></div><div class="mv-sb-list">' + rowsHtml + '</div></div>'
      +   '</div>'
      +   '<div class="mv-dfoot"><button class="mv-btn ghost" type="button" data-mv="cancel">Cancel</button><button class="mv-btn ' + (o.confirmCls || 'go') + '" type="button" data-mv="go">' + esc(o.confirmLabel) + '</button></div>'
      + '</div>';
    document.body.appendChild(modal);
    function close() { if (modal.parentNode) modal.parentNode.removeChild(modal); }
    function finish() { close(); if (o.onClose) o.onClose(); }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.mv-x').addEventListener('click', close);
    modal.querySelector('[data-mv="cancel"]').addEventListener('click', close);
    modal.querySelector('[data-mv="go"]').addEventListener('click', function () {
      var r = o.run() || {}; var okCount = r.done || 0, skipped = r.skipped || 0;
      var dialog = modal.querySelector('.mv-dialog');
      dialog.innerHTML = ''
        + '<div class="mv-dhead"><span>' + esc(o.title) + '</span><button class="mv-x" type="button" aria-label="Close">\u00d7</button></div>'
        + '<div class="mv-dbody"><div class="mv-result">'
        +   '<div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>'
        +   '<div class="msg"><b>' + okCount + '</b> ' + esc(okCount === 1 ? noun : noun + 's') + ' updated</div>'
        +   (skipped ? '<div class="sub">' + skipped + ' skipped \u00b7 not applicable</div>' : '<div class="sub">' + esc(o.title) + ' complete</div>')
        + '</div></div>'
        + '<div class="mv-dfoot"><button class="mv-btn go" type="button" data-mv="close">Done</button></div>';
      dialog.querySelector('.mv-x').addEventListener('click', finish);
      dialog.querySelector('[data-mv="close"]').addEventListener('click', finish);
    });
  }
  // generic bulk controls: an Action <select> + (hidden) Execute + count, for any table
  function bulkControlsHtml(actions) {
    var ls = 'display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--platinum-deep);';
    return '<label style="' + ls + '">Action<select class="usr-sel bulk-action"><option value="">Bulk action\u2026</option>'
      + actions.map(function (a) { return '<option value="' + a[0] + '">' + esc(a[1]) + '</option>'; }).join('')
      + '</select></label>'
      + '<button type="button" class="bulk-exec" hidden>Execute</button>'
      + '<span class="bulk-count"></span>';
  }
  // wire select-all + row checkboxes + execute for a table. onExec(action, ids) opens a modal.
  function wireBulk(scope, selStore, onExec) {
    function selIds() { return Object.keys(selStore).filter(function (k) { return selStore[k]; }); }
    function refresh() {
      var boxes = [].slice.call(scope.querySelectorAll('.rowsel'));
      var checked = boxes.filter(function (b) { return b.checked; }).length;
      var allBox = scope.querySelector('.rowsel-all');
      if (allBox) { allBox.checked = boxes.length > 0 && checked === boxes.length; allBox.indeterminate = checked > 0 && checked < boxes.length; }
      var cnt = scope.querySelector('.bulk-count'); if (cnt && !cnt.classList.contains('warn')) cnt.textContent = checked ? (checked + ' selected') : '';
    }
    var allBox = scope.querySelector('.rowsel-all');
    if (allBox) allBox.addEventListener('change', function () {
      [].forEach.call(scope.querySelectorAll('.rowsel'), function (b) { b.checked = allBox.checked; selStore[b.getAttribute('data-sel')] = allBox.checked; });
      refresh();
    });
    [].forEach.call(scope.querySelectorAll('.rowsel'), function (b) {
      b.addEventListener('change', function () { selStore[b.getAttribute('data-sel')] = b.checked; refresh(); });
    });
    var sel = scope.querySelector('.bulk-action'), exec = scope.querySelector('.bulk-exec');
    if (sel && exec) {
      exec.hidden = !sel.value;
      sel.addEventListener('change', function () { exec.hidden = !sel.value; var c = scope.querySelector('.bulk-count'); if (c && c.classList.contains('warn')) { c.className = 'bulk-count'; c.textContent = ''; refresh(); } });
      exec.addEventListener('click', function () {
        var action = sel.value, ids = selIds(), cnt = scope.querySelector('.bulk-count');
        if (!ids.length) { if (cnt) { cnt.textContent = 'Select one or more records first.'; cnt.className = 'bulk-count warn'; } return; }
        if (!action) { if (cnt) { cnt.textContent = 'Choose an action first.'; cnt.className = 'bulk-count warn'; } return; }
        onExec(action, ids);
      });
    }
    refresh();
  }

  function openBulkModal(action, ids) {
    var meta = BULK_META[action]; if (!meta) return;
    var users = ids.map(function (id) { return V.store.get(id); }).filter(Boolean);
    function roleLabelOf(u) { return u.role === 'admin' ? 'Admin' : (u.role === 'heritage' ? 'Heritage' : 'VIP'); }
    var rowsHtml = users.map(function (u) {
      return '<div class="mv-sb-row"><span class="nm">' + esc(u.name) + '</span><span class="em">' + esc(u.email) + '</span><span>' + roleLabelOf(u) + '</span></div>';
    }).join('');
    var modal = document.createElement('div');
    modal.className = 'mv-modal';
    modal.innerHTML = ''
      + '<div class="mv-dialog" role="dialog" aria-modal="true">'
      +   '<div class="mv-dhead"><span>' + esc(meta.title) + '</span><button class="mv-x" type="button" aria-label="Close">\u00d7</button></div>'
      +   '<div class="mv-dbody">'
      +     '<p class="mv-dmsg">You are about to <b>' + esc(meta.verb) + '</b> <span class="gold">' + users.length + '</span> ' + (users.length === 1 ? 'member' : 'members') + '.</p>'
      +     '<div class="mv-sandbox"><div class="mv-sb-head"><span>Affected records</span><span>' + users.length + '</span></div><div class="mv-sb-list">' + rowsHtml + '</div></div>'
      +   '</div>'
      +   '<div class="mv-dfoot"><button class="mv-btn ghost" type="button" data-mv="cancel">Cancel</button><button class="mv-btn ' + meta.cls + '" type="button" data-mv="go">' + esc(meta.go) + '</button></div>'
      + '</div>';
    document.body.appendChild(modal);
    function close() { if (modal.parentNode) modal.parentNode.removeChild(modal); }
    function done() { close(); usersSelected = {}; renderUsers(); }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.mv-x').addEventListener('click', close);
    modal.querySelector('[data-mv="cancel"]').addEventListener('click', close);
    modal.querySelector('[data-mv="go"]').addEventListener('click', function () {
      var okCount = 0, skipped = 0;
      ids.forEach(function (id) {
        var u = V.store.get(id); if (!u) return;
        if (action === 'resend') { V.store.markInviteSent(id); okCount++; }
        else if (action === 'approve') { if (u.role === 'heritage' && u.status === 'pending') { V.store.approveMember(id, u.tier || 'admirer', ''); if (V.logActivity) V.logActivity('member-approved', u.name); okCount++; } else skipped++; }
        else if (action === 'cancel-sub') { if (u.subscription) { V.store.update(id, { subscription: null }); okCount++; } else skipped++; }
        else if (action === 'cancel-mem') { if (u.role === 'heritage' && !u.cancelled) { V.store.cancel(id); okCount++; } else skipped++; }
        else if (action === 'revert') { if (u.role === 'heritage' && u.status !== 'pending') { V.store.update(id, { status: 'pending', endDate: null, decision: null, cancelled: null }); if (V.logActivity) V.logActivity('updated', u.name + ' reverted to pending'); okCount++; } else skipped++; }
      });
      var dialog = modal.querySelector('.mv-dialog');
      dialog.innerHTML = ''
        + '<div class="mv-dhead"><span>' + esc(meta.title) + '</span><button class="mv-x" type="button" aria-label="Close">\u00d7</button></div>'
        + '<div class="mv-dbody"><div class="mv-result">'
        +   '<div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>'
        +   '<div class="msg"><b>' + okCount + '</b> ' + (okCount === 1 ? 'member' : 'members') + ' updated</div>'
        +   (skipped ? '<div class="sub">' + skipped + ' skipped \u00b7 action not applicable</div>' : '<div class="sub">' + esc(meta.title) + ' complete</div>')
        + '</div></div>'
        + '<div class="mv-dfoot"><button class="mv-btn go" type="button" data-mv="close">Done</button></div>';
      dialog.querySelector('.mv-x').addEventListener('click', done);
      dialog.querySelector('[data-mv="close"]').addEventListener('click', done);
    });
  }

  function renderUsers() {
    topBar.hidden = false;
    var sup = V.isSuperAdmin();
    var all = V.store.all().sort(function (a, b) { return a.no - b.no; });
    // Admins see VIP users only; super-admin sees everyone.
    var list = sup ? all : all.filter(function (u) { return (u.role || 'vip') !== 'admin'; });
    if (usersFilter.type !== 'all') list = list.filter(function (u) { return (u.role || 'vip') === usersFilter.type; });
    if (usersFilter.status !== 'all') list = list.filter(function (u) { return userStatus(u).label.toLowerCase() === usersFilter.status; });
    if (usersFilter.tier !== 'all') list = list.filter(function (u) { return u.role === 'heritage' && (u.tier || 'admirer') === usersFilter.tier; });
    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (usersPage > totalPages) usersPage = totalPages;
    var pageList = list.slice((usersPage - 1) * pageSize, usersPage * pageSize);

    var cols = sup ? '38px 40px 170px 240px 112px 130px 104px 108px 108px' : '38px 40px 170px 240px 130px 104px 108px 108px';
    var head = '<div class="adm-row head" style="--cols:' + cols + '">'
      + '<span class="c-check"><input type="checkbox" class="rowsel-all" aria-label="Select all"></span>'
      + '<span class="c-no">ID</span><span class="c-name">Name</span><span class="c-email">Email</span>'
      + (sup ? '<span class="c-role">Type</span>' : '')
      + '<span class="c-end">Tier</span><span class="c-status">Status</span><span class="c-end">Member since</span><span class="c-login">Last login</span></div>';

    var rows;
    if (!list.length) {
      rows = '<p class="adm-empty">No users yet. Press \u201cNew user\u201d to add one.</p>';
    } else {
      rows = '<div class="adm-table tbl-std">' + head
        + pageList.map(function (u) {
            var role = u.role || 'vip';
            var isHerit = role === 'heritage';
            var heritPending = isHerit && u.status === 'pending';
            var last = (u.logins && u.logins.length) ? V.fmtDateTime(u.logins[u.logins.length - 1]).split(' \u00b7 ')[0] : '\u2014';
            var st = userStatus(u);
            var endCls = (role === 'admin') ? 'none' : ((u.endDate && V.isExpired(u)) || u.cancelled ? 'exp' : (u.endDate ? '' : 'none'));
            var nextRen = (role === 'admin') ? 'No expiry' : (u.cancelled ? 'Cancelled' : (u.endDate ? dateShort(u.endDate) : '\u2014'));
            var tierTxt = isHerit ? (TIER_LABEL[u.tier] || '\u2014') : '\u2014';
            var memberSince = (isHerit && u.created) ? dateShort(iso(new Date(u.created))) : '\u2014';
            var renType = isHerit ? (u.autoRenew !== false ? 'Auto-renew' : 'Manual') : '\u2014';
            var flag = (u.extReq || heritPending) ? ' \u2691' : '';
            return '<div class="adm-row" style="--cols:' + cols + '">'
              + '<span class="c-check"><input type="checkbox" class="rowsel" data-sel="' + esc(u.id) + '"' + (usersSelected[u.id] ? ' checked' : '') + '></span>'
              + '<span class="c-no">' + (u.no < 10 ? '0' : '') + u.no + '</span>'
              + '<span class="c-name"><a data-uid="' + esc(u.id) + '">' + esc(u.name) + flag + '</a></span>'
              + '<span class="c-email">' + esc(u.email) + '</span>'
              + (sup ? '<span class="c-role"><span class="role-chip ' + role + '">' + (role === 'admin' ? 'Admin' : (isHerit ? 'Heritage' : 'VIP')) + '</span></span>' : '')
              + '<span class="c-end">' + esc(tierTxt) + '</span>'
              + '<span class="c-status"><span class="st-chip ' + st.cls + '">' + st.label + '</span></span>'
              + '<span class="c-end">' + esc(memberSince) + '</span>'
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
      +   usrFilterRow(usersFilter)
      +   rows
      +   (list.length ? pagerBlock(usersPage, list.length, sup ? 'account' : 'guest', 'uPrev', 'uNext') : '')
      + '</div>';
    bindBack('#menu');
    document.getElementById('newUserBtn').addEventListener('click', function () { location.hash = '#new'; render(); });
    var fs = document.getElementById('fltStatus'); if (fs) fs.addEventListener('change', function () { usersFilter.status = fs.value; usersPage = 1; renderUsers(); });
    var ft = document.getElementById('fltType'); if (ft) ft.addEventListener('change', function () { usersFilter.type = ft.value; usersPage = 1; renderUsers(); });
    var ftr = document.getElementById('fltTier'); if (ftr) ftr.addEventListener('change', function () { usersFilter.tier = ftr.value; usersPage = 1; renderUsers(); });
    var bulkSel = document.getElementById('bulkAction'); var execBtnEl = document.getElementById('bulkExec');
    if (bulkSel && execBtnEl) { execBtnEl.hidden = !bulkSel.value; bulkSel.addEventListener('change', function () { execBtnEl.hidden = !bulkSel.value; var c = document.getElementById('bulkCount'); if (c && c.classList.contains('warn')) { c.textContent = ''; c.className = 'bulk-count'; } }); }
    var up = document.getElementById('uPrev'); if (up) up.addEventListener('click', function () { if (usersPage > 1) { usersPage--; renderUsers(); } });
    var un = document.getElementById('uNext'); if (un) un.addEventListener('click', function () { usersPage++; renderUsers(); });
    [].forEach.call(root.querySelectorAll('[data-uid]'), function (a) {
      a.addEventListener('click', function () { ssSet(LAST_USER, a.getAttribute('data-uid')); userEditing = false; subAssigning = false; location.hash = '#user'; render(); });
    });

    // ---- bulk select + actions ----
    function selIds() { return Object.keys(usersSelected).filter(function (k) { return usersSelected[k]; }); }
    function refreshBulk() {
      var n = selIds().length;
      var cnt = document.getElementById('bulkCount');
      if (cnt) cnt.textContent = n ? (n + ' selected') : '';
      var allBox = document.getElementById('selAll') || root.querySelector('.rowsel-all');
      var boxes = [].slice.call(root.querySelectorAll('.rowsel'));
      var checked = boxes.filter(function (b) { return b.checked; }).length;
      if (allBox) { allBox.checked = boxes.length > 0 && checked === boxes.length; allBox.indeterminate = checked > 0 && checked < boxes.length; }
    }
    var allBox = root.querySelector('.rowsel-all');
    if (allBox) allBox.addEventListener('change', function () {
      [].forEach.call(root.querySelectorAll('.rowsel'), function (b) { b.checked = allBox.checked; usersSelected[b.getAttribute('data-sel')] = allBox.checked; });
      refreshBulk();
    });
    [].forEach.call(root.querySelectorAll('.rowsel'), function (b) {
      b.addEventListener('change', function () { usersSelected[b.getAttribute('data-sel')] = b.checked; refreshBulk(); });
    });
    var execBtn = document.getElementById('bulkExec');
    if (execBtn) execBtn.addEventListener('click', function () {
      var action = (document.getElementById('bulkAction') || {}).value || '';
      var ids = selIds();
      var cnt = document.getElementById('bulkCount');
      if (!ids.length) { if (cnt) { cnt.textContent = 'Select one or more users first.'; cnt.className = 'bulk-count warn'; } return; }
      if (!action) { if (cnt) { cnt.textContent = 'Choose a bulk action first.'; cnt.className = 'bulk-count warn'; } return; }
      openBulkModal(action, ids);
    });
    refreshBulk();
  }

  /* ---------------- USER DETAIL + AUDIT LOG ---------------- */
  var EV_LABELS = {
    created: 'User created', invited: 'Invitation sent', 're-invited': 'Invitation sent',
    login: 'User login', 'login-error': 'User login error', extended: 'Access extended',
    restored: 'Access restored', extension: 'Access extension requested', cancelled: 'Access cancelled',
    visit: 'Website visit', 'password-changed': 'Password changed', 'password-reset': 'Password reset',
    'anon-visit': 'Website visit', updated: 'Account updated',
    'user-created': 'New user created', 'user-updated': 'User updated', 'user-deleted': 'User deleted',
    'vehicle-created': 'New vehicle created', 'vehicle-updated': 'Vehicle updated', 'vehicle-deleted': 'Vehicle deleted',
    'model-created': 'New model created', 'model-updated': 'Model updated', 'model-deleted': 'Model deleted',
    'coa-created': 'New certificate created', 'coa-updated': 'Certificate updated', 'coa-deleted': 'Certificate deleted',
    approved: 'Membership approved', denied: 'Membership denied', renewed: 'Membership renewed',
    'member-registered': 'Member registered', 'member-approved': 'Membership approved', 'member-denied': 'Membership denied', 'member-renewed': 'Membership renewed',
    'impersonation-start': 'Impersonation started', 'impersonation-end': 'Impersonation ended',
    'mail-edited': 'Email content edited',
    'archive-created': 'Archive document added', 'archive-updated': 'Archive document updated', 'archive-deleted': 'Archive document deleted',
    'news-created': 'News published', 'news-updated': 'News updated', 'news-deleted': 'News deleted'
  };
  function htFor(lang, key, vars) { return window.MinervaHeritageL10n ? window.MinervaHeritageL10n.t(key, lang, vars) : key; }
  function memberLang() { var a = V.account ? V.account() : null; var u = a && a.id ? V.store.get(a.id) : null; return (u && u.lang) || (a && a.lang) || 'en'; }
  function HT(key, vars) { return htFor(memberLang(), key, vars); }
  function memberEmailPreview(u) {
    if (!u || !u.decision) return '';
    var approved = u.decision.action === 'approved';
    var L = u.lang || 'en';
    var tl = htFor(L, 'tier.' + (u.tier || 'admirer'));
    var body = htFor(L, 'mail.greeting', { name: u.name }) + '\n\n'
      + (approved
          ? (u.endDate ? htFor(L, 'mail.approved', { tier: tl, date: V.fmtDate(u.endDate) }) : htFor(L, 'mail.approvedNoDate', { tier: tl }))
          : htFor(L, 'mail.denied'));
    if (u.decision.comment) body += '\n\n' + u.decision.comment;
    body += '\n\n' + htFor(L, 'mail.signoff');
    return '<div class="email-card"><div class="email-h"><span>Automated email</span><span class="email-when">' + (approved ? 'Approved' : 'Denied') + ' \u00b7 ' + esc(V.fmtDateTime(u.decision.ts)) + '</span></div>'
      + '<div class="email-row"><span class="email-k">To</span><span>' + esc(u.email) + '</span></div>'
      + '<div class="email-row"><span class="email-k">Subject</span><span>' + esc(htFor(L, 'mail.subject')) + '</span></div>'
      + '<div class="email-body">' + esc(body).replace(/\n/g, '<br>') + '</div></div>';
  }
  var lastUserSec = null;
  function renderUser() {
    topBar.hidden = false;
    var u = V.store.get(ss(LAST_USER));
    if (!u) { location.hash = '#users'; render(); return; }
    if (lastUserSec !== u.id) { ['user-membership', 'user-subscription', 'user-invitation', 'user-extend', 'user-revoke'].forEach(function (k) { collapseState[k] = true; }); lastUserSec = u.id; }
    var role = u.role || 'vip';
    var isAdminUser = role === 'admin';
    var isHeritageUser = role === 'heritage';
    var tier = u.tier || null;
    var heritPending = isHeritageUser && u.status === 'pending';
    var expired = !isAdminUser && !isHeritageUser && V.isExpired(u);
    var cancelled = !!u.cancelled;
    var sup = V.isSuperAdmin();
    var statusTxt = cancelled ? 'Cancelled' : (isAdminUser ? 'Admin \u00b7 no expiry' : (isHeritageUser ? (heritPending ? 'Membership under review' : 'Active member') : (!u.endDate ? 'Active \u00b7 no expiry' : (expired ? 'Expired' : 'Active'))));
    var statusCls = (cancelled || expired || heritPending) ? 'expired' : '';

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
      +     '<span>Type <b>' + (isAdminUser ? 'Admin' : (isHeritageUser ? ('Heritage \u00b7 ' + (TIER_LABEL[tier] || 'Member')) : 'VIP')) + '</b></span>'
      +     '<span class="adm-status ' + statusCls + '"><span class="pip"></span>' + statusTxt + '</span>'
      +     (isHeritageUser ? (u.vin ? '<span>VIN <b>' + esc(u.vin) + '</b></span>' : '') : (isAdminUser ? '' : '<span>End date <b>' + (u.endDate ? esc(V.fmtDate(u.endDate)) : 'None') + '</b></span>'))
      +   '</div>'
      +   '<div class="adm-listhead" style="margin-top:24px;">'
      +     '<p class="adm-section-h" style="margin:0;">Account details</p>'
      +     (userEditing ? '' : '<button class="btn-new" id="userEdit" type="button"><svg viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>Edit</button>')
      +   '</div>'
      +   (userEditing ? ('<form class="adm-form" id="userForm" onsubmit="return false;" style="margin-top:18px;">'
      +     '<div class="ff"><label for="uName">Full name</label><div class="ff-input"><input id="uName" type="text" value="' + esc(u.name) + '"></div></div>'
      +     '<div class="ff"><label for="uEmail">Email address</label><div class="ff-input"><input id="uEmail" type="email" value="' + esc(u.email) + '"></div></div>'
      +     '<div class="ff"><label for="uLang">Language</label><div class="ff-input"><select id="uLang" class="ff-select">' + ADM_LANG_OPTS(u.lang || 'en') + '</select></div></div>'
      +     (sup ? ('<div class="ff"><label for="uRole">Account role</label><div class="ff-input"><select id="uRole" class="ff-select">'
      +       '<option value="vip"' + (!isAdminUser && !isHeritageUser ? ' selected' : '') + '>VIP</option>'
      +       '<option value="admin"' + (isAdminUser ? ' selected' : '') + '>Admin</option>'
      +       '<option value="heritage"' + (isHeritageUser ? ' selected' : '') + '>Heritage</option>'
      +       '</select></div></div>'
      +       '<div class="ff" id="uTierBlock"' + (isHeritageUser ? '' : ' style="display:none;"') + '><label for="uTier">Heritage tier</label><div class="ff-input"><select id="uTier" class="ff-select">'
      +       ['admirer', 'custodian', 'commissioner'].map(function (t) { return '<option value="' + t + '"' + ((tier || 'admirer') === t ? ' selected' : '') + '>' + TIER_LABEL[t] + '</option>'; }).join('')
      +       '</select></div></div>') : '')
      +     '<p class="adm-err" id="uErr"></p>'
      +     '<div class="adm-extend"><button class="btn" type="submit" id="uSave">Save changes</button><button class="btn-cancel" type="button" id="uCancelEdit" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
      +   '</form>') : '')
      +   (isHeritageUser ? secColl('user-membership', 'Membership',
              '<div class="adm-detail-meta"><span>Tier <b>' + (TIER_LABEL[tier] || 'Member') + '</b></span><span>Status <b>' + (heritPending ? 'Pending review' : (u.status === 'denied' ? 'Denied' : (V.isExpired(u) ? 'Lapsed' : 'Active'))) + '</b></span>' + (u.endDate ? '<span>Renews <b>' + esc(V.fmtDate(u.endDate)) + '</b></span>' : '') + (u.vin ? '<span>VIN <b>' + esc(u.vin) + '</b></span>' : '<span>VIN <b>Not provided</b></span>') + '</div>'
            + ((heritPending || u.status === 'denied')
              ? ('<form class="adm-form" id="decForm" onsubmit="return false;" style="margin-top:16px;max-width:560px;">'
            +         '<div class="ff"><label for="decTier">Confirm tier</label><div class="ff-input"><select id="decTier" class="ff-select">' + ['admirer', 'custodian', 'commissioner'].map(function (t) { return '<option value="' + t + '"' + (tier === t ? ' selected' : '') + '>' + TIER_LABEL[t] + '</option>'; }).join('') + '</select></div></div>'
            +         '<div class="ff"><label for="decMsg">Message to the applicant</label><div class="ff-input"><textarea id="decMsg" rows="3" class="ff-textarea" placeholder="Added to the automated email \u2014 a welcome note, or the reason for declining\u2026"></textarea></div></div>'
            +         '<div class="adm-extend"><button class="btn" type="button" id="acceptBtn">Accept &amp; activate</button><button class="btn-cancel" type="button" id="denyBtn">Deny application</button></div>'
            +         '</form>')
              : '<div class="adm-extend"><button class="btn" type="button" id="renewBtn">Renew 12 months</button><button class="btn-cancel" type="button" id="revertBtn" style="border-color:var(--line);color:var(--fg-dim);">Revert to pending</button>' + (u.cancelled ? '' : '<button class="btn-cancel" type="button" id="revokeMemBtn" style="margin-left:auto;">Revoke membership</button>') + '</div>')
            + memberEmailPreview(u)) : '')
      +   extReqHtml
      +   secColl('user-subscription', 'Subscription', subSectionHtml(u, (isAdminUser ? 'admin' : (isHeritageUser ? (tier || 'admirer') : 'vip'))))
      +   secColl('user-invitation', 'Invitation',
            '<div class="adm-detail-meta"><span>Invitation sent <b>' + (u.inviteSentAt ? esc(V.fmtDateTime(u.inviteSentAt)) : 'Not yet') + '</b></span></div>'
            + '<div class="adm-extend"><button class="btn" type="button" id="resendBtn">Resend invitation</button></div>')
      +   (isAdminUser || isHeritageUser ? '' : secColl('user-extend', 'Extend access',
              (cancelled ? '<p class="field-hint" style="margin:-6px 0 12px;">Access is cancelled. Enter a future date and press Execute to grant access again.</p>' : '')
            + '<form class="adm-extend" id="extForm" onsubmit="return false;">'
            +       '<div class="ff" style="flex:1;min-width:220px;"><label for="extDate">New end date</label>'
            +         '<div class="ff-input"><input id="extDate" type="date" value="' + (cancelled ? '' : (u.endDate || '')) + '" min="' + minDate + '" max="' + maxDate + '"></div>'
            +         '<div class="dp-quick"><button type="button" class="dp-chip" data-add="7">+ 1 week</button>'
            +           '<button type="button" class="dp-chip" data-add="30">+ 1 month</button>'
            +           '<button type="button" class="dp-chip" data-add="90">+ 3 months</button></div>'
            +         '<div class="dp-readout" id="extRead"></div></div>'
            +       '<button class="btn" type="submit" id="extBtn">Execute</button>'
            + '</form>'
            + '<p class="adm-okmsg" id="extMsg" style="margin-top:14px;"></p>'))
      +   secColl('user-revoke', (isAdminUser ? 'Remove admin' : (isHeritageUser ? 'Revoke membership' : 'Cancel access')),
            (cancelled
             ? '<p class="adm-okmsg" style="color:var(--minerva-red-bright);">Access cancelled on ' + esc(V.fmtDateTime(u.cancelled)) + '</p>'
             : '<div class="adm-extend"><button class="btn-cancel" type="button" id="cancelBtn">' + (isAdminUser ? 'Revoke admin access' : (isHeritageUser ? 'Revoke membership' : 'Cancel access')) + '</button></div>'))
      +   (sup ? ('<p class="adm-section-h">Delete account</p>'
              + '<p class="field-hint" style="margin:-6px 0 12px;">Permanently removes this account and its audit trail. This cannot be undone.</p>'
            + '<div class="adm-extend"><button class="btn-cancel" type="button" id="userDel">Delete account</button></div>') : '')
      + '</div>';
    bindBack('#users');

    var subAssignBtn = document.getElementById('subAssignBtn'); if (subAssignBtn) subAssignBtn.addEventListener('click', function () { subAssigning = true; renderUser(); });
    var subEditBtnU = document.getElementById('subEditBtn'); if (subEditBtnU) subEditBtnU.addEventListener('click', function () { subAssigning = true; renderUser(); });
    var subCancelAssign = document.getElementById('subCancelAssign'); if (subCancelAssign) subCancelAssign.addEventListener('click', function () { subAssigning = false; renderUser(); });
    var subRemoveBtn = document.getElementById('subRemoveBtn'); if (subRemoveBtn) subRemoveBtn.addEventListener('click', function () {
      if (!confirm('Remove this subscription from ' + u.name + '?')) return;
      V.store.update(u.id, { subscription: null });
      if (V.logActivity) V.logActivity('account-updated', u.name + ' \u2014 subscription removed');
      subAssigning = false; renderUser();
    });
    var usSaveBtn = document.getElementById('usSave'); if (usSaveBtn) usSaveBtn.addEventListener('click', function () {
      var plan = V.getSubscriptions().filter(function (p) { return p.id === document.getElementById('usPlan').value; })[0];
      if (!plan) return;
      var start = document.getElementById('usStart').value || new Date().toISOString().slice(0, 10);
      var d = new Date(start + 'T00:00:00');
      if (plan.period === 'monthly') d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1);
      var snap = { planId: plan.id, name: plan.name, period: plan.period, start: start, end: d.toISOString().slice(0, 10), price: plan.price, payment: plan.payment, reminder: document.getElementById('usReminder').checked };
      V.store.update(u.id, { subscription: snap });
      if (V.logActivity) V.logActivity('account-updated', u.name + ' \u2014 subscription: ' + plan.name);
      subAssigning = false; renderUser();
    });

    document.getElementById('resendBtn').addEventListener('click', function () {
      ssSet(LAST_NEW, u.id); location.hash = '#created'; render();
    });
    var userEditBtn = document.getElementById('userEdit');
    if (userEditBtn) userEditBtn.addEventListener('click', function () { userEditing = true; renderUser(); });
    var decForm = document.getElementById('decForm');
    if (decForm) {
      document.getElementById('acceptBtn').addEventListener('click', function () {
        var t = document.getElementById('decTier').value;
        var msg = document.getElementById('decMsg').value.trim();
        V.store.approveMember(u.id, t, msg);
        if (V.logActivity) V.logActivity('member-approved', u.name + ' (' + (TIER_LABEL[t] || '') + ')');
        renderUser();
      });
      document.getElementById('denyBtn').addEventListener('click', function () {
        var msg = document.getElementById('decMsg').value.trim();
        if (!confirm('Deny ' + u.name + '\u2019s application?')) return;
        V.store.denyMember(u.id, msg);
        if (V.logActivity) V.logActivity('member-denied', u.name);
        renderUser();
      });
    }
    var renewBtn = document.getElementById('renewBtn');
    if (renewBtn) renewBtn.addEventListener('click', function () {
      V.store.renewMember(u.id);
      if (V.logActivity) V.logActivity('member-renewed', u.name);
      renderUser();
    });
    var revertBtn = document.getElementById('revertBtn');
    if (revertBtn) revertBtn.addEventListener('click', function () {
      if (!confirm('Revert ' + u.name + '\u2019s membership to pending review?')) return;
      V.store.update(u.id, { status: 'pending', endDate: null, decision: null, cancelled: null });
      if (V.logActivity) V.logActivity('updated', u.name + ' reverted to pending');
      renderUser();
    });
    var revokeMemBtn = document.getElementById('revokeMemBtn');
    if (revokeMemBtn) revokeMemBtn.addEventListener('click', function () {
      if (!confirm('Revoke ' + u.name + '\u2019s membership? Access is removed immediately; the audit trail is retained.')) return;
      V.store.cancel(u.id);
      renderUser();
    });
    var userCancelEdit = document.getElementById('uCancelEdit');
    if (userCancelEdit) userCancelEdit.addEventListener('click', function () { userEditing = false; renderUser(); });
    var uRoleSel = document.getElementById('uRole');
    if (uRoleSel) uRoleSel.addEventListener('change', function () {
      var tb = document.getElementById('uTierBlock');
      if (tb) tb.style.display = (uRoleSel.value === 'heritage') ? '' : 'none';
    });
    var userSave = document.getElementById('uSave');
    if (userSave) userSave.addEventListener('click', function () {
      var uErr = document.getElementById('uErr');
      var nm = document.getElementById('uName').value.trim();
      var em = document.getElementById('uEmail').value.trim();
      var lg = document.getElementById('uLang').value;
      if (!nm) { uErr.textContent = 'Enter a full name'; return; }
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { uErr.textContent = 'Enter a valid email address'; return; }
      var clash = V.store.findByEmail(em); if (clash && clash.id !== u.id) { uErr.textContent = 'Another account already uses this email'; return; }
      var patch = { name: nm, email: em.toLowerCase(), lang: lg };
      var roleSel = document.getElementById('uRole');
      if (sup && roleSel) {
        var wasRole = isAdminUser ? 'admin' : (isHeritageUser ? 'heritage' : 'vip');
        var nr = roleSel.value;
        if (nr !== wasRole) {
          patch.role = nr; patch.cancelled = null;
          if (nr === 'admin') { patch.tier = null; patch.status = null; patch.endDate = null; }
          else if (nr === 'heritage') {
            var ts = document.getElementById('uTier');
            patch.tier = ts ? ts.value : 'admirer';
            patch.status = 'active';
            var hd = new Date(); hd.setMonth(hd.getMonth() + 12); patch.endDate = hd.toISOString().slice(0, 10);
          } else {
            patch.tier = null; patch.status = null;
            var keep = u.endDate && new Date(u.endDate) > new Date();
            if (!keep) { var vd = new Date(); vd.setDate(vd.getDate() + 90); patch.endDate = vd.toISOString().slice(0, 10); }
          }
          if (V.logActivity) V.logActivity('account-updated', u.name + ' \u2192 ' + (nr === 'admin' ? 'Admin' : (nr === 'heritage' ? ('Heritage \u00b7 ' + (TIER_LABEL[patch.tier] || '')) : 'VIP')));
        } else if (nr === 'heritage') {
          var ts2 = document.getElementById('uTier'); if (ts2) patch.tier = ts2.value;
        }
      }
      V.store.update(u.id, patch);
      userEditing = false; renderUser();
    });
    var userDelBtn = document.getElementById('userDel');
    if (userDelBtn) userDelBtn.addEventListener('click', function () {
      if (!V.isSuperAdmin()) return;
      if (confirm('Permanently delete ' + u.name + '? This removes the account and its audit trail and cannot be undone.')) {
        V.store.remove(u.id);
        if (V.logActivity) V.logActivity('user-deleted', u.name);
        location.hash = '#users'; render();
      }
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
  }

  /* ---------------- AUDIT LOGS (dedicated page) ---------------- */
  var auditState = { types: [], users: [], targets: [], period: 'all', page: 1, open: null };
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
    topBar.hidden = false;
    var all = V.auditEvents();
    // Created admins must not see admin-account activity in the audit log.
    if (!V.isSuperAdmin()) { all = all.filter(function (e) { return !(e.registered && e.role === 'admin'); }); }
    // 'invited' and 're-invited' both shown under "Invitation sent"
    function typeKey(t) { return t === 're-invited' ? 'invited' : (t === 'restored' ? 'extended' : (t === 'extension' ? 'extended' : t)); }

    // distinct users present in the stream (registered only) for the user filter
    var SELF_EV = { login: 1, 'login-error': 1, visit: 1, 'anon-visit': 1, 'password-changed': 1, extension: 1, 'password-reset': 1 };
    var UTGT_SYS = { 'user-created': 1, 'user-updated': 1, 'user-deleted': 1, 'member-registered': 1, 'member-approved': 1, 'member-denied': 1, 'member-renewed': 1, 'impersonation-start': 1, 'impersonation-end': 1 };
    function actorOf(e) { if (e.system) return e.userName || ''; if (!e.registered) return ''; return SELF_EV[e.type] ? e.userName : ''; }
    function targetOf(e) { if (e.system) return UTGT_SYS[e.type] ? (e.label || '') : ''; if (!e.registered) return ''; return SELF_EV[e.type] ? '' : e.userName; }
    var actorSet = {}, targetSet = {};
    all.forEach(function (e) { var a = actorOf(e); if (a) actorSet[a] = 1; var t = targetOf(e); if (t) targetSet[t] = 1; });
    var actorOpts = Object.keys(actorSet).sort();
    var targetOpts = Object.keys(targetSet).sort();

    function passes(e) {
      if (auditState.types.length && auditState.types.indexOf(typeKey(e.type)) < 0) return false;
      if (auditState.users.length && auditState.users.indexOf(actorOf(e)) < 0) return false;
      if (auditState.targets.length && auditState.targets.indexOf(targetOf(e)) < 0) return false;
      if (auditState.period !== 'all' && e.ts < periodStart(auditState.period)) return false;
      return true;
    }
    var filtered = all.filter(passes);
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (auditState.page > totalPages) auditState.page = totalPages;
    var startI = (auditState.page - 1) * pageSize;
    var pageRows = filtered.slice(startI, startI + pageSize);

    // build dropdown option rows
    function ddPanel(items, key, emptyMsg, searchable) {
      var head = searchable ? '<input type="search" class="flt-srch" data-fltsearch="' + key + '" placeholder="Search\u2026" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--fld-bg);border:0;border-bottom:1px solid var(--line);color:var(--fg);font-family:var(--sans);font-size:13px;padding:10px 13px;outline:none;">' : '';
      if (!items.length) return head + '<div class="flt-empty" style="padding:11px 13px;">' + esc(emptyMsg || 'None') + '</div>';
      return head + items.map(function (o) {
        return '<div class="flt-opt' + (o.on ? ' on' : '') + '" data-' + key + '="' + esc(o.val) + '">'
          + '<span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span>' + esc(o.label) + '</div>';
      }).join('');
    }
    var typeItems = TYPE_FILTERS.map(function (t) { return { val: t[0], label: t[1], on: auditState.types.indexOf(t[0]) >= 0 }; });
    var userItems = actorOpts.map(function (n) { return { val: n, label: n, on: auditState.users.indexOf(n) >= 0 }; });
    var targetItems = targetOpts.map(function (n) { return { val: n, label: n, on: auditState.targets.indexOf(n) >= 0 }; });
    var periodItems = PERIODS.map(function (p) { return { val: p[0], label: p[1], on: auditState.period === p[0] }; });
    var typeSummary = auditState.types.length ? (auditState.types.length + ' selected') : 'All events';
    var userSummary = auditState.users.length ? (auditState.users.length + ' selected') : 'All users';
    var targetSummary = auditState.targets.length ? (auditState.targets.length + ' selected') : 'All targets';
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
          var actor = actorOf(e), target = targetOf(e);
          var userCell = (!e.registered && !e.system)
            ? '<span class="au-user au-anon">Unregistered<span class="au-role">' + esc(e.device || 'Device') + '</span></span>'
            : (actor ? '<span class="au-user">' + esc(actor) + '</span>' : '<span style="color:var(--mute)">\u2014</span>');
          var targetCell = target ? '<span class="au-user">' + esc(target) + '</span>' : '<span style="color:var(--mute)">\u2014</span>';
          var labelSuffix = (e.system && e.label && !UTGT_SYS[e.type]) ? ' \u00b7 ' + esc(e.label) : '';
          return '<div class="adm-row au-row" style="--cols:260px 180px 180px 170px">'
            + '<span class="au-ev' + cls + '">' + esc(EV_LABELS[e.type] || e.type) + labelSuffix + '</span>'
            + userCell + targetCell
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

    var activeCount = auditState.types.length + auditState.users.length + auditState.targets.length + (auditState.period !== 'all' ? 1 : 0);

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Audit logs">'
      +   '<div class="adm-listhead"><p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Audit logs</span></p>'
      +     (activeCount ? '<button class="btn-new" id="clearFlt" type="button" style="background:transparent;color:var(--fg-dim);border-color:var(--line);">Clear filters (' + activeCount + ')</button>' : '')
      +   '</div>'
      +   '<div class="au-filters"><div class="flt-row2">'
      +     dd('type', 'Event type', typeSummary, ddPanel(typeItems, 'type'))
      +     dd('user', 'Executed by', userSummary, ddPanel(userItems, 'user', 'No users yet', true))
      +     dd('target', 'Target user', targetSummary, ddPanel(targetItems, 'target', 'No target users yet', true))
      +     dd('period', 'Period', periodSummary, ddPanel(periodItems, 'period'))
      +   '</div></div>'
      +   '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:260px 180px 180px 170px"><span>Event</span><span>Executed by</span><span>Target user</span><span>Date &amp; time</span></div>'
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
    [].forEach.call(root.querySelectorAll('.flt-opt[data-target]'), function (o) { o.addEventListener('click', function (e) { e.stopPropagation(); toggle(auditState.targets, o.getAttribute('data-target')); }); });
    [].forEach.call(root.querySelectorAll('[data-fltsearch]'), function (inp) {
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); });
      inp.addEventListener('input', function (e) {
        e.stopPropagation();
        var key = inp.getAttribute('data-fltsearch'); var q = inp.value.toLowerCase();
        var panel = inp.closest('.flt-dd-panel'); if (!panel) return;
        [].forEach.call(panel.querySelectorAll('.flt-opt[data-' + key + ']'), function (o) {
          o.style.display = (!q || o.textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
        });
      });
    });
    if (auditState.open === 'user' || auditState.open === 'target') { var sfocus = document.querySelector('[data-fltsearch="' + auditState.open + '"]'); if (sfocus) sfocus.focus(); }
    [].forEach.call(root.querySelectorAll('.flt-opt[data-period]'), function (o) { o.addEventListener('click', function (e) { e.stopPropagation(); auditState.period = o.getAttribute('data-period'); auditState.open = null; auditState.page = 1; renderAudit(); }); });
    // close any open dropdown on an outside click
    if (auditState.open) {
      setTimeout(function () {
        document.addEventListener('click', function closer() { auditState.open = null; document.removeEventListener('click', closer); renderAudit(); }, { once: true });
      }, 0);
    }
    var clr = document.getElementById('clearFlt'); if (clr) clr.addEventListener('click', function () { auditState = { types: [], users: [], targets: [], period: 'all', page: 1, open: null }; renderAudit(); });
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

  /* ---------------- DASHBOARD (configurable widgets) ---------------- */
  var DASH_KEY = 'minerva_dash_widgets_v1';
  function dashCharBars(items) {
    var max = items.reduce(function (m, i) { return Math.max(m, i.val); }, 1);
    return '<div class="chart-bars">' + items.map(function (i) {
      var pct = Math.round((i.val / max) * 100);
      return '<div class="cb-row"><span class="cb-name">' + esc(i.name) + '</span><span class="cb-track"><span class="cb-fill" style="width:' + pct + '%;' + (i.color ? 'background:' + i.color + ';' : '') + '"></span></span><span class="cb-val">' + esc(String(i.disp != null ? i.disp : i.val)) + '</span></div>';
    }).join('') + '</div>';
  }
  function dashDonut(segs) {
    var total = segs.reduce(function (a, s) { return a + s.val; }, 0) || 1;
    var r = 32, c = 2 * Math.PI * r, off = 0;
    var circles = segs.map(function (s) { var len = s.val / total * c; var el = '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="15" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 42 42)"/>'; off += len; return el; }).join('');
    var legend = segs.map(function (s) { return '<div class="dl-row"><span class="dl-dot" style="background:' + s.color + '"></span>' + esc(s.label) + '<span class="dl-val">' + s.val + '</span></div>'; }).join('');
    return '<div class="chart-donut"><svg width="84" height="84" viewBox="0 0 84 84">' + circles + '</svg><div class="donut-legend">' + legend + '</div></div>';
  }
  function dashSpark(vals, color) {
    color = color || '#c2a15a'; var w = 280, h = 56;
    var max = vals.reduce(function (m, v) { return Math.max(m, v); }, 1), min = vals.reduce(function (m, v) { return Math.min(m, v); }, vals[0] || 0);
    var pts = vals.map(function (v, i) { var x = (i / (vals.length - 1 || 1)) * w; var y = h - ((v - min) / ((max - min) || 1)) * (h - 8) - 4; return x.toFixed(1) + ',' + y.toFixed(1); });
    var line = pts.join(' '); var area = '0,' + h + ' ' + line + ' ' + w + ',' + h;
    return '<div class="chart-spark"><svg width="100%" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" style="height:60px;display:block;"><polygon points="' + area + '" fill="' + color + '20"/><polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.5"/></svg></div>';
  }
  function parseMoney(s) { var n = parseFloat(String(s || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; }
  var DASH_WIDGETS = [
    { id: 'heritage-members', title: 'Heritage members', roles: 'all', render: function (c) { return '<div class="dw-num">' + V.getMembersCount() + '</div><span class="dw-sub">Total members on the register</span>'; } },
    { id: 'vip-users', title: 'VIP users', roles: 'all', render: function (c) { return '<div class="dw-num">' + c.d.vipUsers + '</div><span class="dw-sub">Active memberships</span>'; } },
    { id: 'admin-users', title: 'Admin users', roles: 'super', render: function (c) { return '<div class="dw-num">' + c.d.adminUsers + '</div><span class="dw-sub">With console access</span>'; } },
    { id: 'registered-vehicles', title: 'Registered vehicles', roles: 'all', link: '#vehicles', render: function (c) { return '<div class="dw-num">' + V.vehicleCount() + '</div><span class="dw-sub">Aegis &amp; Sovereign on the road</span>'; } },
    { id: 'vehicles-produced', title: 'Vehicles produced', roles: 'all', render: function (c) { return '<div class="dw-num">80,000</div><span class="dw-sub">Est. manufactured since 1897</span>'; } },
    { id: 'pending-approvals', title: 'Pending approvals', roles: 'all', link: '#users', render: function (c) { return '<div class="dw-num" style="color:' + (c.pending ? '#c2a15a' : 'var(--fg)') + ';">' + c.pending + '</div><span class="dw-sub">Heritage applications awaiting review</span>'; } },
    { id: 'mrr', title: 'Subscription revenue', roles: 'super', link: '#subscriptions', render: function (c) { return '<div class="dw-num">\u20ac' + fmtN(c.mrr) + '</div><span class="dw-sub">Est. monthly recurring revenue</span>'; } },
    { id: 'members-by-tier', title: 'Members by tier', roles: 'all', wide: true, render: function (c) { return dashDonut([{ label: 'Admirer', val: c.tier.admirer, color: '#9B8FD6' }, { label: 'Custodian', val: c.tier.custodian, color: '#C2A15A' }, { label: 'Commissioner', val: c.tier.commissioner, color: '#D8222F' }]); } },
    { id: 'web-traffic', title: 'Web traffic \u00b7 7 days', roles: 'all', wide: true, link: '#stats', render: function (c) { return dashSpark(c.traffic7, '#5FB07A') + '<div class="spark-foot"><span>' + fmtN(c.traffic7.reduce(function (a, v) { return a + v; }, 0)) + ' visits</span><span>7-day trend</span></div>'; } },
    { id: 'visitor-devices', title: 'Visitor devices', roles: 'all', wide: true, link: '#stats', render: function (c) { var dv = (c.d.devices || []).map(function (x) { return { name: x.os, val: x.count }; }); return dv.length ? dashCharBars(dv) : '<span class="dw-sub">No device data yet.</span>'; } },
    { id: 'vehicles-by-model', title: 'Vehicles by model', roles: 'all', wide: true, link: '#vehicles', render: function (c) { return c.vehByModel.length ? dashCharBars(c.vehByModel) : '<span class="dw-sub">No vehicles registered.</span>'; } },
    { id: 'campaign-performance', title: 'Campaign read rates', roles: 'all', wide: true, link: '#campaigns', render: function (c) { return c.campaigns.length ? dashCharBars(c.campaigns) : '<span class="dw-sub">No sent campaigns yet.</span>'; } },
    { id: 'invoices-status', title: 'Invoices', roles: 'super', wide: true, link: '#invoices', render: function (c) { return dashDonut([{ label: 'Paid', val: c.inv.paid, color: '#4cbf85' }, { label: 'Unpaid', val: c.inv.unpaid, color: '#d4ad62' }, { label: 'Overdue', val: c.inv.overdue, color: '#D8222F' }]); } },
    { id: 'notifications-channel', title: 'Notifications by channel', roles: 'super', wide: true, link: '#notiflogs', render: function (c) { return c.notifs.length ? dashCharBars(c.notifs) : '<span class="dw-sub">No notifications sent yet.</span>'; } },
    { id: 'recent-activity', title: 'Audit logs', roles: 'super', wide: true, link: '#audit', render: function (c) { return c.audit.length ? '<div class="dw-list">' + c.audit.map(function (e) { return '<div class="dwl-row"><span class="ev">' + esc(e.label) + '</span><span class="tm">' + esc(e.when) + '</span></div>'; }).join('') + '</div>' : '<span class="dw-sub">No recent activity.</span>'; } }
  ];
  var DASH_DEFAULT = ['heritage-members', 'vip-users', 'registered-vehicles', 'pending-approvals', 'members-by-tier', 'web-traffic'];
  function dashSelected() { try { var a = JSON.parse(localStorage.getItem(DASH_KEY)); if (Array.isArray(a)) return a; } catch (e) {} return DASH_DEFAULT.slice(); }
  function dashSetSelected(a) { try { localStorage.setItem(DASH_KEY, JSON.stringify(a)); } catch (e) {} }
  var DASH_SIZE_KEY = 'minerva_dash_sizes_v1';
  function dashSizes() { try { var o = JSON.parse(localStorage.getItem(DASH_SIZE_KEY)); if (o && typeof o === 'object') return o; } catch (e) {} return {}; }
  function dashSetSize(id, s) { var m = dashSizes(); m[id] = s; try { localStorage.setItem(DASH_SIZE_KEY, JSON.stringify(m)); } catch (e) {} }
  function dashSizeOf(w) { var m = dashSizes(); return m[w.id] || (w.wide ? 'half' : 'small'); }
  var DASH_SIZE_NEXT = { small: 'half', half: 'big', big: 'small' };
  /* ---- saved dashboard views ---- */
  var DASH_VIEWS_KEY = 'minerva_dash_views_v1';
  var DASH_DEFVIEW_KEY = 'minerva_dash_default_view_v1';
  var DASH_VIEW_APPLIED = false;
  function dashViews() { try { var a = JSON.parse(localStorage.getItem(DASH_VIEWS_KEY)); if (Array.isArray(a)) return a; } catch (e) {} return []; }
  function dashSetViews(a) { try { localStorage.setItem(DASH_VIEWS_KEY, JSON.stringify(a || [])); } catch (e) {} }
  function dashDefaultViewId() { try { return localStorage.getItem(DASH_DEFVIEW_KEY) || ''; } catch (e) { return ''; } }
  function dashSetDefaultView(id) { try { if (id) localStorage.setItem(DASH_DEFVIEW_KEY, id); else localStorage.removeItem(DASH_DEFVIEW_KEY); } catch (e) {} }
  // views an admin (non-super) may use are those flagged adminVisible
  function dashViewsFor(sup) { return dashViews().filter(function (v) { return sup || v.adminVisible; }); }
  function dashSaveView(name) {
    var v = { id: 'view_' + Date.now(), name: name, widgets: dashSelected().slice(), sizes: JSON.parse(JSON.stringify(dashSizes())), adminVisible: false, by: (V.account && V.account() ? V.account().email : '') };
    dashSetViews([v].concat(dashViews())); return v;
  }
  function dashApplyView(v) {
    if (!v) return;
    dashSetSelected((v.widgets || []).slice());
    try { localStorage.setItem(DASH_SIZE_KEY, JSON.stringify(v.sizes || {})); } catch (e) {}
  }
  // apply the default view once per session, at first dashboard load after login
  function dashApplyDefaultOnce() {
    if (DASH_VIEW_APPLIED) return; DASH_VIEW_APPLIED = true;
    var id = dashDefaultViewId(); if (!id) return;
    var v = dashViews().filter(function (x) { return x.id === id; })[0];
    if (v) dashApplyView(v);
  }
  function dashViewToolbar(sup) {
    var views = dashViewsFor(sup), defId = dashDefaultViewId();
    var rows = views.length ? views.map(function (v) {
      var isDef = v.id === defId;
      return '<div class="vmulti-row" data-viewid="' + v.id + '">'
        + '<button class="vm-apply" type="button" data-vapply="' + v.id + '" title="Load this view">' + esc(v.name) + (isDef ? ' <span class="vm-deftag">Default</span>' : '') + '</button>'
        + '<div class="vm-acts">'
        +   '<button class="vm-ic' + (isDef ? ' on' : '') + '" type="button" data-vdef="' + v.id + '" title="' + (isDef ? 'Opens on login \u2014 click to unset' : 'Open this view on login') + '" aria-label="Set default">\u2605</button>'
        +   (sup ? '<button class="vm-ic' + (v.adminVisible ? ' on' : '') + '" type="button" data-vadm="' + v.id + '" title="' + (v.adminVisible ? 'Visible to admins \u2014 click to hide' : 'Make available to admin users') + '" aria-label="Admin visibility"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>' : '')
        +   '<button class="vm-ic del" type="button" data-vdel="' + v.id + '" title="Delete view" aria-label="Delete">\u00d7</button>'
        + '</div></div>';
    }).join('') : '<div class="vmulti-empty">No saved views yet.</div>';
    return '<span class="dash-tlabel" style="margin-left:8px;">View</span>'
      + '<div class="wmulti vmulti" id="vmulti"><button class="wmulti-btn" type="button" id="vmultiBtn"><span>' + (views.length ? views.length + ' saved' : 'Save / load') + '</span><span class="caret">\u25be</span></button>'
      + '<div class="wmulti-panel"><div class="vmulti-list">' + rows + '</div>'
      + '<div class="vmulti-save"><input type="text" id="vSaveName" placeholder="Name this view\u2026" autocomplete="off"><button type="button" id="vSaveBtn">Save current</button></div></div></div>';
  }
  function renderDashboard() {
    topBar.hidden = false;
    var sup = V.isSuperAdmin();
    dashApplyDefaultOnce();
    var d = V.dashboardData(0, Date.now() + 1);
    var users = (V.store.all ? V.store.all() : []) || [];
    var members = users.filter(function (u) { return u.role === 'heritage'; });
    var tier = { admirer: 0, custodian: 0, commissioner: 0 };
    members.forEach(function (u) { var t = u.tier || 'admirer'; if (tier[t] != null) tier[t]++; });
    var pending = members.filter(function (u) { return u.status === 'pending'; }).length;
    var mrr = 0; users.forEach(function (u) { if (u.subscription && u.subscription.price) { var p = parseMoney(u.subscription.price); mrr += (u.subscription.period === 'yearly' ? p / 12 : p); } });
    mrr = Math.round(mrr);
    var campaigns = (V.getCampaigns ? V.getCampaigns() : []).filter(function (x) { return x.stats && x.stats.delivered; }).slice(0, 5).map(function (x) { var pct = Math.round(x.stats.read / x.stats.delivered * 100); return { name: x.name, val: pct, disp: pct + '%' }; });
    var inv = { paid: 0, unpaid: 0, overdue: 0 }; (V.getInvoices ? V.getInvoices() : []).forEach(function (n) { if (inv[n.status] != null) inv[n.status]++; });
    var notifMap = {}; (V.getNotifLogs ? V.getNotifLogs() : []).forEach(function (n) { notifMap[n.channel] = (notifMap[n.channel] || 0) + 1; });
    var chName = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', 'push-mobile': 'Push \u00b7 mobile', 'push-web': 'Push \u00b7 web' };
    var notifs = Object.keys(notifMap).map(function (k) { return { name: chName[k] || k, val: notifMap[k] }; });
    var vbm = {}; (V.getVehicles ? V.getVehicles() : []).forEach(function (v) { var m = v.model || '\u2014'; vbm[m] = (vbm[m] || 0) + 1; });
    var vehByModel = Object.keys(vbm).map(function (k) { return { name: k, val: vbm[k] }; }).sort(function (a, b) { return b.val - a.val; }).slice(0, 6);
    var audit = (V.auditEvents ? V.auditEvents() : []).slice(0, 6).map(function (e) {
      var lbl = (EV_LABELS && EV_LABELS[e.type]) || e.label || e.type || 'Event';
      var when = e.ts ? V.fmtDateTime(e.ts).split(' \u00b7 ')[0] : '';
      return { label: lbl + (e.userName ? ' \u00b7 ' + e.userName : ''), when: when };
    });
    var tv = (d && d.totalVisits) || 240;
    var traffic7 = [0.62, 0.78, 0.7, 0.95, 0.83, 1.0, 0.88].map(function (f) { return Math.round(tv / 7 * f * 7 / 5); });
    var ctx = { d: d, tier: tier, pending: pending, mrr: mrr, campaigns: campaigns, inv: inv, notifs: notifs, vehByModel: vehByModel, audit: audit, traffic7: traffic7 };

    var available = DASH_WIDGETS.filter(function (w) { return sup || w.roles === 'all'; });
    var sel = dashSelected().filter(function (id) { return available.some(function (w) { return w.id === id; }); });

    var opts = available.map(function (w) {
      var on = sel.indexOf(w.id) >= 0;
      return '<div class="wmulti-opt' + (on ? ' on' : '') + '" data-wid="' + w.id + '"><span class="box"></span><span>' + esc(w.title) + '</span>' + (w.roles === 'super' ? '<span class="rl">Super</span>' : '') + '</div>';
    }).join('');
    var toolbar = '<div class="dash-toolbar"><span class="dash-tlabel">Widgets</span>'
      + '<div class="wmulti" id="wmulti"><button class="wmulti-btn" type="button" id="wmultiBtn"><span>' + sel.length + ' of ' + available.length + ' shown</span><span class="caret">\u25be</span></button>'
      + '<div class="wmulti-panel">' + opts + '</div></div>'
      + dashViewToolbar(sup) + '</div>';

    var cards = sel.map(function (id) {
      var w = available.filter(function (x) { return x.id === id; })[0]; if (!w) return '';
      var handle = '<button class="dw-handle" type="button" aria-label="Drag to reorder"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';
      var size = dashSizeOf(w);
      var tools = '<div class="dw-tools">'
        + '<button class="dw-btn dw-up" type="button" data-up-id="' + w.id + '" aria-label="Move up" title="Move up"><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>'
        + '<button class="dw-btn dw-size" type="button" data-size-id="' + w.id + '" aria-label="Resize" title="Width: ' + size + ' \u2014 click to change"><svg viewBox="0 0 24 24"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg></button>'
        + (w.link ? '<button class="dw-btn dw-expand" type="button" data-go="' + w.link + '" aria-label="Open"><svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg></button>' : '')
        + '<button class="dw-btn dw-close" type="button" data-rm="' + w.id + '" aria-label="Remove"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
      return '<div class="dash-widget" data-size="' + size + '" data-wid="' + w.id + '">' + handle + tools + '<div class="dw-head"><span class="dw-title">' + esc(w.title) + '</span></div>' + w.render(ctx) + '</div>';
    }).join('');
    var grid = sel.length ? '<div class="dash-grid">' + cards + '</div>' : '<div class="dash-empty-w">No widgets selected \u2014 choose some from the Widgets menu above.</div>';

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Dashboard">'
      +   '<p class="adm-crumb"><span class="cr-here">Dashboard</span></p>'
      +   toolbar + grid
      + '</div>';
    bindBack('#menu');

    var wm = document.getElementById('wmulti'), wb = document.getElementById('wmultiBtn');
    if (wb) wb.addEventListener('click', function (e) { e.stopPropagation(); wm.classList.toggle('open'); });
    if (wm) document.addEventListener('click', function closer(e) { if (!wm.contains(e.target)) { wm.classList.remove('open'); document.removeEventListener('click', closer); } });
    // ---- saved views dropdown ----
    var vm = document.getElementById('vmulti'), vb = document.getElementById('vmultiBtn');
    if (vb) vb.addEventListener('click', function (e) { e.stopPropagation(); vm.classList.toggle('open'); });
    if (vm) document.addEventListener('click', function vcloser(e) { if (!vm.contains(e.target)) { vm.classList.remove('open'); document.removeEventListener('click', vcloser); } });
    [].forEach.call(root.querySelectorAll('[data-vapply]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var v = dashViews().filter(function (x) { return x.id === b.getAttribute('data-vapply'); })[0]; if (v) { dashApplyView(v); renderDashboard(); } });
    });
    [].forEach.call(root.querySelectorAll('[data-vdef]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var id = b.getAttribute('data-vdef'); dashSetDefaultView(dashDefaultViewId() === id ? '' : id); renderDashboard(); var m = document.getElementById('vmulti'); if (m) m.classList.add('open'); });
    });
    [].forEach.call(root.querySelectorAll('[data-vadm]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var id = b.getAttribute('data-vadm'); dashSetViews(dashViews().map(function (v) { return v.id === id ? Object.assign({}, v, { adminVisible: !v.adminVisible }) : v; })); renderDashboard(); var m = document.getElementById('vmulti'); if (m) m.classList.add('open'); });
    });
    [].forEach.call(root.querySelectorAll('[data-vdel]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); var id = b.getAttribute('data-vdel'); dashSetViews(dashViews().filter(function (v) { return v.id !== id; })); if (dashDefaultViewId() === id) dashSetDefaultView(''); renderDashboard(); var m = document.getElementById('vmulti'); if (m) m.classList.add('open'); });
    });
    var vSaveBtn = document.getElementById('vSaveBtn'), vSaveName = document.getElementById('vSaveName');
    function doSaveView() { var nm = (vSaveName.value || '').trim(); if (!nm) { vSaveName.focus(); return; } dashSaveView(nm); renderDashboard(); var m = document.getElementById('vmulti'); if (m) m.classList.add('open'); }
    if (vSaveBtn) vSaveBtn.addEventListener('click', function (e) { e.stopPropagation(); doSaveView(); });
    if (vSaveName) { vSaveName.addEventListener('click', function (e) { e.stopPropagation(); }); vSaveName.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSaveView(); } }); }
    [].forEach.call(root.querySelectorAll('.wmulti-opt[data-wid]'), function (o) {
      o.addEventListener('click', function (e) { e.stopPropagation(); var id = o.getAttribute('data-wid'); var s = dashSelected(); var i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); dashSetSelected(s); renderDashboard(); var m = document.getElementById('wmulti'); if (m) m.classList.add('open'); });
    });
    [].forEach.call(root.querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function () { var id = b.getAttribute('data-rm'); var s = dashSelected().filter(function (x) { return x !== id; }); dashSetSelected(s); renderDashboard(); });
    });
    [].forEach.call(root.querySelectorAll('.dw-expand[data-go]'), function (b) {
      b.addEventListener('click', function () { location.hash = b.getAttribute('data-go'); render(); });
    });
    [].forEach.call(root.querySelectorAll('.dw-size[data-size-id]'), function (b) {
      b.addEventListener('click', function () { var id = b.getAttribute('data-size-id'); var w = available.filter(function (x) { return x.id === id; })[0]; dashSetSize(id, DASH_SIZE_NEXT[dashSizeOf(w)] || 'small'); renderDashboard(); });
    });
    [].forEach.call(root.querySelectorAll('.dw-up[data-up-id]'), function (b) {
      b.addEventListener('click', function () { var id = b.getAttribute('data-up-id'); var s = dashSelected(); var i = s.indexOf(id); if (i > 0) { s.splice(i - 1, 0, s.splice(i, 1)[0]); dashSetSelected(s); renderDashboard(); } });
    });
    // drag-to-reorder via the hamburger handle
    var grid = root.querySelector('.dash-grid');
    function dragAfter(x, y) {
      var els = [].slice.call(grid.querySelectorAll('.dash-widget:not(.dragging)'));
      var best = null, bestDist = Infinity, before = true;
      els.forEach(function (el) {
        var b = el.getBoundingClientRect(); var cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (dist < bestDist) { bestDist = dist; best = el; before = (y < cy - 6) || (Math.abs(y - cy) <= b.height / 2 && x < cx); }
      });
      if (!best) return null;
      return before ? best : best.nextElementSibling;
    }
    [].forEach.call(root.querySelectorAll('.dash-widget'), function (card) {
      var handle = card.querySelector('.dw-handle');
      if (handle) {
        handle.addEventListener('mousedown', function () { card.draggable = true; });
        handle.addEventListener('mouseup', function () { card.draggable = false; });
      }
      card.addEventListener('dragstart', function (e) { card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', card.getAttribute('data-wid')); } catch (_) {} });
      card.addEventListener('dragend', function () {
        card.classList.remove('dragging'); card.draggable = false;
        var order = [].map.call(grid.querySelectorAll('.dash-widget'), function (c) { return c.getAttribute('data-wid'); });
        dashSetSelected(order);
      });
    });
    if (grid) grid.addEventListener('dragover', function (e) {
      e.preventDefault();
      var dragging = grid.querySelector('.dragging'); if (!dragging) return;
      var after = dragAfter(e.clientX, e.clientY);
      if (after === dragging) return;
      grid.insertBefore(dragging, after);
    });
  }


  /* ---------------- VEHICLES (register · models · certificates · search) ---------------- */
  var vehTab = 'register';
  var vehQuery = '';
  var vehAdding = false;
  var vehSel = null;       // { type, key } of the record open in the detail page
  var vehEditing = false;  // edit-mode toggle on the detail page
  // Field schema + render/save per tab. A 4th element (if present) lists <select> options.
  var VEH_FIELDS = {
    register: [['vin', 'VIN', 'text'], ['firstReg', 'First registration', 'date'], ['model', 'Model', 'text'], ['modelDate', 'Model date', 'date'], ['owner', 'Owner', 'text'], ['email', 'Email', 'email']],
    models: [['name', 'Model', 'text'], ['year', 'Year', 'number'], ['type', 'Type', 'select', ['Hypercar', 'SUV', 'Sedan', 'Truck']], ['category', 'Category', 'select', ['New model', 'Oldtimer']], ['power', 'Powertrain', 'text'], ['status', 'Status', 'text']],
    coa: [['ref', 'Reference', 'text'], ['vin', 'VIN', 'text'], ['model', 'Model', 'text'], ['issued', 'Issued', 'date'], ['owner', 'Owner', 'text'], ['status', 'Status', 'text']]
  };
  function tabTitleFor(t) { return t === 'models' ? 'Vehicle models' : (t === 'coa' ? 'Certificates of authenticity' : 'Registered vehicles'); }
  function vehStore(type) {
    if (type === 'models') return { get: V.getModels, set: V.setModels, key: 'name', noun: 'model', back: '#vmodels', title: 'Vehicle model', ev: 'model' };
    if (type === 'coa') return { get: V.getCoa, set: V.setCoa, key: 'ref', noun: 'certificate', back: '#vcerts', title: 'Certificate of authenticity', ev: 'coa' };
    return { get: V.getVehicles, set: V.setVehicles, key: 'vin', noun: 'vehicle', back: '#vehicles', title: 'Registered vehicle', ev: 'vehicle' };
  }
  // Shared field control used by both the New-record form and the record Edit form.
  function vehFieldControl(f, val) {
    val = (val == null ? '' : String(val));
    if (f[2] === 'select') {
      return '<div class="ff-input"><select id="vf_' + f[0] + '" class="ff-select">'
        + (f[3] || []).map(function (o) { return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('')
        + '</select></div>';
    }
    return '<div class="ff-input"><input id="vf_' + f[0] + '" type="' + f[2] + '"' + (f[2] === 'date' ? '' : ' placeholder="' + esc(f[1]) + '"') + ' value="' + esc(val) + '"></div>';
  }
  /* ---- single record: read view + Edit (admin) + Delete (super-admin only) ---- */
  function renderVehRecord() {
    topBar.hidden = false;
    if (!vehSel) { location.hash = '#vehicles'; render(); return; }
    var s = vehStore(vehSel.type);
    var rec = s.get().filter(function (r) { return String(r[s.key]) === String(vehSel.key); })[0];
    if (!rec) { vehSel = null; location.hash = s.back; render(); return; }
    var fields = VEH_FIELDS[vehSel.type];
    var sup = V.isSuperAdmin();
    var canEdit = !!(V.isAdmin && V.isAdmin());           // admins & super may edit; heritage views read-only
    var heritageView = !!(V.isHeritage && V.isHeritage());
    var backHash = heritageView ? '#vehicles' : s.back;

    var bodyHtml;
    if (vehEditing) {
      bodyHtml = '<form class="veh-newform" id="vrecForm" onsubmit="return false;">'
        + '<div class="veh-newgrid">' + fields.map(function (f) {
            return '<div class="ff"><label for="vf_' + f[0] + '">' + esc(f[1]) + '</label>' + vehFieldControl(f, rec[f[0]]) + '</div>';
          }).join('') + '</div>'
        + '<p class="adm-err" id="vrecErr"></p>'
        + '<div class="adm-extend"><button class="btn" type="submit" id="vrecSave">Save changes</button>'
        +   '<button class="btn-cancel" type="button" id="vrecCancelEdit" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
        + '</form>';
    } else {
      bodyHtml = '<div class="rec-card">' + fields.map(function (f) {
          var v = rec[f[0]];
          var disp = (f[2] === 'date') ? (v ? V.fmtDate(v) : '\u2014') : (v != null && v !== '' ? v : '\u2014');
          return '<div class="rec-row"><span class="rec-k">' + esc(f[1]) + '</span><span class="rec-v">' + esc(String(disp)) + '</span></div>';
        }).join('') + '</div>';
    }

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Vehicle Record">'
      +   '<p class="adm-crumb"><a class="cr-root" href="' + backHash + '">Vehicles</a><span class="cr-sep">\u203a</span>'
      +     '<a class="cr-root" href="' + backHash + '">' + esc(heritageView ? 'Browse' : tabTitleFor(vehSel.type)) + '</a><span class="cr-sep">\u203a</span>'
      +     '<span class="cr-here">' + esc(String(rec[s.key])) + '</span></p>'
      +   '<div class="adm-listhead" style="margin-top:clamp(20px,3vh,30px);">'
      +     '<p class="adm-section-h" style="margin:0;">' + esc(s.title) + '</p>'
      +     (!vehEditing && canEdit ? '<button class="btn-new" id="vrecEdit" type="button"><svg viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>Edit</button>' : '')
      +   '</div>'
      +   bodyHtml
      +   (!vehEditing && sup ? ('<p class="adm-section-h">Delete record</p>'
      +     '<p class="field-hint" style="margin:-6px 0 12px;">Permanently removes this ' + s.noun + ' from the register. This cannot be undone.</p>'
      +     '<div class="adm-extend"><button class="btn-cancel" id="vrecDel" type="button">Delete ' + s.noun + '</button></div>') : '')
      + '</div>';
    bindBack(backHash);

    var editBtn = document.getElementById('vrecEdit');
    if (editBtn) editBtn.addEventListener('click', function () { vehEditing = true; renderVehRecord(); });
    var cancelEdit = document.getElementById('vrecCancelEdit');
    if (cancelEdit) cancelEdit.addEventListener('click', function () { vehEditing = false; renderVehRecord(); });

    var saveBtn = document.getElementById('vrecSave');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var err = document.getElementById('vrecErr');
      var patch = {};
      fields.forEach(function (f) { var el = document.getElementById('vf_' + f[0]); patch[f[0]] = el ? String(el.value).trim() : ''; });
      if (!patch[s.key]) { err.textContent = fields[0][1] + ' is required'; return; }
      var dup = s.get().some(function (r) { return String(r[s.key]) === String(patch[s.key]) && String(r[s.key]) !== String(vehSel.key); });
      if (dup) { err.textContent = fields[0][1] + ' already exists'; return; }
      s.set(s.get().map(function (r) { return String(r[s.key]) === String(vehSel.key) ? patch : r; }));
      if (V.logActivity) V.logActivity(s.ev + '-updated', patch[s.key]);
      vehSel.key = patch[s.key];
      vehEditing = false; renderVehRecord();
    });

    var delBtn = document.getElementById('vrecDel');
    if (delBtn) delBtn.addEventListener('click', function () {
      if (!V.isSuperAdmin()) return;
      if (confirm('Delete this ' + s.noun + ' (' + rec[s.key] + ')? This cannot be undone.')) {
        s.set(s.get().filter(function (r) { return String(r[s.key]) !== String(vehSel.key); }));
        if (V.logActivity) V.logActivity(s.ev + '-deleted', rec[s.key]);
        vehSel = null; vehEditing = false; location.hash = s.back; render();
      }
    });
  }
  function vehNewForm() {
    var fields = VEH_FIELDS[vehTab];
    var title = vehTab === 'models' ? 'New vehicle model' : (vehTab === 'coa' ? 'New certificate' : 'New registered vehicle');
    return '<form class="veh-newform" id="vehForm" onsubmit="return false;">'
      + '<p class="adm-section-h" style="margin:0 0 14px;">' + title + '</p>'
      + '<div class="veh-newgrid">' + fields.map(function (f) {
          return '<div class="ff"><label for="vf_' + f[0] + '">' + esc(f[1]) + '</label><div class="ff-input"><input id="vf_' + f[0] + '" type="' + f[2] + '"' + (f[2] === 'date' ? '' : ' placeholder="' + esc(f[1]) + '"') + '></div></div>';
        }).join('') + '</div>'
      + '<p class="adm-err" id="vfErr"></p>'
      + '<div class="adm-extend"><button class="btn" type="submit" id="vfSave">Save record</button><button class="btn-cancel" type="button" id="vfCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
      + '</form>';
  }
  function renderVehicles() {
    topBar.hidden = false;
    var q = vehQuery.trim().toLowerCase();
    function match(obj) { return !q || Object.keys(obj).some(function (k) { return String(obj[k] || '').toLowerCase().indexOf(q) >= 0; }); }

    var tabTitle = vehTab === 'models' ? 'Vehicle models' : (vehTab === 'coa' ? 'Certificates of authenticity' : 'Registered vehicles');
    var sup = V.isSuperAdmin();
    var chkCol = sup ? '38px ' : '';
    var chkHead = sup ? '<span class="c-check"><input type="checkbox" class="rowsel-all" aria-label="Select all"></span>' : '';
    function chkCell(key) { return sup ? '<span class="c-check"><input type="checkbox" class="rowsel" data-sel="' + esc(key) + '"' + (vehSelected[key] ? ' checked' : '') + '></span>' : ''; }

    var body = '', count = 0;
    if (vehTab === 'register') {
      var list = V.getVehicles().filter(match); count = list.length;
      var cols = chkCol + '150px 120px 140px 120px 140px 220px';
      body = '<div class="adm-table tbl-std"><div class="adm-row head veh-row" style="--cols:' + cols + '">' + chkHead + '<span>VIN</span><span>First registration</span><span>Model</span><span>Model date</span><span>Owner</span><span>Email</span></div>'
        + (list.length ? list.slice((vehPage - 1) * pageSize, vehPage * pageSize).map(function (v) {
            return '<div class="adm-row veh-row" style="--cols:' + cols + '">' + chkCell(v.vin) + '<span class="veh-vin"><a class="veh-open" data-vtype="register" data-vkey="' + esc(v.vin) + '">' + esc(v.vin) + '</a></span>'
              + '<span class="veh-c">' + esc(v.firstReg ? V.fmtDate(v.firstReg) : '\u2014') + '</span>'
              + '<span class="veh-model">' + esc(v.model) + '</span>'
              + '<span class="veh-c">' + esc(v.modelDate ? V.fmtDate(v.modelDate) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(v.owner || '\u2014') + '</span>'
              + '<span class="veh-email">' + esc(v.email || '\u2014') + '</span></div>';
          }).join('') : '<p class="adm-empty">No vehicles match.</p>')
        + '</div>';
    } else if (vehTab === 'models') {
      var models = V.getModels().filter(match); count = models.length;
      var mcols = chkCol + '180px 70px 110px 120px 180px 130px';
      body = '<div class="adm-table tbl-std"><div class="adm-row head veh-row" style="--cols:' + mcols + '">' + chkHead + '<span>Model</span><span>Year</span><span>Type</span><span>Category</span><span>Powertrain</span><span>Status</span></div>'
        + (models.length ? models.slice((vehPage - 1) * pageSize, vehPage * pageSize).map(function (m) {
            return '<div class="adm-row veh-row" style="--cols:' + mcols + '">' + chkCell(m.name) + '<span class="veh-model"><a class="veh-open" data-vtype="models" data-vkey="' + esc(m.name) + '">' + esc(m.name) + '</a></span>'
              + '<span class="veh-c">' + esc(m.year != null && m.year !== '' ? String(m.year) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(m.type || '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(m.category || '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(m.power || '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(m.status || '\u2014') + '</span></div>';
          }).join('') : '<p class="adm-empty">No models match.</p>')
        + '</div>';
    } else {
      var coa = V.getCoa().filter(match); count = coa.length;
      var ccols = chkCol + '140px 150px 130px 110px 130px 110px';
      body = '<div class="adm-table tbl-std"><div class="adm-row head veh-row" style="--cols:' + ccols + '">' + chkHead + '<span>Reference</span><span>VIN</span><span>Model</span><span>Issued</span><span>Owner</span><span>Status</span></div>'
        + (coa.length ? coa.slice((vehPage - 1) * pageSize, vehPage * pageSize).map(function (c) {
            var st = (c.status || '').toLowerCase();
            return '<div class="adm-row veh-row" style="--cols:' + ccols + '">' + chkCell(c.ref) + '<span class="veh-vin"><a class="veh-open" data-vtype="coa" data-vkey="' + esc(c.ref) + '">' + esc(c.ref) + '</a></span>'
              + '<span class="veh-vin">' + esc(c.vin) + '</span>'
              + '<span class="veh-model">' + esc(c.model) + '</span>'
              + '<span class="veh-c">' + esc(c.issued ? V.fmtDate(c.issued) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(c.owner || '\u2014') + '</span>'
              + '<span class="c-status"><span class="st-chip ' + (st === 'issued' ? 'st-green' : 'st-amber') + '">' + esc(c.status || '\u2014') + '</span></span></div>';
          }).join('') : '<p class="adm-empty">No certificates match.</p>')
        + '</div>';
    }

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Vehicles">'
      +   '<p class="adm-crumb"><a class="cr-root" href="' + (vehTab === 'models' ? '#settings">Settings' : '#vehicles">Vehicles') + '</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(tabTitle) + '</span></p>'
      +   '<div class="veh-bar">'
      +     '<div class="veh-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      +       '<input id="vehSearch" type="search" placeholder="Search VIN, model, owner\u2026" value="' + esc(vehQuery) + '"></div>'
      +     '<button class="btn-new" id="vehNewBtn" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New record</button>'
      +   '</div>'
      +   (vehAdding ? vehNewForm() : '')
      +   (sup ? '<div class="bulk-bar" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 6px;">' + bulkControlsHtml([['delete', 'Delete selected']]) + '</div>' : '')
      +   body
      +   (count ? pagerBlock(vehPage, count, 'result', 'vPrev', 'vNext') : '')
      + '</div>';
    bindBack('#menu');
    var vp = document.getElementById('vPrev'); if (vp) vp.addEventListener('click', function () { if (vehPage > 1) { vehPage--; renderVehicles(); } });
    [].forEach.call(root.querySelectorAll('.veh-open'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        vehSel = { type: a.getAttribute('data-vtype'), key: a.getAttribute('data-vkey') };
        vehEditing = false; location.hash = '#vehrec'; render();
      });
    });
    var vn = document.getElementById('vNext'); if (vn) vn.addEventListener('click', function () { vehPage++; renderVehicles(); });
    var nb = document.getElementById('vehNewBtn'); if (nb) nb.addEventListener('click', function () { vehAdding = !vehAdding; renderVehicles(); });
    if (sup) {
      var vScope = root.querySelector('.adm-wrap');
      wireBulk(vScope, vehSelected, function (action, keys) {
        if (action !== 'delete') return;
        var s = vehStore(vehTab);
        var recs = s.get().filter(function (r) { return keys.indexOf(String(r[s.key])) >= 0; });
        mvBulkModal({
          title: 'Delete ' + s.noun + 's', verb: 'permanently delete', noun: s.noun, confirmLabel: 'Delete', confirmCls: 'danger',
          items: recs.map(function (r) { return { cells: [String(r[s.key]), String(r[s.noun === 'vehicle' ? 'model' : (s.noun === 'certificate' ? 'vin' : 'type')] || '') ] }; }),
          run: function () {
            var keep = s.get().filter(function (r) { return keys.indexOf(String(r[s.key])) < 0; });
            var removed = s.get().length - keep.length;
            s.set(keep);
            recs.forEach(function (r) { if (V.logActivity) V.logActivity(s.ev + '-deleted', String(r[s.key])); });
            return { done: removed, skipped: 0 };
          },
          onClose: function () { vehSelected = {}; renderVehicles(); }
        });
      });
    }
    var vfCancel = document.getElementById('vfCancel'); if (vfCancel) vfCancel.addEventListener('click', function () { vehAdding = false; renderVehicles(); });
    var vfSave = document.getElementById('vfSave');
    if (vfSave) vfSave.addEventListener('click', function () {
      var fields = VEH_FIELDS[vehTab], rec = {}, err = document.getElementById('vfErr');
      fields.forEach(function (f) { var el = document.getElementById('vf_' + f[0]); rec[f[0]] = el ? el.value.trim() : ''; });
      var firstKey = fields[0][0];
      if (!rec[firstKey]) { err.textContent = fields[0][1] + ' is required'; return; }
      if (vehTab === 'register') { var v = V.getVehicles(); v.unshift(rec); V.setVehicles(v); V.logActivity && V.logActivity('vehicle-created', rec.vin); }
      else if (vehTab === 'models') { var m = V.getModels(); m.unshift(rec); V.setModels(m); V.logActivity && V.logActivity('model-created', rec.name); }
      else { var c = V.getCoa(); c.unshift(rec); V.setCoa(c); V.logActivity && V.logActivity('coa-created', rec.ref); }
      vehAdding = false; vehPage = 1; renderVehicles();
    });

    [].forEach.call(root.querySelectorAll('[data-vtab]'), function (b) {
      b.addEventListener('click', function () { vehTab = b.getAttribute('data-vtab'); vehPage = 1; vehSelected = {}; renderVehicles(); });
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
  var collapseState = {};
  function secColl(key, title, bodyHtml) {
    var col = !!collapseState[key];
    return '<div class="stat-section' + (col ? ' collapsed' : '') + '" data-sec="' + key + '">'
      + '<button type="button" class="adm-section-h stat-toggle" data-sectoggle="' + key + '"><span class="lb">' + esc(title) + '</span><span class="sec-rule"></span>'
      + '<svg class="sec-caret" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>'
      + '<div class="stat-sec-body">' + bodyHtml + '</div></div>';
  }
  function statSection(key, title, bodyHtml) { return secColl(key, title, bodyHtml); }
  // one delegated handler drives every collapsible section across all pages
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-sectoggle]') : null;
    if (!btn) return;
    var key = btn.getAttribute('data-sectoggle');
    collapseState[key] = !collapseState[key];
    var sec = btn.closest('.stat-section');
    if (sec) sec.classList.toggle('collapsed', !!collapseState[key]);
    if (!collapseState[key] && sec && sec.querySelector('#geoMap') && window.MinervaGeoMap && MinervaGeoMap.refresh) MinervaGeoMap.refresh();
  });
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
      +   (visitsBar ? statSection('audience', 'Visits by audience', visitsBar) : '')
      +   statSection('pages', 'Most visited pages',
            '<div class="dash-pages"><div class="dash-page dash-page-head"><span class="dp-name">Page</span><span class="dp-track"></span><span class="dp-count">Visits</span><span class="dp-time">Avg time</span></div>' + pagesRows + '</div>')
      +   statSection('device', 'Visitor device',
            '<div class="dash-pages"><div class="dash-page dash-page-head"><span class="dp-name">Operating system</span><span class="dp-track"></span><span class="dp-count">Visits</span><span class="dp-time">Share</span></div>' + deviceRows + '</div>')
      +   statSection('location', 'Visitor location',
            '<div class="stat-geo"><div class="geo-map" id="geoMap"></div><div class="geo-list">' + locList + '</div></div>')
      +   ''
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
    var geoEl = document.getElementById('geoMap');
    if (geoEl && window.MinervaGeoMap) {
      MinervaGeoMap.render(geoEl, d.locations, true);
    }
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
    archive: '<rect x="3" y="4" width="18" height="4"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
    news: '<path d="M4 5h12v14H5a1 1 0 0 1-1-1zM16 8h3a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2M7 9h6M7 13h6"/>',
    bell: '<path d="M18 16V11a6 6 0 1 0-12 0v5l-1.5 2h15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    automations: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
    marketing: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6M19 6a7 7 0 0 1 0 12"/>',
    admin: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M7 15h5"/>'
  };
  // [route, label, iconKey, children?]  children = [[route,label],...]
  var NAV = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['users', 'Users', 'users', [['users', 'All users'], ['groups', 'User groups'], ['new', 'New user']]],
    ['vehicles', 'Vehicles', 'vehicles', [['vehicles', 'Registered vehicles'], ['vcerts', 'Certificates']]],
    ['marketing', 'Marketing', 'marketing', [['heritage', 'Heritage'], ['news', 'News'], ['campaigns', 'Campaigns'], ['stats', 'Web Statistics'], ['counters', 'Counters']]],
    ['automations', 'Automations', 'automations', [['eventlogs', 'Event logs'], ['events', 'Events'], ['messages', 'Messages']]],
    ['admin', 'Admin', 'admin', [['subscriptions', 'Subscriptions'], ['invoices', 'Invoices'], ['payments', 'Payments']]],
    ['settings', 'Settings', 'settings', [['main', 'Main'], ['usertypes', 'User roles'], ['userperms', 'User permissions'], ['vmodels', 'Vehicle models'], ['subs', 'Subscription types'], ['notifications', 'Notifications'], ['notiflogs', 'Notification logs'], ['triggers', 'Triggers'], ['widgets', 'Widgets'], ['audit', 'Audit logs'], ['integrations', 'Integrations']]]
  ];
  // Heritage member portal nav (a completely different menu from the admin console)
  var HERITAGE_NAV = [
    ['heritage', 'Heritage', 'archive'],
    ['vehicles', 'Vehicles', 'vehicles'],
    ['mynotifs', 'Notifications', 'bell'],
    ['news', 'News', 'news']
  ];
  // routes only the super-admin may see/visit
  var SUPER_ONLY = { automations: 1, audit: 1, notifications: 1, notiflogs: 1, triggers: 1, widgets: 1, usertypes: 1, userperms: 1, messages: 1, messagerec: 1, events: 1, eventlogs: 1, integrations: 1, integ: 1 };
  function navList() {
    if (V.isHeritage && V.isHeritage()) return HERITAGE_NAV;
    var n = NAV.slice();
    if (!V.isSuperAdmin()) {
      n = n.filter(function (it) { return !SUPER_ONLY[it[0]]; }).map(function (it) {
        if (!it[3]) return it;
        return [it[0], it[1], it[2], it[3].filter(function (c) { return !SUPER_ONLY[c[0]]; })];
      });
    }
    return n;
  }
  // sub-routes map to their parent nav item for active highlighting
  var NAV_ALIAS = { menu: 'dashboard', created: 'users', user: 'users', groups: 'users', grouprec: 'users', faq: 'help', vehrec: 'vehicles', archive: 'heritage', newsrec: 'news', emailrec: 'emails', settings: 'main' };
  // which top-level group a route belongs to (for keeping a group open)
  var ROUTE_GROUP = { users: 'users', new: 'users', created: 'users', user: 'users', groups: 'users', grouprec: 'users', vehicles: 'vehicles', vmodels: 'settings', vcerts: 'vehicles', vehrec: 'vehicles', subs: 'settings', integrations: 'settings', integ: 'settings', heritage: 'marketing', archive: 'marketing', news: 'marketing', newsrec: 'marketing', campaigns: 'marketing', campaignrec: 'marketing', stats: 'marketing', counters: 'marketing', marketing: 'marketing', subscriptions: 'admin', invoices: 'admin', payments: 'admin', admin: 'admin', messages: 'automations', messagerec: 'automations', notifications: 'settings', notiflogs: 'settings', triggers: 'settings', events: 'automations', eventlogs: 'automations', widgets: 'settings', audit: 'settings', usertypes: 'settings', userperms: 'settings', main: 'settings', settings: 'settings' };

  function curRoute() { return (location.hash || '#dashboard').replace('#', ''); }
  function groupOpenFor(route) { return ROUTE_GROUP[route] || null; }

  function buildNav() {
    var nav = document.getElementById('admNav');
    if (!nav) return;
    var locked = (V.isHeritage && V.isHeritage()) && (V.memberPending && V.memberPending());
    var openGroup = groupOpenFor(curRoute());
    if (locked) {
      // membership under review — show the menu but disable navigation
      nav.innerHTML = navList().map(function (n) {
        return '<span class="nav-row locked"><svg class="ic" viewBox="0 0 24 24">' + ICON[n[2]] + '</svg><span class="lb">' + T(n[1]) + '</span>'
          + '<svg class="nav-lock" viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="8" rx="1"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg></span>';
      }).join('');
      return;
    }
    nav.innerHTML = navList().map(function (n) {
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

    // parent toggles its group open/closed (accordion: only one group open at a time,
    // so the sidebar stays compact and bottom items never fall off-screen)
    [].forEach.call(nav.querySelectorAll('.nav-parent'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var grp = btn.closest('.nav-group');
        var wasOpen = grp.classList.contains('open');
        [].forEach.call(nav.querySelectorAll('.nav-group'), function (g) { g.classList.remove('open'); });
        if (!wasOpen) grp.classList.add('open');
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
  // Member self-cancellation — branded modal with optional data erasure.
  function cancelMembershipModal(acct) {
    var email = (acct && acct.email) || '';
    var modal = document.createElement('div');
    modal.className = 'mv-modal';
    modal.innerHTML = ''
      + '<div class="mv-dialog" role="dialog" aria-modal="true">'
      +   '<div class="mv-dhead"><span>' + esc(HT('cancel.title')) + '</span><button class="mv-x" type="button" aria-label="Close">\u00d7</button></div>'
      +   '<div class="mv-dbody">'
      +     '<p class="mv-dmsg">' + HT('cancel.body', { email: '<span class="gold">' + esc(email) + '</span>' }) + '</p>'
      +     '<label style="display:flex;gap:12px;align-items:flex-start;margin-top:6px;cursor:pointer;font-weight:300;color:var(--fg-dim);font-size:0.9rem;line-height:1.55;"><input type="checkbox" id="eraseChk" style="margin-top:3px;flex:none;"> <span>' + esc(HT('cancel.erase')) + ' <span style="color:var(--mute);">' + esc(HT('cancel.eraseHint')) + '</span></span></label>'
      +   '</div>'
      +   '<div class="mv-dfoot"><button class="mv-btn ghost" type="button" data-mv="cancel">' + esc(HT('cancel.keep')) + '</button><button class="mv-btn danger" type="button" data-mv="go">' + esc(HT('cancel.confirm')) + '</button></div>'
      + '</div>';
    document.body.appendChild(modal);
    function close() { if (modal.parentNode) modal.parentNode.removeChild(modal); }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.mv-x').addEventListener('click', close);
    modal.querySelector('[data-mv="cancel"]').addEventListener('click', close);
    modal.querySelector('[data-mv="go"]').addEventListener('click', function () {
      var erase = !!(document.getElementById('eraseChk') && document.getElementById('eraseChk').checked);
      if (acct && acct.id) {
        V.store.cancel(acct.id);
        if (V.logActivity) V.logActivity('member-cancelled', (acct.name || '') + (erase ? ' \u00b7 data erased' : ''));
        if (erase) V.store.remove(acct.id);
      }
      var dialog = modal.querySelector('.mv-dialog');
      dialog.innerHTML = ''
        + '<div class="mv-dhead"><span>' + esc(HT('cancel.doneTitle')) + '</span></div>'
        + '<div class="mv-dbody"><div class="mv-result">'
        +   '<div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>'
        +   '<div class="msg">' + esc(HT('cancel.doneMsg')) + '</div>'
        +   '<div class="sub">' + esc(HT('cancel.emailSent', { email: email })) + (erase ? ' ' + esc(HT('cancel.removed')) : '') + '</div>'
        + '</div></div>'
        + '<div class="mv-dfoot"><button class="mv-btn go" type="button" data-mv="close">' + esc(HT('common.done')) + '</button></div>';
      dialog.querySelector('[data-mv="close"]').addEventListener('click', function () {
        if (V.signOutVip) V.signOutVip();
        location.href = 'index.html';
      });
    });
  }
  function renderProfile() {
    topBar.hidden = false;
    var acct = V.account();
    if (!acct) { toLogin(); return; }
    var initials = (acct.name || 'M').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var hu = (acct.role === 'heritage' && acct.id) ? V.store.get(acct.id) : null;
    var roleLabel = acct.super ? 'Super-admin' : (acct.role === 'admin' ? 'Admin' : (hu ? HT('tier.' + (hu.tier || 'admirer')) : 'VIP'));
    var validLine = (acct.super || acct.role === 'admin') ? 'No expiry' : (acct.endDate ? V.fmtDate(acct.endDate) : 'No end date');

    var pwSection, pwTitle;
    if (acct.super) {
      pwTitle = 'Password';
      pwSection = '<p class="adm-sub" style="max-width:60ch;">The master super-admin password is fixed in the system configuration and cannot be changed from this page. To rotate it, update it in the deployment settings (see the backend handoff).</p>';
    } else {
      pwTitle = 'Change password';
      pwSection = ''
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
      +   (hu ? secColl('prof-membership', 'Membership',
            '<div class="acc-meta2">'
            + '<span>Type <b>' + esc(HT('tier.' + (hu.tier || 'admirer'))) + '</b></span>'
            + '<span>Status <b>' + (hu.status === 'pending' ? 'Pending review' : (hu.status === 'denied' ? 'Declined' : (V.isExpired(hu) ? 'Lapsed' : 'Active'))) + '</b></span>'
            + (hu.endDate ? '<span>Renewal date <b>' + esc(V.fmtDate(hu.endDate)) + '</b></span>' : '')
            + '<span>Renewal <b>' + (hu.autoRenew !== false ? 'Auto-renew' : 'Manual') + '</b></span>'
            + '</div>'
            + '<div class="acc-meta2" style="align-items:center;margin-top:12px;"><label class="set-toggle"><input type="checkbox" id="autoRenewTgl"' + (hu.autoRenew !== false ? ' checked' : '') + '><span class="tk"></span></label><span class="field-hint">Automatically renew my membership each year (12 months).</span></div>'
            + '<div class="acc-meta2" style="align-items:center;margin-top:12px;"><label class="set-toggle"><input type="checkbox" id="mailTgl"' + (hu.mailing !== false ? ' checked' : '') + '><span class="tk"></span></label><span class="field-hint">' + esc(HT('portal.mailing')) + '</span></div>'
            + '<div class="adm-extend" style="margin-top:18px;"><button class="btn-cancel" type="button" id="cancelMemBtn" style="border-color:var(--minerva-red-bright);color:var(--minerva-red-bright);">Cancel membership</button></div>') : '')
      +   secColl('prof-language', 'Language',
            '<form id="langForm" onsubmit="return false;" style="max-width:440px;"><div class="ff"><label for="acLang">Preferred language</label><div class="ff-input"><select id="acLang" class="ff-select">' + ADM_LANG_OPTS(acct.lang || 'en') + '</select></div><span class="field-hint">This sets the language of the website while you are signed in.</span></div><p class="acc-msg" id="langMsg"></p></form>')
      +   secColl('prof-password', pwTitle, pwSection)
      + '</div>';

    var arTgl = document.getElementById('autoRenewTgl');
    if (arTgl) arTgl.addEventListener('change', function () { if (acct.id) V.store.update(acct.id, { autoRenew: arTgl.checked }); renderProfile(); });
    var mailTgl = document.getElementById('mailTgl');
    if (mailTgl) mailTgl.addEventListener('change', function () { if (acct.id) V.store.update(acct.id, { mailing: mailTgl.checked }); });
    var cancelMemBtn = document.getElementById('cancelMemBtn');
    if (cancelMemBtn) cancelMemBtn.addEventListener('click', function () { cancelMembershipModal(acct); });
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
      +   ''
      +   '<div class="counters" style="margin-top:clamp(26px,4vh,40px);">' + countersHtml + '</div>'
      + '</div>';
    bindBack('#menu');
    [].forEach.call(root.querySelectorAll('[data-counter]'), function (el) {
      var key = el.getAttribute('data-counter');
      el.querySelector('[data-target]').addEventListener('change', function (e) { V.setCounter(key, { target: e.target.value || null }); renderCounters(); });
    });
  }

  /* ---------------- HELP & SUPPORT — AI concierge + FAQ ---------------- */
  // Ephemeral, in-memory only (no persistence => no saved chat history).
  var aiState = { messages: [], busy: false, pending: null };
  var AI_SUGGEST = [
    'How do I add a new VIP guest?',
    'What\u2019s the difference between VIP and Admin?',
    'How do I extend or restore a user\u2019s access?',
    'Explain the audit log.'
  ];
    var AI_SUGGEST_MEMBER = [
    'What can I do as a member?',
    'How do I browse the Heritage archive?',
    'Tell me about the history of Minerva.',
    'What is the Minerva Motors Heritage vzw?'
  ];
  function aiIsMember() { return !!(V.isHeritage && V.isHeritage()); }
  function isAdmirerView() { return !!(V.isHeritage && V.isHeritage() && V.memberTier && V.memberTier() === 'admirer'); }
  function aiSuggest() { return aiIsMember() ? AI_SUGGEST_MEMBER : AI_SUGGEST; }
  function memberKnowledge() {
    return [
      'You are the Minerva Concierge for a Heritage member of Minerva Luxury Motors, inside the member portal.',
      'SCOPE \u2014 you may ONLY discuss three things: (1) how the member uses this portal and the features available to their access, (2) the documented history of the Minerva marque, and (3) the Minerva Motors Heritage vzw that operates this service.',
      'You must NOT provide any information about current or forthcoming Minerva vehicles, the company, its people or team, its partners, suppliers or commercial programmes. If asked about any of those, politely reply that such information is not available in the member portal.',
      'PORTAL FEATURES: the portal offers Heritage (the archive of historical documents and photographs), Vehicles (a member\u2019s own motor car where applicable, and for owner tiers the model catalogue), News (member news and invitations), and Profile (membership tier, status, renewal date, password and language). A member\u2019s tier \u2014 Admirer, Custodian or Commissioner \u2014 sets what they may see; an Admirer follows the marque and browses the public archive.',
      'HISTORY: Minerva is a Belgian motorcar marque founded in Antwerp in 1897 by Sylvain de Jong, named after the Roman goddess of wisdom and craft. In the 1920s the international motoring press ranked it among the four greatest luxury manufacturers in the world, alongside Rolls-Royce, Hispano-Suiza and Isotta-Fraschini; its clients included the Belgian Royal Family and the kings of Sweden and Norway, and Charles Rolls was its English dealer before co-founding Rolls-Royce. The marque went dormant in 1956.',
      'THE VZW: the Minerva Motors Heritage vzw (Belgian non-profit, enterprise number BE0783.597.177) is entrusted with preserving the history of the marque; Jean Claes is among its founding members. This member portal is operated in service of that conservation mission.',
      'VOICE: patrician, declarative, unhurried and precise. Never use emoji or exclamation marks. Keep replies concise. Reply in the same language as the member.'
    ].join(' ');
  }
  function aiPreamble() {
    if (aiIsMember()) return memberKnowledge();
    // Canonical capabilities knowledge (assets/concierge-knowledge.js) is the
    // single source of truth, shared with the production Mistral bridge.
    var core = window.MinervaConciergeKnowledge || [
      'You are the Minerva Concierge, the in-console assistant for the administration console of Minerva Luxury Motors.',
      'You help administrators use this console \u2014 most often to create and edit VIP users (Manage Users \u2192 New user; or open a user\u2019s row to edit, resend, extend or restore access).'
    ].join(' ');
    return [
      core,
      'Reply in ' + (consoleLang() === 'fr' ? 'French' : 'English') + ' unless the administrator writes in another language, in which case mirror it.',
      'Knowledge base \u2014 use these official answers to common questions when relevant: ' + FAQ.map(function (q) { return 'Q: ' + q[0] + ' A: ' + q[1].replace(/<[^>]+>/g, ''); }).join(' \u2014\u2014 ')
    ].join(' ');
  }
  function aiFormat(t) {
    var s = esc(t);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    return '<p>' + s + '</p>';
  }
  function aiGreeting() {
    var a = V.account ? V.account() : null;
    var nm = (a && a.name) ? a.name.split(/\s+/)[0] : '';
    if (aiIsMember()) return 'Good day' + (nm ? ', ' + nm : '') + '. I am the Minerva concierge. Ask me about your Heritage membership and the portal, the history of the marque, or the Minerva Motors Heritage vzw \u2014 and I will assist you.';
    return 'Good day' + (nm ? ', ' + nm : '') + '. I am the Minerva concierge. Ask me anything about managing users, access, vehicles, the audit log or the launch counters \u2014 and I will guide you.';
  }
  function aiAvatar(role) {
    return role === 'user'
      ? '<span class="av"><span class="you">YOU</span></span>'
      : '<span class="av"><img src="uploads/minerva-logo-black.png" alt="Minerva"></span>';
  }
  function aiRenderThread() {
    var th = document.getElementById('aiThread'); if (!th) return;
    var html = aiState.messages.map(function (m) {
      return '<div class="ai-msg ' + (m.role === 'user' ? 'user' : 'bot') + '">' + aiAvatar(m.role)
        + '<div class="bubble">' + aiFormat(m.content) + '</div></div>';
    }).join('');
    if (aiState.busy) {
      html += '<div class="ai-msg bot">' + aiAvatar('assistant')
        + '<div class="bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div></div>';
    }
    th.innerHTML = html;
    var hasUser = aiState.messages.some(function (m) { return m.role === 'user'; });
    var sug = document.getElementById('aiSuggest'); if (sug) sug.style.display = hasUser ? 'none' : '';
    var btn = document.getElementById('aiSendBtn'); if (btn) btn.disabled = aiState.busy;
    aiScroll();
  }
  // Keep the newest message in view inside the bounded thread (rAF is unreliable when the frame isn't painting).
  function aiScroll() {
    var th = document.getElementById('aiThread'); if (!th) return;
    th.scrollTop = th.scrollHeight;
    setTimeout(function () { var t = document.getElementById('aiThread'); if (t) t.scrollTop = t.scrollHeight; }, 60);
  }
  function aiSend(text) {
    text = (text || '').trim();
    if (!text || aiState.busy) return;
    aiState.messages.push({ role: 'user', content: text });
    aiState.busy = true;
    aiRenderThread();
    var canAI = window.claude && typeof window.claude.complete === 'function';
    if (!canAI) {
      aiState.busy = false;
      aiState.messages.push({ role: 'assistant', content: 'The assistant is unavailable in this context. Once connected, I will answer your questions about the console here.' });
      aiRenderThread();
      return;
    }
    var apiMsgs = [{ role: 'user', content: aiPreamble() }, { role: 'assistant', content: 'Understood. I am the Minerva concierge and will assist with the console.' }]
      .concat(aiState.messages.map(function (m) { return { role: m.role === 'user' ? 'user' : 'assistant', content: m.content }; }));
    window.claude.complete({ messages: apiMsgs }).then(function (resp) {
      aiState.busy = false;
      aiState.messages.push({ role: 'assistant', content: (resp || '').trim() || 'I beg your pardon \u2014 I was unable to compose a reply. Kindly try again.' });
      aiRenderThread();
    }).catch(function () {
      aiState.busy = false;
      aiState.messages.push({ role: 'assistant', content: 'I beg your pardon \u2014 the assistant is momentarily unavailable. Kindly try again shortly.' });
      aiRenderThread();
    });
  }
  function renderHelp() {
    topBar.hidden = false;
    // Fresh greeting when nothing is in flight and no prompt is incoming from the top bar.
    if (!aiState.messages.length && !aiState.pending) {
      aiState.messages.push({ role: 'assistant', content: aiGreeting() });
    }
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Help & Support">'
      +   '<p class="adm-crumb"><span class="cr-here">Help &amp; Support</span></p>'
      +   '<div class="ai-panel">'
      +     '<div class="ai-head">'
      +       '<span class="mark"><img src="uploads/minerva-logo-black.png" alt="Minerva"></span>'
      +       '<div><div class="ttl">Minerva Concierge</div>'
      +         '<div class="st"><span class="pip"></span>AI assistant \u00b7 here to help</div></div>'
      +       '<button class="ai-reset" id="aiReset" type="button">New conversation</button>'
      +     '</div>'
      +     '<div class="ai-thread" id="aiThread"></div>'
      +     '<div class="ai-suggest" id="aiSuggest">' + aiSuggest().map(function (s) { return '<button class="ai-chip" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>'
      +     '<form class="ai-composer" id="aiForm" onsubmit="return false;">'
      +       '<textarea id="aiInput" rows="1" placeholder="Ask the concierge\u2026"></textarea>'
      +       '<button class="ai-send" id="aiSendBtn" type="submit" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
      +     '</form>'
      +     '<p class="ai-disclaimer">Conversations are not saved \u00b7 responses may be imperfect</p>'
      +   '</div>'
      + '</div>';
    bindBack('#dashboard');

    var form = document.getElementById('aiForm');
    var input = document.getElementById('aiInput');
    function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }
    function submitAsk() { var v = input.value; input.value = ''; grow(); aiSend(v); }
    input.addEventListener('input', grow);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAsk(); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); submitAsk(); });
    [].forEach.call(root.querySelectorAll('.ai-chip'), function (c) { c.addEventListener('click', function () { aiSend(c.getAttribute('data-q')); }); });
    document.getElementById('aiReset').addEventListener('click', function () {
      aiState = { messages: [], busy: false, pending: null };
      aiState.messages.push({ role: 'assistant', content: aiGreeting() });
      renderHelp();
    });

    aiRenderThread();
    // A prompt arriving from the top bar opens a fresh conversation and sends straight away.
    if (aiState.pending) {
      var p = aiState.pending; aiState.pending = null; aiState.messages = [];
      aiRenderThread(); aiSend(p);
    }
    input.focus();
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
      +   '<p class="adm-crumb"><a class="cr-root" href="#main">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Main</span></p>'
      +   '<div style="margin-top:clamp(20px,3vh,30px);"></div>'
      +   secColl('set-appearance', 'Appearance',
            row('Theme', 'Switch the console between dark and light.', '<div class="seg" id="setTheme"><button type="button" data-theme="dark"' + (theme !== 'light' ? ' class="on"' : '') + '>Dark</button><button type="button" data-theme="light"' + (theme === 'light' ? ' class="on"' : '') + '>Light</button></div>'))
      +   secColl('set-notifications', 'Notifications',
            row('Push notifications', 'Show alerts in the console bell.', '<label class="set-toggle"><input type="checkbox" id="setNotif" checked><span class="tk"></span></label>')
            + row('Email digests', 'A weekly summary of access activity.', '<label class="set-toggle"><input type="checkbox" id="setDigest"><span class="tk"></span></label>'))
      +   secColl('set-account', 'Account',
            row('Profile &amp; password', 'Manage your personal details and password.', '<a class="btn" href="#profile" id="setProfile" style="text-decoration:none;">Open profile</a>'))
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

  /* ---------------- USER ROLES & PERMISSIONS (settings) ---------------- */
  function renderUserTypes() {
    topBar.hidden = false;
    var types = [
      ['Super-admin', 'Full system', 'Complete control of the console and configuration. A single fixed master account — it cannot be created from the console.'],
      ['Admin', 'Users & content', 'Manages VIP guests, vehicles, the Heritage archive and news. Cannot create other administrators or change system configuration.'],
      ['VIP guest', 'VIP app · time-limited', 'Time-bound access to the VIP mobile application. Issued by an administrator from tomorrow up to three months ahead.'],
      ['Heritage · Admirer', 'Public archive', 'Brand admirer who follows the marque and browses the public Heritage archive.'],
      ['Heritage · Custodian', 'Archive + events', 'Custodian of a historic Minerva; contributes to the archive and is invited to Minerva events.'],
      ['Heritage · Commissioner', 'Archive + owner experience', 'Commissioner of a new Minerva; contributes to the archive and is invited to the Owner Experience.']
    ];
    var cols = '200px 180px 420px';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="User roles">'
      + '<p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">›</span><span class="cr-here">User roles</span></p>'
      + ''
      + '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span>Role</span><span>Access scope</span><span>Description</span></div>'
      + types.map(function (t) { return '<div class="adm-row" style="--cols:' + cols + '"><span class="c-name">' + esc(t[0]) + '</span><span class="veh-c">' + esc(t[1]) + '</span><span class="c-email" style="white-space:normal;">' + esc(t[2]) + '</span></div>'; }).join('')
      + '</div></div>';
    bindBack('#settings');
  }
  function renderUserPerms() {
    topBar.hidden = false;
    var Y = '<span style="color:var(--minerva-red-bright);font-weight:600;">✓</span>';
    var N = '<span style="color:var(--platinum-deep);opacity:.45;">—</span>';
    var roles = ['Super-admin', 'Admin', 'VIP guest', 'Admirer', 'Custodian', 'Commissioner'];
    // [name, super-admin, admin, vip, heritage:admirer, heritage:custodian, heritage:commissioner]
    var caps = [
      { g: 'Console &amp; platform' },
      ['Sign in to the console', 1, 1, 0, 0, 0, 0],
      ['Create VIP guests', 1, 1, 0, 0, 0, 0],
      ['Create administrators', 1, 0, 0, 0, 0, 0],
      ['Impersonate any user', 1, 0, 0, 0, 0, 0],
      ['Manage vehicles & models', 1, 1, 0, 0, 0, 0],
      ['Manage Heritage archive', 1, 1, 0, 0, 0, 0],
      ['Publish news', 1, 1, 0, 0, 0, 0],
      ['Automations, triggers & widgets', 1, 0, 0, 0, 0, 0],
      ['View audit logs', 1, 0, 0, 0, 0, 0],
      ['System settings', 1, 0, 0, 0, 0, 0],
      { g: 'Applications' },
      ['VIP mobile application', 0, 0, 1, 0, 0, 0],
      ['Heritage member portal', 0, 0, 0, 1, 1, 1],
      { g: 'Heritage benefits' },
      ['Browse the public archive', 0, 0, 0, 1, 1, 1],
      ['Receive member news', 0, 0, 0, 1, 1, 1],
      ['Contribute to the archive', 0, 0, 0, 0, 1, 1],
      ['Register a vehicle on the portal', 0, 0, 0, 0, 1, 1],
      ['Invitation to Minerva events', 0, 0, 0, 0, 1, 1],
      ['Owner Experience programme', 0, 0, 0, 0, 0, 1]
    ];
    var cols = '220px 92px 92px 92px 92px 92px 92px';
    function cell(v) { return '<span class="veh-c" style="text-align:center;">' + (v ? Y : N) + '</span>'; }
    var headHtml = '<div class="adm-row head" style="--cols:' + cols + '"><span>Capability</span>'
      + roles.map(function (r) { return '<span style="text-align:center;white-space:normal;letter-spacing:.03em;font-size:10px;line-height:1.25;">' + r + '</span>'; }).join('') + '</div>';
    var bodyHtml = caps.map(function (c) {
      if (c.g) return '<div class="adm-row" style="--cols:1fr;"><span style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--minerva-red-bright);opacity:.85;padding-top:8px;">' + c.g + '</span></div>';
      return '<div class="adm-row" style="--cols:' + cols + '"><span class="c-name" style="font-weight:400;white-space:normal;">' + esc(c[0]) + '</span>' + cell(c[1]) + cell(c[2]) + cell(c[3]) + cell(c[4]) + cell(c[5]) + cell(c[6]) + '</div>';
    }).join('');
    root.innerHTML = '<div class="adm-wrap" data-screen-label="User permissions">'
      + '<p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">›</span><span class="cr-here">User permissions</span></p>'
      + ''
      + '<div class="adm-table tbl-std">' + headHtml + bodyHtml + '</div></div>';
    bindBack('#settings');
  }

  /* ============================================================
     HERITAGE MEMBER PORTAL  (role = heritage)
     ============================================================ */
  var TIER_LABEL = { admirer: 'Admirer', custodian: 'Custodian', commissioner: 'Commissioner' };
  var TIER_DESC = {
    admirer: 'Brand admirer \u00b7 follows the marque and browses the public archive.',
    custodian: 'Custodian of a historic Minerva \u00b7 contributes to the archive and is invited to Minerva events.',
    commissioner: 'Commissioner of a new Minerva \u00b7 contributes to the archive and is invited to the Owner Experience.'
  };
  var ARCH_CATS = ['Photograph', 'Document', 'Correspondence', 'Drawing', 'Press', 'Film'];
  var archSel = null, archFilter = 'all', archAdding = false, archPending = null;
  var newsSel = null, newsAdding = false, newsSelected = {};

  function memberBanner() {
    if (!(V.isHeritage && V.isHeritage())) return '';
    var tier = V.memberTier ? V.memberTier() : null;
    if (!tier) return '';
    var pending = V.memberPending && V.memberPending();
    return '<div class="mem-card">'
      + '<div class="mem-tier"><span class="mem-badge tier-' + tier + '">' + esc(HT('tier.' + tier)) + '</span>'
      +   (pending ? '<span class="mem-status pending">' + esc(HT('card.review')) + '</span>' : '<span class="mem-status ok">' + esc(HT('card.standing')) + '</span>') + '</div>'
      + '<p class="mem-desc">' + esc(HT('tierdesc.' + tier)) + '</p>'
      + (pending ? '<p class="mem-note">' + esc(HT('card.pendingNote')) + '</p>' : '')
      + '</div>';
  }
  function audienceLabel(a) { return a === 'custodian' ? 'Custodians' : (a === 'commissioner' ? 'Commissioners' : 'All members'); }

  /* ---- portal Vehicles: the member's own car(s) + the model catalogue ---- */
  function renderMemberPending() {
    topBar.hidden = false;
    var acct = V.account ? V.account() : null;
    var u = acct && acct.id ? V.store.get(acct.id) : null;
    var tier = (u && u.tier) || 'admirer';
    var first = (acct && acct.name ? acct.name.split(/\s+/)[0] : '');
    var nameStr = first ? ', ' + first : '';
    var vinStr = (u && u.vin) ? ' (' + u.vin + ')' : '';
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Membership under review">'
      +   '<div class="review-screen">'
      +     '<span class="review-mark"><img src="uploads/minerva-logo-black.png" alt="Minerva"></span>'
      +     '<p class="review-eyebrow">' + esc(HT('review.eyebrow')) + '</p>'
      +     '<h1 class="review-h">' + esc(HT('review.title')) + '</h1>'
      +     '<p class="review-b">' + esc(HT('review.body', { name: nameStr, tier: HT('tier.' + tier), vin: vinStr })) + '</p>'
      +     '<div class="review-steps">'
      +       '<div class="rstep done"><span class="rdot"></span><span class="rlbl">' + esc(HT('review.step1')) + '</span></div>'
      +       '<div class="rstep active"><span class="rdot"></span><span class="rlbl">' + esc(HT('review.step2')) + '</span></div>'
      +       '<div class="rstep"><span class="rdot"></span><span class="rlbl">' + esc(HT('review.step3')) + '</span></div>'
      +     '</div>'
      +     '<p class="review-foot">' + esc(HT('review.contact')) + ' <a href="mailto:heritage@minervaluxurymotors.com">heritage@minervaluxurymotors.com</a></p>'
      +     '<div style="margin-top:24px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px;align-items:center;">'
      +       '<div style="display:flex;gap:8px;width:100%;">'
      +         '<input id="reVin" type="text" value="' + esc((u && u.vin) || '') + '" placeholder="' + esc(HT('reg.vin')) + '" style="flex:1;background:var(--fld-bg);border:1px solid var(--line);color:var(--fg);font-family:var(--mono);font-size:12px;padding:11px 12px;letter-spacing:.06em;">'
      +         '<button class="btn" id="reSave" type="button" style="margin-top:0;white-space:nowrap;">Update</button>'
      +       '</div>'
      +       '<p class="adm-okmsg" id="reMsg" style="min-height:13px;"></p>'
      +       '<button class="btn-cancel" id="reWithdraw" type="button">Withdraw application</button>'
      +     '</div>'
      +     '<button class="vip-act ghost review-out" id="reviewOut" type="button">' + esc(HT('common.signout')) + '</button>'
      +   '</div>'
      + '</div>';
    var so = document.getElementById('reviewOut');
    if (so) so.addEventListener('click', function () { if (V.signOutVip) V.signOutVip(); location.href = 'login.html'; });
    var reSave = document.getElementById('reSave');
    if (reSave) reSave.addEventListener('click', function () { var v = document.getElementById('reVin').value.trim(); if (acct && acct.id) V.store.update(acct.id, { vin: v || null }); var m = document.getElementById('reMsg'); if (m) m.textContent = 'Saved.'; });
    var reW = document.getElementById('reWithdraw');
    if (reW) reW.addEventListener('click', function () { if (confirm('Withdraw your membership application? This cannot be undone.')) { if (acct && acct.id) V.store.cancel(acct.id); if (V.signOutVip) V.signOutVip(); location.href = 'login.html'; } });
  }
  /* ---- member notifications: visible news + push notifications sent to them ---- */
  /* ---- member notifications: admin-sent push, per-member read state ---- */
  var MNOTIF_KEY = 'minerva_member_notifs_v3';
  function mnotifAllStore() { try { return JSON.parse(localStorage.getItem(MNOTIF_KEY)) || {}; } catch (e) { return {}; } }
  function mnotifSaveStore(o) { try { localStorage.setItem(MNOTIF_KEY, JSON.stringify(o)); } catch (e) {} }
  function mnotifSeed() { return []; /* demo notifications disabled for production */
    var L1 = 'The Minerva Heritage archive has received a significant new accession this month. A private collection of period photographs and coachbuilders\u2019 records has been entrusted to the vzw for conservation. Each item is being catalogued and digitised by our archivists in Antwerp. Members will be notified as sections of the collection are opened for viewing. We are grateful to the families who continue to safeguard the marque\u2019s documented history.';
    var L2 = 'You are warmly invited to the annual Minerva Heritage gathering. The day brings together custodians, historians and enthusiasts in celebration of the marque\u2019s legacy. A guided presentation of recent archive acquisitions will open the programme. Luncheon will follow, with an afternoon dedicated to members\u2019 own records and recollections. Kindly confirm your attendance so that arrangements may be made accordingly.';
    var L3 = 'A note regarding your Heritage membership and its continued standing. Your access to the member portal, the archive and member communications remains active. Should your contact details change, you may update them at any time from your profile. The Minerva Motors Heritage vzw is committed to preserving the history of the marque on your behalf. We thank you for your continued support of this conservation mission.';
    var today = new Date();
    function d(n) { return new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10); }
    var raw = [
      ['Welcome to the Minerva Heritage circle', 'Your membership is active. The archive and member news are open to you.', 0, false],
      ['New archive accession', L1, 1, false],
      ['Annual Heritage gathering \u2014 invitation', L2, 2, false],
      ['Archive: Court of Sweden delivery, 1928', 'A newly catalogued photograph has been added to the public archive.', 4, false],
      ['Membership standing', L3, 6, false],
      ['Restoration records digitised', 'Coachbuilders\u2019 records from the 1930s are now available to view.', 8, true],
      ['Member newsletter \u2014 spring', 'This season\u2019s dispatch from the Minerva Motors Heritage vzw is available.', 11, true],
      ['Archive viewing \u2014 by appointment', 'Private viewings of the Antwerp archive may now be arranged.', 14, true],
      ['Press cuttings collection opened', 'A collection of period press cuttings has been opened for members.', 17, true],
      ['Heritage register update', 'The marque\u2019s chassis register has been updated with new entries.', 20, true],
      ['Concours invitation', 'Custodians are invited to a forthcoming concours d\u2019\u00e9l\u00e9gance.', 24, true],
      ['Archive volunteer programme', 'Members may now contribute to the conservation of the archive.', 28, true],
      ['Photographic restoration complete', 'A series of restored photographs has rejoined the collection.', 33, true],
      ['Membership renewal reminder', 'Your annual membership will renew shortly. No action is required.', 38, true],
      ['Founding members honoured', 'The vzw has recognised the founding members of the Heritage circle.', 45, true]
    ];
    return raw.map(function (r, i) { return { id: 'mn' + (i + 1), title: r[0], body: r[1], date: d(r[2]), read: r[3] }; });
  }
  function memberNotifs() {
    var a = V.account && V.account(); var mid = (a && a.id) || 'anon';
    var o = mnotifAllStore();
    if (!o[mid]) { o[mid] = mnotifSeed(); mnotifSaveStore(o); }
    return o[mid];
  }
  function mnotifUpdate(fn) { var a = V.account && V.account(); var mid = (a && a.id) || 'anon'; var o = mnotifAllStore(); o[mid] = fn(o[mid] || []); mnotifSaveStore(o); }
  function markNotifRead(id) { mnotifUpdate(function (l) { l.forEach(function (n) { if (n.id === id) n.read = true; }); return l; }); }
  function markAllNotifRead() { mnotifUpdate(function (l) { l.forEach(function (n) { n.read = true; }); return l; }); }
  function notifPopup(n) {
    markNotifRead(n.id);
    var modal = document.createElement('div'); modal.className = 'mv-modal';
    modal.innerHTML = '<div class="mv-dialog" role="dialog" aria-modal="true">'
      + '<div class="mv-dhead"><span>' + esc(n.title) + '</span><button class="mv-x" type="button" aria-label="Close">\u00d7</button></div>'
      + '<div class="mv-dbody"><p style="font-weight:300;line-height:1.7;color:var(--fg-dim);text-wrap:pretty;">' + esc(n.body) + '</p>'
      + '<p style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin-top:14px;">' + esc(n.date ? V.fmtDate(n.date) : '') + '</p></div>'
      + '<div class="mv-dfoot"><button class="mv-btn go" type="button" data-mv="close">' + esc(HT('common.done')) + '</button></div></div>';
    document.body.appendChild(modal);
    function close() { if (modal.parentNode) modal.parentNode.removeChild(modal); if (location.hash === '#mynotifs') renderMemberNotifications(); }
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('.mv-x').addEventListener('click', close);
    modal.querySelector('[data-mv="close"]').addEventListener('click', close);
  }
  function memberBellNotes() { return memberNotifs(); }
  // Admin push delivery: append a notification to each targeted member's centre.
  function deliverPushToMembers(srcId, item) {
    var aud = item.audience || 'all';
    var users = (V.store && V.store.all) ? V.store.all() : [];
    var store = mnotifAllStore();
    users.forEach(function (u) {
      if (u.role !== 'heritage' || u.cancelled) return;
      if (aud !== 'all' && u.tier !== aud) return;
      if (!store[u.id]) store[u.id] = [];
      if (store[u.id].some(function (n) { return n.src === srcId; })) return;   // no duplicates
      store[u.id].unshift({ id: 'mn_' + srcId + '_' + u.id, src: srcId, title: item.title, body: item.body || '', date: item.date || V.todayStr(), read: false });
    });
    mnotifSaveStore(store);
  }
  function renderMemberNotifications() {
    topBar.hidden = false;
    var list = memberNotifs();
    var cols = '1.7fr 150px 90px 70px';
    var rows = list.length
      ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span>' + esc(HT('common.notification')) + '</span><span>Date</span><span>Status</span><span></span></div>'
        + list.map(function (n) {
            return '<div class="adm-row" style="--cols:' + cols + '"><span class="c-name"><a data-open="' + esc(n.id) + '">' + esc(n.title) + '</a></span>'
              + '<span class="veh-c">' + esc(n.date ? V.fmtDate(n.date) : '\u2014') + '</span>'
              + '<span class="veh-c"><span class="st-chip ' + (n.read ? '' : 'st-amber') + '">' + esc(n.read ? HT('notif.read') : HT('notif.unread')) + '</span></span>'
              + '<span class="veh-c"><a data-mr="' + esc(n.id) + '" style="cursor:pointer;" title="Mark as read">\u2713</a></span></div>';
          }).join('') + '</div>'
      : '<p class="adm-empty">' + esc(HT('portal.noNotifs')) + '</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Notifications"><div class="adm-listhead"><p class="adm-crumb"><span class="cr-here">' + esc(HT('common.notifications')) + '</span></p><button class="btn-new" id="mnReadAll" type="button">' + esc(HT('notif.markAll')) + '</button></div>' + memberBanner() + rows + '</div>';
    bindBack('#heritage');
    var ra = document.getElementById('mnReadAll'); if (ra) ra.addEventListener('click', function () { markAllNotifRead(); renderMemberNotifications(); });
    [].forEach.call(root.querySelectorAll('[data-open]'), function (a) { a.addEventListener('click', function () { var n = memberNotifs().filter(function (x) { return x.id === a.getAttribute('data-open'); })[0]; if (n) notifPopup(n); }); });
    [].forEach.call(root.querySelectorAll('[data-mr]'), function (a) { a.addEventListener('click', function () { markNotifRead(a.getAttribute('data-mr')); renderMemberNotifications(); }); });
  }
  function renderMemberVehicles() {
    topBar.hidden = false;
    var acct = V.account ? V.account() : null;
    var u = acct && acct.id ? V.store.get(acct.id) : null;
    if (isAdmirerView()) {
      root.innerHTML = '<div class="adm-wrap" data-screen-label="Vehicles"><p class="adm-crumb"><span class="cr-here">Vehicles</span></p>' + memberBanner() + '<p class="adm-empty">' + esc(HT('portal.noVehicle')) + '</p></div>';
      bindBack('#heritage');
      return;
    }
    var myVin = u && u.vin ? String(u.vin).toLowerCase() : '';
    var email = acct ? String(acct.email || '').toLowerCase() : '';
    var mine = V.getVehicles().filter(function (v) {
      return (myVin && String(v.vin || '').toLowerCase() === myVin) || (email && String(v.email || '').toLowerCase() === email);
    });
    var mineHtml = mine.length
      ? '<div class="adm-table tbl-std"><div class="adm-row head veh-row" style="--cols:200px 150px 160px 140px"><span>VIN</span><span>First registration</span><span>Model</span><span>Model date</span></div>'
        + mine.map(function (v) {
            return '<div class="adm-row veh-row" style="--cols:200px 150px 160px 140px"><span class="veh-vin"><a class="veh-open" data-vtype="register" data-vkey="' + esc(v.vin) + '">' + esc(v.vin) + '</a></span>'
              + '<span class="veh-c">' + esc(v.firstReg ? V.fmtDate(v.firstReg) : '\u2014') + '</span>'
              + '<span class="veh-model">' + esc(v.model) + '</span>'
              + '<span class="veh-c">' + esc(v.modelDate ? V.fmtDate(v.modelDate) : '\u2014') + '</span></div>';
          }).join('') + '</div>'
      : '<p class="adm-empty">' + (u && u.vin ? HT('portal.vehiclePending', { vin: u.vin }) : HT('portal.noVehicle')) + '</p>';

    var modelsHtml = '<div class="adm-table tbl-std"><div class="adm-row head veh-row" style="--cols:200px 80px 120px 140px"><span>Model</span><span>Year</span><span>Type</span><span>Category</span></div>'
      + V.getModels().map(function (m) {
          return '<div class="adm-row veh-row" style="--cols:200px 80px 120px 140px"><span class="veh-model"><a class="veh-open" data-vtype="models" data-vkey="' + esc(m.name) + '">' + esc(m.name) + '</a></span>'
            + '<span class="veh-c">' + esc(m.year != null ? String(m.year) : '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(m.type || '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(m.category || '\u2014') + '</span></div>';
        }).join('') + '</div>';

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Vehicles">'
      +   '<p class="adm-crumb"><span class="cr-here">Vehicles</span></p>'
      +   memberBanner()
      +   '<p class="adm-section-h">' + esc(HT('portal.yourMinerva')) + '</p>'
      +   mineHtml
      +   '<p class="adm-section-h">' + esc(HT('portal.modelCatalogue')) + '</p>'
      +   ''
      +   modelsHtml
      + '</div>';
    bindBack('#heritage');
    [].forEach.call(root.querySelectorAll('.veh-open'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        vehSel = { type: a.getAttribute('data-vtype'), key: a.getAttribute('data-vkey') };
        vehEditing = false; location.hash = '#vehrec'; render();
      });
    });
  }

  /* ---- Heritage archive portal ---- */
  function archForm() {
    return '<form class="veh-newform" id="archFormEl" onsubmit="return false;">'
      + '<p class="adm-section-h" style="margin:0 0 14px;">Import a document</p>'
      + '<div class="veh-newgrid">'
      +   '<div class="ff"><label for="af_title">Title</label><div class="ff-input"><input id="af_title" type="text" placeholder="e.g. Atelier delivery note, 1929"></div></div>'
      +   '<div class="ff"><label for="af_year">Year</label><div class="ff-input"><input id="af_year" type="number" placeholder="1929"></div></div>'
      +   '<div class="ff"><label for="af_cat">Category</label><div class="ff-input"><select id="af_cat" class="ff-select">' + ARCH_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div></div>'
      + '</div>'
      + '<div class="ff" style="margin-top:16px;"><label>Visibility</label><div class="seg" id="af_vis"><button type="button" data-vis="private" class="on">Private</button><button type="button" data-vis="public">Public</button></div>'
      +   '<span class="field-hint" id="af_vishint">Private \u2014 only you and Minerva can see this document.</span></div>'
      + '<div class="ff" style="margin-top:16px;"><label for="af_desc">Description</label><div class="ff-input"><textarea id="af_desc" rows="2" class="ff-textarea" placeholder="A short note about this document"></textarea></div></div>'
      + '<div class="ff" style="margin-top:16px;"><label for="af_file">File</label><input id="af_file" type="file" accept="image/*,application/pdf" class="arch-file"><span class="field-hint">Images preview here; PDFs are referenced by name (full file storage arrives with the backend).</span><div id="af_preview" class="af-preview"></div></div>'
      + '<p class="adm-err" id="af_err"></p>'
      + '<div class="adm-extend"><button class="btn" type="submit" id="af_save">Add to archive</button><button class="btn-cancel" type="button" id="af_cancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
      + '</form>';
  }
  function wireArchForm() {
    var form = document.getElementById('archFormEl'); if (!form) return;
    var vis = 'private';
    var visSeg = document.getElementById('af_vis');
    var visHint = document.getElementById('af_vishint');
    [].forEach.call(visSeg.querySelectorAll('[data-vis]'), function (b) {
      b.addEventListener('click', function () {
        vis = b.getAttribute('data-vis');
        [].forEach.call(visSeg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        visHint.textContent = vis === 'public' ? 'Public \u2014 other members can see this document.' : 'Private \u2014 only you and Minerva can see this document.';
      });
    });
    var fileEl = document.getElementById('af_file');
    var preview = document.getElementById('af_preview');
    fileEl.addEventListener('change', function () {
      var f = fileEl.files && fileEl.files[0];
      archPending = null; preview.innerHTML = '';
      if (!f) return;
      archPending = { fileName: f.name, thumb: null, file: f };
      if (/^image\//.test(f.type)) {
        var rd = new FileReader();
        rd.onload = function (ev) {
          var img = new Image();
          img.onload = function () {
            var max = 280, w = img.width, hh = img.height, s = Math.min(1, max / Math.max(w, hh));
            var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(hh * s);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            try { archPending.thumb = c.toDataURL('image/jpeg', 0.7); } catch (e) {}
            preview.innerHTML = '<span class="arch-thumb" style="background-image:url(' + (archPending.thumb || '') + ')"></span>';
          };
          img.src = ev.target.result;
        };
        rd.readAsDataURL(f);
      } else {
        preview.innerHTML = '<span class="arch-file-chip">' + esc(f.name) + '</span>';
      }
    });
    document.getElementById('af_cancel').addEventListener('click', function () { archAdding = false; archPending = null; renderArchives(); });
    document.getElementById('af_save').addEventListener('click', function () {
      var err = document.getElementById('af_err');
      var saveBtn = document.getElementById('af_save');
      var title = document.getElementById('af_title').value.trim();
      if (!title) { err.textContent = 'Enter a title'; return; }
      var acct = V.account ? V.account() : null;
      // No client id: the bridge inserts rows that arrive without an id, then
      // re-reads the persisted row (with its real uuid) from Supabase.
      var rec = {
        title: title,
        year: parseInt(document.getElementById('af_year').value, 10) || '',
        category: document.getElementById('af_cat').value,
        visibility: vis,
        desc: document.getElementById('af_desc').value.trim(),
        fileName: archPending ? archPending.fileName : '',
        filePath: '',
        thumb: archPending ? archPending.thumb : null,
        by: acct ? acct.name : 'Member',
        ts: Date.now()
      };
      function commit() {
        var list = V.getArchives(); list.unshift(rec); V.setArchives(list);
        if (V.logActivity) V.logActivity('archive-created', title);
        archAdding = false; archPending = null; renderArchives();
      }
      var fileObj = archPending && archPending.file;
      if (fileObj && V.uploadArchiveFile) {
        err.textContent = '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Uploading…'; }
        V.uploadArchiveFile(fileObj)
          .then(function (path) { rec.filePath = path || ''; commit(); })
          .catch(function (e) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Add to archive'; }
            err.textContent = 'File upload failed: ' + ((e && e.message) || 'error');
          });
      } else {
        commit();
      }
    });
  }
  function renderArchives() {
    topBar.hidden = false;
    var isAdminView = !!(V.isAdmin && V.isAdmin());
    if (isAdmirerView()) {
      root.innerHTML = '<div class="adm-wrap" data-screen-label="Archives"><p class="adm-crumb"><span class="cr-here">Heritage</span></p>' + memberBanner() + '<p class="adm-empty">' + esc(HT('portal.archSoon')) + '</p></div>';
      bindBack('#dashboard');
      return;
    }
    var canContribute = isAdminView || (V.canContribute && V.canContribute());
    var pending = V.memberPending && V.memberPending();
    var hv = !isAdminView && (V.isHeritage && V.isHeritage());
    function PL(key, en) { return hv ? HT(key) : en; }
    var acct = V.account ? V.account() : null;
    var me = acct ? acct.name : '';
    var visible = V.getArchives().filter(function (a) {
      if (isAdminView) return true;
      if (a.visibility === 'public') return true;
      return a.by && me && a.by === me;
    });
    if (archFilter === 'public') visible = visible.filter(function (a) { return a.visibility === 'public'; });
    else if (archFilter === 'private') visible = visible.filter(function (a) { return a.visibility === 'private'; });

    var cards = visible.length ? '<div class="arch-grid">' + visible.map(function (a) {
      var thumb = a.thumb
        ? '<span class="arch-thumb" style="background-image:url(' + a.thumb + ')"></span>'
        : '<span class="arch-thumb arch-thumb-glyph">' + esc((a.category || 'A').charAt(0)) + '</span>';
      return '<button class="arch-card" type="button" data-arc="' + esc(a.id) + '">' + thumb
        + '<span class="arch-meta"><span class="arch-title">' + esc(a.title) + '</span>'
        +   '<span class="arch-sub">' + (a.year ? esc(String(a.year)) + ' \u00b7 ' : '') + esc(a.category || '') + '</span>'
        +   '<span class="arch-vis vis-' + (a.visibility === 'public' ? 'pub' : 'priv') + '">' + (a.visibility === 'public' ? PL('common.public', 'Public') : PL('common.private', 'Private')) + '</span></span>'
        + '</button>';
    }).join('') + '</div>' : '<p class="adm-empty">' + esc(PL('portal.noDocs', 'No documents in the archive.')) + '</p>';

    var filters = '<div class="seg arch-filter" id="archFilter">'
      + [['all', PL('common.all', 'All')], ['public', PL('common.public', 'Public')], ['private', PL('common.private', 'Private')]].map(function (f) { return '<button type="button" data-af="' + f[0] + '"' + (archFilter === f[0] ? ' class="on"' : '') + '>' + esc(f[1]) + '</button>'; }).join('')
      + '</div>';
    var importBtn = (canContribute && !pending) ? '<button class="btn-new" id="archNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Import document</button>' : '';

    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Heritage">'
      +   '<p class="adm-crumb"><span class="cr-here">' + esc(PL('common.heritage', 'Heritage')) + '</span></p>'
      +   ''
      +   memberBanner()
      +   '<div class="veh-bar">' + filters + importBtn + '</div>'
      +   (archAdding ? archForm() : '')
      +   cards
      + '</div>';
    bindBack('#heritage');
    var ff = document.getElementById('archFilter');
    if (ff) [].forEach.call(ff.querySelectorAll('[data-af]'), function (b) { b.addEventListener('click', function () { archFilter = b.getAttribute('data-af'); renderArchives(); }); });
    var an = document.getElementById('archNew'); if (an) an.addEventListener('click', function () { archAdding = !archAdding; archPending = null; renderArchives(); });
    wireArchForm();
    [].forEach.call(root.querySelectorAll('[data-arc]'), function (b) { b.addEventListener('click', function () { archSel = b.getAttribute('data-arc'); location.hash = '#archive'; render(); }); });
  }
  function renderArchiveRecord() {
    topBar.hidden = false;
    if (!archSel) { location.hash = '#heritage'; render(); return; }
    var rec = V.getArchives().filter(function (a) { return a.id === archSel; })[0];
    if (!rec) { archSel = null; location.hash = '#heritage'; render(); return; }
    var acct = V.account ? V.account() : null;
    var isAdminView = !!(V.isAdmin && V.isAdmin());
    var owns = acct && rec.by === acct.name;
    var canManage = isAdminView || ((V.canContribute && V.canContribute()) && owns);
    var media = rec.thumb
      ? '<div class="arch-hero" style="background-image:url(' + rec.thumb + ')"></div>'
      : '<div class="arch-hero arch-hero-glyph">' + esc((rec.category || 'A').charAt(0)) + '</div>';
    var rows = [
      ['Title', rec.title], ['Year', rec.year || '\u2014'], ['Category', rec.category || '\u2014'],
      ['Visibility', rec.visibility === 'public' ? 'Public \u2014 visible to all members' : 'Private \u2014 not shown to other members'],
      ['Contributed by', rec.by || '\u2014'], ['File', rec.fileName || '\u2014'], ['Description', rec.desc || '\u2014']
    ].map(function (r) { return '<div class="rec-row"><span class="rec-k">' + esc(r[0]) + '</span><span class="rec-v">' + esc(String(r[1])) + '</span></div>'; }).join('');
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Archive Document">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#heritage">Heritage</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(rec.title) + '</span></p>'
      +   '<div class="adm-listhead" style="margin-top:clamp(20px,3vh,30px);"><p class="adm-section-h" style="margin:0;">Archive document</p>'
      +     '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      +     (rec.filePath ? '<button class="btn-new" id="archDl" type="button">Download file</button>' : '')
      +     (canManage ? '<button class="btn-new" id="archVis" type="button">Make ' + (rec.visibility === 'public' ? 'private' : 'public') + '</button>' : '')
      +     '</div>'
      +   '</div>'
      +   media
      +   '<div class="rec-card">' + rows + '</div>'
      +   (canManage ? ('<p class="adm-section-h">Remove document</p><p class="field-hint" style="margin:-6px 0 12px;">Permanently removes this document from the archive.</p><div class="adm-extend"><button class="btn-cancel" id="archDel" type="button">Delete document</button></div>') : '')
      + '</div>';
    bindBack('#heritage');
    var dl = document.getElementById('archDl');
    if (dl) dl.addEventListener('click', function () {
      var orig = dl.textContent; dl.disabled = true; dl.textContent = 'Preparing…';
      Promise.resolve(V.archiveFileUrl ? V.archiveFileUrl(rec.id) : '').then(function (url) {
        dl.disabled = false; dl.textContent = orig;
        if (url) window.open(url, '_blank', 'noopener'); else alert('File unavailable.');
      }).catch(function () { dl.disabled = false; dl.textContent = orig; alert('File unavailable.'); });
    });
    var vb = document.getElementById('archVis');
    if (vb) vb.addEventListener('click', function () {
      V.setArchives(V.getArchives().map(function (a) { if (a.id === rec.id) a.visibility = (a.visibility === 'public' ? 'private' : 'public'); return a; }));
      if (V.logActivity) V.logActivity('archive-updated', rec.title);
      renderArchiveRecord();
    });
    var db = document.getElementById('archDel');
    if (db) db.addEventListener('click', function () {
      if (confirm('Delete \u201c' + rec.title + '\u201d from the archive?')) {
        V.setArchives(V.getArchives().filter(function (a) { return a.id !== rec.id; }));
        if (V.logActivity) V.logActivity('archive-deleted', rec.title);
        archSel = null; location.hash = '#heritage'; render();
      }
    });
  }

  /* ---- News (admin manager + member feed) ---- */
  function newsForm(rec) {
    rec = rec || {};
    function aud(v) { return rec.audience === v ? ' selected' : ''; }
    return '<form class="veh-newform" id="newsFormEl" onsubmit="return false;">'
      + '<p class="adm-section-h" style="margin:0 0 14px;">' + (rec.id ? 'Edit post' : 'New post') + '</p>'
      + '<div class="veh-newgrid">'
      +   '<div class="ff"><label for="nw_title">Title</label><div class="ff-input"><input id="nw_title" type="text" value="' + esc(rec.title || '') + '" placeholder="Headline"></div></div>'
      +   '<div class="ff"><label for="nw_date">Date</label><div class="ff-input"><input id="nw_date" type="date" value="' + esc(rec.date || '') + '"></div></div>'
      +   '<div class="ff"><label for="nw_aud">Audience</label><div class="ff-input"><select id="nw_aud" class="ff-select"><option value="all"' + aud('all') + '>All members</option><option value="custodian"' + aud('custodian') + '>Custodians (event invite)</option><option value="commissioner"' + aud('commissioner') + '>Commissioners (owner experience)</option></select></div></div>'
      +   '<div class="ff"><label for="nw_status">Status</label><div class="ff-input"><select id="nw_status" class="ff-select"><option' + (rec.status === 'Published' ? ' selected' : '') + '>Published</option><option' + (rec.status === 'Draft' ? ' selected' : '') + '>Draft</option></select></div></div>'
      + '</div>'
      + '<div class="ff" style="margin-top:14px;"><label>Publish to</label><div style="display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:8px;font-weight:300;color:var(--fg-dim);font-size:0.9rem;">'
      +   '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;"><input type="checkbox" id="nw_web_pub"' + (rec.webPublic ? ' checked' : '') + '> Public website</label>'
      +   '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;"><input type="checkbox" id="nw_web_priv"' + (rec.webPrivate !== false ? ' checked' : '') + '> Private website (members)</label>'
      +   '<label style="display:flex;gap:8px;align-items:center;cursor:pointer;"><input type="checkbox" id="nw_push"' + (rec.push ? ' checked' : '') + '> Push notification</label>'
      + '</div><span class="field-hint">Push is delivered to the selected Audience’s notification centre (all members, or by tier).</span></div>'
      + '<div class="ff" style="margin-top:16px;"><label for="nw_body">Body</label><div class="ff-input"><textarea id="nw_body" rows="3" class="ff-textarea" placeholder="The announcement">' + esc(rec.body || '') + '</textarea></div></div>'
      + '<p class="adm-err" id="nw_err"></p>'
      + '<div class="adm-extend"><button class="btn" type="submit" id="nw_save">' + (rec.id ? 'Save changes' : 'Publish post') + '</button><button class="btn-cancel" type="button" id="nw_cancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
      + '</form>';
  }
  function wireNewsForm(existing) {
    var form = document.getElementById('newsFormEl'); if (!form) return;
    document.getElementById('nw_cancel').addEventListener('click', function () {
      if (existing) { location.hash = '#news'; render(); } else { newsAdding = false; renderNews(); }
    });
    document.getElementById('nw_save').addEventListener('click', function () {
      var err = document.getElementById('nw_err');
      var title = document.getElementById('nw_title').value.trim();
      if (!title) { err.textContent = 'Enter a title'; return; }
      var data = {
        title: title, date: document.getElementById('nw_date').value || V.todayStr(),
        audience: document.getElementById('nw_aud').value, status: document.getElementById('nw_status').value,
        body: document.getElementById('nw_body').value.trim(),
        webPublic: document.getElementById('nw_web_pub').checked,
        webPrivate: document.getElementById('nw_web_priv').checked,
        push: document.getElementById('nw_push').checked
      };
      var doPush = data.push && data.status === 'Published';
      if (existing) {
        V.setNews(V.getNews().map(function (n) { if (n.id === existing.id) { for (var k in data) n[k] = data[k]; } return n; }));
        if (V.logActivity) V.logActivity('news-updated', title);
        if (doPush) deliverPushToMembers(existing.id, data);
        location.hash = '#news'; render();
      } else {
        data.id = 'nw_' + Date.now().toString(36);
        var l2 = V.getNews(); l2.unshift(data); V.setNews(l2);
        if (V.logActivity) V.logActivity('news-created', title);
        if (doPush) deliverPushToMembers(data.id, data);
        newsAdding = false; renderNews();
      }
    });
  }
  function renderNews() {
    topBar.hidden = false;
    var isAdminView = !!(V.isAdmin && V.isAdmin());
    var all = V.getNews();
    if (isAdminView) {
      var nsup = !!(V.isAdmin && V.isAdmin());
      var ncol = nsup ? '38px ' : '';
      var nhead = nsup ? '<span class="c-check"><input type="checkbox" class="rowsel-all" aria-label="Select all"></span>' : '';
      var ncols = ncol + '320px 120px 150px 120px';
      var rows = all.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + ncols + '">' + nhead + '<span>Title</span><span>Date</span><span>Audience</span><span>Status</span></div>'
        + all.map(function (n) {
            return '<div class="adm-row" style="--cols:' + ncols + '">' + (nsup ? '<span class="c-check"><input type="checkbox" class="rowsel" data-sel="' + esc(n.id) + '"' + (newsSelected[n.id] ? ' checked' : '') + '></span>' : '') + '<span class="c-name"><a data-news="' + esc(n.id) + '">' + esc(n.title) + '</a></span>'
              + '<span class="veh-c">' + esc(n.date ? dateShort(n.date) : '\u2014') + '</span>'
              + '<span class="veh-c">' + esc(audienceLabel(n.audience)) + '</span>'
              + '<span class="c-status"><span class="st-chip ' + (n.status === 'Published' ? 'st-green' : '') + '">' + esc(n.status) + '</span></span></div>';
          }).join('') + '</div>' : '<p class="adm-empty">No news yet.</p>';
      root.innerHTML = ''
        + '<div class="adm-wrap" data-screen-label="News">'
        +   '<div class="adm-listhead"><p class="adm-crumb"><span class="cr-here">News</span></p>'
        +     '<button class="btn-new" id="newsNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New post</button></div>'
        +   (newsAdding ? newsForm() : '')
        +   (nsup ? '<div class="bulk-bar" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 6px;">' + bulkControlsHtml([['delete', 'Delete selected']]) + '</div>' : '')
        +   rows
        + '</div>';
      bindBack('#dashboard');
      var nn = document.getElementById('newsNew'); if (nn) nn.addEventListener('click', function () { newsAdding = !newsAdding; renderNews(); });
      wireNewsForm();
      [].forEach.call(root.querySelectorAll('[data-news]'), function (a) { a.addEventListener('click', function () { newsSel = a.getAttribute('data-news'); location.hash = '#newsrec'; render(); }); });
      if (nsup) wireBulk(root.querySelector('.adm-wrap'), newsSelected, function (action, ids) {
        if (action !== 'delete') return;
        var recs = V.getNews().filter(function (n) { return ids.indexOf(n.id) >= 0; });
        mvBulkModal({ title: 'Delete posts', verb: 'permanently delete', noun: 'post', confirmLabel: 'Delete', confirmCls: 'danger',
          items: recs.map(function (n) { return { cells: [n.title, audienceLabel(n.audience)] }; }),
          run: function () { V.setNews(V.getNews().filter(function (n) { return ids.indexOf(n.id) < 0; })); recs.forEach(function (n) { if (V.logActivity) V.logActivity('news-deleted', n.title); }); return { done: recs.length, skipped: 0 }; },
          onClose: function () { newsSelected = {}; renderNews(); } });
      });
      return;
    }
    var tier = V.memberTier ? V.memberTier() : null;
    var feed = all.filter(function (n) { return n.status === 'Published' && (!n.audience || n.audience === 'all' || n.audience === tier); })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (isAdmirerView()) feed = [];
    var items = feed.length ? feed.map(function (n) {
      var invite = n.audience && n.audience !== 'all';
      return '<article class="news-item' + (invite ? ' news-invite' : '') + '">'
        + (invite ? '<span class="news-badge">' + esc(HT('common.invitation')) + '</span>' : '')
        + '<span class="news-date">' + esc(n.date ? V.fmtDate(n.date) : '') + '</span>'
        + '<h3 class="news-h">' + esc(n.title) + '</h3>'
        + '<p class="news-body">' + esc(n.body || '') + '</p></article>';
    }).join('') : '<p class="adm-empty">' + esc(HT('portal.noNews')) + '</p>';
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="News">'
      +   '<p class="adm-crumb"><span class="cr-here">' + esc(HT('common.news')) + '</span></p>'
      +   memberBanner()
      +   '<div class="news-feed">' + items + '</div>'
      + '</div>';
    bindBack('#heritage');
  }
  function renderNewsRecord() {
    topBar.hidden = false;
    if (!(V.isAdmin && V.isAdmin()) || !newsSel) { location.hash = '#news'; render(); return; }
    var rec = V.getNews().filter(function (n) { return n.id === newsSel; })[0];
    if (!rec) { location.hash = '#news'; render(); return; }
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="News Post">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#news">News</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(rec.title) + '</span></p>'
      +   '<div style="margin-top:clamp(18px,3vh,26px);">' + newsForm(rec) + '</div>'
      +   '<p class="adm-section-h">Remove post</p><div class="adm-extend"><button class="btn-cancel" id="newsDel" type="button">Delete post</button></div>'
      + '</div>';
    bindBack('#news');
    wireNewsForm(rec);
    document.getElementById('newsDel').addEventListener('click', function () {
      if (confirm('Delete \u201c' + rec.title + '\u201d?')) {
        V.setNews(V.getNews().filter(function (n) { return n.id !== rec.id; }));
        if (V.logActivity) V.logActivity('news-deleted', rec.title);
        newsSel = null; location.hash = '#news'; render();
      }
    });
  }

  /* ---- marketing: campaigns (email / push-web / push-mobile broadcasts) ---- */
  var campSel = null, campAdding = false, campSelected = {};
  var CAMP_CHANNELS = [['email', 'Email'], ['push-web', 'Push \u00b7 web'], ['push-mobile', 'Push \u00b7 mobile']];
  var CAMP_AUDIENCE = [['all', 'All members'], ['admirer', 'Admirers'], ['custodian', 'Custodians'], ['commissioner', 'Commissioners']];
  function campChLabels(ch) { return (ch || []).map(function (c) { var f = CAMP_CHANNELS.filter(function (x) { return x[0] === c; })[0]; return f ? f[1] : c; }).join(' \u00b7 ') || '\u2014'; }
  function campAudLabel(a) { var f = CAMP_AUDIENCE.filter(function (x) { return x[0] === a; })[0]; return f ? f[1] : 'All members'; }
  function campStatusChip(s) { var cls = s === 'Sent' ? 'st-green' : (s === 'Scheduled' ? 'st-amber' : ''); return '<span class="st-chip ' + cls + '">' + esc(s || 'Draft') + '</span>'; }
  function campForm(rec) {
    rec = rec || {};
    var chans = rec.channels || [];
    var chBoxes = CAMP_CHANNELS.map(function (c) {
      return '<label style="display:flex;align-items:center;gap:7px;font-family:var(--sans);font-size:0.9rem;color:var(--fg);cursor:pointer;"><input type="checkbox" class="camp-ch" value="' + c[0] + '"' + (chans.indexOf(c[0]) >= 0 ? ' checked' : '') + '><span>' + c[1] + '</span></label>';
    }).join('');
    var audOpts = CAMP_AUDIENCE.map(function (a) { return '<option value="' + a[0] + '"' + ((rec.audience || 'all') === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('');
    return '<form class="veh-newform" id="campForm" onsubmit="return false;" style="max-width:660px;">'
      + '<div class="ff"><label for="cName">Campaign name</label><div class="ff-input"><input id="cName" type="text" value="' + esc(rec.name || '') + '" placeholder="Aegis GT \u2014 Founding Register" autocomplete="off"></div></div>'
      + '<div class="ff" style="margin-top:14px;"><label>Channels</label><div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;">' + chBoxes + '</div></div>'
      + '<div class="ff"><label for="cAud">Audience</label><div class="ff-input"><select id="cAud" class="ff-select">' + audOpts + '</select></div></div>'
      + '<div class="ff"><label for="cSubject">Subject <span style="opacity:.6;">(email)</span></label><div class="ff-input"><input id="cSubject" type="text" value="' + esc(rec.subject || '') + '" placeholder="The Aegis GT register is open" autocomplete="off"></div></div>'
      + '<div class="ff"><label for="cBody">Message</label><div class="ff-input"><textarea id="cBody" rows="5" placeholder="Write the announcement\u2026">' + esc(rec.body || '') + '</textarea></div></div>'
      + '<div class="ff"><label for="cCta">Call to action <span style="opacity:.6;">(button label)</span></label><div class="ff-input"><input id="cCta" type="text" value="' + esc(rec.cta || '') + '" placeholder="View the register" autocomplete="off"></div></div>'
      + '<div class="ff"><label for="cWhen">Schedule date <span style="opacity:.6;">(optional)</span></label><div class="ff-input"><input id="cWhen" type="date" value="' + esc(rec.sent || '') + '"></div></div>'
      + '<p class="adm-okmsg" id="campMsg" style="min-height:14px;"></p>'
      + '<div class="adm-extend"><button class="btn" type="submit" id="campSave">Save campaign</button>'
      +   '<button class="btn-cancel" type="button" id="campSend" style="border-color:var(--line);color:var(--fg-dim);">' + (rec.sent ? 'Send now' : 'Schedule / Send') + '</button></div>'
      + '</form>';
  }
  function readCampForm() {
    var chans = [].map.call(document.querySelectorAll('.camp-ch:checked'), function (b) { return b.value; });
    return {
      name: (document.getElementById('cName').value || '').trim(),
      channels: chans,
      audience: document.getElementById('cAud').value,
      subject: (document.getElementById('cSubject').value || '').trim(),
      body: (document.getElementById('cBody').value || '').trim(),
      cta: (document.getElementById('cCta') ? document.getElementById('cCta').value : '').trim(),
      sent: document.getElementById('cWhen').value || ''
    };
  }
  function estReach(audience) {
    var users = (V.store.all ? V.store.all() : V.store.list()) || [];
    var n = users.filter(function (u) {
      if (!u || !u.tier) return false;
      if (u.status && u.status !== 'active') return false;
      return audience === 'all' || u.tier === audience;
    }).length;
    return n;
  }
  function wireCampForm(rec) {
    var save = document.getElementById('campSave');
    if (save) save.addEventListener('click', function () {
      var d = readCampForm();
      if (!d.name) { var m = document.getElementById('campMsg'); if (m) m.textContent = 'A campaign name is required.'; return; }
      if (!d.channels.length) { var m2 = document.getElementById('campMsg'); if (m2) m2.textContent = 'Select at least one channel.'; return; }
      var list = V.getCampaigns();
      if (rec && rec.id) {
        list = list.map(function (c) { return c.id === rec.id ? Object.assign({}, c, d) : c; });
      } else {
        d.id = 'cmp_' + Date.now(); d.status = 'Draft'; d.reach = 0; list = [d].concat(list);
      }
      V.setCampaigns(list);
      if (V.logActivity) V.logActivity('account-updated', 'Campaign saved \u00b7 ' + d.name);
      campAdding = false; campSel = rec && rec.id ? rec.id : d.id;
      location.hash = '#campaignrec'; render();
    });
    var send = document.getElementById('campSend');
    if (send) send.addEventListener('click', function () {
      var d = readCampForm();
      if (!d.name || !d.channels.length) { var m = document.getElementById('campMsg'); if (m) m.textContent = 'Add a name and at least one channel first.'; return; }
      var future = d.sent && d.sent > new Date().toISOString().slice(0, 10);
      d.status = future ? 'Scheduled' : 'Sent';
      if (!d.sent) d.sent = new Date().toISOString().slice(0, 10);
      d.reach = estReach(d.audience);
      // engagement accrues only once actually sent (not for a future schedule)
      d.stats = future ? { delivered: 0, read: 0, clicked: 0 } : { delivered: d.reach, read: 0, clicked: 0 };
      var list = V.getCampaigns();
      if (rec && rec.id) { list = list.map(function (c) { return c.id === rec.id ? Object.assign({}, c, d) : c; }); campSel = rec.id; }
      else { d.id = 'cmp_' + Date.now(); list = [d].concat(list); campSel = d.id; }
      V.setCampaigns(list);
      // log one notification per channel
      d.channels.forEach(function (ch) {
        if (V.getNotifLogs && V.setNotifLogs) {
          V.setNotifLogs([{ id: 'nl_' + Date.now() + '_' + ch, message: d.name, channel: ch, recipient: campAudLabel(d.audience), status: future ? 'pending' : 'delivered', ts: new Date().toISOString() }].concat(V.getNotifLogs()));
        }
      });
      if (V.logActivity) V.logActivity('account-updated', (future ? 'Campaign scheduled \u00b7 ' : 'Campaign sent \u00b7 ') + d.name);
      campAdding = false; location.hash = '#campaignrec'; render();
    });
  }
  function renderCampaigns() {
    topBar.hidden = false;
    var list = V.getCampaigns();
    var cols = '38px 240px 200px 140px 80px 80px 120px';
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span class="c-check"><input type="checkbox" class="rowsel-all" aria-label="Select all"></span><span>Campaign</span><span>Channels</span><span>Audience</span><span>Reach</span><span>Read</span><span>Status</span></div>'
      + list.map(function (c) {
          var st = c.stats || { delivered: 0, read: 0, clicked: 0 };
          var readPct = st.delivered ? Math.round(st.read / st.delivered * 100) : 0;
          return '<div class="adm-row" style="--cols:' + cols + ';"><span class="c-check"><input type="checkbox" class="rowsel" data-sel="' + esc(c.id) + '"' + (campSelected[c.id] ? ' checked' : '') + '></span>'
            + '<span class="c-name"><a data-camp="' + esc(c.id) + '">' + esc(c.name) + '</a></span>'
            + '<span class="veh-c">' + esc(campChLabels(c.channels)) + '</span>'
            + '<span class="veh-c">' + esc(campAudLabel(c.audience)) + '</span>'
            + '<span class="veh-c">' + (c.reach ? esc(String(c.reach)) : '\u2014') + '</span>'
            + '<span class="veh-c">' + (st.delivered ? readPct + '%' : '\u2014') + '</span>'
            + '<span class="c-status">' + campStatusChip(c.status) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No campaigns yet.</p>';
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Campaigns">'
      +   '<div class="adm-listhead"><p class="adm-crumb"><span class="cr-here">Marketing \u203a Campaigns</span></p>'
      +     '<button class="btn-new" id="campNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New campaign</button></div>'
      +   (campAdding ? campForm() : '')
      +   '<div class="bulk-bar" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 6px;">' + bulkControlsHtml([['delete', 'Delete selected']]) + '</div>'
      +   rows
      + '</div>';
    bindBack('#dashboard');
    var nb = document.getElementById('campNew'); if (nb) nb.addEventListener('click', function () { campAdding = !campAdding; renderCampaigns(); });
    if (campAdding) wireCampForm(null);
    [].forEach.call(root.querySelectorAll('[data-camp]'), function (a) { a.addEventListener('click', function () { campSel = a.getAttribute('data-camp'); location.hash = '#campaignrec'; render(); }); });
    wireBulk(root.querySelector('.adm-wrap'), campSelected, function (action, ids) {
      if (action !== 'delete') return;
      var recs = V.getCampaigns().filter(function (c) { return ids.indexOf(c.id) >= 0; });
      mvBulkModal({ title: 'Delete campaigns', verb: 'permanently delete', noun: 'campaign', confirmLabel: 'Delete', confirmCls: 'danger',
        items: recs.map(function (c) { return { cells: [c.name, campAudLabel(c.audience)] }; }),
        run: function () { V.setCampaigns(V.getCampaigns().filter(function (c) { return ids.indexOf(c.id) < 0; })); recs.forEach(function (c) { if (V.logActivity) V.logActivity('account-updated', 'Campaign deleted \u00b7 ' + c.name); }); return { done: recs.length, skipped: 0 }; },
        onClose: function () { campSelected = {}; renderCampaigns(); } });
    });
  }
  function campStatPanel(rec) {
    var st = rec.stats || { delivered: 0, read: 0, clicked: 0 };
    if (rec.status !== 'Sent' || !st.delivered) {
      var note = rec.status === 'Scheduled' ? 'Engagement statistics will appear once the campaign is sent.' : 'Send this campaign to begin collecting engagement statistics.';
      return '<p class="adm-section-h">Engagement</p><p class="adm-empty" style="text-align:left;padding:18px 0;">' + note + '</p>';
    }
    var readPct = Math.round(st.read / st.delivered * 100);
    var ctaPct = st.read ? Math.round(st.clicked / st.read * 100) : 0;
    var ctaOfDelivered = Math.round(st.clicked / st.delivered * 100);
    function bar(pct, val, label, sub) {
      return '<div class="camp-stat">'
        + '<div class="camp-stat-top"><span class="camp-stat-val">' + val + '</span><span class="camp-stat-pct">' + pct + '%</span></div>'
        + '<div class="camp-bar"><div class="camp-bar-fill" style="width:' + pct + '%;"></div></div>'
        + '<div class="camp-stat-lb">' + label + '</div>'
        + (sub ? '<div class="camp-stat-sub">' + sub + '</div>' : '')
        + '</div>';
    }
    return '<p class="adm-section-h">Engagement</p>'
      + '<div class="camp-stats">'
      +   bar(100, fmtN(st.delivered), 'Delivered', 'Messages sent')
      +   bar(readPct, fmtN(st.read), 'Read', readPct + '% of delivered')
      +   bar(ctaOfDelivered, fmtN(st.clicked), 'Call to action', ctaPct + '% of readers' + (rec.cta ? ' \u00b7 \u201c' + esc(rec.cta) + '\u201d' : ''))
      + '</div>';
  }
  function renderCampaign() {
    topBar.hidden = false;
    var rec = V.getCampaigns().filter(function (c) { return c.id === campSel; })[0];
    if (!rec) { location.hash = '#campaigns'; render(); return; }
    var meta = '<div class="adm-detail-meta" style="margin-top:18px;"><span>Status ' + campStatusChip(rec.status) + '</span>'
      + (rec.sent ? '<span>' + (rec.status === 'Scheduled' ? 'Scheduled for ' : 'Sent ') + esc(V.fmtDate(rec.sent)) + '</span>' : '')
      + (rec.reach ? '<span>Reach <b>' + esc(String(rec.reach)) + '</b></span>' : '') + '</div>';
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Campaign">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#campaigns">Campaigns</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(rec.name) + '</span></p>'
      +   meta
      +   campStatPanel(rec)
      +   '<div style="margin-top:clamp(18px,3vh,26px);">' + campForm(rec) + '</div>'
      +   '<p class="adm-section-h">Remove campaign</p><div class="adm-extend"><button class="btn-cancel" id="campDel" type="button">Delete campaign</button></div>'
      + '</div>';
    bindBack('#campaigns');
    wireCampForm(rec);
    document.getElementById('campDel').addEventListener('click', function () {
      if (confirm('Delete \u201c' + rec.name + '\u201d?')) {
        V.setCampaigns(V.getCampaigns().filter(function (c) { return c.id !== rec.id; }));
        if (V.logActivity) V.logActivity('account-updated', 'Campaign deleted \u00b7 ' + rec.name);
        campSel = null; location.hash = '#campaigns'; render();
      }
    });
  }

  /* ---- automations: event logs ---- */
  function renderEventLogs() {
    topBar.hidden = false;
    var ST = { completed: ['st-green', 'Completed'], pending: ['st-amber', 'Pending'], failed: ['st-red', 'Failed'] };
    var list = V.getEventLogs().slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:260px 130px 90px 120px"><span>Event</span><span>Date</span><span>Time</span><span>Status</span></div>'
      + list.map(function (e) {
          var d = (e.ts || '').split('T'); var s = ST[e.status] || ['st-amber', e.status];
          return '<div class="adm-row" style="--cols:260px 130px 90px 120px"><span class="c-name">' + esc(e.name) + '</span>'
            + '<span class="veh-c">' + esc(d[0] ? dateShort(d[0]) : '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(d[1] ? d[1].slice(0, 5) : '\u2014') + '</span>'
            + '<span class="c-status"><span class="st-chip ' + s[0] + '">' + esc(s[1]) + '</span></span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No event logs yet.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Event logs"><p class="adm-crumb"><span class="cr-here">Automations \u203a Event logs</span></p>'
      + '' + rows + '</div>';
    bindBack('#dashboard');
  }

  var notifLogFilter = { status: 'all', message: 'all', channel: 'all', period: 'all', recipient: '' };
  function renderNotifLogs() {
    topBar.hidden = false;
    var ST = { delivered: ['st-green', 'Delivered'], pending: ['st-amber', 'Pending'], failed: ['st-red', 'Failed'] };
    var f = notifLogFilter;
    var allLogs = V.getNotifLogs().slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    var msgNames = []; allLogs.forEach(function (n) { if (msgNames.indexOf(n.message) < 0) msgNames.push(n.message); }); msgNames.sort();
    var CH = [['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['push-mobile', 'Push \u00b7 mobile'], ['push-web', 'Push \u00b7 web']];
    var PERIODS = [['all', 'Any time'], ['24h', 'Last 24 hours'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 3 months']];
    var now = new Date();
    function inPeriod(ts) {
      if (f.period === 'all') return true;
      var days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[f.period] || 0;
      return new Date(ts) >= new Date(now.getTime() - days * 86400000);
    }
    var rq = (f.recipient || '').trim().toLowerCase();
    var list = allLogs.filter(function (n) {
      if (f.status !== 'all' && n.status !== f.status) return false;
      if (f.message !== 'all' && n.message !== f.message) return false;
      if (f.channel !== 'all' && n.channel !== f.channel) return false;
      if (rq && (n.to || '').toLowerCase().indexOf(rq) < 0) return false;
      if (!inPeriod(n.ts)) return false;
      return true;
    });
    var active = (f.status !== 'all' || f.message !== 'all' || f.channel !== 'all' || f.period !== 'all' || rq);
    function opt(arr, sel) { return arr.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (sel === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); }
    var STO = [['all', 'All statuses'], ['delivered', 'Delivered'], ['pending', 'Pending'], ['failed', 'Failed']];
    var MSO = [['all', 'All notifications']].concat(msgNames.map(function (m) { return [m, m]; }));
    var CHO = [['all', 'All channels']].concat(CH);
    var ls = 'display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--platinum-deep);';
    var filterRow = '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:clamp(14px,2vh,20px) 0 2px;">'
      + '<label style="' + ls + '">Status<select id="nlStatus" class="usr-sel">' + opt(STO, f.status) + '</select></label>'
      + '<label style="' + ls + '">Notification<select id="nlMsg" class="usr-sel">' + opt(MSO, f.message) + '</select></label>'
      + '<label style="' + ls + '">Channel<select id="nlCh" class="usr-sel">' + opt(CHO, f.channel) + '</select></label>'
      + '<label style="' + ls + '">Time<select id="nlPeriod" class="usr-sel">' + opt(PERIODS, f.period) + '</select></label>'
      + '<label style="' + ls + '">Recipient<input id="nlTo" type="text" class="usr-sel" style="min-width:150px;cursor:text;" placeholder="Search name\u2026" value="' + esc(f.recipient || '') + '"></label>'
      + (active ? '<button type="button" id="nlClear" class="btn-cancel" style="border-color:var(--line);color:var(--fg-dim);">Clear</button>' : '')
      + '</div>';
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + '220px 130px 190px 170px 110px' + '"><span>Notification</span><span>Channel</span><span>Recipient</span><span>Sent</span><span>Status</span></div>'
      + list.map(function (n) {
          var d = (n.ts || '').split('T'); var s = ST[n.status] || ['st-amber', n.status];
          var sent = (d[0] ? dateShort(d[0]) : '\u2014') + (d[1] ? ' \u00b7 ' + d[1].slice(0, 5) : '');
          return '<div class="adm-row" style="--cols:220px 130px 190px 170px 110px"><span class="c-name">' + esc(n.message) + '</span>'
            + '<span class="veh-c">' + esc(channelLabel(n.channel)) + '</span>'
            + '<span class="c-email">' + esc(n.to || '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(sent) + '</span>'
            + '<span class="c-status"><span class="st-chip ' + s[0] + '">' + esc(s[1]) + '</span></span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No notifications match these filters.</p>';
    var countLine = '<p style="font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin:12px 0 0;">' + list.length + ' of ' + allLogs.length + ' notification' + (allLogs.length === 1 ? '' : 's') + '</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Notification logs">'
      + '<p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Notification logs</span></p>'
      + ''
      + filterRow + countLine + rows + '</div>';
    bindBack('#dashboard');
    var es = document.getElementById('nlStatus'); if (es) es.addEventListener('change', function () { f.status = es.value; renderNotifLogs(); });
    var em = document.getElementById('nlMsg'); if (em) em.addEventListener('change', function () { f.message = em.value; renderNotifLogs(); });
    var ec = document.getElementById('nlCh'); if (ec) ec.addEventListener('change', function () { f.channel = ec.value; renderNotifLogs(); });
    var ep = document.getElementById('nlPeriod'); if (ep) ep.addEventListener('change', function () { f.period = ep.value; renderNotifLogs(); });
    var et = document.getElementById('nlTo'); if (et) et.addEventListener('input', function () { f.recipient = et.value; renderNotifLogs(); var el = document.getElementById('nlTo'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
    var ex = document.getElementById('nlClear'); if (ex) ex.addEventListener('click', function () { notifLogFilter = { status: 'all', message: 'all', channel: 'all', period: 'all', recipient: '' }; renderNotifLogs(); });
  }

  /* ---------------- SUBSCRIPTIONS (settings catalogue) ---------------- */
  var SUB_ROLE_OPTS = [['vip', 'VIP'], ['admin', 'Admin'], ['admirer', 'Admirer'], ['custodian', 'Custodian'], ['commissioner', 'Commissioner']];
  function subRoleLabel(k) { for (var i = 0; i < SUB_ROLE_OPTS.length; i++) if (SUB_ROLE_OPTS[i][0] === k) return SUB_ROLE_OPTS[i][1]; return k; }
  function capPeriod(v) { return v === 'monthly' ? 'Monthly' : 'Yearly'; }
  var SUB_STATUS = [['active', 'Active'], ['active-existing', 'Active existing'], ['terminated', 'Terminated'], ['paused', 'Paused']];
  function subStatusLabel(k) { for (var i = 0; i < SUB_STATUS.length; i++) if (SUB_STATUS[i][0] === k) return SUB_STATUS[i][1]; return 'Active'; }
  function subStatusChip(k) { var cls = k === 'active' ? 'st-green' : (k === 'paused' ? 'st-amber' : (k === 'terminated' ? 'st-red' : '')); return '<span class="st-chip ' + cls + '">' + esc(subStatusLabel(k || 'active')) + '</span>'; }
  var subsSel = null, subsAdding = false, subsSelected = {};
  function renderSubscriptions() {
    topBar.hidden = false;
    var list = V.getSubscriptions();
    if (subsAdding || subsSel) {
      var p = subsSel ? (list.filter(function (x) { return x.id === subsSel; })[0] || {}) : {};
      var roles = p.roles || [];
      function perOpt(v) { return ['monthly', 'yearly'].map(function (o) { return '<option value="' + o + '"' + ((v || 'yearly') === o ? ' selected' : '') + '>' + capPeriod(o) + '</option>'; }).join(''); }
      var roleChecks = SUB_ROLE_OPTS.map(function (r) {
        return '<label style="display:flex;align-items:center;gap:8px;font-family:var(--sans);font-size:0.95rem;color:var(--fg);cursor:pointer;"><input type="checkbox" class="sub-role" value="' + r[0] + '"' + (roles.indexOf(r[0]) >= 0 ? ' checked' : '') + '>' + r[1] + '</label>';
      }).join('');
      var remChecked = (subsSel ? p.reminder : true) ? ' checked' : '';
      root.innerHTML = '<div class="adm-wrap" data-screen-label="Subscription">'
        + '<p class="adm-crumb"><a class="cr-root" href="#subs">Subscription types</a><span class="cr-sep">\u203a</span><span class="cr-here">' + (subsSel ? 'Edit subscription' : 'New subscription') + '</span></p>'
        + '<form class="veh-newform" id="subForm" onsubmit="return false;" style="margin-top:18px;max-width:640px;">'
        +   '<div class="ff"><label for="sName">Subscription name</label><div class="ff-input"><input id="sName" type="text" value="' + esc(p.name || '') + '" placeholder="e.g. Heritage Archive"></div></div>'
        +   '<div class="veh-newgrid" style="margin-top:14px;">'
        +     '<div class="ff"><label for="sPeriod">Period</label><div class="ff-input"><select id="sPeriod" class="ff-select">' + perOpt(p.period) + '</select></div></div>'
        +     '<div class="ff"><label for="sPrice">Price</label><div class="ff-input"><input id="sPrice" type="text" value="' + esc(p.price || '') + '" placeholder="\u20ac0"></div></div>'
        +     '<div class="ff"><label for="sPay">Payment</label><div class="ff-input"><select id="sPay" class="ff-select">' + perOpt(p.payment) + '</select></div></div>'
        +     '<div class="ff"><label for="sStatus">Status</label><div class="ff-input"><select id="sStatus" class="ff-select">' + SUB_STATUS.map(function (o) { return '<option value="' + o[0] + '"' + (((p.status || 'active') === o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>'
        +   '</div>'
        +   '<div class="ff" style="margin-top:16px;"><label>Accessible to roles</label><div style="display:flex;flex-wrap:wrap;gap:12px 22px;margin-top:10px;">' + roleChecks + '</div></div>'
        +   '<div class="ff" style="margin-top:18px;"><label class="set-toggle-row" style="display:flex;align-items:center;gap:14px;cursor:pointer;justify-content:space-between;max-width:320px;"><span>Renewal reminder</span><label class="set-toggle"><input type="checkbox" id="sReminder"' + remChecked + '><span class="tk"></span></label></label></div>'
        +   '<p class="adm-err" id="sErr"></p>'
        +   '<div class="adm-extend"><button class="btn" type="submit" id="sSave">' + (subsSel ? 'Save changes' : 'Create subscription') + '</button><button class="btn-cancel" type="button" id="sCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button>'
        +     (subsSel ? '<button class="btn-cancel" type="button" id="sDelete" style="margin-left:auto;">Cancel subscription</button>' : '')
        +   '</div>'
        + '</form></div>';
      bindBack('#settings');
      var sc = document.getElementById('sCancel'); if (sc) sc.addEventListener('click', function () { subsAdding = false; subsSel = null; renderSubscriptions(); });
      var sd = document.getElementById('sDelete'); if (sd) sd.addEventListener('click', function () {
        if (!confirm('Cancel this subscription plan? It will be removed from the catalogue.')) return;
        V.setSubscriptions(V.getSubscriptions().filter(function (x) { return x.id !== subsSel; }));
        if (V.logActivity) V.logActivity('account-updated', 'Subscription plan cancelled: ' + (p.name || ''));
        subsSel = null; subsAdding = false; renderSubscriptions();
      });
      var ss = document.getElementById('sSave'); if (ss) ss.addEventListener('click', function () {
        var err = document.getElementById('sErr');
        var name = document.getElementById('sName').value.trim();
        if (!name) { err.textContent = 'Enter a subscription name'; return; }
        var rls = [].map.call(root.querySelectorAll('.sub-role:checked'), function (c) { return c.value; });
        var rec = {
          name: name,
          period: document.getElementById('sPeriod').value,
          price: document.getElementById('sPrice').value.trim(),
          payment: document.getElementById('sPay').value,
          status: document.getElementById('sStatus').value,
          reminder: document.getElementById('sReminder').checked,
          roles: rls
        };
        var all = V.getSubscriptions();
        if (subsSel) { for (var i = 0; i < all.length; i++) if (all[i].id === subsSel) { rec.id = subsSel; all[i] = rec; } }
        else { rec.id = 'sub_' + Date.now().toString(36); all.push(rec); }
        V.setSubscriptions(all);
        if (V.logActivity) V.logActivity('account-updated', (subsSel ? 'Subscription plan updated: ' : 'Subscription plan created: ') + name);
        subsAdding = false; subsSel = null; renderSubscriptions();
      });
      return;
    }
    var cols = '38px 180px 90px 100px 100px 120px 90px 200px';
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span class="c-check"><input type="checkbox" class="rowsel-all" aria-label="Select all"></span><span>Name</span><span>Period</span><span>Price</span><span>Payment</span><span>Status</span><span>Reminder</span><span>Roles</span></div>'
      + list.map(function (p) {
          var roleChips = (p.roles || []).map(function (r) { return subRoleLabel(r); }).join(', ') || '\u2014';
          return '<div class="adm-row" style="--cols:' + cols + ';"><span class="c-check"><input type="checkbox" class="rowsel" data-sel="' + esc(p.id) + '"' + (subsSelected[p.id] ? ' checked' : '') + '></span>'
            + '<span class="c-name"><a data-subid="' + esc(p.id) + '">' + esc(p.name) + '</a></span>'
            + '<span class="veh-c">' + capPeriod(p.period) + '</span>'
            + '<span class="veh-c">' + esc(p.price || '\u2014') + '</span>'
            + '<span class="veh-c">' + capPeriod(p.payment) + '</span>'
            + '<span class="c-status">' + subStatusChip(p.status || 'active') + '</span>'
            + '<span class="c-status"><span class="st-chip ' + (p.reminder ? 'st-green' : '') + '">' + (p.reminder ? 'Active' : 'Off') + '</span></span>'
            + '<span class="c-email">' + esc(roleChips) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No subscriptions yet.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Subscription types"><div class="adm-listhead">'
      + '<p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Subscription types</span></p>'
      + '<button class="btn-new" id="subNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New subscription</button></div>'
      + '<div class="bulk-bar" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:0 0 6px;">' + bulkControlsHtml([['delete', 'Delete selected']]) + '</div>'
      + rows + '</div>';
    bindBack('#settings');
    var nb = document.getElementById('subNew'); if (nb) nb.addEventListener('click', function () { subsAdding = true; subsSel = null; renderSubscriptions(); });
    [].forEach.call(root.querySelectorAll('[data-subid]'), function (a) { a.addEventListener('click', function () { subsSel = a.getAttribute('data-subid'); subsAdding = false; renderSubscriptions(); }); });
    wireBulk(root.querySelector('.adm-wrap'), subsSelected, function (action, ids) {
      if (action !== 'delete') return;
      var recs = V.getSubscriptions().filter(function (p) { return ids.indexOf(p.id) >= 0; });
      mvBulkModal({ title: 'Delete subscription types', verb: 'permanently delete', noun: 'subscription', confirmLabel: 'Delete', confirmCls: 'danger',
        items: recs.map(function (p) { return { cells: [p.name, p.price || '\u2014'] }; }),
        run: function () { V.setSubscriptions(V.getSubscriptions().filter(function (p) { return ids.indexOf(p.id) < 0; })); recs.forEach(function (p) { if (V.logActivity) V.logActivity('account-updated', 'Subscription plan cancelled: ' + p.name); }); return { done: recs.length, skipped: 0 }; },
        onClose: function () { subsSelected = {}; renderSubscriptions(); } });
    });
  }

  /* ---------------- ADMIN: subscriptions, invoices, payments ---------------- */
  function adminStatusChip(map, status) { var s = map[status] || ['', status]; return '<span class="st-chip ' + s[0] + '">' + esc(s[1]) + '</span>'; }
  function renderMemberSubscriptions() {
    topBar.hidden = false;
    var users = (V.store.all ? V.store.all() : V.store.list()) || [];
    var subs = [];
    users.forEach(function (u) { if (u && u.subscription) subs.push({ u: u, s: u.subscription }); });
    var today = new Date().toISOString().slice(0, 10);
    var cols = '170px 150px 90px 110px 110px 100px 110px';
    var rows = subs.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span>Member</span><span>Plan</span><span>Period</span><span>Start</span><span>End</span><span>Price</span><span>Status</span></div>'
      + subs.map(function (x) {
          var lapsed = x.s.end && x.s.end < today;
          return '<div class="adm-row" style="--cols:' + cols + ';" data-suid="' + esc(x.u.id) + '">'
            + '<span class="c-name"><a>' + esc(x.u.name) + '</a></span>'
            + '<span class="veh-c">' + esc(x.s.name || '\u2014') + '</span>'
            + '<span class="veh-c">' + capPeriod(x.s.period) + '</span>'
            + '<span class="veh-c">' + (x.s.start ? esc(dateShort(x.s.start)) : '\u2014') + '</span>'
            + '<span class="veh-c">' + (x.s.end ? esc(dateShort(x.s.end)) : '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(x.s.price || '\u2014') + '</span>'
            + '<span class="c-status">' + (lapsed ? '<span class="st-chip">Lapsed</span>' : '<span class="st-chip st-green">Active</span>') + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No member subscriptions yet. Assign one from a user\u2019s page, or define plans under Settings \u203a Subscription types.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Subscriptions">'
      + '<p class="adm-crumb"><span class="cr-here">Admin \u203a Subscriptions</span></p>'
      + rows + '</div>';
    bindBack('#dashboard');
    [].forEach.call(root.querySelectorAll('[data-suid]'), function (a) {
      a.addEventListener('click', function () { ssSet(LAST_USER, a.getAttribute('data-suid')); userEditing = false; subAssigning = false; location.hash = '#user'; render(); });
    });
  }
  function renderInvoices() {
    topBar.hidden = false;
    var ST = { paid: ['st-green', 'Paid'], unpaid: ['st-amber', 'Unpaid'], overdue: ['st-red', 'Overdue'] };
    var list = V.getInvoices();
    var cols = '140px 160px 140px 100px 110px 100px';
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span>Reference</span><span>Member</span><span>Plan</span><span>Amount</span><span>Date</span><span>Status</span></div>'
      + list.map(function (n) {
          return '<div class="adm-row" style="--cols:' + cols + '">'
            + '<span class="c-name">' + esc(n.ref) + '</span>'
            + '<span class="c-email">' + esc(n.member) + '</span>'
            + '<span class="veh-c">' + esc(n.plan || '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(n.amount || '\u2014') + '</span>'
            + '<span class="veh-c">' + (n.date ? esc(dateShort(n.date)) : '\u2014') + '</span>'
            + '<span class="c-status">' + adminStatusChip(ST, n.status) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No invoices yet.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Invoices">'
      + '<p class="adm-crumb"><span class="cr-here">Admin \u203a Invoices</span></p>'
      + integSyncBar(['odoo'])
      + rows + '</div>';
    bindBack('#dashboard');
    wireSyncBar(['odoo']);
  }
  function renderPayments() {
    topBar.hidden = false;
    var ST = { completed: ['st-green', 'Completed'], pending: ['st-amber', 'Pending'], failed: ['st-red', 'Failed'] };
    var list = V.getPayments();
    var cols = '140px 160px 100px 130px 110px 100px';
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span>Reference</span><span>Member</span><span>Amount</span><span>Method</span><span>Date</span><span>Status</span></div>'
      + list.map(function (n) {
          return '<div class="adm-row" style="--cols:' + cols + '">'
            + '<span class="c-name">' + esc(n.ref) + '</span>'
            + '<span class="c-email">' + esc(n.member) + '</span>'
            + '<span class="veh-c">' + esc(n.amount || '\u2014') + '</span>'
            + '<span class="veh-c">' + esc(n.method || '\u2014') + '</span>'
            + '<span class="veh-c">' + (n.date ? esc(dateShort(n.date)) : '\u2014') + '</span>'
            + '<span class="c-status">' + adminStatusChip(ST, n.status) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="adm-empty">No payments yet.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Payments">'
      + '<p class="adm-crumb"><span class="cr-here">Admin \u203a Payments</span></p>'
      + integSyncBar(['odoo', 'stripe'])
      + rows + '</div>';
    bindBack('#dashboard');
    wireSyncBar(['odoo', 'stripe']);
  }

  /* ---------------- INTEGRATIONS (settings) ---------------- */
  var INTEGRATIONS = [
    { id: 'odoo', name: 'Odoo', purpose: 'Invoicing & payment records', fields: [['url', 'Server URL', 'text', 'https://company.odoo.com'], ['db', 'Database', 'text', 'company-prod'], ['user', 'API user', 'text', 'api@company.com'], ['apiKey', 'API key', 'password', '']] },
    { id: 'stripe', name: 'Stripe', purpose: 'Payment processing', fields: [['pubKey', 'Publishable key', 'text', 'pk_live_\u2026'], ['secretKey', 'Secret key', 'password', 'sk_live_\u2026']] }
  ];
  function integMeta(id) { for (var i = 0; i < INTEGRATIONS.length; i++) if (INTEGRATIONS[i].id === id) return INTEGRATIONS[i]; return null; }
  function integName(id) { var m = integMeta(id); return m ? m.name : id; }
  var integSel = null;
  function integSyncBar(ids) {
    var st = V.getIntegrations();
    var active = ids.filter(function (id) { return st[id] && st[id].connected; });
    if (!active.length) {
      return '<div style="margin:-2px 0 16px;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);">No billing integration connected \u00b7 <a href="#integrations" style="color:var(--platinum-bright);">Connect under Settings \u203a Integrations</a></div>';
    }
    var names = active.map(function (id) { return integName(id); }).join(' \u00b7 ');
    var last = active.map(function (id) { return st[id].lastSync || ''; }).sort().reverse()[0];
    return '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:-2px 0 16px;font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);">'
      + '<span style="color:var(--platinum-deep);">Source \u00b7 ' + esc(names) + '</span>'
      + (last ? '<span>Last sync ' + esc(V.fmtDateTime(last)) + '</span>' : '')
      + '<button type="button" id="integSyncBtn" class="btn-cancel" style="padding:5px 12px;border-color:var(--line);color:var(--fg-dim);font-size:9px;letter-spacing:.14em;">Sync now</button>'
      + '</div>';
  }
  function wireSyncBar(ids) {
    var b = document.getElementById('integSyncBtn');
    if (b) b.addEventListener('click', function () {
      ids.forEach(function (id) { var c = V.getIntegrations()[id]; if (c && c.connected) V.setIntegration(id, { lastSync: new Date().toISOString() }); });
      if (V.logActivity) V.logActivity('account-updated', 'Synced ' + ids.map(integName).join(' & '));
      render();
    });
  }
  function renderIntegrations() {
    topBar.hidden = false;
    var st = V.getIntegrations();
    var cols = '200px 380px 130px';
    var rows = '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + cols + '"><span>Integration</span><span>Purpose</span><span>Status</span></div>'
      + INTEGRATIONS.map(function (g) {
          var connected = !!(st[g.id] && st[g.id].connected);
          return '<div class="adm-row" style="--cols:' + cols + ';cursor:pointer;" data-integ="' + g.id + '">'
            + '<span class="c-name"><a>' + esc(g.name) + '</a></span>'
            + '<span class="c-email" style="white-space:normal;">' + esc(g.purpose) + '</span>'
            + '<span class="c-status">' + (connected ? '<span class="st-chip st-green">Connected</span>' : '<span class="st-chip">Not connected</span>') + '</span></div>';
        }).join('') + '</div>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Integrations">'
      + '<p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Integrations</span></p>'
      + rows + '</div>';
    bindBack('#settings');
    [].forEach.call(root.querySelectorAll('[data-integ]'), function (a) { a.addEventListener('click', function () { integSel = a.getAttribute('data-integ'); location.hash = '#integ'; render(); }); });
  }
  function renderIntegration() {
    topBar.hidden = false;
    var g = integMeta(integSel);
    if (!g) { location.hash = '#integrations'; return; }
    var conf = V.getIntegrations()[g.id] || {};
    var connected = !!conf.connected;
    var fieldsHtml = g.fields.map(function (f) {
      var val = conf[f[0]] != null ? conf[f[0]] : '';
      return '<div class="ff"><label for="ig_' + f[0] + '">' + esc(f[1]) + '</label><div class="ff-input"><input id="ig_' + f[0] + '" type="' + f[2] + '" value="' + esc(val) + '" placeholder="' + esc(f[3] || '') + '" autocomplete="off"></div></div>';
    }).join('');
    var syncLine = conf.lastSync ? ('Last sync ' + esc(V.fmtDateTime(conf.lastSync))) : 'Never synced';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Integration">'
      + '<p class="adm-crumb"><a class="cr-root" href="#integrations">Integrations</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(g.name) + '</span></p>'
      + '<div class="adm-detail-meta" style="margin-top:18px;"><span>' + esc(g.purpose) + '</span><span>Status <b>' + (connected ? 'Connected' : 'Not connected') + '</b></span>' + (connected ? '<span>' + syncLine + '</span>' : '') + '</div>'
      + '<form class="veh-newform" id="integForm" onsubmit="return false;" style="margin-top:18px;max-width:620px;">'
      +   fieldsHtml
      +   '<p class="adm-okmsg" id="igMsg" style="min-height:14px;"></p>'
      +   '<div class="adm-extend"><button class="btn" type="submit" id="igSave">Save</button>'
      +     (connected
          ? '<button class="btn-cancel" type="button" id="igTest" style="border-color:var(--line);color:var(--fg-dim);">Test connection</button><button class="btn-cancel" type="button" id="igDisc" style="margin-left:auto;">Disconnect</button>'
          : '<button class="btn-cancel" type="button" id="igConnect" style="border-color:var(--line);color:var(--fg-dim);">Connect</button>')
      +   '</div>'
      + '</form></div>';
    bindBack('#integrations');
    function readForm() { var p = {}; g.fields.forEach(function (f) { var el = document.getElementById('ig_' + f[0]); if (el) p[f[0]] = el.value; }); return p; }
    var save = document.getElementById('igSave'); if (save) save.addEventListener('click', function () { V.setIntegration(g.id, readForm()); var m = document.getElementById('igMsg'); if (m) m.textContent = 'Settings saved.'; });
    var conn = document.getElementById('igConnect'); if (conn) conn.addEventListener('click', function () { var p = readForm(); p.connected = true; p.lastSync = new Date().toISOString(); V.setIntegration(g.id, p); if (V.logActivity) V.logActivity('account-updated', g.name + ' connected'); renderIntegration(); });
    var disc = document.getElementById('igDisc'); if (disc) disc.addEventListener('click', function () { if (!confirm('Disconnect ' + g.name + '?')) return; V.setIntegration(g.id, { connected: false }); if (V.logActivity) V.logActivity('account-updated', g.name + ' disconnected'); renderIntegration(); });
    var test = document.getElementById('igTest'); if (test) test.addEventListener('click', function () { V.setIntegration(g.id, { lastSync: new Date().toISOString() }); var m = document.getElementById('igMsg'); if (m) m.textContent = 'Connection successful \u00b7 ' + g.name + ' is reachable.'; });
  }

  /* ---- automations: actions, triggers, events ---- */
  var AUTO_ACTIONS = [
    { id: 'member-registered', label: 'Membership requested', desc: 'A visitor submits a heritage membership application.' },
    { id: 'member-approved', label: 'Membership approved', desc: 'A heritage application is accepted.' },
    { id: 'member-denied', label: 'Membership declined', desc: 'A heritage application is declined.' },
    { id: 'member-renewed', label: 'Membership renewed', desc: 'A membership is renewed for twelve months.' },
    { id: 'membership-expiring', label: 'Membership nearing expiry', desc: 'A membership approaches its renewal date.' },
    { id: 'vehicle-created', label: 'Vehicle registered', desc: 'A vehicle is added to the register.' },
    { id: 'coa-created', label: 'Certificate issued', desc: 'A certificate of authenticity is created.' },
    { id: 'password-reset', label: 'Password reset requested', desc: 'A user requests a new password.' },
    { id: 'login-error', label: 'Repeated failed sign-in', desc: 'Several sign-in attempts fail in succession.' }
  ];
  var AUTO_TRIGGERS = [
    { id: 'heritage-registration', action: 'member-registered', label: 'When a membership application is received' },
    { id: 'membership-approved', action: 'member-approved', label: 'When an application is approved' },
    { id: 'membership-declined', action: 'member-denied', label: 'When an application is declined' },
    { id: 'membership-renewed', action: 'member-renewed', label: 'When a membership is renewed' },
    { id: 'membership-expiring', action: 'membership-expiring', label: '30 days before a membership expires' },
    { id: 'vehicle-registered', action: 'vehicle-created', label: 'When a vehicle is registered' },
    { id: 'certificate-issued', action: 'coa-created', label: 'When a certificate is issued' },
    { id: 'password-config', action: 'password-reset', label: 'When a password reset is requested' },
    { id: 'failed-signin', action: 'login-error', label: 'After repeated failed sign-ins' }
  ];
  function actionLabel(id) { var a = AUTO_ACTIONS.filter(function (x) { return x.id === id; })[0]; return a ? a.label : id; }
  function triggerLabel(id) { var t = AUTO_TRIGGERS.filter(function (x) { return x.id === id; })[0]; return t ? t.label : id; }
  var eventSel = null, eventAdding = false;
  function renderNotifications() {
    topBar.hidden = false;
    var CH = [
      { id: 'email', label: 'Email', desc: 'Full formatted messages with a subject line and body, sent to the member\u2019s address.' },
      { id: 'sms', label: 'SMS', desc: 'Short plain-text messages delivered to a mobile number.' },
      { id: 'whatsapp', label: 'WhatsApp', desc: 'Messages delivered through the Minerva WhatsApp Business account.' },
      { id: 'push-mobile', label: 'Push \u00b7 mobile', desc: 'Push notification to the Minerva mobile application on the member\u2019s device.' },
      { id: 'push-web', label: 'Push \u00b7 web', desc: 'In-app alert shown in the notifications bell, top right beside the user\u2019s name.' }
    ];
    var msgs = V.getMessages();
    function count(id) { return msgs.filter(function (m) { return (m.channels || []).indexOf(id) !== -1; }).length; }
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Notifications">'
      + '<p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Notifications</span></p>'
      + ''
      + '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:160px 380px 120px"><span>Channel</span><span>Description</span><span style="text-align:center;">Messages</span></div>'
      + CH.map(function (c) {
          return '<div class="adm-row" style="--cols:160px 380px 120px"><span class="veh-model">' + esc(c.label) + '</span><span class="c-email" style="white-space:normal;">' + esc(c.desc) + '</span><span class="veh-c" style="text-align:center;">' + count(c.id) + '</span></div>';
        }).join('')
      + '</div>'
      + ''
      + '</div>';
    bindBack('#dashboard');
  }
  var trgEditId = null, trgAdding = false;
  function renderTriggers() {
    topBar.hidden = false;
    var list = V.getTriggers();
    var editing = trgAdding ? { id: '', label: '', action: '' } : (trgEditId ? list.filter(function (t) { return t.id === trgEditId; })[0] : null);
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:240px 220px 90px"><span>Trigger</span><span>Fires on action</span><span></span></div>'
      + list.map(function (t) { return '<div class="adm-row" style="--cols:240px 220px 90px"><span class="c-name"><a data-trg="' + esc(t.id) + '">' + esc(t.label) + '</a></span><span class="c-email">' + esc(actionLabel(t.action)) + '</span><span class="veh-c"><a data-trgdel="' + esc(t.id) + '" style="color:var(--minerva-red-bright);cursor:pointer;">Delete</a></span></div>'; }).join('') + '</div>'
      : '<p class="adm-empty">No triggers yet.</p>';
    var actOpts = AUTO_ACTIONS.map(function (a) { return '<option value="' + a.id + '"' + ((editing && editing.action === a.id) ? ' selected' : '') + '>' + esc(a.label) + '</option>'; }).join('');
    var form = editing ? '<form class="veh-newform" id="trgForm" onsubmit="return false;"><p class="adm-section-h" style="margin:0 0 14px;">' + (editing.id ? 'Edit trigger' : 'New trigger') + '</p><div class="ff"><label for="trgLabel">Trigger name</label><div class="ff-input"><input id="trgLabel" type="text" value="' + esc(editing.label || '') + '" placeholder="e.g. Heritage user registration"></div></div><div class="ff" style="margin-top:18px;"><label for="trgAction">Fires on action</label><div class="ff-input"><select id="trgAction" class="ff-select"><option value="">Choose an action\u2026</option>' + actOpts + '</select></div><p class="field-hint">The system action that sets this trigger off. Events bound to this trigger run when the action occurs.</p></div><p class="adm-err" id="trgErr"></p><div class="adm-extend"><button class="btn" type="submit" id="trgSave">Save trigger</button><button class="btn-cancel" type="button" id="trgCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div></form>' : '';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Triggers"><div class="adm-listhead"><p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Triggers</span></p>' + (editing ? '' : '<button class="btn-new" id="trgNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New trigger</button>') + '</div>'
      + ''
      + (editing ? form : rows) + '</div>';
    bindBack('#dashboard');
    var nb = document.getElementById('trgNew'); if (nb) nb.addEventListener('click', function () { trgAdding = true; trgEditId = null; renderTriggers(); });
    [].forEach.call(root.querySelectorAll('[data-trg]'), function (a) { a.addEventListener('click', function () { trgEditId = a.getAttribute('data-trg'); trgAdding = false; renderTriggers(); }); });
    [].forEach.call(root.querySelectorAll('[data-trgdel]'), function (a) { a.addEventListener('click', function () { if (confirm('Delete this trigger?')) { V.setTriggers(V.getTriggers().filter(function (t) { return t.id !== a.getAttribute('data-trgdel'); })); renderTriggers(); } }); });
    var tc = document.getElementById('trgCancel'); if (tc) tc.addEventListener('click', function () { trgAdding = false; trgEditId = null; renderTriggers(); });
    var tsv = document.getElementById('trgSave'); if (tsv) tsv.addEventListener('click', function () {
      var err = document.getElementById('trgErr'); var label = document.getElementById('trgLabel').value.trim();
      var action = document.getElementById('trgAction').value;
      if (!label) { err.textContent = 'Enter a trigger name'; return; }
      if (!action) { err.textContent = 'Choose the action this trigger fires on'; return; }
      var l = V.getTriggers();
      if (editing && editing.id) { l = l.map(function (t) { if (t.id === editing.id) { t.label = label; t.action = action; } return t; }); }
      else { l.unshift({ id: 'trg_' + Date.now().toString(36), label: label, action: action }); }
      V.setTriggers(l); trgAdding = false; trgEditId = null; renderTriggers();
    });
  }
  var EV_PAGES = [
    { v: 'index.html', l: 'Website \u00b7 Home' }, { v: 'about.html', l: 'Website \u00b7 About' }, { v: 'history.html', l: 'Website \u00b7 History' },
    { v: 'aegis.html', l: 'Website \u00b7 Aegis' }, { v: 'sovereign.html', l: 'Website \u00b7 Sovereign' }, { v: 'news.html', l: 'Website \u00b7 News' },
    { v: 'press.html', l: 'Website \u00b7 Press' }, { v: 'investors.html', l: 'Website \u00b7 Investors' }, { v: 'team.html', l: 'Website \u00b7 Team' }, { v: 'archives.html', l: 'Website \u00b7 Heritage' },
    { v: 'portal.html#heritage', l: 'Portal \u00b7 Heritage' }, { v: 'portal.html#vehicles', l: 'Portal \u00b7 Vehicles' }, { v: 'portal.html#news', l: 'Portal \u00b7 News' }
  ];
  var wgEditId = null, wgAdding = false, wgDraft = null;
  function readWgDraft() {
    if (!wgDraft) return;
    var nm = document.getElementById('wgName'); if (nm) wgDraft.name = nm.value;
    var kd = document.getElementById('wgKind'); if (kd) wgDraft.kind = kd.value;
    var sec = document.getElementById('wgSeconds'); if (sec) wgDraft.seconds = parseInt(sec.value, 10) || 0;
    var tx = document.getElementById('wgText'); if (tx) wgDraft.text = tx.value;
    var pg = document.getElementById('wgPage'); if (pg) wgDraft.page = pg.value;
  }
  function renderWidgets() {
    topBar.hidden = false;
    var list = V.getWidgets();
    var building = wgAdding || !!wgEditId;
    if (building) {
      if (!wgDraft) {
        var src = wgEditId ? list.filter(function (w) { return w.id === wgEditId; })[0] : null;
        wgDraft = src ? { id: src.id, name: src.name, kind: src.kind, seconds: src.seconds, text: src.text || '', page: src.page || (EV_PAGES[0] || {}).v }
          : { id: '', name: '', kind: 'sandbox', seconds: 4, text: '', page: (EV_PAGES[0] || {}).v || '' };
      }
    } else { wgDraft = null; }
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:200px 110px 260px 90px"><span>Widget</span><span>Type</span><span>Detail</span><span></span></div>'
      + list.map(function (w) { var type = w.kind === 'open-page' ? 'Open page' : 'Sandbox'; var detail = w.kind === 'open-page' ? ((w.text ? esc(w.text) : '\u2014') + ' \u00b7 ' + (w.seconds || 0) + 's') : ((w.seconds || 0) + 's pause'); return '<div class="adm-row" style="--cols:200px 110px 260px 90px"><span class="c-name"><a data-wg="' + esc(w.id) + '">' + esc(w.name) + '</a></span><span class="veh-c">' + type + '</span><span class="c-email">' + detail + '</span><span class="veh-c"><a data-wgdel="' + esc(w.id) + '" style="color:var(--minerva-red-bright);cursor:pointer;">Delete</a></span></div>'; }).join('') + '</div>'
      : '<p class="adm-empty">No widgets yet.</p>';
    var ed = wgDraft, isOpen = ed && ed.kind === 'open-page';
    var pageOpts = EV_PAGES.map(function (p) { return '<option value="' + esc(p.v) + '"' + ((ed && ed.page === p.v) ? ' selected' : '') + '>' + esc(p.l) + '</option>'; }).join('');
    var form = ed ? '<form class="veh-newform" id="wgForm" onsubmit="return false;"><p class="adm-section-h" style="margin:0 0 14px;">' + (ed.id ? 'Edit widget' : 'New widget') + '</p>'
      + '<div class="ff"><label for="wgName">Widget name</label><div class="ff-input"><input id="wgName" type="text" value="' + esc(ed.name || '') + '" placeholder="e.g. Heritage welcome screen"></div></div>'
      + '<div class="ff" style="margin-top:14px;"><label for="wgKind">Widget type</label><div class="ff-input"><select id="wgKind" class="ff-select"><option value="sandbox"' + (!isOpen ? ' selected' : '') + '>Sandbox (timed pause)</option><option value="open-page"' + (isOpen ? ' selected' : '') + '>Open page &amp; show text</option></select></div></div>'
      + '<div class="ff" style="margin-top:14px;"><label for="wgSeconds">Duration (seconds)</label><div class="ff-input"><input id="wgSeconds" type="number" min="1" value="' + (ed.seconds || 4) + '"></div></div>'
      + (isOpen ? '<div class="ff" style="margin-top:14px;"><label for="wgText">Text to show</label><div class="ff-input"><input id="wgText" type="text" value="' + esc(ed.text || '') + '" placeholder="e.g. Welcome to Minerva Heritage"></div></div><div class="ff" style="margin-top:14px;"><label for="wgPage">Redirect to page</label><div class="ff-input"><select id="wgPage" class="ff-select">' + pageOpts + '</select></div></div>' : '')
      + '<p class="adm-err" id="wgErr"></p><div class="adm-extend"><button class="btn" type="submit" id="wgSave">Save widget</button><button class="btn-cancel" type="button" id="wgCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div></form>' : '';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Widgets"><div class="adm-listhead"><p class="adm-crumb"><a class="cr-root" href="#settings">Settings</a><span class="cr-sep">\u203a</span><span class="cr-here">Widgets</span></p>' + (ed ? '' : '<button class="btn-new" id="wgNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New widget</button>') + '</div>'
      + ''
      + (ed ? form : rows) + '</div>';
    bindBack('#dashboard');
    var nb = document.getElementById('wgNew'); if (nb) nb.addEventListener('click', function () { wgAdding = true; wgEditId = null; wgDraft = null; renderWidgets(); });
    [].forEach.call(root.querySelectorAll('[data-wg]'), function (a) { a.addEventListener('click', function () { wgEditId = a.getAttribute('data-wg'); wgAdding = false; wgDraft = null; renderWidgets(); }); });
    [].forEach.call(root.querySelectorAll('[data-wgdel]'), function (a) { a.addEventListener('click', function () { if (confirm('Delete this widget?')) { V.setWidgets(V.getWidgets().filter(function (w) { return w.id !== a.getAttribute('data-wgdel'); })); renderWidgets(); } }); });
    var ks = document.getElementById('wgKind'); if (ks) ks.addEventListener('change', function () { readWgDraft(); renderWidgets(); });
    var wc = document.getElementById('wgCancel'); if (wc) wc.addEventListener('click', function () { wgAdding = false; wgEditId = null; wgDraft = null; renderWidgets(); });
    var wsv = document.getElementById('wgSave'); if (wsv) wsv.addEventListener('click', function () {
      readWgDraft();
      var err = document.getElementById('wgErr');
      if (!wgDraft.name.trim()) { err.textContent = 'Enter a widget name'; return; }
      if (!wgDraft.seconds || wgDraft.seconds < 1) { err.textContent = 'Enter a duration of at least one second'; return; }
      if (wgDraft.kind === 'open-page' && !wgDraft.text.trim()) { err.textContent = 'Enter the text to show'; return; }
      var rec = { id: wgDraft.id || ('w_' + Date.now().toString(36)), name: wgDraft.name.trim(), kind: wgDraft.kind, seconds: wgDraft.seconds, text: wgDraft.kind === 'open-page' ? wgDraft.text.trim() : '', page: wgDraft.kind === 'open-page' ? wgDraft.page : '' };
      var l = V.getWidgets();
      if (wgDraft.id) { l = l.map(function (w) { return w.id === wgDraft.id ? rec : w; }); } else { l.unshift(rec); }
      V.setWidgets(l); wgAdding = false; wgEditId = null; wgDraft = null; renderWidgets();
    });
  }
  var evDraft = null;
  function trgLabel(id) { var t = V.getTriggers().filter(function (x) { return x.id === id; })[0]; if (t) return t.label; var o = AUTO_TRIGGERS.filter(function (x) { return x.id === id; })[0]; return o ? o.label : (id || '\u2014'); }
  function channelLabel(c) { var f = [['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['push-mobile', 'Push · mobile'], ['push-web', 'Push · web']].filter(function (x) { return x[0] === c; })[0]; return f ? f[1] : (c || '\u2014'); }
  function widgetById(id) { return V.getWidgets().filter(function (w) { return w.id === id; })[0] || null; }
  function widgetSummary(w) { if (!w) return '\u2014'; return w.kind === 'open-page' ? (w.name + ' \u00b7 page \u00b7 ' + (w.seconds || 0) + 's') : (w.name + ' \u00b7 ' + (w.seconds || 0) + 's'); }
  function actSummary(a) {
    if (a.type === 'notification') { var m = V.getMessages().filter(function (x) { return x.id === a.message; })[0]; return channelLabel(a.channel) + ' \u00b7 ' + (m ? m.name : (a.message || '\u2014')); }
    return widgetSummary(widgetById(a.widgetId));
  }
  function readEvDraft() {
    if (!evDraft) return;
    var nm = document.getElementById('evName'); if (nm) evDraft.name = nm.value;
    var tg = document.getElementById('evTrigger'); if (tg) evDraft.trigger = tg.value;
    var ex = document.getElementById('evExpires'); if (ex) evDraft.expires = ex.value;
    evDraft.actions = (evDraft.actions || []).map(function (a, i) {
      if (a.type === 'notification') {
        var ch = document.getElementById('act-ch-' + i); var s = document.getElementById('act-msg-' + i);
        return { type: 'notification', channel: ch ? ch.value : (a.channel || 'email'), message: s ? s.value : a.message };
      }
      var wsel = document.getElementById('act-widget-' + i);
      return { type: 'widget', widgetId: wsel ? wsel.value : (a.widgetId || (V.getWidgets()[0] || {}).id || '') };
    });
  }
  function actionCard(a, i) {
    var head = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><span style="font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--platinum-deep);">Step ' + (i + 1) + ' \u00b7 ' + (a.type === 'notification' ? 'Notification' : 'Widget') + '</span><button type="button" data-rm="' + i + '" style="background:none;border:0;color:var(--minerva-red-bright);cursor:pointer;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;">Remove</button></div>';
    var inner = '';
    if (a.type === 'notification') {
      var ch = a.channel || 'email';
      var chOpts = [['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['push-mobile', 'Push · mobile'], ['push-web', 'Push · web']].map(function (c) { return '<option value="' + c[0] + '"' + (ch === c[0] ? ' selected' : '') + '>Send ' + c[1] + '</option>'; }).join('');
      var msgs = V.getMessages().filter(function (m) { return (m.channels || []).indexOf(ch) !== -1; });
      var msgOpts = msgs.length ? msgs.map(function (m) { return '<option value="' + esc(m.id) + '"' + (a.message === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('') : '<option value="">No messages on this channel</option>';
      inner = '<div class="ff" style="margin-top:10px;"><label>Channel</label><div class="ff-input"><select class="ff-select act-ch" id="act-ch-' + i + '">' + chOpts + '</select></div></div>'
        + '<div class="ff" style="margin-top:10px;"><label>Message</label><div class="ff-input"><select class="ff-select" id="act-msg-' + i + '">' + msgOpts + '</select></div></div>';
    } else {
      var ws = V.getWidgets();
      if (!ws.length) {
        inner = '<p class="field-hint" style="margin-top:10px;">No widgets defined yet. Create one in Automations \u203a Widgets.</p>';
      } else {
        var wOpts = ws.map(function (w) { return '<option value="' + esc(w.id) + '"' + (a.widgetId === w.id ? ' selected' : '') + '>' + esc(widgetSummary(w)) + '</option>'; }).join('');
        inner = '<div class="ff" style="margin-top:10px;"><label>Widget</label><div class="ff-input"><select class="ff-select" id="act-widget-' + i + '">' + wOpts + '</select></div><p class="field-hint">Manage widget types in Automations \u203a Widgets.</p></div>';
      }
    }
    return '<div style="border:1px solid var(--line);padding:14px;margin-top:10px;">' + head + inner + '</div>';
  }
  function renderEvents() {
    topBar.hidden = false;
    var list = V.getAutomations();
    var building = eventAdding || !!eventSel;
    if (building) {
      if (!evDraft) {
        var src = eventSel ? list.filter(function (e) { return e.id === eventSel; })[0] : null;
        evDraft = src ? { id: src.id, name: src.name, trigger: src.trigger, expires: src.expires || '', created: src.created, actions: (src.actions ? JSON.parse(JSON.stringify(src.actions)) : []) }
          : { id: '', name: '', trigger: (V.getTriggers()[0] || {}).id || '', expires: '', actions: [] };
      }
    } else { evDraft = null; }
    if (!building) {
      var ecols = '200px 220px 300px 120px 120px';
      var rows = list.length
        ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:' + ecols + '"><span>Event</span><span>Trigger</span><span>Actions</span><span>Created</span><span>Expires</span></div>'
          + list.map(function (e) {
              var summ = e.actions && e.actions.length ? e.actions.map(actSummary).join('  \u2192  ') : (e.action ? actionLabel(e.action) : '\u2014');
              return '<div class="adm-row" style="--cols:' + ecols + '"><span class="c-name"><a data-ev="' + esc(e.id) + '">' + esc(e.name) + '</a></span>'
                + '<span class="veh-c">' + esc(trgLabel(e.trigger)) + '</span>'
                + '<span class="veh-c">' + esc(summ) + '</span>'
                + '<span class="veh-c">' + esc(e.created ? V.fmtDate(e.created) : '\u2014') + '</span>'
                + '<span class="veh-c">' + esc(e.expires ? V.fmtDate(e.expires) : '\u2014') + '</span></div>';
            }).join('') + '</div>'
        : '<p class="adm-empty">No events configured.</p>';
      root.innerHTML = '<div class="adm-wrap" data-screen-label="Events"><div class="adm-listhead"><p class="adm-crumb"><span class="cr-here">Automations \u203a Events</span></p><button class="btn-new" id="evNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New event</button></div>'
        + '' + rows + '</div>';
      bindBack('#dashboard');
      var nb = document.getElementById('evNew'); if (nb) nb.addEventListener('click', function () { eventAdding = true; eventSel = null; evDraft = null; renderEvents(); });
      [].forEach.call(root.querySelectorAll('[data-ev]'), function (a) { a.addEventListener('click', function () { eventSel = a.getAttribute('data-ev'); eventAdding = false; evDraft = null; renderEvents(); }); });
      return;
    }
    var trigOpts = V.getTriggers().map(function (t) { return '<option value="' + esc(t.id) + '"' + (evDraft.trigger === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('');
    var actsHtml = evDraft.actions.length ? evDraft.actions.map(actionCard).join('') : '<p class="field-hint" style="margin-top:10px;">No actions yet. Add a notification or widget below.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Event builder">'
      + '<p class="adm-crumb"><a class="cr-root" href="#events">Events</a><span class="cr-sep">\u203a</span><span class="cr-here">' + (eventSel ? 'Edit event' : 'New event') + '</span></p>'
      + '<form class="veh-newform" id="evForm" onsubmit="return false;" style="margin-top:clamp(18px,3vh,28px);">'
      +   '<div class="veh-newgrid">'
      +     '<div class="ff"><label for="evName">Event name</label><div class="ff-input"><input id="evName" type="text" value="' + esc(evDraft.name || '') + '" placeholder="e.g. Welcome new members"></div></div>'
      +     '<div class="ff"><label for="evTrigger">Trigger</label><div class="ff-input"><select id="evTrigger" class="ff-select">' + trigOpts + '</select></div></div>'
      +     '<div class="ff"><label for="evExpires">Expiration date (optional)</label><div class="ff-input"><input id="evExpires" type="date" value="' + esc(evDraft.expires || '') + '"></div></div>'
      +   '</div>'
      +   '<p class="adm-section-h" style="margin:22px 0 0;">Action sequence</p>'
      +   actsHtml
      +   '<div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;"><button type="button" class="btn-cancel" id="addNotif" style="border-color:var(--line);">+ Notification</button><button type="button" class="btn-cancel" id="addWidget" style="border-color:var(--line);">+ Widget</button></div>'
      +   '<p class="adm-err" id="evErr"></p>'
      +   (evDraft.created ? '<p class="field-hint">Created ' + esc(V.fmtDate(evDraft.created)) + '</p>' : '')
      +   '<div class="adm-extend"><button class="btn" type="submit" id="evSave">' + (eventSel ? 'Save event' : 'Create event') + '</button><button class="btn-cancel" type="button" id="evCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button>' + (eventSel ? '<button class="btn-cancel" type="button" id="evDelete">Delete</button>' : '') + '</div>'
      + '</form></div>';
    bindBack('#events');
    document.getElementById('addNotif').addEventListener('click', function () { readEvDraft(); evDraft.actions.push({ type: 'notification', channel: 'email', message: (V.getMessages().filter(function (m) { return (m.channels || []).indexOf('email') !== -1; })[0] || {}).id || '' }); renderEvents(); });
    document.getElementById('addWidget').addEventListener('click', function () { readEvDraft(); evDraft.actions.push({ type: 'widget', widgetId: (V.getWidgets()[0] || {}).id || '' }); renderEvents(); });
    [].forEach.call(root.querySelectorAll('[data-rm]'), function (b) { b.addEventListener('click', function () { readEvDraft(); evDraft.actions.splice(parseInt(b.getAttribute('data-rm'), 10), 1); renderEvents(); }); });
    [].forEach.call(root.querySelectorAll('.act-ch'), function (s) { s.addEventListener('change', function () { readEvDraft(); renderEvents(); }); });
    document.getElementById('evCancel').addEventListener('click', function () { eventAdding = false; eventSel = null; evDraft = null; renderEvents(); });
    document.getElementById('evSave').addEventListener('click', function () {
      readEvDraft();
      var err = document.getElementById('evErr');
      if (!evDraft.name.trim()) { err.textContent = 'Enter an event name'; return; }
      if (!evDraft.trigger) { err.textContent = 'Choose a trigger'; return; }
      if (!evDraft.actions.length) { err.textContent = 'Add at least one action'; return; }
      var l = V.getAutomations();
      if (eventSel) { l = l.map(function (e) { return e.id === eventSel ? { id: e.id, name: evDraft.name.trim(), trigger: evDraft.trigger, actions: evDraft.actions, created: e.created, expires: evDraft.expires } : e; }); }
      else { l.unshift({ id: 'au_' + Date.now().toString(36), name: evDraft.name.trim(), trigger: evDraft.trigger, actions: evDraft.actions, created: V.todayStr(), expires: evDraft.expires }); }
      V.setAutomations(l); eventAdding = false; eventSel = null; evDraft = null; renderEvents();
    });
    var ed = document.getElementById('evDelete'); if (ed) ed.addEventListener('click', function () { if (confirm('Delete this event?')) { V.setAutomations(V.getAutomations().filter(function (e) { return e.id !== eventSel; })); eventAdding = false; eventSel = null; evDraft = null; renderEvents(); } });
  }

  /* ---- automations: messages (multi-channel templates) ---- */
  var msgSel = null, msgEditing = false, msgAdding = false;
  var CHANNELS = [['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['push-mobile', 'Push · mobile'], ['push-web', 'Push · web']];
  function chLabels(ch) { return (ch || []).map(function (c) { var f = CHANNELS.filter(function (x) { return x[0] === c; })[0]; return f ? f[1] : c; }).join(' \u00b7 '); }
  function renderMessages() {
    topBar.hidden = false;
    var list = V.getMessages();
    var rows = list.length ? '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:200px 220px 300px"><span>Message</span><span>Channels</span><span>Subject</span></div>'
      + list.map(function (m) { return '<div class="adm-row" style="--cols:200px 220px 300px"><span class="c-name"><a data-msg="' + esc(m.id) + '">' + esc(m.name) + '</a></span><span class="veh-c">' + esc(chLabels(m.channels)) + '</span><span class="c-email">' + esc(m.subject || '\u2014') + '</span></div>'; }).join('') + '</div>'
      : '<p class="adm-empty">No messages yet.</p>';
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Messages">'
      + '<div class="adm-listhead"><p class="adm-crumb"><span class="cr-here">Automations \u203a Messages</span></p><button class="btn-new" id="msgNew" type="button"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New message</button></div>'
      + ''
      + rows + '</div>';
    bindBack('#dashboard');
    var nb = document.getElementById('msgNew'); if (nb) nb.addEventListener('click', function () { msgSel = null; msgAdding = true; msgEditing = true; location.hash = '#messagerec'; render(); });
    [].forEach.call(root.querySelectorAll('[data-msg]'), function (a) { a.addEventListener('click', function () { msgSel = a.getAttribute('data-msg'); msgAdding = false; msgEditing = false; location.hash = '#messagerec'; render(); }); });
  }
  function renderMessageRecord() {
    topBar.hidden = false;
    var m = msgAdding ? { id: '', name: '', channels: ['email'], subject: '', body: '' } : V.getMessages().filter(function (x) { return x.id === msgSel; })[0];
    if (!m) { msgSel = null; location.hash = '#messages'; render(); return; }
    var body;
    if (msgEditing) {
      body = '<form class="veh-newform" id="msgForm" onsubmit="return false;">'
        + '<div class="veh-newgrid">'
        +   '<div class="ff"><label for="mgName">Message name</label><div class="ff-input"><input id="mgName" type="text" value="' + esc(m.name) + '" placeholder="e.g. Event invitation"></div></div>'
        +   '<div class="ff"><label for="mgSubj">Subject (email)</label><div class="ff-input"><input id="mgSubj" type="text" value="' + esc(m.subject || '') + '"></div></div>'
        + '</div>'
        + '<div class="ff" style="margin-top:14px;"><label>Channels</label><div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;">'
        +   CHANNELS.map(function (c) { return '<label style="display:flex;align-items:center;gap:7px;font-family:var(--sans);font-size:0.9rem;color:var(--fg);cursor:pointer;"><input type="checkbox" class="mg-ch" value="' + c[0] + '"' + ((m.channels || []).indexOf(c[0]) >= 0 ? ' checked' : '') + '>' + c[1] + '</label>'; }).join('')
        + '</div></div>'
        + '<div class="ff" style="margin-top:14px;"><label for="mgBody">Content</label><div class="ff-input"><textarea id="mgBody" rows="9" class="ff-textarea">' + esc(m.body || '') + '</textarea></div><span class="field-hint">Placeholders such as {name}, {tier}, {date} are filled automatically. Delivered to members in their language.</span></div>'
        + '<p class="adm-err" id="mgErr"></p>'
        + '<div class="adm-extend"><button class="btn" type="submit" id="mgSave">' + (msgAdding ? 'Create message' : 'Save message') + '</button><button class="btn-cancel" type="button" id="mgCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button>' + (!msgAdding ? '<button class="btn-cancel" type="button" id="mgDelete">Delete</button>' : '') + '</div>'
        + '</form>';
    } else {
      body = '<div class="rec-card">'
        + '<div class="rec-row"><span class="rec-k">Name</span><span class="rec-v">' + esc(m.name) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Channels</span><span class="rec-v">' + esc(chLabels(m.channels)) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Subject</span><span class="rec-v">' + esc(m.subject || '\u2014') + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Content</span><span class="rec-v" style="white-space:pre-wrap;">' + esc(m.body || '') + '</span></div>'
        + '</div>';
    }
    root.innerHTML = '<div class="adm-wrap" data-screen-label="Message">'
      + '<p class="adm-crumb"><a class="cr-root" href="#messages">Messages</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(m.name || 'New message') + '</span></p>'
      + '<div class="adm-listhead" style="margin-top:clamp(20px,3vh,30px);"><p class="adm-section-h" style="margin:0;">' + esc(m.name || 'New message') + '</p>' + (!msgEditing ? '<button class="btn-new" id="mgEdit" type="button"><svg viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>Edit</button>' : '') + '</div>'
      + body + '</div>';
    bindBack('#messages');
    var ed = document.getElementById('mgEdit'); if (ed) ed.addEventListener('click', function () { msgEditing = true; renderMessageRecord(); });
    var mc = document.getElementById('mgCancel'); if (mc) mc.addEventListener('click', function () { if (msgAdding) { location.hash = '#messages'; render(); } else { msgEditing = false; renderMessageRecord(); } });
    var ms = document.getElementById('mgSave'); if (ms) ms.addEventListener('click', function () {
      var err = document.getElementById('mgErr'); var name = document.getElementById('mgName').value.trim();
      if (!name) { err.textContent = 'Enter a message name'; return; }
      var ch = [].slice.call(document.querySelectorAll('.mg-ch:checked')).map(function (x) { return x.value; });
      if (!ch.length) { err.textContent = 'Select at least one channel'; return; }
      var data = { name: name, channels: ch, subject: document.getElementById('mgSubj').value, body: document.getElementById('mgBody').value };
      var l = V.getMessages();
      if (msgAdding) { data.id = 'msg_' + Date.now().toString(36); l.unshift(data); }
      else { l = l.map(function (x) { if (x.id === m.id) { data.id = m.id; return data; } return x; }); }
      V.setMessages(l);
      if (V.logActivity) V.logActivity('mail-edited', data.id);
      msgAdding = false; msgEditing = false; msgSel = data.id; renderMessageRecord();
    });
    var md = document.getElementById('mgDelete'); if (md) md.addEventListener('click', function () { if (confirm('Delete this message?')) { V.setMessages(V.getMessages().filter(function (x) { return x.id !== m.id; })); msgSel = null; location.hash = '#messages'; render(); } });
  }

  /* ---- automations: emails ---- */
  var emailSel = null, emailEditing = false;
  function renderEmails() {
    topBar.hidden = false;
    var list = V.getEmails();
    var rows = '<div class="adm-table tbl-std"><div class="adm-row head" style="--cols:200px 280px 140px 120px"><span>Event</span><span>Subject</span><span>Languages</span><span>Content</span></div>'
      + list.map(function (m) {
          return '<div class="adm-row" style="--cols:200px 280px 140px 120px"><span class="c-name"><a data-mail="' + esc(m.id) + '">' + esc(m.event) + '</a></span>'
            + '<span class="c-email">' + esc(m.subject) + '</span>'
            + '<span class="veh-c">' + m.languages.length + ' languages</span>'
            + '<span class="veh-c">' + (m.custom ? 'Custom' : 'Default') + '</span></div>';
        }).join('') + '</div>';
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Automated emails">'
      +   '<p class="adm-crumb"><span class="cr-here">Automations \u203a Emails</span></p>'
      +   ''
      +   rows
      + '</div>';
    bindBack('#dashboard');
    [].forEach.call(root.querySelectorAll('[data-mail]'), function (a) { a.addEventListener('click', function () { emailSel = a.getAttribute('data-mail'); emailEditing = false; location.hash = '#emailrec'; render(); }); });
  }
  function renderEmailRecord() {
    topBar.hidden = false;
    if (!emailSel) { location.hash = '#emails'; render(); return; }
    var m = V.getEmails().filter(function (x) { return x.id === emailSel; })[0];
    if (!m) { emailSel = null; location.hash = '#emails'; render(); return; }
    var body;
    if (emailEditing) {
      body = '<form class="veh-newform" id="mailForm" onsubmit="return false;">'
        + '<div class="ff"><label for="mSubj">Subject</label><div class="ff-input"><input id="mSubj" type="text" value="' + esc(m.subject) + '"></div></div>'
        + '<div class="ff" style="margin-top:14px;"><label for="mBody">Content</label><div class="ff-input"><textarea id="mBody" rows="10" class="ff-textarea">' + esc(m.body) + '</textarea></div><span class="field-hint">Placeholders such as {name}, {tier}, {date}, {password}, {link}, {comment} are filled in automatically.</span></div>'
        + '<div class="adm-extend"><button class="btn" type="submit" id="mSave">Save content</button><button class="btn-cancel" type="button" id="mCancel" style="border-color:var(--line);color:var(--fg-dim);">Cancel</button></div>'
        + '</form>';
    } else {
      body = '<div class="rec-card">'
        + '<div class="rec-row"><span class="rec-k">Event</span><span class="rec-v">' + esc(m.event) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Trigger</span><span class="rec-v">' + esc(m.trigger) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Subject</span><span class="rec-v">' + esc(m.subject) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Languages</span><span class="rec-v">' + esc(m.languages.map(function (l) { return l.toUpperCase(); }).join(' \u00b7 ')) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Content</span><span class="rec-v" style="white-space:pre-wrap;">' + esc(m.body) + '</span></div>'
        + '<div class="rec-row"><span class="rec-k">Status</span><span class="rec-v">' + (m.custom ? 'Custom content' : 'Default content') + '</span></div>'
        + '</div>';
    }
    root.innerHTML = ''
      + '<div class="adm-wrap" data-screen-label="Email Template">'
      +   '<p class="adm-crumb"><a class="cr-root" href="#emails">Emails</a><span class="cr-sep">\u203a</span><span class="cr-here">' + esc(m.event) + '</span></p>'
      +   '<div class="adm-listhead" style="margin-top:clamp(20px,3vh,30px);"><p class="adm-section-h" style="margin:0;">' + esc(m.event) + '</p>'
      +     (emailEditing ? '' : '<button class="btn-new" id="mEdit" type="button"><svg viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>Edit content</button>')
      +   '</div>'
      +   '<p class="field-hint" style="margin:0 0 12px;">Delivered to members in their own language; editing here sets the master (English) content.</p>'
      +   body
      +   (m.custom && !emailEditing ? '<div class="adm-extend"><button class="btn-cancel" id="mReset" type="button" style="border-color:var(--line);color:var(--fg-dim);">Reset to default</button></div>' : '')
      + '</div>';
    bindBack('#emails');
    var ed = document.getElementById('mEdit'); if (ed) ed.addEventListener('click', function () { emailEditing = true; renderEmailRecord(); });
    var mc = document.getElementById('mCancel'); if (mc) mc.addEventListener('click', function () { emailEditing = false; renderEmailRecord(); });
    var ms = document.getElementById('mSave'); if (ms) ms.addEventListener('click', function () {
      V.setEmail(m.id, document.getElementById('mSubj').value, document.getElementById('mBody').value);
      if (V.logActivity) V.logActivity('mail-edited', m.id);
      emailEditing = false; renderEmailRecord();
    });
    var mr = document.getElementById('mReset'); if (mr) mr.addEventListener('click', function () { if (confirm('Reset this email to the default content?')) { V.resetEmail(m.id); if (V.logActivity) V.logActivity('mail-edited', m.id + ' (reset)'); renderEmailRecord(); } });
  }

  /* ---- impersonation (super-admin) ---- */
  function startImpersonation(id) {
    var u = V.store.get(id); if (!u) return;
    var roleLbl = u.role === 'heritage' ? ('Heritage \u00b7 ' + (TIER_LABEL[u.tier] || 'Member')) : (u.role === 'admin' ? 'Admin' : 'VIP');
    if (V.logActivity) V.logActivity('impersonation-start', u.name + ' (' + roleLbl + ')');
    if (!V.setImpersonation || !V.setImpersonation(id)) return;
    var role = u.role || 'vip';
    if (role === 'vip') { location.href = 'index.html'; return; }
    location.hash = (role === 'heritage') ? 'heritage' : 'dashboard';
    location.reload();
  }
  function openImpersonatePicker() {
    if (!V.isSuperAdmin()) return;
    var users = V.store.all().sort(function (a, b) { return a.no - b.no; });
    var ov = document.createElement('div');
    ov.className = 'imp-modal';
    ov.innerHTML = '<div class="imp-dialog" role="dialog" aria-label="Impersonate a user">'
      + '<div class="imp-dhead"><span>Impersonate a user</span><button class="imp-x" id="impX" type="button" aria-label="Close">\u2715</button></div>'
      + '<div class="imp-dsearch"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="impSearch" type="search" placeholder="Search name or email\u2026" autocomplete="off"></div>'
      + '<div class="imp-dlist" id="impList"></div>'
      + '<p class="imp-dhint">You will see the site and console exactly as this user does. A red bar lets you return to super-admin at any time.</p>'
      + '</div>';
    document.body.appendChild(ov);
    function roleChip(u) { var r = u.role || 'vip'; var lbl = r === 'admin' ? 'Admin' : (r === 'heritage' ? 'Heritage' : 'VIP'); return '<span class="role-chip ' + r + '">' + lbl + '</span>'; }
    function paint(q) {
      q = (q || '').toLowerCase();
      var list = users.filter(function (u) { return !q || (u.name + ' ' + u.email).toLowerCase().indexOf(q) >= 0; });
      document.getElementById('impList').innerHTML = list.length ? list.map(function (u) {
        return '<button class="imp-row" type="button" data-imp="' + esc(u.id) + '"><span class="imp-av">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</span><span class="imp-meta"><span class="imp-nm">' + esc(u.name) + '</span><span class="imp-em">' + esc(u.email) + '</span></span>' + roleChip(u) + '</button>';
      }).join('') : '<p class="adm-empty" style="padding:20px;">No users match.</p>';
      [].forEach.call(ov.querySelectorAll('[data-imp]'), function (b) { b.addEventListener('click', function () { startImpersonation(b.getAttribute('data-imp')); }); });
    }
    paint('');
    var si = document.getElementById('impSearch'); si.addEventListener('input', function () { paint(si.value); }); si.focus();
    document.getElementById('impX').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  }

  /* ---------------- ROUTER ---------------- */
  function render() {
    var heritage = V.isHeritage && V.isHeritage();
    if (!V.isAdmin() && !heritage) { var _a = V.account && V.account(); location.href = _a ? 'index.html' : 'login.html'; return; }
    var so = document.getElementById('admSignout'); if (so) so.style.display = '';
    // account chip + role label
    var acct = V.account ? V.account() : null;
    var sup = V.isSuperAdmin();
    var lbl = document.getElementById('admLbl'); if (lbl) lbl.textContent = heritage ? 'Heritage' : (sup ? 'Administration' : 'User Management');
    if (acct) {
      var nm = document.getElementById('admAcctName'); if (nm) nm.textContent = acct.email || acct.name;
      var av = document.getElementById('admAv'); if (av) av.textContent = (acct.name || 'SA').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    }
    var impEl = document.getElementById('admImpersonate'); if (impEl) { var showImp = !!V.isSuperAdmin(); impEl.hidden = !showImp; impEl.style.display = showImp ? '' : 'none'; }
    var h = (location.hash || (heritage ? '#heritage' : '#dashboard')).replace('#', '');
    if (heritage) {
      var H_OK = { heritage: 1, archive: 1, news: 1, vehicles: 1, vehrec: 1, profile: 1, help: 1, faq: 1, mynotifs: 1 };
      if (!H_OK[h]) h = 'heritage';
    } else if (!sup && (h === 'audit' || h === 'messages' || h === 'messagerec' || h === 'notifications' || h === 'notiflogs' || h === 'triggers' || h === 'events' || h === 'eventlogs' || h === 'widgets' || h === 'usertypes' || h === 'userperms' || h === 'integrations' || h === 'integ')) {
      h = 'dashboard';   // audit + automations + admin config are super-admin only
    }
    document.body.classList.toggle('adm-chat', h === 'help' || h === 'faq');
    buildNav();
    highlightNav();
    applyConsoleLang();
    if (heritage && V.memberPending && V.memberPending()) return renderMemberPending();
    if (h === 'mynotifs') return renderMemberNotifications();
    if (h === 'heritage') return renderArchives();
    if (h === 'archive') return renderArchiveRecord();
    if (h === 'news') return renderNews();
    if (h === 'newsrec') return renderNewsRecord();
    if (h === 'messages') return renderMessages();
    if (h === 'messagerec') return renderMessageRecord();
    if (h === 'notifications') return renderNotifications();
    if (h === 'notiflogs') return renderNotifLogs();
    if (h === 'triggers') return renderTriggers();
    if (h === 'widgets') return renderWidgets();
    if (h === 'subs') return renderSubscriptions();
    if (h === 'admin' || h === 'subscriptions') return renderMemberSubscriptions();
    if (h === 'invoices') return renderInvoices();
    if (h === 'campaigns') return renderCampaigns();
    if (h === 'campaignrec') return renderCampaign();
    if (h === 'payments') return renderPayments();
    if (h === 'integrations') return renderIntegrations();
    if (h === 'integ') return renderIntegration();
    if (h === 'events') return renderEvents();
    if (h === 'eventlogs') return renderEventLogs();
    if (h === 'vehicles') { if (heritage) return renderMemberVehicles(); vehTab = 'register'; vehPage = 1; return renderVehicles(); }
    if (h === 'dashboard') return renderDashboard();
    if (h === 'counters') return renderCounters();
    if (h === 'settings' || h === 'main') return renderSettings();
    if (h === 'usertypes') return renderUserTypes();
    if (h === 'userperms') return renderUserPerms();
    if (h === 'help' || h === 'faq') return renderHelp();
    if (h === 'profile') return renderProfile();
    if (h === 'stats') return renderStats();
    if (h === 'vmodels') { vehTab = 'models'; vehPage = 1; return renderVehicles(); }
    if (h === 'vcerts') { vehTab = 'coa'; vehPage = 1; return renderVehicles(); }
    if (h === 'vehrec') return renderVehRecord();
    if (h === 'new') return renderNew();
    if (h === 'created') return renderCreated();
    if (h === 'users') { usersPage = 1; return renderUsers(); }
    if (h === 'groups') return renderGroups();
    if (h === 'grouprec') return renderGroup();
    if (h === 'audit') return renderAudit();
    if (h === 'user') return renderUser();
    return heritage ? renderArchives() : renderDashboard();
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
    var impBtn = document.getElementById('admImpersonate'); if (impBtn) impBtn.addEventListener('click', function (e) { e.preventDefault(); openImpersonatePicker(); });
    var avBtn = document.getElementById('admAv'); if (avBtn) { avBtn.style.cursor = 'pointer'; avBtn.addEventListener('click', function (e) { e.stopPropagation(); location.hash = '#profile'; render(); }); }
    // collapsible rail (persisted)
    try { if (localStorage.getItem('minerva_admin_rail') === '1') document.body.classList.add('adm-rail'); } catch (e) {}
    var cb = document.getElementById('admCollapse');
    if (cb) cb.addEventListener('click', function () {
      var railed = document.body.classList.toggle('adm-rail');
      try { localStorage.setItem('minerva_admin_rail', railed ? '1' : '0'); } catch (e) {}
    });
    window.addEventListener('hashchange', render);
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
    // Production push-notification events surfaced in the bell:
    //   • VIP <name> website login
    //   • VIP <name> invitation sent
    //   • Heritage member <name> registration request
    //   • Heritage member <name> registration accepted
    // (Populated from real accounts where present; example names otherwise.)
    function buildNotes() {
      if (aiIsMember()) return memberBellNotes();
      function nice(u) { return u && typeof u.name === 'string' && /\s/.test(u.name.trim()) && /^[A-Za-zÀ-ÿ'’ .-]+$/.test(u.name.trim()) && !/guest/i.test(u.name); }
      var vips = [], pending = null, active = null;
      try {
        var all = (V.store && V.store.all) ? V.store.all() : [];
        vips = all.filter(function (u) { return u.role === 'vip' && nice(u); });
        pending = all.filter(function (u) { return u.role === 'heritage' && u.status === 'pending' && nice(u); })[0] || null;
        active = all.filter(function (u) { return u.role === 'heritage' && (u.status === 'active' || u.status === 'accepted') && nice(u); })[0] || null;
      } catch (e) {}
      var vip1 = (vips[0] && vips[0].name) || 'Alexander Vance';
      var vip2 = (vips[1] && vips[1].name) || (vips[0] && vips[0].name) || 'Camille Laurent';
      var preg = (pending && pending.name) || 'Henri Lemaire';
      var pacc = (active && active.name) || 'Sofia Conti';
      return [
        { t: 'VIP ' + vip1 + ' website login', m: '2h ago', read: false },
        { t: 'VIP ' + vip2 + ' invitation sent', m: '4h ago', read: false },
        { t: 'Heritage member ' + preg + ' registration request', m: '6h ago', read: false },
        { t: 'Heritage member ' + pacc + ' registration accepted', m: 'Yesterday', read: true }
      ];
    }
    var NOTES = buildNotes();
    var bell = document.getElementById('admBell'), bellMenu = document.getElementById('admBellMenu');
    var bellList = document.getElementById('admBellList'), badge = document.getElementById('admBadge');
    function paintNotes() {
      var mem = aiIsMember();
      if (mem) NOTES = memberNotifs();
      var unread = NOTES.filter(function (n) { return !n.read; }).length;
      if (badge) { badge.textContent = unread; badge.hidden = unread === 0; }
      var shown = mem ? NOTES.slice(0, 5) : NOTES;
      if (bellList) bellList.innerHTML = shown.length
        ? shown.map(function (n) {
            return mem
              ? '<div class="bell-item' + (n.read ? ' read' : '') + '" data-bn="' + esc(n.id) + '"><span class="dot"></span><span class="bd"><span class="bt">' + esc(n.title) + '</span><span class="bm">' + esc(n.date ? V.fmtDate(n.date) : '') + '</span></span></div>'
              : '<div class="bell-item' + (n.read ? ' read' : '') + '"><span class="dot"></span><span class="bd"><span class="bt">' + esc(n.t) + '</span><span class="bm">' + esc(n.m) + '</span></span></div>';
          }).join('')
        : '<div class="bell-empty">' + (mem ? esc(HT('portal.noNotifs')) : 'No notifications') + '</div>';
      if (mem && bellList) [].forEach.call(bellList.querySelectorAll('[data-bn]'), function (el) {
        el.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var n = memberNotifs().filter(function (x) { return x.id === el.getAttribute('data-bn'); })[0];
          if (n) { notifPopup(n); paintNotes(); }
        });
      });
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
    if (bellClear) bellClear.addEventListener('click', function (e) { e.stopPropagation(); if (aiIsMember()) { markAllNotifRead(); } else { NOTES.forEach(function (n) { n.read = true; }); } paintNotes(); });
    // Header icon → open the detailed notifications list as a full page
    var bellExpand = document.getElementById('admBellExpand');
    if (bellExpand) {
      var _mem = !!(V.isHeritage && V.isHeritage());
      bellExpand.hidden = !(V.isSuperAdmin() || _mem);
      bellExpand.addEventListener('click', function (e) {
        e.stopPropagation(); closeBell();
        location.hash = (V.isHeritage && V.isHeritage()) ? '#mynotifs' : '#notiflogs'; render();
      });
    }

    // top field → Minerva Concierge: opens Help & Support and sends the prompt
    var searchInput = document.getElementById('admSearchInput');
    if (searchInput) {
      document.getElementById('admSearch').addEventListener('submit', function () {
        var q = searchInput.value.trim();
        searchInput.value = '';
        if (q) aiState.pending = q;
        location.hash = '#help'; render();
      });
    }
    // Open the native day/month/year calendar on a click anywhere in a date field.
    root.addEventListener('click', function (e) {
      var t = e.target.closest('input[type="date"]');
      if (t && typeof t.showPicker === 'function') { try { t.showPicker(); } catch (err) {} }
    });
    render();
  });
})();
