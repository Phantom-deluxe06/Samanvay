# Prompt for Claude Code — Samanvay frontend (SIH 2026 · PS 26264)

> Paste everything below this line into Claude Code, in an empty folder. Put the 4 reference screenshots (`ref_case_register.png`, `ref_case_cluster.png`, `ref_overview.png`, `ref_institution_profile.png`) and `ref_mockups.html` into a folder called `design-ref/` first, so Claude Code can look at them.

---

## 0. What you are building

Build the **complete frontend** of **Samanvay** (Hindi: "coordination"). It is an AI-assisted, single-window dashboard for **AICTE (All India Council for Technical Education)**. It monitors and tracks complaint cases about technical institutions across AICTE's Bureaus and Cells:
- **PGRC**: Public Grievance Redressal Cell
- **RB**: Regulation Bureau
- **Regional Offices (RO)**: Southern, Western, Northern, Eastern, Central, South-Western, North-Western, Northern-Eastern
- other cells

This is for **Smart India Hackathon 2026, problem statement SIH26264**. The prototype must run fully **in the browser with no backend**. All data comes from a seeded synthetic data generator and a mock service layer. That layer must sit behind a typed API client, so a FastAPI backend can replace it later without UI changes.

**The core idea, which the demo must show convincingly:** complaints about the *same institution* reach different bureaus, often with *different spellings* ("SVIT Engg Clg", "Sri Venkatesa Inst. of Tech.", "S.V. Institute of Technology"). Samanvay does four things:
1. It **matches every complaint to the right institution**, using the AICTE Permanent ID first, then fuzzy name, city/pincode and alias matching. Every match shows a **confidence %** and a **written reason**.
2. It **detects overlaps at two levels**:
   - **L1:** the same institution has open cases in more than one Bureau/Cell.
   - **L2:** the same *issue* has been raised twice in different words (text similarity).
3. It raises the alert **"Potential Overlapping Cases – Coordination Required"**. The alert forms a **case cluster** with a **suggested lead bureau** and **shared notes**.
4. It tracks every case with **SLA timers, auto-escalation, a full audit trail, an institution risk score and reports**.

**Golden rule:** the system never closes, merges or acts on a case by itself. It recommends, and officers decide. Every automated link must be confirmable or reversible by a human, and every such action must be logged.

## 1. Tech stack (use exactly this)

- **Next.js 14+ (App Router) + TypeScript (strict)**
- **Tailwind CSS** and **shadcn/ui** (Radix) for primitives: Dialog, Sheet, Tabs, Select, Popover, Command, Toast, Tooltip, DropdownMenu, Table
- **lucide-react** for icons
- **Recharts** for charts
- **Cytoscape.js** via `react-cytoscapejs` for the case-cluster graph
- **TanStack Table v8** for data tables, with sorting, filtering, pagination and column visibility
- **TanStack Query** for data fetching against the mock API, so swapping in a real API is trivial
- **Zustand** for UI and session state: current role, demo clock, filters
- **react-hook-form + zod** for forms and validation
- **date-fns** for dates
- **@faker-js/faker** with a **fixed seed**, so the data is identical on every run
- **jspdf + jspdf-autotable** and **xlsx (SheetJS)** for client-side PDF and Excel export
- Persistence: keep the mock database in memory and mirror it to `localStorage`. Wrap every read and write in try/catch so the app still works if storage is blocked. Add a "Reset demo data" button.
- Package manager: npm. Must run with `npm install && npm run dev`. No environment variables are required.

## 2. Visual design (match the reference screenshots in `design-ref/`)

Look at all 4 PNGs and `ref_mockups.html` before writing UI code, and match their layout and feel.

**Design tokens.** Put them in `tailwind.config.ts` and CSS variables:

| Token | Value | Use |
|---|---|---|
| `navy` | `#0F2A52` | sidebar background, primary text headings, primary dark buttons |
| `navy-2` | `#1F4B8A` | active sidebar item |
| `blue` | `#1A6FC4` | primary actions, PGRC tag, links |
| `saffron` | `#F39C34` | brand accent ("VAY" in logo), overlap alerts, highlights |
| `orange-dark` | `#E67E22` | RB tag text, warning |
| `green` | `#1E8449` | success, disposed, Regional Office tag |
| `red` | `#C0392B` | overdue, SLA breach, high risk |
| `amber` | `#D68910` | due soon / medium risk |
| `bg` | `#EEF2F7` | app background |
| `card` | `#FFFFFF` with border `#D6DFEB`, radius 10px | cards |
| `muted` | `#5B6B82` | secondary text |

