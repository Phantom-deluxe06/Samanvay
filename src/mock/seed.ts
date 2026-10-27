import { fakerEN_IN as faker } from '@faker-js/faker';
import { ANCHOR, CATEGORIES, DEFAULT_SLA, OFFICERS, REGION_TO_BUREAU, REGIONAL_OFFICERS, ROLES } from '@/lib/constants';
import type { BureauCode, Case, CaseAction, CaseStatus, Category, ComplainantType, Institution, InstitutionType } from '@/lib/types';
import { acronym } from '@/engine/normalize';
import { buildIndex, matchInstitution } from '@/engine/match';
import { CITIES, LOOKALIKE_PATTERNS, PATTERNS, PREFIXES, RESERVED, SECOND, STEMS, TYPE_WEIGHTS } from './names';
import { messyInstitutionText } from './messiness';
import { Rng } from './rng';
import { COURSES, DESCRIPTIONS, HERO_TEXTS, L2_PAIRS } from './texts';

export const SEED = 2026;
const DAY = 86_400_000;

export const HERO_ID = '1-4417XXXXXX';
export const HERO_CASE_IDS = ['PG/2026/08841', 'RB/2026/01273', 'PG/2026/09105'] as const;
export const HERO_RO_CASE_ID = 'RO/2025/03318';

export interface GroundTruth {
  /** caseId → true AICTE ID */
  caseInstitution: Record<string, string>;
  l1Clusters: { aicteId: string; caseIds: string[] }[];
  l2Pairs: [string, string][];
  lookalikePairs: [string, string][];
}

export interface SeedResult {
  institutions: Institution[];
  cases: Case[];
  truth: GroundTruth;
  counters: Record<string, number>;
}

export type Scenario = 'full' | 'demo';

const iso = (t: number) => new Date(t).toISOString();

function prefixFor(b: BureauCode): string {
  if (b === 'PGRC') return 'PG';
  if (b === 'RB') return 'RB';
  if (b === 'OTHER') return 'OC';
  return 'RO';
}

export function nextActionFor(status: CaseStatus): string {
  switch (status) {
    case 'Received': return 'Assign officer and acknowledge complainant';
    case 'Under process': return 'Await institution reply to notice';
    case 'Inquiry initiated': return 'Inquiry committee report due';
    case 'Transferred': return 'Receiving bureau to acknowledge';
    case 'Escalated': return 'Senior review and directions';
    case 'Disposed': return '—';
  }
}

