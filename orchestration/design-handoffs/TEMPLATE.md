# Design handoff — v__ (export YYYY-MM-DD)

> Fill this in with the export. Read [`../DESIGN-SYNC-CONTRACT.md`](../DESIGN-SYNC-CONTRACT.md) first.

## 1. Summary
One paragraph: what this version changes and why.

## 2. Scope confirmation (must be true before export)
- [ ] No hard-coded credentials in shipped code.
- [ ] No private/gated content baked into HTML.
- [ ] Shared engine files (`vip.js`, `minerva.js`, `config.js`) not restructured.
- [ ] Wired-page script order preserved.
- [ ] New `data-i18n` keys resolve in all 8 languages (added, not renamed).
- [ ] One canonical tree; no `dist/`, no nested duplicate, no `.jsx`/preview in the deployable set.
- [ ] Package filename and this note state the same version.

## 3. Changed / new files
List **every** changed and new file, grouped.

**Safe / design-owned (take as-is):**
-

**Wiring-bearing (markup/UI only — Cowork re-applies wiring):**
-

**New pages:**
-

**Dropped / do not ship:**
-

## 4. New features
For each: what it does, which pages, and any new `data-i18n` keys.

## 5. Features that need backend wiring
For each: entity (what data), audience (who can see/do it), action (read/write/notify).
Flag anything implemented against localStorage in the prototype.

## 6. Open questions for Cowork / Steve
-

---

## Merge outcome (filled in by Cowork after the merge)
- Shipped:
- Held / deferred:
- Backend work created:
- Deployment-log version:
