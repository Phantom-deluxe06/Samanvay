import { BUREAU_NAMES, BUREAU_SHORT, OFFICERS, REGION_TO_BUREAU, ROLES } from '@/lib/constants';
import type { AppNotification, AuditEvent, BureauCode, Case, Cluster, Institution, MatchResult, Session, Settings } from '@/lib/types';
import { verifyChain } from '@/lib/audit-hash';
import { matchInstitution } from '@/engine/match';
import { isOpen, leadReason } from '@/engine/overlap';
import { issueSimilarity } from '@/engine/similarity';
import { riskScore } from '@/engine/risk';
import { getDb, resetDb, type Db } from '@/mock/db';
import { maskEmail, maskPhone } from '@/mock/messiness';
import { nextActionFor } from '@/mock/seed';
import { applyOverviewFilters, buildOverview, buildReport, institutionRows, monthKeys } from './analytics';
import type {
  AuditFilters, CaseActionInput, CaseFilters, CaseMutationResult, CasePatch, CaseView, ClusterDecision, ClusterView, Counts,
  CreateCaseInput, HistoryItem, InstitutionDetail, InstitutionRow, ModelQuality, NewInstitutionInput, Overview, OverviewFilters,
  QueueItem, Report, ReportType, SamanvayApi, SlaEscalation, SlaSummary,
} from './types';

const DAY = 86_400_000;

export class ApiError extends Error {
  constructor(message: string, public status: 403 | 404 | 400 = 400) {
    super(message);
  }
}

const delay = (min = 150, max = 400) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

function roleLabel(s: Session | null) {
  if (!s) return 'Anonymous';
  const r = ROLES.find((x) => x.id === s.role)!;
  return s.role === 'RO' && s.region ? `${r.label} · ${s.region}` : r.label;
}

export class MockApi implements SamanvayApi {
  private session: Session | null = null;

  setSession(session: Session | null) {
    this.session = session;
  }

  // ───────────── access helpers ─────────────
  private s(): Session {
    if (!this.session) throw new ApiError('Not signed in', 403);
    return this.session;
  }
  private bureauOf(s: Session): BureauCode | null {
    if (s.role === 'PGRC') return 'PGRC';
    if (s.role === 'RB') return 'RB';
    if (s.role === 'RO' && s.region) return REGION_TO_BUREAU[s.region];
    return null;
  }
  private seesAll(s: Session) {
    return s.role === 'SENIOR' || s.role === 'ADMIN';
  }
  private assertWrite(s: Session) {
    if (s.role === 'SENIOR') throw new ApiError('Senior Management has read-only access', 403);
  }
  private clusterBureaus(db: Db, cl: Cluster): Set<BureauCode> {
    return new Set(cl.caseIds.map((id) => db.caseById.get(id)?.bureau).filter((b): b is BureauCode => !!b));
  }
  private canSeeCluster(db: Db, s: Session, cl: Cluster) {
    if (this.seesAll(s)) return true;
    const b = this.bureauOf(s);
    return !!b && this.clusterBureaus(db, cl).has(b);
  }
  private canSeeCase(db: Db, s: Session, c: Case): boolean {
    if (this.seesAll(s)) return true;
    const b = this.bureauOf(s);
    if (!b) return false;
    if (c.bureau === b) return true;
    const ids = [c.clusterId, ...(c.l2ClusterIds ?? [])].filter(Boolean) as string[];
    return ids.some((id) => {
      const cl = db.state.clusters.find((x) => x.clusterId === id);
      return !!cl && cl.status !== 'Dismissed' && this.clusterBureaus(db, cl).has(b);
    });
  }
  private canEdit(s: Session, c: Case) {
    if (s.role === 'SENIOR') return false;
    if (s.role === 'ADMIN') return true;
    return c.bureau === this.bureauOf(s);
  }
  private actorBureau(s: Session): BureauCode {
    return this.bureauOf(s) ?? 'OTHER';
  }
  private view(db: Db, s: Session, c: Case): CaseView {
    const inst = c.match.aicteId ? db.instById.get(c.match.aicteId) : undefined;
    const now = db.now().getTime();
    const daysLeft = Math.ceil((new Date(c.expectedDisposal).getTime() - now) / DAY);
    const open = isOpen(c);
    const unmasked = s.officer === c.officer;
    const cl = c.clusterId ? db.state.clusters.find((x) => x.clusterId === c.clusterId) : undefined;
    return {
      ...c,
      actions: [...c.actions],
      complainant: unmasked ? { ...c.complainant } : { ...c.complainant, phone: maskPhone(c.complainant.phone), email: maskEmail(c.complainant.email) },
      contactMasked: !unmasked,
      institution: inst ? { aicteId: inst.aicteId, name: inst.name, city: inst.city, region: inst.region } : undefined,
      region: inst?.region,
      daysLeft,
      overdue: open && daysLeft < 0,
      inCluster: !!cl && (cl.status === 'Open' || cl.status === 'Coordinating') && open,
      canEdit: this.canEdit(s, c),
    };
  }
  private visibleCases(db: Db, s: Session): Case[] {
    return db.state.cases.filter((c) => this.canSeeCase(db, s, c));
  }
  /** Cases that count as "mine" for dashboards (own bureau, not cluster-shared ones). */
  private scopedCases(db: Db, s: Session): Case[] {
    if (this.seesAll(s)) return db.state.cases;
    const b = this.bureauOf(s);
    return db.state.cases.filter((c) => c.bureau === b);
  }
  private scopeLabel(s: Session) {
    if (this.seesAll(s)) return 'National · all bureaus';
    const b = this.bureauOf(s)!;
    return BUREAU_NAMES[b];
  }
  private getCaseOr404(db: Db, id: string): Case {
    const c = db.caseById.get(id);
    if (!c) throw new ApiError(`Case ${id} not found`, 404);
    return c;
  }
  private auditAs(db: Db, s: Session, action: string, target: string, detail?: string) {
    return db.audit({ actor: s.officer, role: roleLabel(s), action, target, detail });
  }

