/**
 * In-memory mock database. The seed is deterministic, so localStorage only stores an *overlay*
 * (changed/new cases, clusters, audit, notifications, settings, clock). Every storage access is wrapped
 * in try/catch so the app keeps working when storage is blocked.
 */
import { ANCHOR, DEFAULT_SETTINGS } from '@/lib/constants';
import type { AppNotification, AuditEvent, BureauCode, Case, CaseAction, Cluster, Institution, Settings } from '@/lib/types';
import { GENESIS_HASH, sealEvent } from '@/lib/audit-hash';
import { buildIndex, type MatchIndex } from '@/engine/match';
import { detectOverlaps, isOpen, suggestLead } from '@/engine/overlap';
import { buildIdf, type Idf } from '@/engine/similarity';
import { generateSeed, nextActionFor, type GroundTruth, type Scenario } from './seed';

const STORAGE_KEY = 'samanvay.db.v1';
const DAY = 86_400_000;

export interface DbState {
  scenario: Scenario;
  institutions: Institution[];
  cases: Case[];
  clusters: Cluster[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  settings: Settings;
  clockOffsetDays: number;
  /** Real time when this demo session started; the demo clock flows from ANCHOR at real speed. */
  startedRealMs: number;
  counters: Record<string, number>;
  truth: GroundTruth;
}

interface Overlay {
  v: 1;
  scenario: Scenario;
  cases: Case[];
  newInstitutions: Institution[];
  aliasAdditions: Record<string, string[]>;
  clusters: Cluster[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  settings: Settings;
  clockOffsetDays: number;
  startedRealMs: number;
  counters: Record<string, number>;
}

export class Db {
  state: DbState;
  caseById = new Map<string, Case>();
  instById = new Map<string, Institution>();
  index!: MatchIndex;
  idf!: Idf;
  private dirtyCases = new Set<string>();
  private newInstIds = new Set<string>();
  private aliasAdds: Record<string, string[]> = {};
  private seededCaseIds = new Set<string>();
  private auditQueue: Promise<unknown> = Promise.resolve();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every write; lets callers cache derived data. */
  version = 0;

  constructor(state: DbState) {
    this.state = state;
    this.rebuildCaches();
  }

  // ───────────── clock ─────────────
  now(): Date {
    const elapsed = Math.max(0, Date.now() - this.state.startedRealMs);
    return new Date(ANCHOR.getTime() + this.state.clockOffsetDays * DAY + elapsed);
  }

  // ───────────── caches ─────────────
  rebuildCaches() {
    this.caseById = new Map(this.state.cases.map((c) => [c.caseId, c]));
    this.instById = new Map(this.state.institutions.map((i) => [i.aicteId, i]));
    this.rebuildIndex();
    this.idf = buildIdf(this.state.cases.map((c) => c.description));
  }
  rebuildIndex() {
    this.index = buildIndex(this.state.institutions, this.state.settings.abbreviations);
  }

  // ───────────── writes ─────────────
  touch(c: Case) {
    this.dirtyCases.add(c.caseId);
    this.changed();
  }
  changed() {
    this.version++;
    this.schedulePersist();
  }

  addCase(c: Case) {
    this.state.cases.push(c);
    this.caseById.set(c.caseId, c);
    this.idf = buildIdf(this.state.cases.map((x) => x.description));
    this.touch(c);
  }

  addInstitution(inst: Institution) {
    this.state.institutions.push(inst);
    this.instById.set(inst.aicteId, inst);
    this.newInstIds.add(inst.aicteId);
    this.rebuildIndex();
    this.changed();
  }

