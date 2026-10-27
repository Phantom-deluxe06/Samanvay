import type {
  AppNotification, AuditEvent, BureauCode, Case, CaseStatus, Category, Cluster, ComplainantType, Institution, MatchResult,
  Region, RiskBreakdown, Session, Settings,
} from '@/lib/types';

export type StatusFilter = CaseStatus | 'Open' | 'Pending' | 'Overdue';

export interface CaseFilters {
  q?: string;
  bureau?: BureauCode | 'ALL';
  region?: Region | 'ALL';
  category?: Category | 'ALL';
  status?: StatusFilter | 'ALL';
  from?: string;
  to?: string;
  onlyOverlapping?: boolean;
  needsConfirmation?: boolean;
  aicteId?: string;
}

/** A case as returned to the UI: enriched and with contact details masked where required. */
export interface CaseView extends Case {
  institution?: Pick<Institution, 'aicteId' | 'name' | 'city' | 'region'>;
  region?: Region;
  /** Days until expected disposal; negative when overdue. */
  daysLeft: number;
  overdue: boolean;
  inCluster: boolean;
  canEdit: boolean;
}

export interface CreateCaseInput {
  bureau: BureauCode;
  complainant: { type: ComplainantType; name: string; phone: string; email: string };
  rawInstitutionText: string;
  aicteId?: string;
  city?: string;
  category: Category;
  description: string;
  attachments: string[];
}

export interface OverlapNotice {
  clusters: Cluster[];
  related: CaseView[];
  institution: Institution;
  /**
   * True when another *open* case is involved (always for L1). False when the only link is an L2
   * "same issue" match to an already-disposed complaint — a repeat complaint, worth knowing but not a coordination alert.
   */
  coordinationRequired: boolean;
}

export interface CaseMutationResult {
  case: CaseView;
  overlap: OverlapNotice | null;
}

export type CaseActionInput =
  | { type: 'status'; status: Exclude<CaseStatus, 'Disposed' | 'Transferred'>; remarks?: string }
  | { type: 'transfer'; toBureau: BureauCode; remarks: string }
  | { type: 'escalate'; remarks: string }
  | { type: 'note'; remarks: string }
  | { type: 'notice'; remarks: string }
  | { type: 'dispose'; remarks: string };

export interface CasePatch { officer?: string; nextAction?: string }

export interface L2Edge { a: string; b: string; similarity: number }

export interface ClusterView extends Cluster {
  institution: Institution;
  risk: RiskBreakdown;
  cases: CaseView[];
  /** Cases outside the cluster linked by L2 (e.g. a disposed earlier complaint). */
  extraCases: CaseView[];
  l2Edges: L2Edge[];
  bureaus: BureauCode[];
  leadReason: string;
  ageDays: number;
}

export type ClusterDecision =
  | { type: 'accept-lead'; lead?: BureauCode }
  | { type: 'not-related'; reason: string }
  | { type: 'note'; text: string }
  | { type: 'link'; caseIds: string[] }
  | { type: 'resolve'; remarks?: string };

export interface InstitutionRow extends Institution {
  openCases: number;
  totalCases: number;
  bureaus: BureauCode[];
  risk: RiskBreakdown;
  /** Cases per month for the last 9 months (sparkline). */
  spark: number[];
}

export interface HistoryItem {
  at: string; by: string; bureau: BureauCode; type: string; caseId: string; remarks?: string;
  kind: 'action' | 'alert' | 'escalation';
}

export interface InstitutionDetail extends InstitutionRow {
  cases: CaseView[];
  history: HistoryItem[];
  categoryBreakdown: { category: Category; count: number }[];
  monthly: { month: string; count: number }[];
  threeYearCount: number;
  avgDisposalDays: number | null;
  clusters: Cluster[];
}

export interface OverviewFilters { from?: string; to?: string; region?: Region | 'ALL'; category?: Category | 'ALL' }