**Bureau tag colours** (pill badges):
- PGRC: bg `#E3ECFA`, text `#1F4B8A`
- RB: bg `#FDEBD8`, text `#A35A0A`
- RO: bg `#E4F4EA`, text `#1E8449`
- Other cells: bg `#EFE9F7`, text `#7A5CA8`

**Status pills:**
- Overdue: `#FBE1DE` / `#C0392B`
- Under process / Inquiry initiated: `#FFF1D6` / `#A36A00`
- Disposed: `#DFF3E6` / `#1E8449`
- Transferred: `#E3ECFA` / `#1F4B8A`
- Escalated: solid red

**Type:** Inter (via `next/font`). Page titles 22px bold. Card titles 14px semibold. Tables 13px.

**App shell:**
- **Left sidebar:** fixed, 220px, navy.
  - Logo text "SAMAN**VAY**", with "VAY" in saffron and a small subtitle "AICTE Complaint Monitoring".
  - Nav items: **Overview, Case Register, Overlap Alerts (with red count badge), Institutions, SLA & Escalations, Reports, Audit Log, Settings**. The active item uses the `navy-2` background.
  - At the bottom: the logged-in role and officer name, and a "Switch role" button.
- **Top bar:** page title on the left. On the right:
  - a global search (⌘K command palette) that searches institution name, alias, AICTE ID and case ID
  - a notifications bell with unread count
  - a role pill such as "RB Officer · Southern Region"
  - a **Demo controls** button (see §9)
- The sidebar collapses to icons under 1024px. The app must be usable at 1280×720, because that is the projector size.
- Show a small grey footer line on every page: "Prototype · synthetic data · SIH 2026 PS 26264".

**The overlap alert banner** must look like the reference:
- Background `#FFF4E5`, a 1.5px `#F39C34` border, radius 10px, and an orange circle with a white "!" on the left.
- Bold title "Potential Overlapping Cases – Coordination Required".
- Body text: "<Institution> (AICTE ID …) has **N active cases** across **PGRC** and **RB**. Suggested lead: Regulation Bureau."
- Buttons: "View cluster", "Accept lead", "Not related".

## 3. Roles (mock login, no real authentication)

`/login` shows a role picker with cards. Selecting a card sets the role in Zustand and in localStorage.
- **PGRC Officer**: sees PGRC cases, plus all overlap alerts that involve them.
- **RB Officer**: sees RB cases, plus overlap alerts that involve them.
- **Regional Officer**: picks a region and sees that region's cases.
- **Senior Management**: sees everything read-only, plus national dashboards and reports.
- **System Admin**: sees Settings (SLA rules, categories, thresholds) and the full audit log.

Enforce role-based visibility in the mock API layer, not only by hiding UI. Complainant contact details are **masked** (for example `98XXXXXX21`) for every role except the assigned officer. Every role switch and every view of an unmasked field is written to the audit log.

## 4. Data model (`/src/lib/types.ts`)

