# Samanvay API contract (v1)

This is the contract the FastAPI backend should implement so it can replace the in-browser `MockApi` without UI changes. The TypeScript source of truth is `src/api/types.ts` (`SamanvayApi` and the DTOs) and `src/lib/types.ts` (domain types). Field names below match those types exactly.

- Base URL: `/api/v1`
- Format: JSON, UTF-8. Timestamps are ISO-8601 strings with offset (`2026-10-27T10:00:00+05:30` or UTC `Z`).
- Auth: the prototype has a mock role picker. The backend should read the officer and role from a bearer token. Every rule below ("visible to", "masked for") must be enforced **server-side**.
- Errors: `{ "detail": "message" }` with `400` (validation), `403` (role not allowed), `404` (not found).
- Case IDs contain `/` (`PG/2026/08841`). URL-encode them in paths (`PG%2F2026%2F08841`).

## Roles and visibility

| Role | Sees | Can change |
|---|---|---|
| `PGRC`, `RB` | Own bureau's cases, plus cases in any open cluster that involves their bureau | Own bureau's cases; notes on visible cases; cluster decisions |
| `RO` (with `region`) | That Regional Office's cases, plus clusters that involve it | Same as above, for its RO |
| `SENIOR` | Everything | Nothing (read-only) |
| `ADMIN` | Everything | Everything, including settings |

**Masking.** `complainant.phone` and `complainant.email` are masked (`98XXXXXX21`, `pr…@gmail.com`) for everyone except the assigned officer, and the response sets `contactMasked: true`. An unmasked view by the assigned officer and every reveal are written to the audit log.

## Domain objects (abridged)

```jsonc
// Institution
{ "aicteId": "1-4417XXXXXX", "name": "Sri Venkatesa Institute of Technology", "aliases": ["SVIT"], "learntAliases": [],
  "type": "Engineering", "city": "Chennai", "district": "Chennai", "state": "Tamil Nadu", "pincode": "600097",
  "region": "Southern", "approvedIntake": 720 }

// MatchResult
{ "aicteId": "1-4417XXXXXX" /* null when below threshold */, "confidence": 93,
  "reasons": ["Abbreviation match: SVIT", "Same city: Chennai"], "method": "alias" /* exact-id | alias | fuzzy | manual */,
  "confirmedBy": "A. Kumar" /* when a human confirmed */, "candidates": [{ "aicteId": "…", "name": "…", "city": "…", "confidence": 93, "reasons": ["…"] }] }

// CaseView = Case + derived fields
{ "caseId": "PG/2026/08841", "receivedAt": "…", "rawInstitutionText": "SVIT Engg Clg, Chennai", "match": { /* MatchResult */ },
  "category": "Certificates withheld", "description": "…",
  "complainant": { "type": "Student", "name": "…", "phone": "98XXXXXX21", "email": "…" }, "contactMasked": true,
  "bureau": "PGRC", "officer": "A. Kumar", "status": "Under process", "lastAction": "Notice issued · 19 Oct",
  "nextAction": "Await institution reply to notice", "expectedDisposal": "…", "slaDays": 15,
  "clusterId": "CL-1001", "l2ClusterIds": ["CL-1002"], "escalationLevel": 0, "escalatedTo": null, "disposedAt": null,
  "actions": [{ "id": "a1", "at": "…", "by": "Intake desk", "bureau": "PGRC", "type": "Registered", "remarks": "…" }],
  // derived
  "institution": { "aicteId": "…", "name": "…", "city": "…", "region": "Southern" }, "region": "Southern",
  "daysLeft": 4, "overdue": false, "inCluster": true, "canEdit": true }

// Cluster
{ "clusterId": "CL-1001", "aicteId": "1-4417XXXXXX", "caseIds": ["PG/2026/08841", "RB/2026/01273", "PG/2026/09105"],
  "level": "L1-institution" /* or L2-same-issue */, "similarity": 0.9 /* L2 only */, "suggestedLead": "RB", "leadAccepted": false,
  "sharedNotes": [{ "at": "…", "by": "S. Iyer", "bureau": "RB", "text": "…" }], "createdAt": "…",
  "status": "Open" /* Coordinating | Resolved | Dismissed */, "dismissedReason": null }

// AuditEvent — hash = sha256(prevHash + JSON({id, at, actor, role, action, target, detail}))
{ "id": "EV-000061", "at": "…", "actor": "A. Kumar", "role": "PGRC Officer", "action": "Match confirmed",
  "target": "PG/2026/08838", "detail": "…", "prevHash": "64 hex", "hash": "64 hex" }
```

## Endpoints

### Cases

