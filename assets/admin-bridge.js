/* ============================================================
   MINERVA — Admin console bridge  (admin.html ONLY)
   ------------------------------------------------------------
   The new admin SPA (assets/admin-app.js) was written against the
   front-end PROTOTYPE engine, which exposed a large, SYNCHRONOUS
   window.MinervaVIP surface backed by localStorage.

   The LIVE engine (assets/vip.js) is Supabase-backed and ASYNC, and
   intentionally exposes only the production surface (auth + the VIP
   store as Promises). This bridge sits BETWEEN them: it waits for the
   live MinervaVIP, then EXTENDS it (never overwrites a live auth
   method) with the extra methods admin-app.js calls — adapting the
   live async store into the synchronous, cache-backed shape the SPA
   expects, and stubbing the not-yet-wired sections (vehicles, web
   stats, counters, audit) so the console renders "coming soon" / empty
   panels and never throws.

   SECURITY
   --------
   • NO password is stored or compared here. Admin identity is whatever
     the live Supabase session says it is (vip.js -> profiles.is_admin).
     isSuperAdmin() is derived purely from the signed-in session email.
   • This file does not modify vip.js, config.js or minerva.js.
   • Loaded after config.js, supabase-js and vip.js, before admin-app.js.
   ============================================================ */
(function () {
  'use strict';

  // The single super-admin account (matches profiles.is_admin owner).
  var SUPER_ADMIN_EMAIL = 'admin@minervaluxurymotors.com';

  function start(V) {
    /* ----- session email (for isSuperAdmin) — resolved once, cached ----- */
    var _sessionEmail = null;
    var _isSuper = false;
    var _sb = (function () {
      try {
        var CFG = window.MINERVA_SUPABASE || {};
        if (window.supabase && CFG.url && CFG.anonKey) {
          // A read-only client purely to resolve the session email; auth state
          // is owned by vip.js. persistSession:false avoids touching its storage.
          return window.supabase.createClient(CFG.url, CFG.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          });
        }
      } catch (e) {}
      return null;
    })();

    // Authenticated DATA client for the Phase-2 tables (vehicles / models / certs).
    // The _sb client above can read the session but does not attach the admin's JWT
    // to PostgREST calls, so RLS (admins only) would hide every row. This client
    // derives a fresh access token from the shared session on each request, so the
    // database sees the signed-in admin. Reads stay current even as the token rotates.
    var _db = (function () {
      try {
        var CFG = window.MINERVA_SUPABASE || {};
        if (window.supabase && _sb && CFG.url && CFG.anonKey) {
          return window.supabase.createClient(CFG.url, CFG.anonKey, {
            accessToken: function () {
              return _sb.auth.getSession().then(function (r) {
                return (r && r.data && r.data.session && r.data.session.access_token) || null;
              }).catch(function () { return null; });
            }
          });
        }
      } catch (e) {}
      return null;
    })();

    function resolveSessionEmail() {
      if (!_sb) return Promise.resolve(null);
      return _sb.auth.getSession().then(function (res) {
        var sxn = res && res.data ? res.data.session : null;
        var email = (sxn && sxn.user && sxn.user.email) ? String(sxn.user.email).toLowerCase() : null;
        _sessionEmail = email;
        _isSuper = !!(email && email === SUPER_ADMIN_EMAIL);
        return email;
      }).catch(function () { return null; });
    }

    /* ----- re-render hook so async refreshes repaint the SPA ----- */
    function repaint() {
      try { window.dispatchEvent(new Event('minerva-admin-refresh')); } catch (e) {}
    }

    /* ==================================================================
       USER STORE — synchronous cache over the live async store.
       admin-app.js calls store.all()/get()/findByEmail() synchronously,
       so we serve a cache and refresh it in the background.
       ================================================================== */
    var liveStore = (V.store && typeof V.store === 'object') ? V.store : {};
    var _users = [];
    var _byId = {};
    var _loaded = false;
    var _loading = false;

    function indexUsers(list) {
      _users = Array.isArray(list) ? list.slice() : [];
      _byId = {};
      _users.forEach(function (u, i) {
        if (u && u.no == null) u.no = i + 1;
        if (u && u.role == null) u.role = 'vip';   // Phase 1 provisions VIPs only
        if (u) _byId[u.id] = u;
      });
    }

    function refreshUsers() {
      if (!liveStore.all) { _loaded = true; return Promise.resolve(_users); }
      if (_loading) return Promise.resolve(_users);
      _loading = true;
      return Promise.resolve().then(function () { return liveStore.all(); })
        .then(function (list) { indexUsers(list); _loaded = true; _loading = false; repaint(); return _users; })
        .catch(function () { _loaded = true; _loading = false; return _users; });
    }

    function refreshUser(id) {
      if (!liveStore.get || id == null) return Promise.resolve(_byId[id] || null);
      return Promise.resolve().then(function () { return liveStore.get(id); })
        .then(function (full) {
          if (full) {
            if (full.role == null) full.role = 'vip';
            if (full.no == null && _byId[id]) full.no = _byId[id].no;
            _byId[id] = full;
            for (var i = 0; i < _users.length; i++) { if (_users[i].id === id) { _users[i] = full; break; } }
            repaint();
          }
          return full;
        })
        .catch(function () { return _byId[id] || null; });
    }

    refreshUsers();   // initial load

    var bridgeStore = {
      all: function () { return _users.slice(); },
      list: function () { return _users.slice(); },
      get: function (id) { var u = _byId[id] || null; if (u) refreshUser(id); return u; },
      findByEmail: function (email) {
        var e = String(email || '').toLowerCase();
        for (var i = 0; i < _users.length; i++) {
          if (_users[i] && String(_users[i].email || '').toLowerCase() === e) return _users[i];
        }
        return null;
      },
      // returns a Promise (admin-app.js wraps it). Phase 1 provisions VIPs only;
      // the role arg is accepted for signature-compatibility but ignored.
      create: function (name, email, endDate, role, lang) {
        if (!liveStore.create) return Promise.reject(new Error('store-unavailable'));
        return Promise.resolve(liveStore.create(name, email, endDate, lang)).then(function (u) {
          u = u || {};
          if (u.role == null) u.role = 'vip';
          // live store returns the one-time password as `password`; SPA reads `pw`.
          if (u.pw == null && u.password != null) u.pw = u.password;
          if (u.id) { _byId[u.id] = u; _users.push(u); }
          refreshUsers();
          return u;
        });
      },
      extend: function (id, date) {
        if (!liveStore.extend) return Promise.resolve();
        return Promise.resolve(liveStore.extend(id, date)).then(function (r) { refreshUsers(); refreshUser(id); return r; }).catch(function () {});
      },
      cancel: function (id) {
        if (!liveStore.cancel) return Promise.resolve();
        return Promise.resolve(liveStore.cancel(id)).then(function (r) { refreshUsers(); refreshUser(id); return r; }).catch(function () {});
      },
      markInviteSent: function (id) {
        if (liveStore.markInviteSent) { try { return liveStore.markInviteSent(id); } catch (e) {} }
        return Promise.resolve({ ok: true });
      },
      requestExtension: function (id) {
        if (liveStore.requestExtension) { try { return liveStore.requestExtension(id); } catch (e) {} }
        return Promise.resolve({ ok: true });
      },
      // No self-service password / language change from the console in Phase 1;
      // resolve quietly so nothing throws.
      setLang: function () { return Promise.resolve({ ok: true }); },
      setPassword: function () { return Promise.resolve({ ok: true }); }
    };

    try { V.store = bridgeStore; } catch (e) {}

    /* ==================================================================
       DASHBOARD DATA — real VIP/Admin counts; everything else zeroed.
       Shape MUST match admin-app.js renderDashboard()/renderStats():
         { visits:{anon,vip,admin,total}, vipUsers, adminUsers, avgTime,
           pages:[], sample, firstTs, devices:[], locations:[] }
       ================================================================== */
    function dashboardData() {
      var vipUsers = 0, adminUsers = 0;
      _users.forEach(function (u) {
        if (!u || u.cancelled) return;
        if ((u.role || 'vip') === 'admin') adminUsers++;
        else vipUsers++;
      });
      // The single super-admin owner is an admin account, not a VIP profile row;
      // count it so the Admin tile is never misleadingly 0 for the owner.
      if (_isSuper) adminUsers = Math.max(adminUsers, 1);
      return {
        visits: { anon: 0, vip: 0, admin: 0, total: 0 },
        vipUsers: vipUsers, adminUsers: adminUsers,
        avgTime: 0, pages: [], sample: 0, firstTs: 0, devices: [], locations: []
      };
    }

    /* ----- account: topbar chip / profile page / console language ----- */
    function account() {
      return {
        id: null,
        name: _isSuper ? 'Super-admin' : 'Admin',
        email: _sessionEmail || SUPER_ADMIN_EMAIL,
        role: 'admin', endDate: null, lang: 'en', super: _isSuper
      };
    }

    /* ----- password policy: >=10 chars, upper, lower, digit, symbol ----- */
    var PW_RULES = [
      { id: 'len',   label: 'At least 10 characters',     test: function (p) { return p.length >= 10; } },
      { id: 'upper', label: 'One uppercase letter (A-Z)', test: function (p) { return /[A-Z]/.test(p); } },
      { id: 'lower', label: 'One lowercase letter (a-z)', test: function (p) { return /[a-z]/.test(p); } },
      { id: 'digit', label: 'One number (0-9)',           test: function (p) { return /[0-9]/.test(p); } },
      { id: 'sym',   label: 'One symbol (! ? @ # $)',      test: function (p) { return /[^A-Za-z0-9]/.test(p); } }
    ];
    function passwordChecks(pw) {
      pw = String(pw || '');
      return PW_RULES.map(function (r) { return { id: r.id, label: r.label, ok: !!r.test(pw) }; });
    }
    function passwordValid(pw) { return passwordChecks(pw).every(function (c) { return c.ok; }); }

    /* ==================================================================
       VEHICLES (Phase 2) — registered vehicles, models, certificates.
       Synchronous cache over Supabase tables (vehicles / vehicle_models /
       certificates), same pattern as the user store. Reads & writes use
       the _sb client, which carries the signed-in admin's JWT, so RLS
       (admins only) applies. admin-app.js reads via getVehicles()/
       getModels()/getCoa() synchronously and adds rows via addVehicle()/
       addModel()/addCoa() (Promises).
       ================================================================== */
    var _vehicles = [], _models = [], _coa = [];

    // DB column  ->  SPA record-field maps (SPA keys match VEH_FIELDS).
    function mapVehicleRow(r) {
      return { id: r.id, vin: r.vin || '', firstReg: r.first_reg || '', model: r.model || '',
               modelDate: (r.model_date != null ? r.model_date : ''), owner: r.owner || '', email: r.email || '' };
    }
    function mapModelRow(r) {
      return { id: r.id, name: r.name || '', line: r.line || '', launch: (r.launch != null ? r.launch : ''),
               power: r.power || '', units: (r.units != null ? r.units : ''), status: r.status || '' };
    }
    function mapCoaRow(r) {
      return { id: r.id, ref: r.ref || '', vin: r.vin || '', model: r.model || '',
               issued: r.issued || '', owner: r.owner || '', status: r.status || '' };
    }
    // blank -> null (Postgres date/int reject ''); trim text.
    function s(v) { v = (v == null ? '' : String(v)).trim(); return v || null; }
    function i(v) { v = (v == null ? '' : String(v)).trim(); if (!v) return null; var x = parseInt(v, 10); return isNaN(x) ? null : x; }

    function refreshVehicles() {
      if (!_db) return Promise.resolve(_vehicles);
      return _db.from('vehicles').select('*').order('created_at', { ascending: false })
        .then(function (res) { if (res && !res.error && res.data) { _vehicles = res.data.map(mapVehicleRow); repaint(); } return _vehicles; })
        .catch(function () { return _vehicles; });
    }
    function refreshModels() {
      if (!_db) return Promise.resolve(_models);
      return _db.from('vehicle_models').select('*').order('created_at', { ascending: false })
        .then(function (res) { if (res && !res.error && res.data) { _models = res.data.map(mapModelRow); repaint(); } return _models; })
        .catch(function () { return _models; });
    }
    function refreshCoa() {
      if (!_db) return Promise.resolve(_coa);
      return _db.from('certificates').select('*').order('created_at', { ascending: false })
        .then(function (res) { if (res && !res.error && res.data) { _coa = res.data.map(mapCoaRow); repaint(); } return _coa; })
        .catch(function () { return _coa; });
    }

    function getVehicles() { return _vehicles.slice(); }
    function getModels()   { return _models.slice(); }
    function getCoa()      { return _coa.slice(); }
    function vehicleCount() { return _vehicles.length; }   // real count -> dashboard tile
    // legacy whole-list setters are unused now (create goes through add*); keep as no-ops.
    function setVehicles() {}
    function setModels() {}
    function setCoa() {}

    function addVehicle(rec) {
      rec = rec || {};
      if (!_db) return Promise.reject(new Error('store-unavailable'));
      return _db.from('vehicles').insert({
        vin: s(rec.vin), first_reg: s(rec.firstReg), model: s(rec.model),
        model_date: i(rec.modelDate), owner: s(rec.owner), email: s(rec.email)
      }).then(function (res) {
        if (res && res.error) throw new Error(res.error.message || 'Could not save vehicle.');
        return refreshVehicles();
      });
    }
    function addModel(rec) {
      rec = rec || {};
      if (!_db) return Promise.reject(new Error('store-unavailable'));
      return _db.from('vehicle_models').insert({
        name: s(rec.name), line: s(rec.line), launch: i(rec.launch),
        power: s(rec.power), units: i(rec.units), status: s(rec.status)
      }).then(function (res) {
        if (res && res.error) throw new Error(res.error.message || 'Could not save model.');
        return refreshModels();
      });
    }
    function addCoa(rec) {
      rec = rec || {};
      if (!_db) return Promise.reject(new Error('store-unavailable'));
      return _db.from('certificates').insert({
        ref: s(rec.ref), vin: s(rec.vin), model: s(rec.model),
        issued: s(rec.issued), owner: s(rec.owner), status: s(rec.status)
      }).then(function (res) {
        if (res && res.error) throw new Error(res.error.message || 'Could not save certificate.');
        return refreshCoa();
      });
    }

    refreshVehicles(); refreshModels(); refreshCoa();   // initial loads

    /* ----- still-not-wired sections (Phase 3/4): safe stubs (never throw) ----- */
    function getMembersCount() { return null; }   // -> "Coming soon" tile (Phase 3)
    function getCounters() { return {}; }
    function setCounter() {}
    function auditEvents() { return []; }
    function logActivity() {}
    function map() {}

    /* ----- extend the live MinervaVIP (only where it doesn't already define) ----- */
    var additions = {
      isSuperAdmin: function () { return _isSuper; },
      dashboardData: dashboardData,
      account: account,
      passwordChecks: passwordChecks,
      passwordValid: passwordValid,
      getMembersCount: getMembersCount,
      vehicleCount: vehicleCount,
      getVehicles: getVehicles, setVehicles: setVehicles, addVehicle: addVehicle,
      getModels: getModels, setModels: setModels, addModel: addModel,
      getCoa: getCoa, setCoa: setCoa, addCoa: addCoa,
      getCounters: getCounters, setCounter: setCounter,
      auditEvents: auditEvents,
      logActivity: logActivity,
      map: map
    };
    Object.keys(additions).forEach(function (k) {
      if (typeof V[k] !== 'function') { try { V[k] = additions[k]; } catch (e) {} }
    });

    /* ----- resolve the session email, then repaint so isSuperAdmin() is right ----- */
    resolveSessionEmail().then(function () { repaint(); });
  }

  /* Poll for the live engine (every 40ms) then extend it once. */
  (function waitForEngine() {
    if (window.MinervaVIP) { try { start(window.MinervaVIP); } catch (e) {} return; }
    setTimeout(waitForEngine, 40);
  })();
})();