```ts
type BureauCode = 'PGRC' | 'RB' | 'RO-S' | 'RO-W' | 'RO-N' | 'RO-E' | 'RO-C' | 'RO-SW' | 'RO-NW' | 'RO-NE' | 'OTHER';
type CaseStatus = 'Received' | 'Under process' | 'Inquiry initiated' | 'Transferred' | 'Escalated' | 'Disposed';
type Category = 'Certificates withheld' | 'Excess fee collection' | 'Salary not paid' | 'Ragging' | 'Infrastructure / lab' |
                'Faculty shortage' | 'Unapproved intake' | 'Admission irregularity' | 'Scholarship / refund' | 'Other';

interface Institution {
  aicteId: string;            // format "1-XXXXXXXXXX" (synthetic)
  name: string;               // canonical name
  aliases: string[];          // known spellings learnt from confirmed matches
  type: 'Engineering' | 'Management' | 'Polytechnic' | 'Pharmacy' | 'Architecture' | 'MCA';
  city: string; district: string; state: string; pincode: string;
  region: 'Southern' | 'Western' | 'Northern' | 'Eastern' | 'Central' | 'South-Western' | 'North-Western' | 'North-Eastern';
  approvedIntake: number;
}

interface MatchResult {
  aicteId: string | null;
  confidence: number;          // 0–100
  reasons: string[];           // e.g. ["Abbreviation match: SVIT", "Same city: Chennai", "Pincode 600XXX", "AICTE ID found in attachment"]
  method: 'exact-id' | 'alias' | 'fuzzy' | 'manual';
  confirmedBy?: string;        // officer name when a human confirmed
  candidates?: { aicteId: string; name: string; confidence: number }[]; // top-3 for the confirm queue
}

interface CaseAction {
  id: string; at: string; by: string; bureau: BureauCode;
  type: 'Registered' | 'Assigned' | 'Notice issued' | 'Inquiry initiated' | 'Transferred' | 'Escalated' |
        'Linked to cluster' | 'Unlinked' | 'Lead accepted' | 'Note added' | 'Disposed' | 'Match confirmed' | 'Match rejected';
  remarks?: string; attachments?: string[];
}

interface Case {
  caseId: string;              // "PG/2026/08841", "RB/2026/01273", "RO/2026/00412"
  receivedAt: string;
  rawInstitutionText: string;  // exactly as the complainant wrote it (messy)
  match: MatchResult;
  category: Category;
  description: string;
  complainant: { type: 'Student' | 'Parent' | 'Faculty' | 'Staff' | 'Other'; name: string; phone: string; email: string };
  bureau: BureauCode; officer: string; status: CaseStatus;
  lastAction: string; nextAction: string; expectedDisposal: string; slaDays: number;
  clusterId?: string; actions: CaseAction[];
}

interface Cluster {
  clusterId: string; aicteId: string; caseIds: string[];
  level: 'L1-institution' | 'L2-same-issue';
  similarity?: number;         // for L2
  suggestedLead: BureauCode; leadAccepted?: boolean;
  sharedNotes: { at: string; by: string; bureau: BureauCode; text: string }[];
  createdAt: string; status: 'Open' | 'Coordinating' | 'Resolved' | 'Dismissed';
}

interface AuditEvent { id: string; at: string; actor: string; role: string; action: string; target: string; detail?: string; prevHash: string; hash: string; }
```

The audit log is **hash-chained**: `hash = sha256(prevHash + JSON(event))`, computed with Web Crypto. The Audit Log page has a **"Verify chain"** button that recomputes every hash and shows "Chain intact ✓" or the first broken record.

## 5. Synthetic data generator (`/src/mock/seed.ts`, fixed seed 2026)

- **~500 institutions** spread across all regions and states, with realistic Indian-style but **fictional** names (for example "Sri Venkatesa Institute of Technology", "Kaveri College of Engineering", "Narmada Engineering College", "Annai Polytechnic", "Deccan Institute of Management Studies", "Himgiri Polytechnic"). **Never use real college names.**
- **~2,000 complaints** over the last 9 months. Generate the institution text with a **messiness function**: abbreviations (SVIT), dropped words ("Inst." / "Engg" / "Clg"), initials ("S.V."), typos (1–2 character edits), missing city, missing AICTE ID in about 70% of cases, and extra words ("College, Chennai-600XXX").
- **Plant overlaps on purpose:** about 40 L1 clusters (same institution, 2–4 bureaus) and about 15 L2 pairs (same issue, different wording, for example "college not returning my original marksheet" and "certificates withheld after I left"). Keep a hidden ground-truth table so the Reports page can show **match accuracy and overlap-detection recall on the synthetic set**. Label that section clearly as "measured on synthetic data".
- **Plant about 20 look-alike institution pairs** in the same city with similar names, so the confirm queue has realistic work.
- Spread statuses realistically: about 60% disposed, plus pending, under process and transferred cases, and about 5% beyond SLA.
- **The hero demo institution** must be "Sri Venkatesa Institute of Technology", AICTE ID `1-4417XXXXXX`, Chennai, Southern Region, with exactly these 3 open cases:
  1. `PG/2026/08841`: "SVIT Engg Clg, Chennai", Certificates withheld, PGRC, A. Kumar, Under process, 4 days left
  2. `RB/2026/01273`: "Sri Venkatesa Inst. of Tech.", Excess fee collection, RB, S. Iyer, Inquiry initiated, 18 days left
  3. `PG/2026/09105`: "S.V. Institute of Technology", Salary not paid, PGRC, R. Das, overdue by 6 days

  Also add one disposed RO-South case from 2025. This must reproduce the reference screenshots.