| Method | Path | Request | Response |
|---|---|---|---|
| `listCases` | `GET /cases` | query: `q, bureau, region, category, status (CaseStatus \| Open \| Pending \| Overdue), from, to (YYYY-MM-DD), onlyOverlapping, needsConfirmation, aicteId` | `CaseView[]`, newest first, filtered by role |
| `getCase` | `GET /cases/{caseId}` | — | `CaseView` (`403` when the role cannot see it) |
| `createCase` | `POST /cases` | `CreateCaseInput` (below) | `CaseMutationResult` |
| `updateCase` | `PATCH /cases/{caseId}` | `{ "officer"?: string, "nextAction"?: string }` | `CaseView` |
| `addAction` | `POST /cases/{caseId}/actions` | `CaseActionInput` (below) | `CaseMutationResult` |
| `revealContact` | `POST /cases/{caseId}/reveal-contact` | — | `{ type, name, phone, email }` (audited) |
| `previewMatch` | `POST /match/preview` | `{ "raw": string, "aicteId"?: string, "city"?: string }` | `MatchResult` (no side effects; must be fast — called while typing) |

```jsonc
// CreateCaseInput
{ "bureau": "PGRC", "complainant": { "type": "Student", "name": "…", "phone": "9840012321", "email": "…" },
  "rawInstitutionText": "SVIT Engg Clg", "aicteId": "1-4417XXXXXX" /* optional */, "city": "Chennai" /* optional */,
  "category": "Certificates withheld", "description": "…", "attachments": ["fee_clearance.pdf"] }

// CaseActionInput — one of
{ "type": "status", "status": "Under process" | "Inquiry initiated" | "Escalated" | "Received", "remarks"?: "…" }
{ "type": "notice", "remarks": "…" }
{ "type": "transfer", "toBureau": "RB", "remarks": "…" }
{ "type": "escalate", "remarks": "…" }
{ "type": "note", "remarks": "…" }
{ "type": "dispose", "remarks": "…" }   // remarks mandatory

// CaseMutationResult
{ "case": { /* CaseView */ },
  "overlap": null | { "clusters": [ /* Cluster */ ], "related": [ /* CaseView */ ], "institution": { /* Institution */ },
                      "coordinationRequired": true } }
```

`createCase` must: (1) match the institution (threshold from settings), (2) write `Registered` and `Assigned` actions, (3) audit the registration and auto-link, (4) when linked, run overlap detection and create or extend clusters, notify every bureau involved and return `overlap`. `coordinationRequired` is `true` when another **open** case is involved (always for L1). It is `false` when the only link is an L2 match to a disposed complaint, which the UI shows as a "repeat complaint" notice instead of the alert. Below the threshold, the case goes to the confirmation queue and the owning bureau gets a notification.

### Matching and institutions

| Method | Path | Request | Response |
|---|---|---|---|
| `listInstitutions` | `GET /institutions` | query: `q` (name, alias, AICTE ID, city) | `InstitutionRow[]` = Institution + `openCases, totalCases, bureaus[], risk, spark[9]` |
| `getInstitution` | `GET /institutions/{aicteId}` | — | `InstitutionDetail` = row + `cases[], history[], categoryBreakdown[], monthly[12], threeYearCount, avgDisposalDays, clusters[]` |
| `createInstitution` | `POST /institutions` | `{ name, city, state, region, pincode, type }` | `Institution` with a provisional ID (audited) |
| `listQueue` | `GET /match/queue` | — | `{ case: CaseView, candidates: (MatchCandidate & { institution?: Institution })[] }[]` |
| `confirmMatch` | `POST /cases/{caseId}/match` | `{ "aicteId": "…" }` | `CaseMutationResult` — sets `method: "manual"`, `confirmedBy`, learns the raw text as an alias, re-runs overlap detection |
| `unlinkMatch` | `DELETE /cases/{caseId}/match` | `{ "reason": "…" }` | `CaseView` — detaches from clusters, returns the case to the queue |

`risk` is `{ score: 0–100, label: Low | Medium | High, parts: [{ label, value, points }] }`. The parts are open cases, severity of open issues, bureaus involved, overdue cases, and cases in the last 3 years.

### Clusters (overlap alerts)

| Method | Path | Request | Response |
|---|---|---|---|
| `listClusters` | `GET /clusters` | — | `ClusterView[]` visible to the role |
| `getCluster` | `GET /clusters/{clusterId}` | — | `ClusterView` |
| `decideCluster` | `POST /clusters/{clusterId}/decisions` | `ClusterDecision` | `ClusterView` |

```jsonc
// ClusterView = Cluster + 
{ "institution": { /* Institution */ }, "risk": { /* RiskBreakdown */ }, "cases": [ /* CaseView */ ],
  "extraCases": [ /* CaseView linked only by L2, e.g. an older disposed complaint */ ],
  "l2Edges": [{ "a": "PG/2026/08841", "b": "RO/2025/03318", "similarity": 0.9 }],
  "bureaus": ["PGRC", "RB"], "leadReason": "Regulation Bureau holds regulatory-action powers over the institution", "ageDays": 11 }

// ClusterDecision — one of
{ "type": "accept-lead", "lead"?: "RB" }
{ "type": "not-related", "reason": "…" }      // reason mandatory; status → Dismissed
{ "type": "note", "text": "…" }
{ "type": "link", "caseIds": ["…"] }
{ "type": "resolve", "remarks"?: "…" }
```

