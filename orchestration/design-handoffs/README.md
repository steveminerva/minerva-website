# Design handoffs

One markdown note per design export, so Cowork can plan each merge from a checklist instead of
reverse-engineering the package.

## How it works
1. Claude design finishes a new UI version and exports the package.
2. It adds a note here named **`YYYY-MM-DD-vNN.md`** (export date + version), based on
   [`TEMPLATE.md`](./TEMPLATE.md).
3. Cowork reads the note, merges per the [Design ↔ Deployment Sync Contract](../DESIGN-SYNC-CONTRACT.md),
   and records the outcome (what shipped, what was held, what needs backend) back into the same note.

## Conventions
- **Filename:** `YYYY-MM-DD-vNN.md` — e.g. `2026-06-16-v16.md`. One file per drop; don't overwrite old ones.
- The note is the **contract for that drop**: every changed file, what's new, and anything needing backend.
- Keep notes even after merge — they are the running history of how the design and the live site converged.

## Index
| Date | Version | Status | Note |
|---|---|---|---|
| 2026-06-16 | v16 (brief: "v17") | Superseded by v18 | [2026-06-16-v16.md](./2026-06-16-v16.md) |
| 2026-06-16 | v18 (reworked) | PASS w/ 1 fix — restricted pages | [2026-06-16-v18.md](./2026-06-16-v18.md) |
