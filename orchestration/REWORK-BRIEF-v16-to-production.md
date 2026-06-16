# Rework Brief — bring Design Package v16 in line with Production Architecture

**To:** Claude design **· From:** Tom (lead developer, Cowork side) **· Date:** 2026-06-16
**Subject:** Re-export the v16 build so it merges cleanly onto the live Supabase architecture.
**Read first:** [`DESIGN-SYNC-CONTRACT.md`](./DESIGN-SYNC-CONTRACT.md). This brief is the v16-specific
application of that contract.

---

## 0. TL;DR — what we need from the re-export

The v16 UI is great and we want all of it. The problem is purely **architectural**: v16 ships a
**prototype data layer** (localStorage, demo seeds, a hard-coded admin password, a client-side
concierge knowledge base) that **cannot go to production** and that the live site already replaced
with a secure Supabase backend. Please re-export v16 so that:

1. The UI is **unchanged visually**, but
2. All data access goes through the **live async `window.MinervaVIP` surface** (documented in §3), not
   localStorage; and
3. You hand over a **Data Access Manifest** (§5) listing every method + data shape the console needs,
   so we can wire the new sections to Supabase via the bridge.

You do **not** need to build any backend. You need to (a) stop shipping the prototype engine as if it
were production, and (b) tell us exactly what data each screen needs.

---

## 1. The production architecture (the target you're fitting)

The live site (`steveminerva.github.io/minerva-website`, repo `steveminerva/minerva-website`) is:

- **Static front-end** on GitHub Pages (no build step) + **Supabase** (Postgres, Auth, RLS, Deno edge
  functions) in EU-Frankfurt.
- **Auth:** Supabase Auth. Admin identity = `profiles.is_admin`; **no password is stored in code.**
- **Data:** every entity is a Supabase table under **Row-Level Security** keyed by role/tier
  (super ⊃ admin ⊃ {vip, heritage[commissioner ⊃ custodian ⊃ admirer]} ⊃ public).