The system never merges, closes or acts on a case by itself. Every decision is made by an officer, written to each member case's timeline, and audited.

### Dashboards, reports and SLA

| Method | Path | Request | Response |
|---|---|---|---|
| `getOverview` | `GET /overview` | query: `from, to, region, category` | `Overview`: `kpis {total, pending, underProcess, disposed, beyondSla, clusters}`, `workload[]`, `ageing[]`, `attention[10]`, `regions[]`, `trend[9]`, `scope` |
| `getReports` | `GET /reports/{type}` | `type`: `institution \| region \| bureau \| status \| ageing \| disposal \| overlaps \| monthly \| quarterly`; same query as overview | `Report`: `{ type, title, description, columns[{key,label,numeric?}], rows[], chart{kind, xKey, series[], data[]} }` |
| `getModelQuality` | `GET /quality` | — | `{ casesEvaluated, autoLinkRate, matchAccuracy, lookalikeCases, lookalikeFalseLinkRate, l1Recall, l1Planted, l1Found, l2Recall, l2Planted, l2Found, threshold }` (needs a labelled evaluation set) |
| `getSla` | `GET /sla` | — | `{ dueSoon: CaseView[], overdue: CaseView[], escalations: [{ caseId, at, to, by, remarks, bureau, category, overdueDays }], rules, chain, stepDays }` |

Officer dashboards are scoped to the officer's own bureau. `SENIOR` and `ADMIN` see national figures.

### Audit, settings and notifications

| Method | Path | Request | Response |
|---|---|---|---|
| `listAudit` | `GET /audit` | query: `q, actor, action, limit` | `AuditEvent[]`, newest first. Officers see their own events and events on cases or clusters they can see. |
| `verifyAudit` | `POST /audit/verify` | — | `{ ok, checked, brokenAt?: { index, id, reason } }`. This call is itself audited. |
| `getSettings` | `GET /settings` | — | `Settings` |
| `updateSettings` | `PATCH /settings` | `Partial<Settings>` | `Settings` (ADMIN only; one audit event per changed key; SLA changes recompute `expectedDisposal` of open cases) |
| `listNotifications` | `GET /notifications` | — | `AppNotification[]` for the officer's bureau |
| `markNotificationsRead` | `POST /notifications/read` | `{ "ids"?: string[] }` (omit = all) | `204` |
| `getCounts` | `GET /counts` | — | `{ overlaps, queue, unread }` for the sidebar badges |

```jsonc
// Settings
{ "matchThreshold": 85, "l2Threshold": 0.75,
  "slaDays": { "Ragging": 7, "Certificates withheld": 15, "Excess fee collection": 30, "…": 30 },
  "escalationChain": ["Officer", "Deputy Director", "Director"], "escalationStepDays": 7,
  "categories": ["…"], "bureaus": ["PGRC", "RB", "RO-S", "…"], "abbreviations": { "engg": "engineering", "clg": "college" } }
```

### Prototype-only (do not ship)

`getClock` (`GET /demo/clock`), `advanceClock` (`POST /demo/clock {days}`, runs the SLA sweep), `resetDemo` (`POST /demo/reset {scenario}`) and `logRoleSwitch` exist only for the demo. In production, the SLA sweep is a scheduled job (for example hourly) that escalates open cases: Deputy Director on day 1 overdue, Director after `escalationStepDays` more.

## Engine notes for the Python port

The browser engine in `src/engine/` is the reference implementation. The Python port can use RapidFuzz and Sentence-Transformers, keeping the same order and outputs:

1. `normalize`: lowercase, extract `1-[0-9X]{10}` AICTE ID, pincode / `600XXX` prefix and a known city; expand abbreviations from settings; drop stop-words; merge initials (`S.V.` → `sv`).
2. `matchInstitution`: an exact AICTE ID scores 99 (`exact-id`). An exact alias, name or initials variant scores 92–96, and an acronym in the same city scores ~93 (`alias`). Otherwise a fuzzy blend of distinctive-token coverage, Jaro-Winkler and token-set ratio, plus city / pincode bonus, capped at 95. Look-alike guard: when the runner-up is within 6 points, cap at 80 so it never auto-links. Return the top 3 candidates with reasons.
3. `detectOverlaps`: L1 = other open cases on the same AICTE ID in a different bureau. L2 = TF-IDF cosine over concept-mapped complaint text (category-synonym map), blended with same-category, ≥ `l2Threshold`.
4. `suggestLead`: RB if present, else the bureau with the oldest open case.
5. `riskScore`: see `src/engine/risk.ts` for weights.