## 6. Matching and overlap engine (runs in the browser, `/src/engine/`)

Implement this as pure, unit-tested TypeScript functions. A backend will later use the same algorithms in Python with RapidFuzz and Sentence-Transformers.

- `normalize(text)`: lowercase, strip punctuation, expand abbreviations (engg→engineering, inst→institute, clg/coll→college, tech→technology, mgmt→management, poly→polytechnic, univ→university), remove stop-words ("of", "the", "and"), and extract pincode, city and any `1-\d+` AICTE ID.
- `acronym(name)`: "Sri Venkatesa Institute of Technology" → "svit"; also produce initials variants ("sv institute of technology").
- `matchInstitution(raw, institutions)` works in this order:
  1. If an exact AICTE ID is found, confidence 99, method `exact-id`.
  2. If an exact alias or acronym matches in the same city, confidence 92–96.
  3. Otherwise, fuzzy matching with a **Jaro-Winkler + token-set ratio** blend on the normalized names, plus a city/district/pincode bonus, capped at 95.
  4. Return the top 3 candidates.

  Every match returns **human-readable reasons**.
- **Threshold 85%** (configurable in Settings). At or above it, the match is auto-linked. Below it, the case goes to the **"Needs confirmation" queue**, where the officer picks from the top-3 candidates or searches. Confirming adds the raw text to `institution.aliases` ("learnt alias") and writes to the audit log.
- `detectOverlaps(case, allCases)` has two levels:
  - **L1:** other *open* cases with the same `aicteId` in a *different* bureau.
  - **L2:** the same `aicteId` with similar complaint text. Use TF-IDF cosine similarity over the descriptions plus a category-synonym map, with similarity ≥ 0.75. Show the score, for example "same issue? 0.81".
- `suggestLead(cluster)`: the regulatory-action bureau (RB) leads if any RB case is in the cluster; otherwise the bureau with the oldest open case.
- `riskScore(institution)`, 0–100: the weighted sum of open cases, severity weights by category (ragging and salary are high), the number of distinct bureaus involved, overdue cases and the 3-year case count. Show the breakdown in a tooltip.
- Write **Vitest** tests: the 3 hero spellings must all match `1-4417XXXXXX` with confidence ≥ 85; look-alike pairs must *not* auto-link; and L1 and L2 detection must work on the hero cluster.

## 7. Pages and features (all must work end to end with mock data)

1. **`/login`**: role picker (see §3), plus the Samanvay logo and a tagline.

2. **`/overview`** (Senior Management default; others see a scoped version). Match the reference "National Overview":
   - **6 KPI cards:** Total cases, Pending, Under process, Disposed, Beyond SLA, Overlap clusters. Clicking a card opens the Case Register with that filter.
   - **Bureau/Cell workload:** horizontal bar chart of open cases.
   - **Pending case ageing:** a 0–15 / 16–30 / 31–60 / 60+ days column chart, green to red.
   - **Institutions needing attention:** top 10 by risk score, with region, open cases, bureaus and a coloured risk value.
   - **Region map or grid:** an India region tile grid (no external map tiles needed) coloured by open cases.
   - **Monthly trend:** cases received vs disposed over the last 9 months (line chart).
   - Global filters: date range, region, category.

3. **`/cases`** (Case Register). Match the reference:
   - The overlap alert banner appears at the top when the current role has an open cluster.
   - The table columns are Case ID, Received, Institution (*as written*), Linked to (AICTE ID · confidence %, red when part of a cluster), Category, Bureau tag, Officer, Status pill, and SLA (days left / +overdue, colour-coded).
   - Filters: bureau, region, category, status, date range, "only overlapping", "needs confirmation". Free-text search covers institution, alias, AICTE ID and case ID.
   - Bulk select lets the user export the selection to PDF or Excel.
   - A **"New complaint"** button opens the intake form (see 4).