  addAlias(aicteId: string, alias: string) {
    const inst = this.instById.get(aicteId);
    if (!inst) return;
    const clean = alias.replace(/\(?\s*AICTE[^)]*\)?/i, '').replace(/\s+/g, ' ').trim().replace(/[,-]\s*$/, '');
    if (!clean || inst.aliases.some((a) => a.toLowerCase() === clean.toLowerCase()) || inst.name.toLowerCase() === clean.toLowerCase()) return;
    inst.aliases.push(clean);
    inst.learntAliases = [...(inst.learntAliases ?? []), clean];
    if (!this.newInstIds.has(aicteId)) (this.aliasAdds[aicteId] ??= []).push(clean);
    this.rebuildIndex();
    this.changed();
  }

  nextCaseId(bureau: BureauCode): string {
    const prefix = bureau === 'PGRC' ? 'PG' : bureau === 'RB' ? 'RB' : bureau === 'OTHER' ? 'OC' : 'RO';
    const key = `${prefix}/${this.now().getFullYear()}`;
    const n = this.state.counters[key] ?? 1;
    this.state.counters[key] = n + 1;
    return `${key}/${String(n).padStart(5, '0')}`;
  }

  nextId(prefix: string): string {
    const n = this.state.counters[prefix] ?? 1001;
    this.state.counters[prefix] = n + 1;
    return `${prefix}-${n}`;
  }