export interface Overview {
  kpis: { total: number; pending: number; underProcess: number; disposed: number; beyondSla: number; clusters: number };
  workload: { bureau: BureauCode; open: number }[];
  ageing: { bucket: string; count: number }[];
  attention: InstitutionRow[];
  regions: { region: Region; open: number; total: number }[];
  trend: { month: string; received: number; disposed: number }[];
  scope: string;
}

export type ReportType = 'institution' | 'region' | 'bureau' | 'status' | 'ageing' | 'disposal' | 'overlaps' | 'monthly' | 'quarterly';

export interface Report {
  type: ReportType;
  title: string;
  description: string;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, string | number>[];
  chart: { kind: 'bar' | 'hbar' | 'line' | 'pie'; xKey: string; series: { key: string; label: string; color: string }[]; data: Record<string, string | number>[] };
}

export interface ModelQuality {
  casesEvaluated: number;
  autoLinkRate: number;
  matchAccuracy: number;
  lookalikeCases: number;
  lookalikeFalseLinkRate: number;
  l1Recall: number; l1Planted: number; l1Found: number;
  l2Recall: number; l2Planted: number; l2Found: number;
  threshold: number;
}

export interface AuditFilters { q?: string; actor?: string; action?: string; limit?: number }

export interface SlaEscalation { caseId: string; at: string; to: string; by: string; remarks?: string; bureau: BureauCode; category: Category; overdueDays: number }

export interface SlaSummary {
  dueSoon: CaseView[];
  overdue: CaseView[];
  escalations: SlaEscalation[];
  rules: Settings['slaDays'];
  chain: string[];
  stepDays: number;
}

export interface QueueItem { case: CaseView; candidates: (NonNullable<MatchResult['candidates']>[number] & { institution?: Institution })[] }

export interface NewInstitutionInput { name: string; city: string; state: string; region: Region; pincode: string; type: Institution['type'] }

export interface Counts { overlaps: number; queue: number; unread: number }

export interface SamanvayApi {
  setSession(session: Session | null): void;
  logRoleSwitch(session: Session): Promise<void>;

  listCases(filters?: CaseFilters): Promise<CaseView[]>;
  getCase(id: string): Promise<CaseView>;
  createCase(input: CreateCaseInput): Promise<CaseMutationResult>;
  updateCase(id: string, patch: CasePatch): Promise<CaseView>;
  addAction(id: string, action: CaseActionInput): Promise<CaseMutationResult>;
  revealContact(id: string): Promise<Case['complainant']>;
  previewMatch(raw: string, opts?: { aicteId?: string; city?: string }): Promise<MatchResult>;

  listClusters(): Promise<ClusterView[]>;
  getCluster(id: string): Promise<ClusterView>;
  decideCluster(id: string, decision: ClusterDecision): Promise<ClusterView>;

  listInstitutions(q?: string): Promise<InstitutionRow[]>;
  getInstitution(id: string): Promise<InstitutionDetail>;
  createInstitution(input: NewInstitutionInput): Promise<Institution>;
  confirmMatch(caseId: string, aicteId: string): Promise<CaseMutationResult>;
  unlinkMatch(caseId: string, reason: string): Promise<CaseView>;
  listQueue(): Promise<QueueItem[]>;

  getOverview(filters?: OverviewFilters): Promise<Overview>;
  getReports(type: ReportType, filters?: OverviewFilters): Promise<Report>;
  getModelQuality(): Promise<ModelQuality>;
  getSla(): Promise<SlaSummary>;

  listAudit(filters?: AuditFilters): Promise<AuditEvent[]>;
  verifyAudit(): Promise<{ ok: boolean; checked: number; brokenAt?: { index: number; id: string; reason: string } }>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(ids?: string[]): Promise<void>;
  getCounts(): Promise<Counts>;

  // Demo controls (prototype only)
  getClock(): Promise<{ now: string; offsetDays: number; scenario: 'full' | 'demo' }>;
  advanceClock(days: number): Promise<{ escalated: string[]; reminders: string[] }>;
  resetDemo(scenario?: 'full' | 'demo'): Promise<void>;
}
