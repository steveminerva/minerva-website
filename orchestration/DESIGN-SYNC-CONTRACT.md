# Minerva Website — Design ↔ Deployment Sync Contract

**Audience:** Claude design (and anyone exporting a new front-end build).
**Read this before you start a new UI version, and again before you export.**
**Maintained by:** Tom (lead developer) · **Repo:** `steveminerva/minerva-website` (UAT) · **Last updated:** 2026-06-16

---

## 0. Why this file exists

The live Minerva site is **two layers** that are built by **two different processes**:

1. **The front-end** (HTML/CSS/JS, 8-language UI) — designed and exported by **Claude design**.
2. **The backend wiring** (Supabase auth, Row-Level Security, edge functions, the secure admin
   console bridge) — built by **Cowork** and **not visible** in a design export.

Claude design's exports are **front-end-only**. They are not aware of the backend, and they ship a
**prototype data layer** (localStorage, demo seeds, a hard-coded admin password) that is fine for a
visual prototype but **must never reach production**. The live site is already **ahead** of every
design export on the backend.

Because of this, a design export is **never dropped over the live site**. Cowork merges the *visual
and content* changes and **re-applies the wiring**. This contract exists so those merges stay cheap,
predictable, and safe — and so design knows what it can and cannot change.

---

## 1. The golden rules (non-negotiable)

1. **Never assume your export is the source of truth for wiring.** The live engine and the secure
   backend win on every conflict. Design owns *look, layout, copy, structure, i18n*; it does **not**
   own *auth, data access, or gating logic*.
2. **Do not ship the prototype data layer to production.** No hard-coded credentials, no localStorage
   as the system of record, no demo seed arrays in shipped code.
3. **Do not bake private/gated content into HTML** (even if CSS-hidden). Anything VIP/staff/member-only
   lives in Supabase and is fetched per session. Hidden-but-present HTML is viewable in page source =
   a data leak. (This is why earlier `about/aegis/sovereign` static exports were held — and why v18
   was sent back to merge.) **The required pattern:**
   - Restricted full pages (`aegis.html`, `sovereign.html`, `about.html` Team section) must ship as an
     **empty public shell** containing a placeholder `<div data-protected="aegis|sovereign|team"></div>`.
     The live `vip.js` injects the real content into that div for an authorised session only.
     Hand the actual restricted copy over **as text in the handoff note** (for `protected_content`),
     **never** in the page markup. CSS `visibility`/`display:none` gating is **not** sufficient.
   - **Footer:** keep doing what v18 did — emit **no static footer**; the live `minerva.js` injects it
     and serves the **public vs private (VIP/staff)** variant by session. Don't bake the private footer
     variant into pages.
4. **Keep the shared engine files structurally stable** (see §3). Restructuring them forces a full
   re-merge of the wiring and is the single biggest source of deployment cost.
5. **Every export ships with a handoff note** in `orchestration/design-handoffs/` (see §6).

---

## 2. File classification — what design owns vs what is wired

| Class | Files | Design may change freely? |
|---|---|---|
| **Safe / design-owned** | `index, history, news, press, investors, archives, team, models, privacy, terms` (public pages); `assets/minerva.css`; `assets/i18n.js`, `assets/legal-i18n.js`, `assets/heritage-i18n.js` (dictionaries); `assets/image-slot.js`; all images/brand assets | **Yes** — taken as-is |
| **Wiring-bearing — merge required** | `assets/vip.js`, `assets/minerva.js`, `assets/config.js`, `assets/admin-app.js`, `assets/admin-bridge.js`; `login.html`, `register.html`, `admin.html`, `portal.html`, `account.html`, `about.html`, `aegis.html`, `sovereign.html` | **Markup/UI only** — never the logic |
| **Backend (not in a design export)** | `supabase/` migrations + edge functions | **No** — Cowork only |

### What the live engine actually is (so design doesn't fight it)
- **`assets/vip.js`** — live is **Supabase-backed and async** (auth + stores as Promises). The
  prototype `vip.js` you export is localStorage/synchronous; it is **discarded** on merge. Don't put
  app logic in `vip.js` expecting it to ship.
- **`assets/admin-app.js`** — the admin/portal SPA. It is allowed to be written against the
  synchronous prototype surface, **because** `assets/admin-bridge.js` adapts it onto the live async
  engine. If you add a whole new console section, expect a bridge-extension cost (see §4).
