# Technical Brief — Public / Private (gated content) Architecture

**To:** Claude design **· From:** Tom (Cowork) **· Date:** 2026-06-16
**Purpose:** so you can repackage restricted surfaces (Aegis, Sovereign, About-Us, gated footer)
with the **exact structure the live engine expects**. Pairs with `DESIGN-SYNC-CONTRACT.md` §1.3.

---

## 1. The principle

Restricted content is **never present in the static HTML** — not even hidden by CSS. The page ships
as an **empty public shell**; the live engine (`assets/vip.js`) fetches the real content from Supabase
(`public.protected_content`, behind Row-Level Security) and injects it **only** for an authorised
session. Anonymous / lapsed visitors get an empty shell with **no trace** of the content in page
source — no lock screen, no message, no redirect.

So for any gated surface, design delivers **two things**:
1. The **shell markup** (a placeholder), in the page.
2. The **actual restricted copy** as text **in the handoff note** — Cowork loads it into
   `protected_content`. It does **not** go in the HTML.

---

## 2. Clearance model

```
super-admin ⊃ admin ⊃ { vip , heritage[ commissioner ⊃ custodian ⊃ admirer ] } ⊃ public
```

`vip.js` resolves the caller's role from the Supabase session (`profiles`) — never from the browser.
Gating decisions and content fetches happen **after** the session resolves.

---

## 3. Two gating mechanisms

### A. Full-page gate — the whole `<main>` is restricted
Used by **`aegis.html`**, **`sovereign.html`**. The visitor without access sees an empty page.

### B. In-page section gate — only part of a public page is restricted
Used by **`about.html`** (the **Team** section is gated; the rest of About is public).

Both use the same three moving parts (head guard, body attribute, placeholder div) — they differ only
in the `data-vip-restrict` value (`full` vs `team`) and which elements the guard hides.

---

## 4. The exact shell pattern (copy this)

**4.1 — Head:** add the checking-guard before content paints, so nothing flashes:
```html
<script>document.documentElement.classList.add('vip-checking');</script>
<style id="vip-guard">
  /* full-page gate */
  html.vip-checking body[data-vip-restrict="full"] main{visibility:hidden;}
  /* in-page (Team) gate */
  html.vip-checking .team-grid,
  html.vip-checking [data-i18n="about.teamHead"]{visibility:hidden;}
</style>
```

**4.2 — Body:** declare the restriction level on `<body>`:
```html
<body class="inner" data-vip-restrict="full">   <!-- aegis / sovereign -->
<body class="inner" data-vip-restrict="team">   <!-- about.html (only the Team block is gated) -->
```

**4.3 — Placeholder:** put an **empty** container with the content key where the content should appear.
Nothing else — no real copy:
```html
<main data-screen-label="Aegis">
  <!-- Public shell. Real content lives in public.protected_content (key 'aegis')
       and is injected by assets/vip.js for an authorised session only. -->
  <div data-protected="aegis"></div>
</main>
```

That's the whole contract on the page side. **Do not** add the hypercar specs, programme text, team
bios, etc. into the markup.

---

## 5. What the engine does (so you understand the states)

`vip.js` runs after the Supabase session resolves and then:

- **Has access:** `loadProtected(key, container)` → `select body_html from protected_content where
  key = '<key>'` → injects the HTML into `[data-protected="<key>"]`, then removes `vip-checking`
  (content reveals).
- **No access:** `finishGating(false)` → `gateMenu()` hides VIP-only menu items, and
  `denyFullSilent()` / `denyTeamSilent()` removes the protected region entirely. A denied full page
  also gets `html.vip-denied-full body[data-vip-restrict="full"] main{display:none!important;}`.
- **No client configured / anonymous:** behaves as no-access (shell stays empty, guard removed).

Net effect: the three states are **checking** (hidden), **authed-with-access** (injected + revealed),
**no-access** (silently empty). You only build the shell; the engine drives all three.

---

## 6. Content keys (current)

| Surface | Page | `data-protected` key | `data-vip-restrict` | Min. clearance |
|---|---|---|---|---|
| Aegis hypercar page | `aegis.html` | `aegis` | `full` | VIP / staff |
| Sovereign page | `sovereign.html` | `sovereign` | `full` | VIP / staff |
| About-Us — Team section | `about.html` | `team` | `team` | VIP / staff |

If v18 makes **About-Us a full gated page** (your latest direction), use `data-vip-restrict="full"` on
`about.html` and a single `<div data-protected="about"></div>` shell, and deliver the About copy as
text for a new `about` key. Tell us the intended clearance for each new key in the handoff note.

---

## 7. Footer — public vs private variant

**Keep doing what v18 did: emit NO static footer.** The live `assets/minerva.js` injects the footer on
every page (`injectFooter()`), translates it, and is the right place to serve a **public** vs
**private (VIP/staff)** variant by session. So:

- Design ships pages with **no `<footer>`** markup.
- If you want the private footer to differ (extra links/sections for VIP/staff), **describe the
  private variant's contents in the handoff note** (links, labels, i18n keys). Cowork implements the
  variant + the gating in `minerva.js`. Don't bake the private footer into pages or into a static JS
  array that ships to anonymous users.

---

## 8. Menus & other VIP-only chrome

VIP-only **menu items** are hidden by `gateMenu()` at runtime — you may include them in the menu
markup (they're just links, not secret content), and the engine hides them for non-VIP. Only **content**
(prose, specs, bios, images that are themselves confidential) must use the `protected_content` pattern.
If a menu label itself is sensitive, treat it as content and gate it.

---

## 9. Pre-export checklist (gated surfaces)

- [ ] Restricted pages ship as **empty shells**: head guard + `data-vip-restrict` + `<div data-protected="key"></div>`.
- [ ] **Zero** restricted prose/specs/bios in any HTML (verify by viewing page source logged-out).
- [ ] No CSS-`visibility`/`display:none`-only gating standing in for the engine pattern.
- [ ] No static `<footer>`; private-footer contents (if any) described in the handoff note, not baked.
- [ ] Each `data-protected` key + its restricted copy + intended clearance listed in the handoff note
      for `protected_content` loading.
- [ ] VIP-only menu links may stay in markup (engine hides them); confidential labels treated as content.

---

### Appendix — live reference
`aegis.html` on `main` today is a ~20-line shell whose entire `<main>` is `<div data-protected="aegis"></div>`.
The Aegis copy is **not** in the file. Mirror that for every restricted surface.