4. **New complaint intake** (Sheet or Dialog, with react-hook-form + zod):
   - Fields: bureau (prefilled from role), complainant details, institution as written (free text), optional AICTE ID, city, category (with a "suggest" button that keyword-classifies the description), description, attachments (file names only).
   - **Live matching panel:** as the user types the institution text, show the best match with its confidence bar and reason chips, plus 2 alternatives.
   - On submit, run overlap detection. If an overlap is found, show a **toast and a modal** "Potential Overlapping Cases – Coordination Required" listing the other cases, with an "Open cluster" button. Add a bell notification for the officers of the other bureaus.
   - This is the **key demo moment**. It must feel instant and polished, with a subtle animation.

5. **`/cases/[caseId]`** (Case detail):
   - Header with Case ID, status, bureau, officer, SLA countdown, and actions: Update status, Transfer, Escalate, Add note, Dispose with remarks.
   - **Match panel:** raw text → matched institution, confidence, reasons, method, and who confirmed it. Buttons: "Change match" and "Unlink".
   - **Linked cases:** cluster mini-graph and list.
   - **Timeline:** every action with timestamp, officer, bureau and remarks.
   - Masked complainant contact, with a "reveal" button that is audited.

6. **`/overlaps`** (Overlap Alerts):
   - A list of clusters (L1 / L2 badge, institution, number of cases, bureaus, age, status), with filters.
   - **`/overlaps/[clusterId]`** (Cluster view), matching the reference "Case Cluster":
     - **Left:** a Cytoscape graph with the institution node in the centre (navy, showing name, ID and risk label) and case nodes around it, coloured by bureau and outlined red if overdue. L2 links are shown as dashed orange edges labelled "same issue? 0.81". Clicking a node opens the case drawer.
     - **Right:** a **"Why these cases were linked"** card (per case: raw text → confidence and reason chips), and a **Coordination** card (suggested lead bureau, shared notes thread, buttons **Accept lead**, **Link cases**, **Not related**).
     - "Not related" requires a reason. It dismisses the cluster and records the decision in the audit log.

7. **`/institutions`**: a searchable table (name, AICTE ID, city, region, open cases, total cases, risk score with sparkline).
   - **`/institutions/[aicteId]`**, matching the reference "Institution Profile":
     - details, known aliases as chips (including learnt ones), a big risk score with breakdown, open cases, bureaus involved, 3-year case count and average disposal days
     - a full chronological **action history (audit trail)** across all bureaus, with coloured dots (blue for actions, orange for system alerts, red for escalations)
     - category breakdown donut, and a cases-per-month chart

8. **`/needs-confirmation`** (a tab or sub-route of Case Register): the queue of low-confidence matches, showing raw text, top-3 candidates with confidence and reasons, and Confirm / Pick other / Create new institution actions. The counter is shown in the sidebar.

9. **`/sla`** (SLA & Escalations):
   - Cases due in 3 days, cases overdue, and the escalation log.
   - SLA rules come from Settings (days per category, for example ragging 7, certificates 15, fees 30) with an escalation chain (Officer → Deputy Director → Director).
   - Breach rows show who the case escalated to and when.

10. **`/reports`**:
    - Institution-wise, region-wise, bureau-wise, status-wise, ageing analysis, disposal rate, overlapping/duplicate cases, and monthly or quarterly performance. Each report has a chart and a table and exports to **PDF** (with the Samanvay header and generated-on time) and **Excel**.
    - Add a **"Model quality (synthetic test set)"** card: institution-match accuracy, false-link rate on look-alikes, and L1/L2 overlap recall, computed live against the ground truth.

11. **`/audit`**: a filterable, hash-chained audit log, with the "Verify chain" button and CSV export.

12. **`/settings`** (Admin only): match threshold slider (default 85), L2 similarity threshold (default 0.75), SLA days per category, escalation chain, categories list, bureau list, and abbreviation dictionary. Changes take effect immediately and are audited.

13. **Notifications** (bell dropdown): overlap alerts, SLA reminders and escalations. Clicking one goes to the target.

## 8. Mock API layer (`/src/api/`)

