# Samanvay — AICTE complaint monitoring (SIH 2026 · PS 26264)

Samanvay ("coordination") is a single-window dashboard for AICTE. It tracks complaint cases about technical institutions across the Public Grievance Redressal Cell (PGRC), the Regulation Bureau (RB), the eight Regional Offices and other cells.

Complaints about the same institution reach different bureaus with different spellings, such as "SVIT Engg Clg", "Sri Venkatesa Inst. of Tech." and "S.V. Institute of Technology". Samanvay:

1. **Matches every complaint to an institution**: AICTE ID first, then alias, acronym, initials and fuzzy name matching, with city and pincode. Every match shows a confidence % and written reasons.
2. **Detects overlaps**: **L1** is the same institution open in more than one bureau. **L2** is the same issue raised twice in different words.
3. **Raises "Potential Overlapping Cases – Coordination Required"**, groups the cases into a cluster, suggests a lead bureau and gives the bureaus a shared notes thread.
4. **Tracks every case**: SLA timers, auto-escalation, a hash-chained audit trail, an institution risk score, and reports with PDF and Excel export.

**Golden rule:** the system recommends and officers decide. Nothing is merged, closed or acted on automatically. Every automated link can be confirmed, changed or undone, and every action is audited.

> **All data is synthetic, and every institution name is fictional.** Any resemblance to a real institution is unintended.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

There is no backend and no environment variables are needed. After `npm install` everything works offline, including the bundled Inter font and the client-side PDF and Excel export.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Vitest unit tests for the matching and overlap engine |
| `npm run check:hero` | Prints the match for the three hero spellings and seed quality statistics |
| `npm run lint` | ESLint (`next/core-web-vitals`) |

On first load, the browser builds the synthetic database: 500 institutions and 2,000 complaints from seed 2026, with the matching engine run on every complaint. This takes 1–3 seconds. Changes are kept in `localStorage` as a small overlay on the deterministic seed. **Demo → Reset demo data** clears them.

## Demo script (about 5 minutes)

Open **Demo** (top right) → **Play guided demo**. The tour drives the real UI:

1. **PGRC registers "SVIT Engg Clg – certificates withheld".** The live panel links the abbreviation to *Sri Venkatesa Institute of Technology* (`1-4417XXXXXX`) at 93%, with the reasons "Abbreviation match: SVIT" and "Same city: Chennai". After submitting, a notice says it repeats an old, disposed RO-South complaint (L2, similarity 0.90). No coordination is needed, because that case is closed.
2. **RB registers "Sri Venkatesa Inst. of Tech." – excess fees.** It is a different spelling of the same institution.
3. **The overlap alert fires**: *Potential Overlapping Cases – Coordination Required*, with the suggested lead *Regulation Bureau*. Both bureaus are notified.
4. **The cluster view** shows the institution at the centre and the cases around it, coloured by bureau. Overdue cases have a red outline and the L2 "same issue? 0.90" link is dashed. *Why these cases were linked* shows each raw text, its confidence and its reasons.
5. **Accept the lead and add a shared note.** Both are written to every case timeline and to the audit log.
6. **The clock jumps 7 days.** Cases breach their SLA and the SLA monitor escalates them (Officer → Deputy Director → Director). The escalation log shows who each case went to and when.

The tour starts from a clean "demo" dataset in which the hero institution's complaints are not yet registered. **Reset demo data** returns to the full dataset, which reproduces the reference screens. In the full dataset the hero institution has three open cases:

| Case | As written | Category | Bureau / officer | SLA |
|---|---|---|---|---|
| `PG/2026/08841` | "SVIT Engg Clg, Chennai" | Certificates withheld | PGRC · A. Kumar | 4 days left |
| `RB/2026/01273` | "Sri Venkatesa Inst. of Tech." | Excess fee collection | RB · S. Iyer | 18 days left |
| `PG/2026/09105` | "S.V. Institute of Technology" | Salary not paid | PGRC · R. Das | overdue by 6 days |

It also has one disposed RO-South case from 2025 (`RO/2025/03318`).

Other things to try:

