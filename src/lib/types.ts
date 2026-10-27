export type BureauCode =
  | 'PGRC' | 'RB' | 'RO-S' | 'RO-W' | 'RO-N' | 'RO-E' | 'RO-C' | 'RO-SW' | 'RO-NW' | 'RO-NE' | 'OTHER';

export type CaseStatus = 'Received' | 'Under process' | 'Inquiry initiated' | 'Transferred' | 'Escalated' | 'Disposed';

export type Category =
  | 'Certificates withheld' | 'Excess fee collection' | 'Salary not paid' | 'Ragging' | 'Infrastructure / lab'
  | 'Faculty shortage' | 'Unapproved intake' | 'Admission irregularity' | 'Scholarship / refund' | 'Other';

export type Region =
  | 'Southern' | 'Western' | 'Northern' | 'Eastern' | 'Central' | 'South-Western' | 'North-Western' | 'North-Eastern';

export type InstitutionType = 'Engineering' | 'Management' | 'Polytechnic' | 'Pharmacy' | 'Architecture' | 'MCA';

export interface Institution {
  aicteId: string;
  name: string;
  aliases: string[];
  /** Aliases learnt from officer-confirmed matches (subset of `aliases`). */
  learntAliases?: string[];
  type: InstitutionType;
  city: string; district: string; state: string; pincode: string;
  region: Region;
  approvedIntake: number;
}

export interface MatchCandidate { aicteId: string; name: string; city?: string; confidence: number; reasons?: string[] }

export interface MatchResult {
  aicteId: string | null;
  confidence: number;
  reasons: string[];
  method: 'exact-id' | 'alias' | 'fuzzy' | 'manual';
  confirmedBy?: string;
  candidates?: MatchCandidate[];
}

export type ActionType =
  | 'Registered' | 'Assigned' | 'Notice issued' | 'Inquiry initiated' | 'Transferred' | 'Escalated'
  | 'Linked to cluster' | 'Unlinked' | 'Lead accepted' | 'Note added' | 'Disposed' | 'Match confirmed' | 'Match rejected'
  | 'Status updated' | 'Overlap alert';

export interface CaseAction {
  id: string; at: string; by: string; bureau: BureauCode;
  type: ActionType;
  remarks?: string; attachments?: string[];
}

export type ComplainantType = 'Student' | 'Parent' | 'Faculty' | 'Staff' | 'Other';

export interface Complainant { type: ComplainantType; name: string; phone: string; email: string }

export interface Case {
  caseId: string;
  receivedAt: string;
  rawInstitutionText: string;
  match: MatchResult;
  category: Category;
  description: string;
  complainant: Complainant;
  /** True when phone/email have been masked for the current viewer. */
  contactMasked?: boolean;
  bureau: BureauCode; officer: string; status: CaseStatus;
  lastAction: string; nextAction: string; expectedDisposal: string; slaDays: number;
  clusterId?: string;
  /** L2 (same-issue) cluster ids this case belongs to. */
  l2ClusterIds?: string[];
  /** 0 = none, 1 = Deputy Director, 2 = Director (auto-escalation by SLA sweep). */
  escalationLevel?: number;
  escalatedTo?: string;
  escalatedAt?: string;
  disposedAt?: string;
  attachments?: string[];
  actions: CaseAction[];
}

export interface SharedNote { at: string; by: string; bureau: BureauCode; text: string }

export interface Cluster {
  clusterId: string; aicteId: string; caseIds: string[];
  level: 'L1-institution' | 'L2-same-issue';
  similarity?: number;
  suggestedLead: BureauCode; leadAccepted?: boolean;
  sharedNotes: SharedNote[];
  createdAt: string; status: 'Open' | 'Coordinating' | 'Resolved' | 'Dismissed';
  dismissedReason?: string;
}

export interface AuditEvent {
  id: string; at: string; actor: string; role: string; action: string; target: string; detail?: string;
  prevHash: string; hash: string;
}

export interface AppNotification {
  id: string; at: string;
  kind: 'overlap' | 'sla' | 'escalation' | 'match' | 'info';
  title: string; body: string; href: string;
  /** Bureau whose officers should see it; 'ALL' for everyone. */
  bureau: BureauCode | 'ALL';
  read: boolean;
}

export type RoleId = 'PGRC' | 'RB' | 'RO' | 'SENIOR' | 'ADMIN';

export interface Session {
  role: RoleId;
  officer: string;
  /** Only for the Regional Officer role. */
  region?: Region;
}

export interface Settings {
  matchThreshold: number;
  l2Threshold: number;
  slaDays: Record<Category, number>;
  escalationChain: string[];
  /** Days overdue after which the case goes up to the next level of the chain. */
  escalationStepDays: number;
  categories: Category[];
  bureaus: BureauCode[];
  abbreviations: Record<string, string>;
}

export interface RiskBreakdown {
  score: number;
  label: 'Low' | 'Medium' | 'High';
  parts: { label: string; value: number; points: number }[];
}