- Define an interface `SamanvayApi` with typed methods:
  - `listCases(filters)`, `getCase(id)`, `createCase(input)`, `updateCase(id, patch)`, `addAction(id, action)`
  - `listClusters()`, `getCluster(id)`, `decideCluster(id, decision)`
  - `listInstitutions()`, `getInstitution(id)`, `confirmMatch(caseId, aicteId)`
  - `getOverview(filters)`, `getReports(type, filters)`, `listAudit(filters)`, `getSettings()`, `updateSettings()`
- Implement `MockApi` over the in-memory DB with a random **150–400 ms delay**, so loading states are visible. All UI uses TanStack Query hooks (`useCases`, `useCluster`, and so on), never the DB directly.
- Add `/docs/api-contract.md` describing each endpoint (REST paths, request and response JSON), so the backend team can build the FastAPI version.

## 9. Demo controls (critical for judging)

A floating "Demo" button opens a panel with:
- **Reset demo data**: re-seeds and clears localStorage.
- **Play guided demo**: a step-by-step overlay of 6 steps.
  1. As PGRC, register "SVIT Engg Clg – certificates withheld".
  2. Switch to RB and register "Sri Venkatesa Inst. of Tech. – excess fees".
  3. The overlap alert fires.
  4. Open the cluster and show why the cases were linked.
  5. Accept the lead bureau and add a shared note.
  6. Show a case breaching its SLA and auto-escalating.

  Use the real UI with highlights and Next/Back. Do not use fake screenshots.
- **Time travel**: jump the demo clock forward 1, 7 or 30 days, so SLA breaches and escalations happen live.
- **Role quick-switch**.

## 10. Quality bar and acceptance criteria

- `npm run dev` works on a fresh clone, and `npm run build` passes with **no TypeScript or ESLint errors**.
- Every nav item opens a working page, and no page is a placeholder or "coming soon".
- Every page has loading skeletons, empty states and error states.
- The 6-step guided demo runs start to finish without errors.
- The 3 hero spellings link to the same institution, and the alert fires on the second complaint.
- PDF and Excel exports open correctly.
- Keyboard accessible: focus rings, ⌘K palette, Esc closes dialogs. Colour contrast is at least WCAG AA. Status is never shown by colour alone; always include text.
- Looks right at 1280×720 and 1920×1080.
- Vitest unit tests for the engine pass (`npm test`).
- `README.md` covers how to run, the demo script, the folder structure, and the fact that "all data is synthetic; institution names are fictional".

## 11. Folder structure

```
src/
  app/(auth)/login/page.tsx
  app/(app)/layout.tsx            # sidebar + topbar shell
  app/(app)/overview/page.tsx
  app/(app)/cases/page.tsx  app/(app)/cases/[caseId]/page.tsx
  app/(app)/needs-confirmation/page.tsx
  app/(app)/overlaps/page.tsx  app/(app)/overlaps/[clusterId]/page.tsx
  app/(app)/institutions/page.tsx  app/(app)/institutions/[aicteId]/page.tsx
  app/(app)/sla/page.tsx  app/(app)/reports/page.tsx  app/(app)/audit/page.tsx  app/(app)/settings/page.tsx
  components/{shell,cases,overlaps,institutions,charts,demo,common}/
  engine/{normalize,match,overlap,risk,similarity}.ts  (+ __tests__)
  mock/{seed,names,messiness,db}.ts
  api/{types,client,mockApi,hooks}.ts
  store/{session,demo,filters}.ts
  lib/{types,utils,export,audit-hash}.ts
docs/api-contract.md
```

## 12. How to work

1. Read `design-ref/` first, then scaffold the project, the theme tokens and the app shell. Show me the shell running before building pages.
2. Build the seed data and the engine with tests. Print the match results for the 3 hero spellings to confirm they work.
3. Build the pages in this order: Case Register → New complaint + live match + overlap alert → Cluster view → Case detail → Institution profile → Overview → Needs confirmation → SLA → Reports → Audit → Settings → Demo controls.
4. After each page, run `npm run build` and fix all errors before moving on.
5. At the end, run the full guided demo yourself and fix anything that breaks. Then give me a short summary of what's done and any known gaps.

Do not add a backend, authentication provider, external map tiles or paid APIs. Keep everything runnable offline after `npm install`.
