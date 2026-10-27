import type { BureauCode, Category, Region, RoleId, Settings } from './types';

/** Fixed demo anchor: the demo clock starts here so seeded data is identical on every run. */
export const ANCHOR_ISO = '2026-10-27T10:00:00+05:30';
export const ANCHOR = new Date(ANCHOR_ISO);

export const REGIONS: Region[] = [
  'Southern', 'Western', 'Northern', 'Eastern', 'Central', 'South-Western', 'North-Western', 'North-Eastern',
];

export const REGION_TO_BUREAU: Record<Region, BureauCode> = {
  Southern: 'RO-S', Western: 'RO-W', Northern: 'RO-N', Eastern: 'RO-E', Central: 'RO-C',
  'South-Western': 'RO-SW', 'North-Western': 'RO-NW', 'North-Eastern': 'RO-NE',
};

export const BUREAU_TO_REGION: Partial<Record<BureauCode, Region>> = Object.fromEntries(
  Object.entries(REGION_TO_BUREAU).map(([r, b]) => [b, r]),
) as Partial<Record<BureauCode, Region>>;

export const BUREAUS: BureauCode[] = ['PGRC', 'RB', 'RO-S', 'RO-W', 'RO-N', 'RO-E', 'RO-C', 'RO-SW', 'RO-NW', 'RO-NE', 'OTHER'];

export const BUREAU_NAMES: Record<BureauCode, string> = {
  PGRC: 'Public Grievance Redressal Cell',
  RB: 'Regulation Bureau',
  'RO-S': 'Southern Regional Office',
  'RO-W': 'Western Regional Office',
  'RO-N': 'Northern Regional Office',
  'RO-E': 'Eastern Regional Office',
  'RO-C': 'Central Regional Office',
  'RO-SW': 'South-Western Regional Office',
  'RO-NW': 'North-Western Regional Office',
  'RO-NE': 'North-Eastern Regional Office',
  OTHER: 'Other Cells',
};

export const BUREAU_SHORT: Record<BureauCode, string> = {
  PGRC: 'PGRC', RB: 'RB', 'RO-S': 'RO-South', 'RO-W': 'RO-West', 'RO-N': 'RO-North', 'RO-E': 'RO-East',
  'RO-C': 'RO-Central', 'RO-SW': 'RO-SW', 'RO-NW': 'RO-NW', 'RO-NE': 'RO-NE', OTHER: 'Other cell',
};

export function bureauKind(b: BureauCode): 'PGRC' | 'RB' | 'RO' | 'OTHER' {
  if (b === 'PGRC' || b === 'RB' || b === 'OTHER') return b;
  return 'RO';
}

/** Pill colours: [background, text]. */
export const BUREAU_COLORS: Record<'PGRC' | 'RB' | 'RO' | 'OTHER', [string, string]> = {
  PGRC: ['#E3ECFA', '#1F4B8A'],
  RB: ['#FDEBD8', '#A35A0A'],
  RO: ['#E4F4EA', '#1E8449'],
  OTHER: ['#EFE9F7', '#7A5CA8'],
};

/** Solid colours for graph nodes / charts. */
export const BUREAU_SOLID: Record<'PGRC' | 'RB' | 'RO' | 'OTHER', string> = {
  PGRC: '#1A6FC4', RB: '#E67E22', RO: '#1E8449', OTHER: '#7A5CA8',
};

export const CATEGORIES: Category[] = [
  'Certificates withheld', 'Excess fee collection', 'Salary not paid', 'Ragging', 'Infrastructure / lab',
  'Faculty shortage', 'Unapproved intake', 'Admission irregularity', 'Scholarship / refund', 'Other',
];

export const DEFAULT_SLA: Record<Category, number> = {
  'Certificates withheld': 15,
  'Excess fee collection': 30,
  'Salary not paid': 21,
  Ragging: 7,
  'Infrastructure / lab': 45,
  'Faculty shortage': 45,
  'Unapproved intake': 30,
  'Admission irregularity': 30,
  'Scholarship / refund': 21,
  Other: 30,
};