  // ───────────── session ─────────────
  async logRoleSwitch(session: Session) {
    const db = await getDb();
    await db.audit({ actor: session.officer, role: roleLabel(session), action: 'Role switched', target: 'session', detail: `Signed in as ${roleLabel(session)}` });
  }

  // ───────────── cases ─────────────
  async listCases(f: CaseFilters = {}): Promise<CaseView[]> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const q = f.q?.trim().toLowerCase();
    const now = db.now().getTime();
    const out: CaseView[] = [];
    for (const c of this.visibleCases(db, s)) {
      if (f.bureau && f.bureau !== 'ALL' && c.bureau !== f.bureau) continue;
      if (f.category && f.category !== 'ALL' && c.category !== f.category) continue;
      if (f.aicteId && c.match.aicteId !== f.aicteId) continue;
      if (f.from && c.receivedAt < f.from) continue;
      if (f.to && c.receivedAt > `${f.to}T23:59:59`) continue;
      if (f.needsConfirmation && (c.match.aicteId || !isOpen(c))) continue;
      const inst = c.match.aicteId ? db.instById.get(c.match.aicteId) : undefined;
      if (f.region && f.region !== 'ALL' && inst?.region !== f.region) continue;
      if (f.status && f.status !== 'ALL') {
        const overdue = isOpen(c) && new Date(c.expectedDisposal).getTime() < now;
        if (f.status === 'Open' || f.status === 'Pending') {
          if (!isOpen(c)) continue;
        } else if (f.status === 'Overdue') {
          if (!overdue) continue;
        } else if (c.status !== f.status) continue;
      }
      if (q) {
        const hay = [c.caseId, c.rawInstitutionText, c.match.aicteId ?? '', inst?.name ?? '', ...(inst?.aliases ?? []), c.officer, c.category].join(' ').toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const v = this.view(db, s, c);
      if (f.onlyOverlapping && !v.inCluster) continue;
      out.push(v);
    }
    return out.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  async getCase(id: string): Promise<CaseView> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const c = this.getCaseOr404(db, id);
    if (!this.canSeeCase(db, s, c)) {
      throw new ApiError(`${id} belongs to ${BUREAU_NAMES[c.bureau]}. Your role can only see it through the institution history.`, 403);
    }
    const v = this.view(db, s, c);
    if (!v.contactMasked) {
      // Unmasked view by the assigned officer — logged, at most once per 10 minutes per case.
      const recent = db.state.audit.slice(-50).some((e) => e.target === id && e.action === 'Viewed complainant contact' && e.actor === s.officer && db.now().getTime() - new Date(e.at).getTime() < 600_000);
      if (!recent) void this.auditAs(db, s, 'Viewed complainant contact', id, 'Assigned officer opened case with unmasked contact');
    }
    return v;
  }

  async previewMatch(raw: string, opts: { aicteId?: string; city?: string } = {}): Promise<MatchResult> {
    // Kept instant on purpose (live typing). The backend endpoint would be POST /match/preview.
    const db = await getDb();
    const text = [raw, opts.aicteId ? `(AICTE ID ${opts.aicteId})` : '', opts.city ? `, ${opts.city}` : ''].join(' ');
    return matchInstitution(text, db.index, { threshold: db.state.settings.matchThreshold });
  }