- **Ctrl K / ⌘K**: search by institution, alias (`SVIT`), AICTE ID or case ID.
- **Demo → Time travel** (+1, +7 or +30 days) runs the SLA monitor live.
- **Needs confirmation**: confirm a low-confidence match. The spelling is learnt as an alias and overlap detection runs again.
- **Settings** (System Admin): changing the match threshold, L2 threshold, SLA days or abbreviations takes effect immediately and is audited.
- **Audit Log → Verify chain** recomputes every SHA-256 hash.
- **Reports**: every report exports to PDF (with the Samanvay header) and Excel. The *Model quality* card shows match accuracy, look-alike false-link rate and L1/L2 recall, measured on the synthetic set.

## Roles (mock sign-in)

| Role | Officer | Sees |
|---|---|---|
| PGRC Officer | A. Kumar | PGRC cases, plus every overlap alert involving PGRC |
| RB Officer | S. Iyer | RB cases, plus every overlap alert involving RB |
| Regional Officer | per region | That Regional Office's cases and alerts |
| Senior Management | Dr. N. Rao | Everything, read-only, with national dashboards |
| System Admin | K. Menon | Settings and the full audit log |

Visibility is enforced in the API layer, not only in the UI. Complainant phone and e-mail are masked for everyone except the assigned officer. Reveals and unmasked views are audited.

## Architecture

```
UI (Next.js App Router, Tailwind, Radix/shadcn-style primitives, Recharts, Cytoscape)
   │  TanStack Query hooks only (src/api/hooks.ts)
   ▼
SamanvayApi interface (src/api/types.ts) ──► MockApi (src/api/mockApi.ts): role checks, masking, audit, 150–400 ms latency
   │                                          swap for an HTTP client against FastAPI (docs/api-contract.md)
   ▼
In-memory DB (src/mock/db.ts) ◄── deterministic seed (src/mock/seed.ts) + localStorage overlay
   │
Engine (src/engine/): normalize · match · similarity (Jaro-Winkler, token-set, TF-IDF) · overlap · risk · classify
```

```
src/
  app/(auth)/login/              role picker
  app/(app)/                     shell layout + pages: overview, cases, cases/[caseId], needs-confirmation,
                                 overlaps, overlaps/[clusterId], institutions, institutions/[aicteId], sla, reports, audit, settings
  components/{shell,cases,overlaps,charts,demo,common,ui}/
  engine/                        pure TypeScript matching / overlap / risk (+ __tests__)
  mock/                          seed, names, messiness, texts, rng, db
  api/                           types, client, mockApi, analytics, hooks
  store/                         session, demo, filters, role (Zustand)
  lib/                           types, constants, utils, export, audit-hash
docs/api-contract.md             REST contract for the backend team
scripts/check-hero.ts            prints hero matches and seed statistics
```

## Synthetic data

- **Seed 2026**, identical on every run. It contains 500 fictional institutions across all regions and 2,000 complaints from the last 9 months.
- Institution text is made messy on purpose: acronyms, initials, `Engg`, `Inst.`, `Clg`, 1–2 character typos, dropped words, a missing city, and `Chennai-600XXX` suffixes. The AICTE ID is missing in about 70% of complaints.
- Planted structure: 40 L1 clusters (2–4 bureaus each), 15 L2 same-issue pairs, and 20 look-alike institution pairs in the same city. A hidden ground-truth table drives the *Model quality* card.
- Statuses: about 80% disposed, 20% open, and 5% beyond SLA. Complaint intake rises gently over the 9 months.

## Known gaps and deviations

- The brief's reference screenshots (`design-ref/`) were not in the workspace. The UI follows the written spec: tokens, layouts and the banner text.
- The open share is about 20%, not the brief's ~40%. With SLAs of 7–45 days and only ~5% beyond SLA, 40% open would force most complaints into the final month and the trend chart would show an artificial spike.
- The hero AICTE ID is the literal `1-4417XXXXXX` from the brief. All other IDs are 10 digits.
- There is no real authentication and no backend. File attachments are stored as file names only.
- The engine uses TF-IDF with a synonym map for L2. The planned backend would use sentence embeddings.

## License

[MIT](LICENSE) © 2026 Phantom-deluxe06