- **`assets/config.js`** — holds the real Supabase URL + publishable key. **Never overwrite.**
- **Script load order on wired pages is fixed:**
  `config.js → supabase-js → vip.js → admin-bridge.js → admin-app.js`.
  Keep these tags present and in this order on `admin.html`/`portal.html`. Don't substitute the
  prototype stack (`vip.js → admin-app.js` direct).

---

## 3. Conventions that keep merges cheap

Following these means a drop can often be taken with near-zero rework:

- **i18n is additive.** Add new keys; don't rename or restructure existing keys or the dictionary
  shape. All 8 languages (EN, NL, FR, DE, IT, ES, ZH, JA) must resolve for every new `data-i18n` key.
- **Reference assets by stable relative paths** (`assets/…`, `uploads/…`). Don't inline-bundle or
  rename shared assets.
- **New pages declare their data needs.** If a new page (e.g. a member screen) reads or writes data,
  say so in the handoff note: what entity, who can see it, what action. That tells Cowork what table /
  function / RLS to wire. Don't implement it against localStorage and assume it ships.
- **SEO/meta head block** is welcome and design-owned: per-page `title`/`description`/`canonical`/
  `robots`, favicon set, Open Graph + Twitter tags. Keep canonical/OG URLs pointing at the agreed
  domain (confirm before changing it).
- **Don't restructure `vip.js` / `minerva.js` / `config.js`.** Treat them as engine. If you think the
  engine needs to change, flag it in the handoff note rather than rewriting it.
- **Gating is the engine's job.** Mark gated regions with the agreed hooks/classes; let `vip.js` /
  `minerva.js` decide visibility at runtime. Don't hard-code who sees what in the page.

---

## 4. Already solved server-side — do NOT reimplement client-side

These exist and are secure on the backend. Shipping a client-side version **regresses** them:

| Feature | Lives on the backend as | So in the export… |
|---|---|---|
| Admin / user login | Supabase Auth + `profiles.is_admin` (no password in code) | never hard-code a password |
| Heritage decision emails (8 lang) | `heritage-decision` edge function + SMTP | don't compose/send mail client-side |
| Heritage self-registration | `heritage-register` edge function (hardened) | don't create members in localStorage |
| Minerva Concierge knowledge | `concierge_kb` table + role-gated `concierge` function (Mistral) | **drop** `concierge-knowledge.js`; a client KB leaks cross-role |
| Data access / who-sees-what | Row-Level Security per role/tier | don't gate by hiding HTML |

Anything still prototype-only (e.g. member notifications, push, invoices) should be **flagged in the
handoff note** as "needs a backend" rather than shipped as a localStorage feature.

---

## 5. Package hygiene (export format)

To avoid the ambiguity seen in past drops:

- Export **one canonical tree** at the package root. **No** `dist/` second copy, **no** nested
  duplicate folder, **no** stale partial builds.
- Keep **design artifacts out of the deployable set** (or in a clearly separate `/_design/` folder):
  `*.jsx`, preview HTML, device frames, "comparison"/"handoff" mockups are not deployable.
- Ship only **one** migrations story: don't include an old `0001_init.sql` that re-seeds a hard-coded
  password. Backend migrations are Cowork's; omit them unless coordinating a schema change.
- **Version naming must be unambiguous.** The package filename and the internal brief must state the
  same version. (Past drop: zip said "(16)", brief said "v17" — avoid this.)

---

## 6. Every export ships a handoff note

Drop a dated note in [`design-handoffs/`](./design-handoffs/) using
[`TEMPLATE.md`](./design-handoffs/TEMPLATE.md). It is the single artifact Cowork reads to plan the
merge: every changed file, what's genuinely new, and any feature that needs backend wiring. See
[`design-handoffs/README.md`](./design-handoffs/README.md) for how the folder works.

A good handoff note turns a multi-hour reverse-engineering job into a checklist.

---

## 7. Quick pre-export checklist (for design)

- [ ] No hard-coded credentials anywhere in shipped code.
- [ ] No private/gated content baked into HTML (gated by engine hooks, not hidden divs).
- [ ] Shared engine files (`vip.js`, `minerva.js`, `config.js`) not restructured.
- [ ] Wired-page script order preserved (`config → supabase-js → vip → admin-bridge → admin-app`).
- [ ] New/changed `data-i18n` keys resolve in all 8 languages; keys added, not renamed.
- [ ] Any new data-driven feature flagged as "needs backend" with entity + audience + action.
- [ ] One canonical tree; no `dist/`, no nested duplicate, no `.jsx`/preview artifacts in the deployable set.
- [ ] Package filename and internal brief state the same version number.
- [ ] Handoff note added in `orchestration/design-handoffs/`.