  async createCase(input: CreateCaseInput): Promise<CaseMutationResult> {
    await delay(250, 450);
    const db = await getDb();
    const s = this.s();
    this.assertWrite(s);
    const own = this.bureauOf(s);
    if (own && input.bureau !== own) throw new ApiError(`You can only register complaints for ${BUREAU_SHORT[own]}`, 403);
    const settings = db.state.settings;
    const matchText = [input.rawInstitutionText, input.aicteId ? `(AICTE ID ${input.aicteId})` : '', input.city ? `, ${input.city}` : ''].join(' ');
    const match = matchInstitution(matchText, db.index, { threshold: settings.matchThreshold });
    const now = db.now();
    const officer = own === input.bureau ? s.officer : OFFICERS[input.bureau][0];
    const c: Case = {
      caseId: db.nextCaseId(input.bureau),
      receivedAt: now.toISOString(),
      rawInstitutionText: input.rawInstitutionText.trim(),
      match,
      category: input.category,
      description: input.description.trim(),
      complainant: { ...input.complainant },
      bureau: input.bureau,
      officer,
      status: 'Received',
      lastAction: '',
      nextAction: nextActionFor('Received'),
      expectedDisposal: new Date(now.getTime() + settings.slaDays[input.category] * DAY).toISOString(),
      slaDays: settings.slaDays[input.category],
      attachments: input.attachments,
      actions: [],
    };
    db.addCase(c);
    db.addAction(c, { by: s.officer, bureau: input.bureau, type: 'Registered', remarks: 'Complaint registered via Samanvay intake', attachments: input.attachments.length ? input.attachments : undefined });
    db.addAction(c, { by: s.officer, bureau: input.bureau, type: 'Assigned', remarks: `Assigned to ${officer}` });
    await this.auditAs(db, s, 'Case registered', c.caseId, `Institution text “${c.rawInstitutionText}” → ${match.aicteId ?? 'needs confirmation'} (${match.confidence}%)`);
    if (match.aicteId) {
      await this.auditAs(db, s, 'Institution auto-linked', c.caseId, `${match.aicteId} · ${match.confidence}% · ${match.reasons.join('; ')}`);
    } else {
      db.notify({ kind: 'match', title: `${c.caseId} needs institution confirmation`, body: `“${c.rawInstitutionText}” · best guess ${match.candidates?.[0]?.name ?? '—'} (${match.confidence}%)`, href: '/needs-confirmation', bureau: c.bureau });
    }
    const overlap = match.aicteId ? await this.runOverlap(db, s, c) : null;
    return { case: this.view(db, s, c), overlap };
  }

  /** Run cluster sync after a case got (re)linked and raise alerts for everyone involved. */
  private async runOverlap(db: Db, s: Session, c: Case): Promise<CaseMutationResult['overlap']> {
    const aicteId = c.match.aicteId!;
    const { created, updated } = db.syncClusters(aicteId);
    const touched = [...created, ...updated].filter((cl) => cl.caseIds.includes(c.caseId));
    if (!touched.length) return null;
    const inst = db.instById.get(aicteId)!;
    for (const cl of touched) {
      const isNew = created.includes(cl);
      const members = cl.caseIds.map((id) => db.caseById.get(id)!).filter(Boolean);
      for (const m of members) {
        if (cl.level === 'L1-institution' && (isNew || m.caseId === c.caseId)) {
          db.addAction(m, { by: 'System · overlap engine', bureau: m.bureau, type: 'Linked to cluster', remarks: `Potential overlap ${cl.clusterId} — ${cl.caseIds.length} cases on ${inst.name}` });
        }
      }
      const bureaus = new Set(members.map((m) => m.bureau));
      const repeatOfClosed = cl.level === 'L2-same-issue' && members.every((m) => m.caseId === c.caseId || !isOpen(m));
      const title = cl.level === 'L1-institution'
        ? 'Potential Overlapping Cases – Coordination Required'
        : repeatOfClosed
          ? `Repeat complaint — same issue as a disposed case (${cl.similarity?.toFixed(2)})`
          : `Same issue raised twice (similarity ${cl.similarity?.toFixed(2)})`;
      for (const b of repeatOfClosed ? [c.bureau] : bureaus) {
        db.notify({ kind: 'overlap', title, body: `${inst.name} · ${cl.caseIds.length} cases across ${[...bureaus].map((x) => BUREAU_SHORT[x]).join(', ')}`, href: `/overlaps/${cl.clusterId}`, bureau: b });
      }
      await db.audit({ actor: 'System · overlap engine', role: 'System', action: cl.level === 'L1-institution' ? (isNew ? 'Overlap detected (L1)' : 'Case added to cluster') : 'Same-issue detected (L2)', target: cl.clusterId, detail: `${aicteId} · ${cl.caseIds.join(', ')} · triggered by ${c.caseId}` });
    }
    const relatedIds = new Set(touched.flatMap((cl) => cl.caseIds).filter((id) => id !== c.caseId));
    const related = [...relatedIds].map((id) => this.view(db, s, db.caseById.get(id)!));
    return {
      clusters: touched.map((cl) => ({ ...cl })),
      related,
      institution: inst,
      coordinationRequired: touched.some((cl) => cl.level === 'L1-institution') || related.some((r) => r.status !== 'Disposed'),
    };
  }