- **Edge functions** already live (don't reimplement in the browser):
  `admin-create-vip`, `admin-create-user`, `admin-set-role`, `admin-list`, `admin-detail`,
  `admin-extend`, `admin-cancel`, `vip-request-extension`, `heritage-register`, `heritage-decision`
  (sends the 8-language decision email), `concierge` (Mistral, role-gated server-side).
- **Wired pages load this exact stack, in this order — keep it:**
  ```html
  <script src="assets/config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="assets/vip.js"></script>          <!-- live async engine -->
  <script src="assets/admin-bridge.js"></script> <!-- adapts the sync console onto the async engine -->
  <script src="assets/admin-app.js"></script>    <!-- your SPA -->
  ```
  Public pages load `config.js → supabase-js → i18n.js → minerva.js` (which loads `vip.js`).

---

## 2. The core change — engine ownership

| File | Who owns it | What you must do |
|---|---|---|
| `assets/vip.js` | **Cowork (engine)** | **Do not ship your prototype `vip.js`.** It is localStorage/synchronous with a hard-coded password and demo seeds. The live one is Supabase/async. Keep your prototype version **only as a local dev mock**, clearly named (e.g. `assets/vip.dev-mock.js`) and **excluded from the deployable tree**. |
| `assets/minerva.js` | **Cowork (engine)** | Same — keep live. Don't ship the prototype variant. |
| `assets/config.js` | **Cowork** | Never include/overwrite — it holds real Supabase keys. |
| `assets/admin-bridge.js` | **Cowork** | Don't ship it. But your `admin-app.js` must be **bridge-compatible** (see §3–§4). |
| `assets/admin-app.js` | **You (design)** | Ship it. Write it against the documented `window.MinervaVIP` surface, **never against localStorage directly.** |
| `assets/concierge-knowledge.js` | **drop** | Remove. Concierge knowledge lives server-side (`concierge_kb` + `concierge` function). If you want to change concierge content, edit the **`CONCIERGE-KNOWLEDGE.md` content contract** instead — never ship a client KB (it leaks cross-role knowledge). |

**Why a dev mock is fine:** the live `admin-bridge.js` already does exactly this adaptation — it lets a
synchronous, cache-backed console run on the async engine. So you may keep coding the console
synchronously against `window.MinervaVIP`; just (a) don't deploy the mock, and (b) give us the manifest
so the bridge can be extended to cover your new calls.

---

## 3. The live `window.MinervaVIP` surface you can rely on

These already exist on the live engine. Reuse them; do not reinvent. (All data methods return
**Promises** on the raw engine; the bridge presents a synchronous cached mirror to the console.)

**Auth / session / role**
- `MinervaVIP.ready(cb)` / `MinervaVIP.refresh()` — engine readiness + session refresh.
- `MinervaVIP.adminLogin(email, pw)` → resolves to admin session (no password compare in code).
- `MinervaVIP.authVip(...)`, `MinervaVIP.loginByInvite(...)`, `MinervaVIP.signOutVip()`.
- `MinervaVIP.isAdmin()`, `MinervaVIP.hasAccess()`, `MinervaVIP.isHeritage()`,
  `MinervaVIP.memberTier()`, `MinervaVIP.memberStatus()`, `MinervaVIP.memberPending()`.
- `MinervaVIP.currentVip()`, `MinervaVIP.expiredVip()`.
- **Impersonation (super-admin):** `MinervaVIP.isImpersonating()`, `MinervaVIP.realIsAdmin()`.
- Helpers: `genPassword()`, `todayStr()`, `isExpired()`.

**Users store** (`MinervaVIP.store`, mirrored synchronously by the bridge)
- `.all()` / `.list()` → array of users `{id,name,email,role,tier,isAdmin,endDate,status,vin,lang,created,logins,events}`
- `.get(id)`, `.findByEmail(email)`
- `.create(name, email, endDate, role, lang, tier, vin)` — routes to `admin-create-vip` / `admin-create-user`
- `.extend(id, date)`, `.cancel(id)`, `.markInviteSent(id)`, `.requestExtension(id)`
- `.setLang(...)`, `.setPassword(...)`
- Role change → `admin-set-role`; super-admin checks via `bridge.isSuperAdmin()`.

**Already wired data domains** (bridge-backed): **users, vehicles, vehicle models, certificates (COA),
news, archives, heritage members.** **Stubbed (Phase 4, render "coming soon"):** web stats, counters,
audit logs.

> If your console calls a method **with the same name and shape** as above, it will "just work" once
> merged. If it calls anything else, it goes in the manifest (§5).

---

## 4. What v16 currently does wrong (fix list, file by file)

Verified against the live repo on 2026-06-16.

**`assets/vip.js` (prototype) — do not ship**
- Contains `var ADMIN_PW = 'Minerva@1897';` and `ADMIN_EMAIL` → **remove from any shippable file.**
- Contains demo seeds `VEHICLE_SEED, COA_SEED, NEWS_SEED, CAMP_SEED, ARCH_SEED, EMAIL_SEED, AUTO_SEED,
  MSG_SEED, TRG_SEED` and a synchronous localStorage store → **dev-mock only.**
- Defines member ops (`registerMember/approveMember/denyMember/renewMember`) client-side → on
  production these are the `heritage-register` / `heritage-decision` functions. Call the
  `MinervaVIP` methods; don't mutate localStorage.

**`assets/admin-app.js` — keep, but make bridge-compatible**
- Today it reads `store` (66×), `localStorage` (22×), `db` (4×). Route **all** of these through
  `window.MinervaVIP` / its `store`. No direct `localStorage` for any record that must persist
  server-side.
- New sections with **no backend yet** — Automations (Events/Triggers/Notifications/Messages/Widgets/
  Event logs), Subscriptions/Invoices/Payments, User groups, Roles & permissions, dashboard widgets:
  these are fine to include, but each must (a) call a named `MinervaVIP` method and (b) be listed in
  the manifest so we can wire it. Until wired, they should degrade to an empty/"coming soon" state via
  the method returning empty — **never throw.**

**`assets/concierge-knowledge.js` — delete** (see §2).

**Wired HTML (`admin.html, portal.html, login.html, register.html, account.html, about.html,
aegis.html, sovereign.html`)**
- Restore the **production script order** (§1). Don't emit the prototype 2-script stack.
- **`about.html`, `aegis.html`, `sovereign.html`:** do **not** bake VIP/staff-only content into the
  HTML (even hidden). Mark the gated region with the engine's hook and let `vip.js` fetch the content
  from `protected_content` at runtime. (This is why these pages were held in earlier drops.)
- `account.html`, `register.html`: keep the UI; the membership/cancel/auto-renew actions must call
  `MinervaVIP` methods, not localStorage.

**i18n (`i18n.js`, `heritage-i18n.js`)** — additive only; keep all 8 languages resolving. Good as-is.

**Package hygiene** — ship **one** canonical tree: no `dist/`, no nested `Minerva website (16)/`
duplicate, no `*.jsx` / preview / mockup HTML in the deployable set, no `supabase/migrations/0001…`
that re-seeds the password. Make the **package filename and the internal brief agree on the version
number** (this drop said "(16)" on the zip and "v17" inside).

---

## 5. Deliverable A — the Data Access Manifest (most important)

A single file (`DATA-ACCESS-MANIFEST.md`) listing **every** data call the console/portal makes.
For each, give us:

| Column | Meaning |
|---|---|
| Method | `MinervaVIP.<name>(args)` or `store.<name>(args)` you call |
| Domain | users / vehicles / news / automations / subscriptions / groups / roles / notifications / … |
| Direction | read / write / action |
| Args | each argument + type |
| Returns | the object/array shape the UI expects (field names + types) |
| Audience | who may see/do this (super / admin / vip / heritage-tier) → becomes RLS |
| Status | already-live (matches §3) / **new — needs wiring** |

This manifest is what we turn into tables + RLS + bridge methods. Anything not in the manifest can't
be wired, so completeness matters more than prose.

## 6. Deliverable B — per-domain data contracts (for the new sections)

For each genuinely new domain (Automations, Subscriptions/Invoices/Payments, User groups,
Roles & permissions, Member notifications, News publishing tags), one short block:

- **Entity & fields** (name + type for each column).
- **Who reads / writes** (role/tier) → RLS.
- **Actions** (e.g. "publish news → push to tier X", "cancel subscription").
- **Volume / retention** if relevant (e.g. notifications capped, audit retained).
- Whether an **email/push** is sent (so we route it through the existing SMTP / a push gateway).

## 7. Definition of done (re-export checklist)

- [ ] No `localStorage` as system-of-record; no hard-coded credentials; no demo seeds in shipped files.
- [ ] `vip.js` / `minerva.js` / `config.js` / `admin-bridge.js` **not** in the deployable tree (engine is Cowork's).
- [ ] `admin-app.js` calls only `window.MinervaVIP` / its `store`; degrades gracefully when a method is unwired.
- [ ] `concierge-knowledge.js` removed; concierge content (if any) delivered as `CONCIERGE-KNOWLEDGE.md`.
- [ ] Wired pages use the production script order; no private content baked into `about/aegis/sovereign`.
- [ ] `DATA-ACCESS-MANIFEST.md` + per-domain contracts included.
- [ ] One canonical tree; consistent version number on the package and the brief.
- [ ] Handoff note added in `orchestration/design-handoffs/` (use `TEMPLATE.md`).

---

### Appendix — why we can't just take v16 as-is
v16's `vip.js` is 77 KB of localStorage logic with `Minerva@1897` hard-coded; the live `vip.js` is
43 KB of Supabase/async logic with **no** password in code. v16's `admin-app.js` is 322 KB (3× the
live 112 KB) and reaches data synchronously through localStorage. Dropping it on production would
re-expose a hard-coded admin login, lose every record to the browser, and re-leak cross-role concierge
knowledge. Re-exporting against the `MinervaVIP` surface + manifest avoids all of that and lets us ship
the new UI quickly.