  addAction(c: Case, a: Omit<CaseAction, 'id' | 'at'> & { at?: string }) {
    const action: CaseAction = { id: `a${c.actions.length + 1}-${Date.now() % 100000}`, at: a.at ?? this.now().toISOString(), ...a };
    c.actions.push(action);
    c.actions.sort((x, y) => x.at.localeCompare(y.at));
    const last = c.actions[c.actions.length - 1];
    c.lastAction = `${last.type} · ${new Date(last.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    this.touch(c);
    return action;
  }

  notify(n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
    this.state.notifications.unshift({ ...n, id: this.nextId('N'), at: this.now().toISOString(), read: false });
    if (this.state.notifications.length > 300) this.state.notifications.length = 300;
    this.changed();
  }

  /** Append to the hash-chained audit log. Writes are serialised so the chain is always linear. */
  audit(e: { actor: string; role: string; action: string; target: string; detail?: string; at?: string }): Promise<AuditEvent> {
    const p = this.auditQueue.then(async () => {
      const prev = this.state.audit[this.state.audit.length - 1]?.hash ?? GENESIS_HASH;
      const ev = await sealEvent(prev, { id: `EV-${String(this.state.audit.length + 1).padStart(6, '0')}`, at: e.at ?? this.now().toISOString(), actor: e.actor, role: e.role, action: e.action, target: e.target, detail: e.detail });
      this.state.audit.push(ev);
      this.changed();
      return ev;
    });
    this.auditQueue = p.catch(() => undefined);
    return p;
  }

  // ───────────── clusters ─────────────
  casesOf(aicteId: string): Case[] {
    return this.state.cases.filter((c) => c.match.aicteId === aicteId);
  }

  /**
   * Recompute L1/L2 clusters for one institution. Never merges or closes cases — it only groups them
   * for officers to review. Dismissed clusters stay dismissed unless a new case arrives.
   */
  syncClusters(aicteId: string, at?: string): { created: Cluster[]; updated: Cluster[] } {
    const created: Cluster[] = [];
    const updated: Cluster[] = [];
    const all = this.casesOf(aicteId);
    const open = all.filter(isOpen);
    const live = (c: Cluster) => c.status === 'Open' || c.status === 'Coordinating';
    const atIso = at ?? this.now().toISOString();

    // L1 — same institution, open in more than one bureau
    if (new Set(open.map((c) => c.bureau)).size >= 2) {
      const ids = open.map((c) => c.caseId);
      const existing = this.state.clusters.find((cl) => cl.aicteId === aicteId && cl.level === 'L1-institution' && live(cl));
      const dismissed = this.state.clusters.filter((cl) => cl.aicteId === aicteId && cl.level === 'L1-institution' && !live(cl));
      if (existing) {
        const add = ids.filter((id) => !existing.caseIds.includes(id));
        if (add.length) {
          existing.caseIds.push(...add);
          if (!existing.leadAccepted) existing.suggestedLead = suggestLead(existing.caseIds.map((id) => this.caseById.get(id)!).filter(Boolean));
          updated.push(existing);
        }
        open.forEach((c) => (c.clusterId = existing.clusterId));
      } else if (!dismissed.some((d) => ids.every((id) => d.caseIds.includes(id)))) {
        const cl: Cluster = {
          clusterId: this.nextId('CL'), aicteId, caseIds: ids, level: 'L1-institution', suggestedLead: suggestLead(open),
          sharedNotes: [], createdAt: at ?? open.map((c) => c.receivedAt).sort().pop()!, status: 'Open',
        };
        this.state.clusters.push(cl);
        open.forEach((c) => (c.clusterId = cl.clusterId));
        created.push(cl);
      }
    }

    // L2 — same issue raised twice in different words
    const seen = new Set<string>();
    for (const c of open) {
      const { l2 } = detectOverlaps(c, all, { idf: this.idf, l2Threshold: this.state.settings.l2Threshold });
      for (const hit of l2) {
        const pair = [c.caseId, hit.case.caseId].sort();
        const key = pair.join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const exists = this.state.clusters.find((cl) => cl.level === 'L2-same-issue' && cl.caseIds.length === 2 && cl.caseIds.includes(pair[0]) && cl.caseIds.includes(pair[1]));
        if (exists) continue;
        const members = pair.map((id) => this.caseById.get(id)!);
        const cl: Cluster = {
          clusterId: this.nextId('CL'), aicteId, caseIds: pair, level: 'L2-same-issue', similarity: hit.similarity,
          suggestedLead: suggestLead(members), sharedNotes: [], createdAt: at ?? members.map((m) => m.receivedAt).sort().pop()!, status: 'Open',
        };
        this.state.clusters.push(cl);
        members.forEach((m) => (m.l2ClusterIds = [...(m.l2ClusterIds ?? []), cl.clusterId]));
        created.push(cl);
      }
    }
    if (created.length || updated.length) {
      [...created, ...updated].forEach((cl) => cl.caseIds.forEach((id) => this.dirtyCases.add(id)));
      this.changed();
    }
    void atIso;
    return { created, updated };
  }

  // ───────────── SLA sweep ─────────────
  /** Auto-escalate open cases past their expected disposal date. Returns escalated cases. */
  slaSweep(opts: { silent?: boolean } = {}): { escalated: Case[]; reminders: Case[] } {
    const now = this.now().getTime();
    const chain = this.state.settings.escalationChain;
    const step = this.state.settings.escalationStepDays;
    const escalated: Case[] = [];
    const reminders: Case[] = [];
    for (const c of this.state.cases) {
      if (!isOpen(c)) continue;
      const due = new Date(c.expectedDisposal).getTime();
      const overdueDays = Math.floor((now - due) / DAY);
      const level = c.escalationLevel ?? 0;
      const targetLevel = overdueDays >= 1 + step ? 2 : overdueDays >= 1 ? 1 : 0;
      if (targetLevel > level) {
        for (let l = level + 1; l <= Math.min(targetLevel, chain.length - 1); l++) {
          const at = new Date(due + DAY * (l === 1 ? 1 : 1 + step)).toISOString();
          c.escalationLevel = l;
          c.escalatedTo = chain[l];
          c.escalatedAt = at;
          this.addAction(c, { at, by: 'System · SLA monitor', bureau: c.bureau, type: 'Escalated', remarks: `SLA of ${c.slaDays} days breached — auto-escalated to ${chain[l]}` });
        }
        escalated.push(c);
        if (!opts.silent) {
          this.notify({ kind: 'escalation', title: `${c.caseId} escalated to ${c.escalatedTo}`, body: `${c.category} · overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`, href: `/cases/${encodeURIComponent(c.caseId)}`, bureau: c.bureau });
          void this.audit({ actor: 'System · SLA monitor', role: 'System', action: 'Auto-escalation', target: c.caseId, detail: `Overdue ${overdueDays}d → ${c.escalatedTo}` });
        }
      } else if (!opts.silent && overdueDays < 0 && overdueDays >= -3) {
        const href = `/cases/${encodeURIComponent(c.caseId)}`;
        if (!this.state.notifications.some((n) => n.kind === 'sla' && n.href === href)) {
          this.notify({ kind: 'sla', title: `${c.caseId} due in ${-overdueDays} day${overdueDays === -1 ? '' : 's'}`, body: `${c.category} · ${c.officer}`, href, bureau: c.bureau });
          reminders.push(c);
        }
      }
    }
    return { escalated, reminders };
  }

  // ───────────── persistence ─────────────
  markSeeded() {
    this.seededCaseIds = new Set(this.state.cases.map((c) => c.caseId));
    this.dirtyCases.clear();
  }

  private flushHooked = false;

  private schedulePersist() {
    if (typeof window === 'undefined') return;
    if (!this.flushHooked) {
      // Never lose a write made just before the tab is reloaded, closed or hidden.
      this.flushHooked = true;
      const flush = () => {
        if (!this.persistTimer) return;
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
        this.persistNow();
      };
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    }
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, 400);
  }

  persistNow() {
    if (typeof window === 'undefined') return;
    const overlay: Overlay = {
      v: 1,
      scenario: this.state.scenario,
      cases: [...this.dirtyCases].map((id) => this.caseById.get(id)!).filter(Boolean),
      newInstitutions: this.state.institutions.filter((i) => this.newInstIds.has(i.aicteId)),
      aliasAdditions: this.aliasAdds,
      clusters: this.state.clusters,
      audit: this.state.audit,
      notifications: this.state.notifications,
      settings: this.state.settings,
      clockOffsetDays: this.state.clockOffsetDays,
      startedRealMs: this.state.startedRealMs,
      counters: this.state.counters,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    } catch {
      // Storage blocked or full: keep working in memory.
    }
  }

  applyOverlay(o: Overlay) {
    for (const inst of o.newInstitutions) {
      this.state.institutions.push(inst);
      this.newInstIds.add(inst.aicteId);
    }
    this.instById = new Map(this.state.institutions.map((i) => [i.aicteId, i]));
    for (const [id, aliases] of Object.entries(o.aliasAdditions)) {
      const inst = this.instById.get(id);
      if (!inst) continue;
      for (const a of aliases) if (!inst.aliases.includes(a)) inst.aliases.push(a);
      inst.learntAliases = [...new Set([...(inst.learntAliases ?? []), ...aliases])];
    }
    this.aliasAdds = o.aliasAdditions;
    const byId = new Map(this.state.cases.map((c, i) => [c.caseId, i]));
    for (const c of o.cases) {
      const i = byId.get(c.caseId);
      if (i === undefined) this.state.cases.push(c);
      else this.state.cases[i] = c;
      this.dirtyCases.add(c.caseId);
    }
    this.state.clusters = o.clusters;
    this.state.audit = o.audit;
    this.state.notifications = o.notifications;
    this.state.settings = { ...DEFAULT_SETTINGS, ...o.settings };
    this.state.clockOffsetDays = o.clockOffsetDays;
    this.state.startedRealMs = o.startedRealMs;
    this.state.counters = o.counters;
    this.rebuildCaches();
  }

  isSeededCase(id: string) {
    return this.seededCaseIds.has(id);
  }
}

// ───────────── bootstrap ─────────────

function readOverlay(): Overlay | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Overlay;
    return o?.v === 1 ? o : null;
  } catch {
    return null;
  }
}

export function clearStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Build a fresh database from the deterministic seed (clusters and SLA state included). */
export async function buildFreshDb(scenario: Scenario, withAudit = true): Promise<Db> {
  const seed = generateSeed(scenario);
  const db = new Db({
    scenario,
    institutions: seed.institutions,
    cases: seed.cases,
    clusters: [],
    audit: [],
    notifications: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    clockOffsetDays: 0,
    startedRealMs: Date.now(),
    counters: seed.counters,
    truth: seed.truth,
  });
  // Pretend the clock is frozen at ANCHOR while seeding so results are identical on every run.
  const realNow = db.now.bind(db);
  db.now = () => new Date(ANCHOR.getTime());

  const ids = [...new Set(seed.cases.map((c) => c.match.aicteId).filter((x): x is string => !!x))];
  const created: Cluster[] = [];
  for (const id of ids) created.push(...db.syncClusters(id).created);
  db.state.clusters.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const cl of db.state.clusters) {
    for (const cid of cl.caseIds) {
      const c = db.caseById.get(cid)!;
      if (cl.level === 'L1-institution' && !c.actions.some((a) => a.type === 'Linked to cluster')) {
        c.actions.push({ id: `al-${cl.clusterId}`, at: cl.createdAt, by: 'System · overlap engine', bureau: c.bureau, type: 'Linked to cluster', remarks: `Potential overlap ${cl.clusterId} — ${cl.caseIds.length} cases on the same institution` });
        c.actions.sort((x, y) => x.at.localeCompare(y.at));
      }
    }
  }
  db.slaSweep({ silent: true });
  for (const c of db.state.cases) if (!c.nextAction) c.nextAction = nextActionFor(c.status);

  // Seed notifications: recent overlaps for the bureaus involved
  const recent = db.state.clusters.filter((cl) => ANCHOR.getTime() - new Date(cl.createdAt).getTime() < 21 * DAY);
  for (const cl of recent.slice(-12)) {
    const inst = db.instById.get(cl.aicteId)!;
    const bureaus = new Set(cl.caseIds.map((id) => db.caseById.get(id)!.bureau));
    for (const b of bureaus) {
      db.state.notifications.unshift({
        id: db.nextId('N'), at: cl.createdAt, kind: 'overlap', read: false, bureau: b,
        title: cl.level === 'L1-institution' ? 'Potential overlapping cases' : 'Same issue raised twice',
        body: `${inst.name} · ${cl.caseIds.length} cases`, href: `/overlaps/${cl.clusterId}`,
      });
    }
  }
  db.state.notifications.sort((a, b) => b.at.localeCompare(a.at));

  if (withAudit) {
    await db.audit({ actor: 'System', role: 'System', action: 'Demo data seeded', target: 'database', detail: `${seed.institutions.length} institutions, ${seed.cases.length} cases, seed 2026 (${scenario})`, at: new Date(ANCHOR.getTime() - 60_000).toISOString() });
    for (const cl of db.state.clusters.filter((c) => new Date(c.createdAt).getTime() > ANCHOR.getTime() - 45 * DAY)) {
      await db.audit({ actor: 'System · overlap engine', role: 'System', action: cl.level === 'L1-institution' ? 'Overlap detected (L1)' : 'Same-issue detected (L2)', target: cl.clusterId, detail: `${cl.aicteId} · ${cl.caseIds.join(', ')}`, at: new Date(ANCHOR.getTime() - 50_000).toISOString() });
    }
  }
  db.now = realNow;
  db.markSeeded();
  return db;
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const overlay = readOverlay();
      const db = await buildFreshDb(overlay?.scenario ?? 'full', !overlay);
      if (overlay) {
        try {
          db.applyOverlay(overlay);
        } catch {
          clearStorage();
          return buildFreshDb('full');
        }
      } else {
        db.persistNow();
      }
      return db;
    })();
  }
  return dbPromise;
}

/** Re-seed and clear storage. */
export async function resetDb(scenario: Scenario = 'full'): Promise<Db> {
  clearStorage();
  dbPromise = buildFreshDb(scenario).then((db) => {
    db.persistNow();
    return db;
  });
  return dbPromise;
}