function fmtShort(t: number) {
  return new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** Build a plausible action timeline for a case. */
function buildActions(rng: Rng, c: { receivedAt: number; bureau: BureauCode; officer: string; status: CaseStatus; disposedAt?: number; transferredFrom?: BureauCode; category: Category }, nowT: number): CaseAction[] {
  const acts: CaseAction[] = [];
  let k = 0;
  const push = (t: number, type: CaseAction['type'], by: string, remarks?: string, bureau: BureauCode = c.bureau) =>
    acts.push({ id: `a${++k}`, at: iso(Math.min(t, nowT)), by, bureau, type, remarks });

  const t0 = c.receivedAt;
  // Spread actions across the case's life so far (received → disposal or now), never piling up on "now".
  const span = Math.max(4 * 3600_000, (c.status === 'Disposed' && c.disposedAt ? c.disposedAt : nowT) - t0);
  const at = (lo: number, hi: number) => t0 + span * (lo + rng.next() * (hi - lo));
  const intakeBureau = c.transferredFrom ?? c.bureau;
  push(t0, 'Registered', 'Intake desk', 'Complaint received through the AICTE grievance portal', intakeBureau);
  push(at(0.02, 0.08), 'Assigned', 'Section officer', `Assigned to ${c.transferredFrom ? 'section' : c.officer}`, intakeBureau);
  if (c.transferredFrom) {
    push(at(0.1, 0.18), 'Transferred', 'Section officer', `Transferred to ${c.bureau} — subject matter falls under its remit`, c.transferredFrom);
    push(at(0.2, 0.25), 'Assigned', 'Section officer', `Assigned to ${c.officer}`);
  }
  if (c.status === 'Received') return acts.slice(0, 1);
  if (c.status === 'Transferred') return acts;
  push(at(0.25, 0.4), 'Notice issued', c.officer, 'Notice issued to the institution seeking a reply within 7 days');
  if (c.status === 'Inquiry initiated' || (c.status === 'Disposed' && rng.chance(0.3))) {
    push(at(0.45, 0.65), 'Inquiry initiated', c.officer, 'Fact-finding inquiry ordered');
  }
  if (c.status === 'Escalated') push(at(0.7, 0.92), 'Escalated', c.officer, 'Institution non-responsive; escalated to Deputy Director');
  if (c.status === 'Disposed' && c.disposedAt) {
    const outcome = rng.pick([
      'Institution complied; complainant confirmed resolution',
      'Institution directed to comply; compliance report received',
      'Complaint found not substantiated after reply',
      'Refund / release confirmed by complainant',
      'Advisory issued to institution; closed',
    ]);
    push(c.disposedAt, 'Disposed', c.officer, outcome);
  }
  acts.sort((a, b) => a.at.localeCompare(b.at));
  return acts;
}

function lastActionText(acts: CaseAction[]): string {
  const a = acts[acts.length - 1];
  return a ? `${a.type} · ${fmtShort(new Date(a.at).getTime())}` : '—';
}

interface Draft {
  key: string;
  aicteId: string;
  bureau: BureauCode;
  category: Category;
  status: CaseStatus;
  receivedAt: number;
  disposedAt?: number;
  description: string;
  rawText?: string;
  officer?: string;
  fixedId?: string;
  transferredFrom?: BureauCode;
  /** Part of a planted overlap: staffed by officers other than the demo-role officers. */
  planted?: boolean;
  messyOpts?: { forceId?: boolean; noId?: boolean };
}

export function generateSeed(scenario: Scenario = 'full'): SeedResult {
  const rng = new Rng(SEED);
  faker.seed(SEED);
  const nowT = ANCHOR.getTime();

  // ───────────── institutions ─────────────
  const institutions: Institution[] = [];
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const newId = () => {
    let id = '';
    do id = `1-${String(rng.int(1000, 9999))}${String(rng.int(100000, 999999))}`;
    while (usedIds.has(id) || id.startsWith('1-4417'));
    usedIds.add(id);
    return id;
  };
  const cityW = CITIES.map((c) => [c, c.weight] as const);
  const mkInst = (name: string, type: InstitutionType, city: (typeof CITIES)[number], aicteId = newId()): Institution => ({
    aicteId, name, aliases: [], learntAliases: [], type, city: city.city, district: city.district, state: city.state,
    pincode: `${city.pin}${String(rng.int(1, 120)).padStart(3, '0')}`, region: city.region,
    approvedIntake: type === 'Engineering' ? rng.pick([300, 420, 540, 600, 720, 900]) : rng.pick([60, 120, 180, 240]),
  });

  const chennai = CITIES.find((c) => c.city === 'Chennai')!;
  const hero = mkInst('Sri Venkatesa Institute of Technology', 'Engineering', chennai, HERO_ID);
  hero.pincode = '600097';
  hero.approvedIntake = 720;
  hero.aliases = ['SVIT'];
  institutions.push(hero);
  usedNames.add(hero.name);

  const stems = rng.shuffle([...STEMS]);
  let stemI = 0;
  const nextStem = () => stems[stemI++ % stems.length];

  // 20 look-alike pairs in the same city
  const lookalikePairs: [string, string][] = [];
  for (let i = 0; i < 20; i++) {
    const [pa, pb] = LOOKALIKE_PATTERNS[i % LOOKALIKE_PATTERNS.length];
    const stem = `${rng.pick(['', '', 'Sri ', 'Saint '])}${nextStem()}`;
    const city = rng.weighted(cityW);
    const type: InstitutionType = pa.includes('Polytechnic') ? 'Polytechnic' : pa.includes('Management') ? 'Management' : pa.includes('Pharmacy') ? 'Pharmacy' : 'Engineering';
    const a = mkInst(pa.replace('{n}', stem), type, city);
    const b = mkInst(pb.replace('{n}', stem), type, city);
    institutions.push(a, b);
    usedNames.add(a.name).add(b.name);
    lookalikePairs.push([a.aicteId, b.aicteId]);
  }

  const heroAcr = acronym(hero.name);
  while (institutions.length < 500) {
    const type = rng.weighted(TYPE_WEIGHTS);
    const stem = `${rng.pick(PREFIXES)}${rng.pick(SECOND)}${rng.chance(0.75) ? nextStem() : rng.pick(STEMS)}`;
    if (RESERVED.some((r) => stem.includes(r))) continue;
    const name = rng.pick(PATTERNS[type]).replace('{n}', stem).replace(/\s+/g, ' ').trim();
    if (usedNames.has(name)) continue;
    const a = acronym(name);
    if (a.acronym === heroAcr.acronym || a.initialsVariant === heroAcr.initialsVariant) continue;
    const city = rng.weighted(cityW);
    const inst = mkInst(name, type, city);
    // Some institutions already have well-known short forms on file
    if (rng.chance(0.18) && a.acronym.length >= 3) inst.aliases.push(a.acronym.toUpperCase());
    institutions.push(inst);
    usedNames.add(name);
  }
  const instById = new Map(institutions.map((i) => [i.aicteId, i]));

  // ───────────── case drafts ─────────────
  const drafts: Draft[] = [];
  let dk = 0;
  const usedCats = new Map<string, Set<Category>>();
  const pickCategory = (aicteId: string, avoid: Category[] = []): Category => {
    const used = usedCats.get(aicteId) ?? new Set<Category>();
    usedCats.set(aicteId, used);
    const free = CATEGORIES.filter((c) => !used.has(c) && !avoid.includes(c));
    const cat = free.length ? rng.pick(free) : rng.pick(CATEGORIES.filter((c) => !avoid.includes(c)));
    used.add(cat);
    return cat;
  };
  const fill = (tpl: string) =>
    tpl.replace('{course}', rng.pick(COURSES)).replace('{amount}', String(rng.int(15, 95) * 1000).replace(/(\d+)(\d{3})$/, '$1,$2'))
      .replace('{months}', String(rng.int(2, 7))).replace('{yr}', String(rng.int(2022, 2026)));
  const describe = (cat: Category) => fill(rng.pick(DESCRIPTIONS[cat]));
  const roOf = (aicteId: string): BureauCode => REGION_TO_BUREAU[instById.get(aicteId)!.region];

  const openStatus = (): CaseStatus => rng.weighted([['Received', 12], ['Under process', 48], ['Inquiry initiated', 22], ['Transferred', 10], ['Escalated', 8]] as const);
  /** Received time for an open case; ~12% are already beyond SLA. */
  const openReceived = (cat: Category) => {
    const sla = DEFAULT_SLA[cat];
    if (rng.chance(0.12)) return nowT - DAY * (sla + rng.int(1, 40)) - rng.int(0, 8) * 3600_000;
    return nowT - DAY * rng.int(1, Math.max(2, sla - 1)) - rng.int(0, 8) * 3600_000;
  };
  const disposedTimes = (cat: Category) => {
    const r = nowT - DAY * rng.int(12, 268) - rng.int(0, 8) * 3600_000;
    const sla = DEFAULT_SLA[cat];
    const d = Math.min(nowT - DAY, r + DAY * Math.max(2, Math.round(sla * (0.35 + rng.next() * 0.95))));
    return { receivedAt: r, disposedAt: d };
  };
  /** Days ago, with complaint volume growing gently over the 9 months (density ∝ 1.2 − 0.45·age/window). */
  const sampleAge = () => {
    for (;;) {
      const a = rng.next() * 268;
      if (rng.next() * 1.2 <= 1.2 - 0.45 * (a / 268)) return a;
    }
  };
  /**
   * Background timing: intake is spread over the window and the status follows from the case's age —
   * most cases still inside their SLA are open, most older ones are disposed, and a small share is beyond SLA.
   */
  const bgTiming = (cat: Category): { open: boolean; receivedAt: number; disposedAt?: number } => {
    const sla = DEFAULT_SLA[cat];
    const age = sampleAge();
    const receivedAt = nowT - age * DAY - rng.int(0, 8) * 3600_000;
    if (age < sla) {
      if (rng.chance(0.85)) return { open: true, receivedAt };
      return { open: false, receivedAt, disposedAt: Math.min(nowT - 3600_000, receivedAt + (nowT - receivedAt) * (0.3 + rng.next() * 0.6)) };
    }
    if (age < sla + 90 && rng.chance(0.15)) return { open: true, receivedAt };
    return { open: false, receivedAt, disposedAt: Math.min(nowT - DAY, receivedAt + DAY * Math.max(1, sla * (0.35 + rng.next() * 0.95))) };
  };

  // Hero cases
  if (scenario === 'full') {
    drafts.push(
      { key: `d${++dk}`, fixedId: HERO_CASE_IDS[0], aicteId: HERO_ID, bureau: 'PGRC', officer: 'A. Kumar', category: 'Certificates withheld', status: 'Under process', receivedAt: nowT - DAY * 11 - 5 * 3600_000, description: HERO_TEXTS.certificates, rawText: 'SVIT Engg Clg, Chennai' },
      { key: `d${++dk}`, fixedId: HERO_CASE_IDS[1], aicteId: HERO_ID, bureau: 'RB', officer: 'S. Iyer', category: 'Excess fee collection', status: 'Inquiry initiated', receivedAt: nowT - DAY * 12 - 2 * 3600_000, description: HERO_TEXTS.fees, rawText: 'Sri Venkatesa Inst. of Tech.' },
      { key: `d${++dk}`, fixedId: HERO_CASE_IDS[2], aicteId: HERO_ID, bureau: 'PGRC', officer: 'R. Das', category: 'Salary not paid', status: 'Under process', receivedAt: nowT - DAY * 27 - 3 * 3600_000, description: HERO_TEXTS.salary, rawText: 'S.V. Institute of Technology' },
    );
  }
  drafts.push({
    key: `d${++dk}`, fixedId: HERO_RO_CASE_ID, aicteId: HERO_ID, bureau: 'RO-S', officer: 'G. Raman', category: 'Certificates withheld', status: 'Disposed',
    receivedAt: new Date('2025-11-12T11:20:00+05:30').getTime(), disposedAt: new Date('2025-12-19T16:00:00+05:30').getTime(),
    description: HERO_TEXTS.roDisposed, rawText: 'Sri Venkatesa Institute of Tech, Chennai-600XXX',
  });
  usedCats.set(HERO_ID, new Set(['Certificates withheld', 'Excess fee collection', 'Salary not paid']));

  const lookalikeIds = new Set(lookalikePairs.flat());
  const pool = rng.shuffle(institutions.filter((i) => i.aicteId !== HERO_ID && !lookalikeIds.has(i.aicteId)).map((i) => i.aicteId));
  const reserved = new Set<string>();

  // 40 planted L1 clusters: same institution, open in 2–4 bureaus
  const truthL1: { aicteId: string; keys: string[] }[] = [];
  for (let i = 0; i < 40; i++) {
    const id = pool.pop()!;
    reserved.add(id);
    const n = rng.weighted([[2, 55], [3, 35], [4, 10]] as const);
    const bureaus = rng.shuffle<BureauCode>(['PGRC', 'RB', roOf(id), 'OTHER']).slice(0, n);
    if (!bureaus.includes('PGRC') && !bureaus.includes('RB')) bureaus[0] = 'PGRC';
    const keys: string[] = [];
    for (const b of bureaus) {
      const cat = pickCategory(id);
      const key = `d${++dk}`;
      keys.push(key);
      drafts.push({ key, aicteId: id, bureau: b, category: cat, status: openStatus(), receivedAt: openReceived(cat), description: describe(cat), planted: true });
    }
    truthL1.push({ aicteId: id, keys });
  }

  // 15 planted L2 pairs: same issue, different words. First 7 across bureaus (also L1), rest in the same bureau.
  const truthL2: [string, string][] = [];
  L2_PAIRS.forEach((pair, i) => {
    const id = pool.pop()!;
    reserved.add(id);
    usedCats.set(id, new Set([pair.category]));
    const cross = i < 7;
    const b1: BureauCode = rng.pick(['PGRC', roOf(id)]);
    const b2: BureauCode = cross ? (b1 === 'PGRC' ? 'RB' : 'PGRC') : b1;
    const ka = `d${++dk}`;
    const kb = `d${++dk}`;
    const firstDisposed = !cross && rng.chance(0.4);
    const sla = DEFAULT_SLA[pair.category];
    const tb = nowT - DAY * rng.int(1, Math.max(2, sla - 2));
    if (firstDisposed) {
      const { receivedAt, disposedAt } = disposedTimes(pair.category);
      drafts.push({ key: ka, aicteId: id, bureau: b1, category: pair.category, status: 'Disposed', receivedAt, disposedAt, description: pair.a, planted: true });
    } else {
      drafts.push({ key: ka, aicteId: id, bureau: b1, category: pair.category, status: openStatus(), receivedAt: tb - DAY * rng.int(3, 20), description: pair.a, planted: true });
    }
    drafts.push({ key: kb, aicteId: id, bureau: b2, category: pair.category, status: rng.pick(['Received', 'Under process'] as const), receivedAt: tb, description: pair.b, planted: true });
    truthL2.push([ka, kb]);
    if (cross) truthL1.push({ aicteId: id, keys: [ka, kb] });
  });

  // Look-alike complaints (realistic work for the confirm queue)
  for (const [a, b] of lookalikePairs) {
    for (const id of [a, b]) {
      const n = rng.int(1, 2);
      const home: BureauCode = rng.pick(['PGRC', roOf(id)]);
      for (let k = 0; k < n; k++) {
        const cat = pickCategory(id);
        const open = rng.chance(0.55);
        if (open) drafts.push({ key: `d${++dk}`, aicteId: id, bureau: home, category: cat, status: openStatus(), receivedAt: openReceived(cat), description: describe(cat), messyOpts: { noId: true } });
        else drafts.push({ key: `d${++dk}`, aicteId: id, bureau: rng.pick(['PGRC', 'RB', roOf(id)]), category: cat, status: 'Disposed', ...disposedTimes(cat), description: describe(cat), messyOpts: { noId: true } });
      }
    }
    reserved.add(a).add(b);
  }

  // Background complaints up to ~2,000. Open cases of one institution stay in one "home" bureau so overlaps are only the planted ones.
  const home = new Map<string, BureauCode>();
  const all = institutions.map((i) => i.aicteId).filter((id) => id !== HERO_ID);
  const instWeight = new Map(all.map((id) => [id, 0.5 + rng.next() * rng.next() * 4]));
  const weighted = all.map((id) => [id, instWeight.get(id)!] as const);
  const target = 2000;
  while (drafts.length < target) {
    const id = rng.weighted(weighted);
    if ((usedCats.get(id)?.size ?? 0) >= 9) continue;
    const cat = pickCategory(id);
    const t = bgTiming(cat);
    if (t.open && !reserved.has(id)) {
      if (!home.has(id)) home.set(id, rng.weighted([['PGRC', 45], ['RB', 20], [roOf(id), 30], ['OTHER', 5]] as const));
      drafts.push({ key: `d${++dk}`, aicteId: id, bureau: home.get(id)!, category: cat, status: openStatus(), receivedAt: t.receivedAt, description: describe(cat) });
    } else {
      const b: BureauCode = rng.weighted([['PGRC', 45], ['RB', 20], [roOf(id), 30], ['OTHER', 5]] as const);
      const times = t.open ? disposedTimes(cat) : { receivedAt: t.receivedAt, disposedAt: t.disposedAt };
      drafts.push({ key: `d${++dk}`, aicteId: id, bureau: b, category: cat, status: 'Disposed', ...times, description: describe(cat) });
    }
  }

  // ───────────── materialise cases ─────────────
  const index = buildIndex(institutions);
  const officerFor = (b: BureauCode) => rng.pick(OFFICERS[b]);
  // The hero cluster is the demo-role officers' own overlap; planted clusters go to their colleagues.
  const roleOfficers = new Set<string>([...ROLES.map((r) => r.officer), ...Object.values(REGIONAL_OFFICERS)]);
  const colleagueFor = (b: BureauCode) => {
    const pool = OFFICERS[b].filter((o) => !roleOfficers.has(o));
    return rng.pick(pool.length ? pool : OFFICERS[b]);
  };

  // Assign case IDs in received order per prefix/year, keeping hero IDs fixed and just after the generated range.
  const sorted = [...drafts].sort((a, b) => a.receivedAt - b.receivedAt);
  const countBy = new Map<string, number>();
  for (const d of sorted) {
    if (d.fixedId) continue;
    const k = `${prefixFor(d.bureau)}/${new Date(d.receivedAt).getFullYear()}`;
    countBy.set(k, (countBy.get(k) ?? 0) + 1);
  }
  const lastBefore: Record<string, number> = { 'PG/2026': 8840, 'RB/2026': 1272, 'RO/2026': 2960, 'OC/2026': 260 };
  const seqNext = new Map<string, number>();
  for (const [k, n] of countBy) seqNext.set(k, Math.max(1, (lastBefore[k] ?? n + 100) - n + 1));
  const keyToId = new Map<string, string>();
  for (const d of sorted) {
    if (d.fixedId) {
      keyToId.set(d.key, d.fixedId);
      continue;
    }
    const k = `${prefixFor(d.bureau)}/${new Date(d.receivedAt).getFullYear()}`;
    const n = seqNext.get(k)!;
    seqNext.set(k, n + 1);
    keyToId.set(d.key, `${k}/${String(n).padStart(5, '0')}`);
  }

  const cases: Case[] = [];
  const caseInstitution: Record<string, string> = {};
  for (const d of sorted) {
    const inst = instById.get(d.aicteId)!;
    const caseId = keyToId.get(d.key)!;
    const raw = d.rawText ?? messyInstitutionText(rng, inst, d.messyOpts).text;
    let match = matchInstitution(raw, index, { threshold: 85 });
    // Historical disposed cases were matched by officers at the time.
    if (d.status === 'Disposed' && !match.aicteId) {
      match = { ...match, aicteId: d.aicteId, method: 'manual', confidence: 100, confirmedBy: OFFICERS[d.bureau][0], reasons: ['Confirmed manually by officer', ...match.reasons.slice(0, 2)] };
    }
    const officer = d.officer ?? (d.planted ? colleagueFor(d.bureau) : officerFor(d.bureau));
    const transferredFrom: BureauCode | undefined = d.status === 'Transferred' ? (d.bureau === 'PGRC' ? 'RB' : 'PGRC') : undefined;
    const sla = DEFAULT_SLA[d.category];
    const actions = buildActions(rng, { receivedAt: d.receivedAt, bureau: d.bureau, officer, status: d.status, disposedAt: d.disposedAt, transferredFrom, category: d.category }, nowT);
    if (match.method === 'manual' && match.confirmedBy) {
      actions.splice(1, 0, { id: 'am', at: iso(d.receivedAt + 2 * 3600_000), by: match.confirmedBy, bureau: d.bureau, type: 'Match confirmed', remarks: `Linked to ${inst.name}` });
    }
    const ctype: ComplainantType = d.category === 'Salary not paid' ? rng.pick(['Faculty', 'Staff'] as const) : rng.weighted([['Student', 60], ['Parent', 30], ['Other', 10]] as const);
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const c: Case = {
      caseId,
      receivedAt: iso(d.receivedAt),
      rawInstitutionText: raw,
      match,
      category: d.category,
      description: d.description,
      complainant: {
        type: ctype, name: `${first} ${last}`,
        phone: `${rng.pick(['9', '8', '7', '6'])}${String(rng.int(100000000, 999999999))}`,
        email: `${first}.${last}${rng.int(1, 99)}@${rng.pick(['gmail.com', 'yahoo.co.in', 'outlook.com', 'rediffmail.com'])}`.toLowerCase(),
      },
      bureau: d.bureau,
      officer,
      status: d.status,
      lastAction: lastActionText(actions),
      nextAction: nextActionFor(d.status),
      expectedDisposal: iso(d.receivedAt + sla * DAY),
      slaDays: sla,
      disposedAt: d.disposedAt ? iso(d.disposedAt) : undefined,
      actions,
    };
    cases.push(c);
    caseInstitution[caseId] = d.aicteId;
  }

  // Next number per prefix/year: what new complaints will get.
  const counters: Record<string, number> = {};
  for (const [k, n] of seqNext) counters[k] = n;
  if (scenario === 'full') {
    counters['PG/2026'] = 9106;
    counters['RB/2026'] = 1274;
  } else {
    counters['PG/2026'] = 8841;
    counters['RB/2026'] = 1273;
  }

  const truth: GroundTruth = {
    caseInstitution,
    l1Clusters: truthL1.map((t) => ({ aicteId: t.aicteId, caseIds: t.keys.map((k) => keyToId.get(k)!) })),
    l2Pairs: truthL2.map(([a, b]) => [keyToId.get(a)!, keyToId.get(b)!]),
    lookalikePairs,
  };
  if (scenario === 'full') {
    truth.l1Clusters.unshift({ aicteId: HERO_ID, caseIds: [...HERO_CASE_IDS] });
    truth.l2Pairs.unshift([HERO_CASE_IDS[0], HERO_RO_CASE_ID]);
  }

  return { institutions, cases, truth, counters };
}