  async updateCase(id: string, patch: CasePatch): Promise<CaseView> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const c = this.getCaseOr404(db, id);
    if (!this.canEdit(s, c)) throw new ApiError('You cannot edit this case', 403);
    if (patch.officer && patch.officer !== c.officer) {
      db.addAction(c, { by: s.officer, bureau: c.bureau, type: 'Assigned', remarks: `Re-assigned from ${c.officer} to ${patch.officer}` });
      c.officer = patch.officer;
    }
    if (patch.nextAction) c.nextAction = patch.nextAction;
    db.touch(c);
    await this.auditAs(db, s, 'Case updated', id, JSON.stringify(patch));
    return this.view(db, s, c);
  }

  async addAction(id: string, a: CaseActionInput): Promise<CaseMutationResult> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const c = this.getCaseOr404(db, id);
    if (a.type === 'note') {
      if (!this.canSeeCase(db, s, c) || s.role === 'SENIOR') throw new ApiError('You cannot add notes to this case', 403);
    } else if (!this.canEdit(s, c)) {
      throw new ApiError('Only the bureau that owns this case can act on it', 403);
    }
    if (!isOpen(c) && a.type !== 'note') throw new ApiError('Case is already disposed', 400);
    const by = s.officer;
    const bureau = this.actorBureau(s);
    let overlap: CaseMutationResult['overlap'] = null;
    switch (a.type) {
      case 'status':
        db.addAction(c, { by, bureau, type: a.status === 'Inquiry initiated' ? 'Inquiry initiated' : a.status === 'Escalated' ? 'Escalated' : 'Status updated', remarks: a.remarks || `Status changed from ${c.status} to ${a.status}` });
        c.status = a.status;
        break;
      case 'notice':
        db.addAction(c, { by, bureau, type: 'Notice issued', remarks: a.remarks });
        if (c.status === 'Received') c.status = 'Under process';
        break;
      case 'transfer': {
        const from = c.bureau;
        db.addAction(c, { by, bureau: from, type: 'Transferred', remarks: `Transferred from ${BUREAU_SHORT[from]} to ${BUREAU_SHORT[a.toBureau]} — ${a.remarks}` });
        c.bureau = a.toBureau;
        c.officer = OFFICERS[a.toBureau][0];
        c.status = 'Transferred';
        db.notify({ kind: 'info', title: `${c.caseId} transferred to ${BUREAU_SHORT[a.toBureau]}`, body: a.remarks, href: `/cases/${encodeURIComponent(c.caseId)}`, bureau: a.toBureau });
        if (c.match.aicteId) overlap = await this.runOverlap(db, s, c);
        break;
      }
      case 'escalate':
        db.addAction(c, { by, bureau, type: 'Escalated', remarks: a.remarks });
        c.status = 'Escalated';
        c.escalationLevel = Math.max(1, c.escalationLevel ?? 0);
        c.escalatedTo = c.escalatedTo ?? db.state.settings.escalationChain[1];
        c.escalatedAt = db.now().toISOString();
        break;
      case 'note':
        db.addAction(c, { by, bureau, type: 'Note added', remarks: a.remarks });
        break;
      case 'dispose':
        db.addAction(c, { by, bureau, type: 'Disposed', remarks: a.remarks });
        c.status = 'Disposed';
        c.disposedAt = db.now().toISOString();
        this.resolveClustersIfDone(db, c);
        break;
    }
    c.nextAction = nextActionFor(c.status);
    db.touch(c);
    await this.auditAs(db, s, `Case action: ${a.type}`, id, 'remarks' in a && a.remarks ? a.remarks : 'status' in a ? a.status : undefined);
    return { case: this.view(db, s, c), overlap };
  }

  private resolveClustersIfDone(db: Db, c: Case) {
    for (const cl of db.state.clusters) {
      if (!cl.caseIds.includes(c.caseId) || cl.status === 'Dismissed' || cl.status === 'Resolved') continue;
      const open = cl.caseIds.map((id) => db.caseById.get(id)!).filter((x) => x && isOpen(x));
      if (cl.level === 'L1-institution' ? new Set(open.map((x) => x.bureau)).size < 2 && open.length < 1 : open.length === 0) {
        cl.status = 'Resolved';
        void db.audit({ actor: 'System', role: 'System', action: 'Cluster resolved', target: cl.clusterId, detail: 'All cases in the cluster are disposed' });
      }
    }
    db.changed();
  }

  async revealContact(id: string) {
    await delay(100, 200);
    const db = await getDb();
    const s = this.s();
    const c = this.getCaseOr404(db, id);
    if (!this.canSeeCase(db, s, c)) throw new ApiError('Not allowed', 403);
    await this.auditAs(db, s, 'Revealed complainant contact', id, s.officer === c.officer ? 'Assigned officer' : `Non-assigned viewer (${roleLabel(s)})`);
    return { ...c.complainant };
  }

  // ───────────── clusters ─────────────
  private clusterView(db: Db, s: Session, cl: Cluster): ClusterView {
    const inst = db.instById.get(cl.aicteId)!;
    const members = cl.caseIds.map((id) => db.caseById.get(id)!).filter(Boolean);
    const all = db.casesOf(cl.aicteId);
    const th = db.state.settings.l2Threshold;
    const l2Edges: ClusterView['l2Edges'] = [];
    const extra = new Map<string, Case>();
    for (let i = 0; i < members.length; i++) {
      for (const o of all) {
        if (o.caseId === members[i].caseId) continue;
        const inside = cl.caseIds.includes(o.caseId);
        if (inside && cl.caseIds.indexOf(o.caseId) < i) continue;
        const sim = issueSimilarity(members[i].description, o.description, db.idf, members[i].category === o.category);
        if (sim >= th) {
          l2Edges.push({ a: members[i].caseId, b: o.caseId, similarity: sim });
          if (!inside) extra.set(o.caseId, o);
        }
      }
    }
    return {
      ...cl,
      sharedNotes: [...cl.sharedNotes],
      institution: inst,
      risk: riskScore(all, db.now()),
      cases: members.map((m) => this.view(db, s, m)),
      extraCases: [...extra.values()].map((m) => this.view(db, s, m)),
      l2Edges,
      bureaus: [...new Set(members.map((m) => m.bureau))],
      leadReason: leadReason(cl.suggestedLead, members),
      ageDays: Math.max(0, Math.floor((db.now().getTime() - new Date(cl.createdAt).getTime()) / DAY)),
    };
  }

  async listClusters(): Promise<ClusterView[]> {
    await delay();
    const db = await getDb();
    const s = this.s();
    return db.state.clusters.filter((cl) => this.canSeeCluster(db, s, cl)).map((cl) => this.clusterView(db, s, cl)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCluster(id: string): Promise<ClusterView> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const cl = db.state.clusters.find((c) => c.clusterId === id);
    if (!cl) throw new ApiError(`Cluster ${id} not found`, 404);
    if (!this.canSeeCluster(db, s, cl)) throw new ApiError('This cluster does not involve your bureau', 403);
    return this.clusterView(db, s, cl);
  }

  async decideCluster(id: string, d: ClusterDecision): Promise<ClusterView> {
    await delay();
    const db = await getDb();
    const s = this.s();
    this.assertWrite(s);
    const cl = db.state.clusters.find((c) => c.clusterId === id);
    if (!cl) throw new ApiError(`Cluster ${id} not found`, 404);
    if (!this.canSeeCluster(db, s, cl)) throw new ApiError('This cluster does not involve your bureau', 403);
    const by = s.officer;
    const bureau = this.actorBureau(s);
    const members = () => cl.caseIds.map((x) => db.caseById.get(x)!).filter(Boolean);
    switch (d.type) {
      case 'accept-lead': {
        if (d.lead) cl.suggestedLead = d.lead;
        cl.leadAccepted = true;
        cl.status = 'Coordinating';
        for (const m of members()) db.addAction(m, { by, bureau: m.bureau, type: 'Lead accepted', remarks: `${BUREAU_NAMES[cl.suggestedLead]} accepted as lead for ${cl.clusterId}` });
        for (const b of this.clusterBureaus(db, cl)) db.notify({ kind: 'overlap', title: `Lead accepted: ${BUREAU_SHORT[cl.suggestedLead]}`, body: `${db.instById.get(cl.aicteId)?.name} · ${cl.clusterId}`, href: `/overlaps/${cl.clusterId}`, bureau: b });
        await this.auditAs(db, s, 'Lead accepted', cl.clusterId, `Lead: ${cl.suggestedLead}`);
        break;
      }
      case 'not-related': {
        if (!d.reason.trim()) throw new ApiError('A reason is required', 400);
        cl.status = 'Dismissed';
        cl.dismissedReason = d.reason.trim();
        for (const m of members()) {
          db.addAction(m, { by, bureau: m.bureau, type: 'Unlinked', remarks: `Marked “not related” in ${cl.clusterId}: ${d.reason}` });
          if (m.clusterId === cl.clusterId) m.clusterId = undefined;
          if (m.l2ClusterIds) m.l2ClusterIds = m.l2ClusterIds.filter((x) => x !== cl.clusterId);
          db.touch(m);
        }
        await this.auditAs(db, s, 'Cluster dismissed — not related', cl.clusterId, d.reason);
        break;
      }
      case 'note': {
        if (!d.text.trim()) throw new ApiError('Note is empty', 400);
        cl.sharedNotes.push({ at: db.now().toISOString(), by, bureau, text: d.text.trim() });
        if (cl.status === 'Open') cl.status = 'Coordinating';
        await this.auditAs(db, s, 'Shared note added', cl.clusterId, d.text.slice(0, 120));
        break;
      }
      case 'link': {
        for (const cid of d.caseIds) {
          const c = db.caseById.get(cid);
          if (!c || cl.caseIds.includes(cid)) continue;
          cl.caseIds.push(cid);
          if (cl.level === 'L1-institution') c.clusterId = cl.clusterId;
          db.addAction(c, { by, bureau: c.bureau, type: 'Linked to cluster', remarks: `Manually linked to ${cl.clusterId} by ${by}` });
        }
        await this.auditAs(db, s, 'Cases linked to cluster', cl.clusterId, d.caseIds.join(', '));
        break;
      }
      case 'resolve':
        cl.status = 'Resolved';
        await this.auditAs(db, s, 'Cluster resolved', cl.clusterId, d.remarks);
        break;
    }
    db.changed();
    return this.clusterView(db, s, cl);
  }

  // ───────────── institutions & matching ─────────────
  async listInstitutions(q?: string): Promise<InstitutionRow[]> {
    await delay();
    const db = await getDb();
    this.s();
    const qq = q?.trim().toLowerCase();
    const insts = qq ? db.state.institutions.filter((i) => [i.name, i.aicteId, i.city, ...i.aliases].join(' ').toLowerCase().includes(qq)) : db.state.institutions;
    return institutionRows(insts, db.state.cases, db.now()).sort((a, b) => b.risk.score - a.risk.score);
  }

  async getInstitution(id: string): Promise<InstitutionDetail> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const inst = db.instById.get(id);
    if (!inst) throw new ApiError(`Institution ${id} not found`, 404);
    const cases = db.casesOf(id);
    const now = db.now();
    const row = institutionRows([inst], db.state.cases, now)[0];
    const history: HistoryItem[] = cases.flatMap((c) => c.actions.map((a) => ({
      at: a.at, by: a.by, bureau: a.bureau, type: a.type, caseId: c.caseId, remarks: a.remarks,
      kind: a.type === 'Escalated' ? 'escalation' as const : a.by.startsWith('System') || a.type === 'Linked to cluster' ? 'alert' as const : 'action' as const,
    }))).sort((a, b) => b.at.localeCompare(a.at));
    const cats = new Map<string, number>();
    cases.forEach((c) => cats.set(c.category, (cats.get(c.category) ?? 0) + 1));
    const disp = cases.filter((c) => c.disposedAt).map((c) => (new Date(c.disposedAt!).getTime() - new Date(c.receivedAt).getTime()) / DAY);
    return {
      ...row,
      cases: cases.map((c) => this.view(db, s, c)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
      history,
      categoryBreakdown: [...cats.entries()].map(([category, count]) => ({ category: category as Case['category'], count })).sort((a, b) => b.count - a.count),
      monthly: monthKeys(now, 12).map((m) => ({ month: m.label, count: cases.filter((c) => c.receivedAt.startsWith(m.key)).length })),
      threeYearCount: cases.filter((c) => now.getTime() - new Date(c.receivedAt).getTime() < 3 * 365 * DAY).length,
      avgDisposalDays: disp.length ? Math.round(disp.reduce((a, b) => a + b, 0) / disp.length) : null,
      clusters: db.state.clusters.filter((cl) => cl.aicteId === id),
    };
  }

  async createInstitution(input: NewInstitutionInput): Promise<Institution> {
    await delay();
    const db = await getDb();
    const s = this.s();
    this.assertWrite(s);
    const n = db.state.counters['NEWINST'] ?? 1;
    db.state.counters['NEWINST'] = n + 1;
    const inst: Institution = {
      aicteId: `1-99${String(n).padStart(8, '0')}`, name: input.name.trim(), aliases: [], learntAliases: [], type: input.type,
      city: input.city.trim(), district: input.city.trim(), state: input.state.trim(), pincode: input.pincode.trim(), region: input.region, approvedIntake: 0,
    };
    db.addInstitution(inst);
    await this.auditAs(db, s, 'Institution created', inst.aicteId, `${inst.name}, ${inst.city} (provisional record, pending AICTE verification)`);
    return inst;
  }

  async confirmMatch(caseId: string, aicteId: string): Promise<CaseMutationResult> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const c = this.getCaseOr404(db, caseId);
    if (!this.canEdit(s, c)) throw new ApiError('Only the bureau that owns this case can confirm its match', 403);
    const inst = db.instById.get(aicteId);
    if (!inst) throw new ApiError('Institution not found', 404);
    const prev = c.match;
    const cand = prev.candidates?.find((x) => x.aicteId === aicteId);
    c.match = {
      aicteId, method: 'manual', confidence: cand?.confidence ?? prev.confidence, confirmedBy: s.officer,
      reasons: [`Confirmed by ${s.officer}`, ...(cand?.reasons ?? []).slice(0, 3)], candidates: prev.candidates,
    };
    if (prev.aicteId && prev.aicteId !== aicteId) this.detachFromClusters(db, c, 'Match changed');
    c.clusterId = undefined;
    // Learn the spelling (without city / ID noise) as an alias.
    const learnt = c.rawInstitutionText.replace(/\(?\s*AICTE[^)]*\)?/i, '').replace(new RegExp(`[,\\s-]*${inst.city}(-\\d{3}X{3})?`, 'i'), '').trim();
    db.addAlias(aicteId, learnt);
    db.addAction(c, { by: s.officer, bureau: c.bureau, type: 'Match confirmed', remarks: `Linked to ${inst.name} (${aicteId}). Learnt alias “${learnt}”.` });
    await this.auditAs(db, s, 'Match confirmed', caseId, `${aicteId} · was ${prev.aicteId ?? 'unlinked'} (${prev.confidence}%) · alias learnt: ${learnt}`);
    const overlap = await this.runOverlap(db, s, c);
    return { case: this.view(db, s, c), overlap };
  }

  private detachFromClusters(db: Db, c: Case, why: string) {
    for (const cl of db.state.clusters) {
      if (!cl.caseIds.includes(c.caseId)) continue;
      cl.caseIds = cl.caseIds.filter((x) => x !== c.caseId);
      const remaining = cl.caseIds.map((x) => db.caseById.get(x)!).filter(Boolean);
      if (cl.level === 'L2-same-issue' || new Set(remaining.filter(isOpen).map((x) => x.bureau)).size < 2) {
        if (cl.status === 'Open' || cl.status === 'Coordinating') {
          cl.status = 'Dismissed';
          cl.dismissedReason = `${why}: ${c.caseId} unlinked`;
        }
      }
    }
    c.clusterId = undefined;
    c.l2ClusterIds = [];
    db.changed();
  }

  async unlinkMatch(caseId: string, reason: string): Promise<CaseView> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const c = this.getCaseOr404(db, caseId);
    if (!this.canEdit(s, c)) throw new ApiError('Only the bureau that owns this case can unlink it', 403);
    const prev = c.match;
    this.detachFromClusters(db, c, 'Match rejected');
    c.match = { ...prev, aicteId: null, method: prev.method === 'manual' ? 'fuzzy' : prev.method, confirmedBy: undefined, reasons: [`Unlinked by ${s.officer}: ${reason}`, ...prev.reasons.filter((r) => !r.startsWith('Confirmed'))] };
    db.addAction(c, { by: s.officer, bureau: c.bureau, type: 'Match rejected', remarks: `Unlinked from ${prev.aicteId}: ${reason}` });
    await this.auditAs(db, s, 'Match rejected / unlinked', caseId, `${prev.aicteId} — ${reason}`);
    return this.view(db, s, c);
  }

  async listQueue(): Promise<QueueItem[]> {
    await delay();
    const db = await getDb();
    const s = this.s();
    return this.visibleCases(db, s)
      .filter((c) => isOpen(c) && !c.match.aicteId && (this.seesAll(s) || c.bureau === this.bureauOf(s)))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .map((c) => ({ case: this.view(db, s, c), candidates: (c.match.candidates ?? []).map((cand) => ({ ...cand, institution: db.instById.get(cand.aicteId) })) }));
  }

  // ───────────── dashboards ─────────────
  private regionOf = (db: Db) => (c: Case) => (c.match.aicteId ? db.instById.get(c.match.aicteId)?.region : undefined);

  async getOverview(f: OverviewFilters = {}): Promise<Overview> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const cases = applyOverviewFilters(this.scopedCases(db, s), f, this.regionOf(db));
    const clusters = db.state.clusters.filter((cl) => this.canSeeCluster(db, s, cl));
    return buildOverview(cases, clusters, db.state.institutions, db.now(), this.regionOf(db), this.scopeLabel(s));
  }

  async getReports(type: ReportType, f: OverviewFilters = {}): Promise<Report> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const cases = applyOverviewFilters(this.scopedCases(db, s), f, this.regionOf(db));
    const clusters = db.state.clusters.filter((cl) => this.canSeeCluster(db, s, cl));
    const report = buildReport(type, cases, clusters, db.state.institutions, db.now(), this.regionOf(db));
    return { ...report, description: `${report.description} Scope: ${this.scopeLabel(s)}.` };
  }

  private qualityCache: { key: string; value: ModelQuality } | null = null;

  async getModelQuality(): Promise<ModelQuality> {
    await delay();
    const db = await getDb();
    this.s();
    const th = db.state.settings.matchThreshold;
    const key = `${th}|${db.state.institutions.length}|${db.state.cases.length}|${db.state.clusters.length}|${db.state.settings.l2Threshold}`;
    if (this.qualityCache?.key === key) return this.qualityCache.value;
    const truth = db.state.truth;
    const twin = new Map<string, string>();
    truth.lookalikePairs.forEach(([a, b]) => twin.set(a, b).set(b, a));
    let evaluated = 0;
    let auto = 0;
    let correct = 0;
    let laCases = 0;
    let laFalse = 0;
    for (const c of db.state.cases) {
      const t = truth.caseInstitution[c.caseId];
      if (!t) continue;
      evaluated++;
      // Re-run the engine live on the original text with the current threshold.
      const m = matchInstitution(c.rawInstitutionText, db.index, { threshold: th });
      if (m.aicteId) {
        auto++;
        if (m.aicteId === t) correct++;
      }
      if (twin.has(t)) {
        laCases++;
        if (m.aicteId === twin.get(t)) laFalse++;
      }
    }
    const L1 = db.state.clusters.filter((c) => c.level === 'L1-institution');
    const L2 = db.state.clusters.filter((c) => c.level === 'L2-same-issue');
    const l1Found = truth.l1Clusters.filter((t) => L1.some((c) => c.aicteId === t.aicteId && t.caseIds.filter((id) => c.caseIds.includes(id)).length >= 2)).length;
    const l2Found = truth.l2Pairs.filter(([a, b]) => L2.some((c) => c.caseIds.includes(a) && c.caseIds.includes(b))).length;
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    const value: ModelQuality = {
      casesEvaluated: evaluated, autoLinkRate: pct(auto, evaluated), matchAccuracy: pct(correct, auto), lookalikeCases: laCases,
      lookalikeFalseLinkRate: pct(laFalse, laCases), l1Planted: truth.l1Clusters.length, l1Found, l1Recall: pct(l1Found, truth.l1Clusters.length),
      l2Planted: truth.l2Pairs.length, l2Found, l2Recall: pct(l2Found, truth.l2Pairs.length), threshold: th,
    };
    this.qualityCache = { key, value };
    return value;
  }

  async getSla(): Promise<SlaSummary> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const scoped = this.scopedCases(db, s);
    const views = scoped.filter(isOpen).map((c) => this.view(db, s, c));
    const now = db.now().getTime();
    const escalations: SlaEscalation[] = [];
    for (const c of scoped) {
      for (const a of c.actions) {
        if (a.type !== 'Escalated') continue;
        const to = a.remarks?.match(/to ([A-Z][\w ]+)$/)?.[1] ?? c.escalatedTo ?? 'Deputy Director';
        escalations.push({ caseId: c.caseId, at: a.at, to, by: a.by, remarks: a.remarks, bureau: c.bureau, category: c.category, overdueDays: Math.max(0, Math.floor((now - new Date(c.expectedDisposal).getTime()) / DAY)) });
      }
    }
    escalations.sort((a, b) => b.at.localeCompare(a.at));
    return {
      dueSoon: views.filter((v) => v.daysLeft >= 0 && v.daysLeft <= 3).sort((a, b) => a.daysLeft - b.daysLeft),
      overdue: views.filter((v) => v.overdue).sort((a, b) => a.daysLeft - b.daysLeft),
      escalations,
      rules: db.state.settings.slaDays,
      chain: db.state.settings.escalationChain,
      stepDays: db.state.settings.escalationStepDays,
    };
  }

  // ───────────── audit ─────────────
  async listAudit(f: AuditFilters = {}): Promise<AuditEvent[]> {
    await delay();
    const db = await getDb();
    const s = this.s();
    const q = f.q?.trim().toLowerCase();
    let ev = db.state.audit;
    if (s.role !== 'ADMIN' && s.role !== 'SENIOR') {
      // Officers see their own actions and events on cases/clusters they can see.
      ev = ev.filter((e) => e.actor === s.officer || (db.caseById.get(e.target) && this.canSeeCase(db, s, db.caseById.get(e.target)!)) || (e.target.startsWith('CL-') && db.state.clusters.some((c) => c.clusterId === e.target && this.canSeeCluster(db, s, c))));
    }
    if (f.actor) ev = ev.filter((e) => e.actor === f.actor);
    if (f.action) ev = ev.filter((e) => e.action === f.action);
    if (q) ev = ev.filter((e) => [e.actor, e.role, e.action, e.target, e.detail ?? '', e.id].join(' ').toLowerCase().includes(q));
    return [...ev].reverse().slice(0, f.limit ?? 5000);
  }

  async verifyAudit() {
    await delay(300, 500);
    const db = await getDb();
    const s = this.s();
    const res = await verifyChain(db.state.audit);
    await this.auditAs(db, s, 'Audit chain verified', 'audit-log', res.ok ? `Intact · ${res.checked} records` : `BROKEN at ${res.brokenAt?.id}`);
    return res;
  }

  // ───────────── settings ─────────────
  async getSettings(): Promise<Settings> {
    await delay();
    const db = await getDb();
    this.s();
    return structuredClone(db.state.settings);
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    await delay();
    const db = await getDb();
    const s = this.s();
    if (s.role !== 'ADMIN') throw new ApiError('Only the System Admin can change settings', 403);
    const before = db.state.settings;
    const changes = (Object.keys(patch) as (keyof Settings)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k]));
    db.state.settings = { ...before, ...structuredClone(patch) };
    if (patch.abbreviations) db.rebuildIndex();
    if (patch.slaDays) {
      for (const c of db.state.cases) {
        if (!isOpen(c)) continue;
        const sla = db.state.settings.slaDays[c.category];
        if (sla !== c.slaDays) {
          c.slaDays = sla;
          c.expectedDisposal = new Date(new Date(c.receivedAt).getTime() + sla * DAY).toISOString();
          db.touch(c);
        }
      }
    }
    db.changed();
    for (const k of changes) await this.auditAs(db, s, 'Setting changed', `settings.${k}`, `${JSON.stringify(before[k]).slice(0, 80)} → ${JSON.stringify(patch[k]).slice(0, 80)}`);
    return structuredClone(db.state.settings);
  }

  // ───────────── notifications ─────────────
  private myNotifications(db: Db, s: Session): AppNotification[] {
    if (this.seesAll(s)) return db.state.notifications;
    const b = this.bureauOf(s);
    return db.state.notifications.filter((n) => n.bureau === 'ALL' || n.bureau === b);
  }

  async listNotifications(): Promise<AppNotification[]> {
    await delay(80, 160);
    const db = await getDb();
    return this.myNotifications(db, this.s()).slice(0, 60).map((n) => ({ ...n }));
  }

  async markNotificationsRead(ids?: string[]) {
    const db = await getDb();
    for (const n of this.myNotifications(db, this.s())) if (!ids || ids.includes(n.id)) n.read = true;
    db.changed();
  }

  async getCounts(): Promise<Counts> {
    const db = await getDb();
    const s = this.s();
    const overlaps = db.state.clusters.filter((cl) => cl.status === 'Open' && this.canSeeCluster(db, s, cl)).length;
    const own = this.bureauOf(s);
    const queue = db.state.cases.filter((c) => isOpen(c) && !c.match.aicteId && (this.seesAll(s) || c.bureau === own)).length;
    const unread = this.myNotifications(db, s).filter((n) => !n.read).length;
    return { overlaps, queue, unread };
  }

  // ───────────── demo ─────────────
  async getClock() {
    const db = await getDb();
    return { now: db.now().toISOString(), offsetDays: db.state.clockOffsetDays, scenario: db.state.scenario };
  }

  async advanceClock(days: number) {
    await delay(150, 250);
    const db = await getDb();
    db.state.clockOffsetDays += days;
    db.changed();
    const s = this.session;
    await db.audit({ actor: s?.officer ?? 'Demo', role: roleLabel(s), action: 'Demo clock advanced', target: 'clock', detail: `+${days} day(s) → offset ${db.state.clockOffsetDays}` });
    const { escalated, reminders } = db.slaSweep();
    return { escalated: escalated.map((c) => c.caseId), reminders: reminders.map((c) => c.caseId) };
  }

  async resetDemo(scenario: 'full' | 'demo' = 'full') {
    const db = await resetDb(scenario);
    this.qualityCache = null;
    const s = this.session;
    if (s) await db.audit({ actor: s.officer, role: roleLabel(s), action: 'Demo data reset', target: 'database', detail: `Scenario: ${scenario}` });
  }
}