/** Category severity weights used by the risk score (ragging and salary are high). */
export const CATEGORY_SEVERITY: Record<Category, number> = {
  Ragging: 3, 'Salary not paid': 2.5, 'Certificates withheld': 2, 'Unapproved intake': 2, 'Excess fee collection': 1.8,
  'Admission irregularity': 1.6, 'Scholarship / refund': 1.4, 'Faculty shortage': 1.3, 'Infrastructure / lab': 1.1, Other: 1,
};

export const DEFAULT_ABBREVIATIONS: Record<string, string> = {
  engg: 'engineering', eng: 'engineering', engr: 'engineering', engineerig: 'engineering',
  inst: 'institute', instt: 'institute', institue: 'institute', insti: 'institute',
  clg: 'college', coll: 'college', colg: 'college', clge: 'college',
  tech: 'technology', techn: 'technology', technol: 'technology',
  mgmt: 'management', mgt: 'management', mngt: 'management',
  poly: 'polytechnic', polytech: 'polytechnic',
  univ: 'university', uni: 'university',
  sci: 'science', pharm: 'pharmacy', arch: 'architecture', comp: 'computer', appl: 'applications',
  shri: 'sri', shree: 'sri', sree: 'sri', st: 'saint', 'and': 'and',
};

export const DEFAULT_SETTINGS: Settings = {
  matchThreshold: 85,
  l2Threshold: 0.75,
  slaDays: { ...DEFAULT_SLA },
  escalationChain: ['Officer', 'Deputy Director', 'Director'],
  escalationStepDays: 7,
  categories: [...CATEGORIES],
  bureaus: [...BUREAUS],
  abbreviations: { ...DEFAULT_ABBREVIATIONS },
};

export interface RoleDef {
  id: RoleId;
  label: string;
  officer: string;
  bureau?: BureauCode;
  description: string;
  readOnly?: boolean;
}

export const ROLES: RoleDef[] = [
  { id: 'PGRC', label: 'PGRC Officer', officer: 'A. Kumar', bureau: 'PGRC', description: 'Public Grievance Redressal Cell cases, plus every overlap alert that involves PGRC.' },
  { id: 'RB', label: 'RB Officer', officer: 'S. Iyer', bureau: 'RB', description: 'Regulation Bureau cases, plus every overlap alert that involves RB.' },
  { id: 'RO', label: 'Regional Officer', officer: 'M. Pillai', description: "Pick a region and work that Regional Office's cases." },
  { id: 'SENIOR', label: 'Senior Management', officer: 'Dr. N. Rao', description: 'Everything, read-only. National dashboards and reports.', readOnly: true },
  { id: 'ADMIN', label: 'System Admin', officer: 'K. Menon', description: 'Settings (SLA rules, thresholds, dictionaries) and the full audit log.' },
];

export const REGIONAL_OFFICERS: Record<Region, string> = {
  Southern: 'M. Pillai', Western: 'P. Deshpande', Northern: 'R. Saxena', Eastern: 'S. Banerjee', Central: 'A. Tiwari',
  'South-Western': 'K. Hegde', 'North-Western': 'H. Sandhu', 'North-Eastern': 'B. Bora',
};

export const OFFICERS: Record<BureauCode, string[]> = {
  PGRC: ['A. Kumar', 'R. Das', 'V. Nair', 'P. Sharma', 'L. Joseph'],
  RB: ['S. Iyer', 'N. Gupta', 'D. Reddy', 'T. Mishra'],
  'RO-S': ['M. Pillai', 'G. Raman', 'J. Thomas'],
  'RO-W': ['P. Deshpande', 'A. Kulkarni', 'F. Shaikh'],
  'RO-N': ['R. Saxena', 'Y. Verma', 'I. Khan'],
  'RO-E': ['S. Banerjee', 'P. Mohanty', 'K. Sinha'],
  'RO-C': ['A. Tiwari', 'M. Dubey'],
  'RO-SW': ['K. Hegde', 'S. Gowda', 'A. Varghese'],
  'RO-NW': ['H. Sandhu', 'R. Chauhan', 'V. Meena'],
  'RO-NE': ['B. Bora', 'L. Singha'],
  OTHER: ['C. Mathur', 'E. Dsouza'],
};

export const STATUSES = ['Received', 'Under process', 'Inquiry initiated', 'Transferred', 'Escalated', 'Disposed'] as const;
