import type { Institution, MatchCandidate, MatchResult } from '@/lib/types';
import { acronym, GENERIC, normalize, type Normalized, titleCase } from './normalize';
import { jaroWinkler, tokenSetRatio } from './similarity';

export interface MatchOptions {
  threshold?: number;
  abbreviations?: Record<string, string>;
}

interface Prepared {
  inst: Institution;
  /** Normalized token lists for the canonical name and each alias. */
  forms: { tokens: string[]; text: string; isAlias: boolean; label: string }[];
  acronym: string;
  initialsVariant: string | null;
  distinctiveInitials: string;
  city: string;
  district: string;
  pinPrefix: string;
}

export interface MatchIndex {
  prepared: Prepared[];
  byId: Map<string, Prepared>;
  byToken: Map<string, Set<number>>;
  byPrefix: Map<string, Set<number>>;
  byAcronym: Map<string, Set<number>>;
  byCity: Map<string, Set<number>>;
  /** Exact normalized form → institution indices (alias path). */
  byForm: Map<string, Set<number>>;
  cities: string[];
  abbreviations?: Record<string, string>;
}

function add(map: Map<string, Set<number>>, key: string, i: number) {
  let s = map.get(key);
  if (!s) map.set(key, (s = new Set()));
  s.add(i);
}

export function buildIndex(institutions: Institution[], abbreviations?: Record<string, string>): MatchIndex {
  const idx: MatchIndex = {
    prepared: [], byId: new Map(), byToken: new Map(), byPrefix: new Map(), byAcronym: new Map(), byCity: new Map(),
    byForm: new Map(), cities: [], abbreviations,
  };
  const citySet = new Set<string>();
  institutions.forEach((inst, i) => {
    const names = [inst.name, ...inst.aliases];
    const forms = names.map((n, k) => {
      const nn = normalize(n, { abbreviations });
      return { tokens: nn.tokens, text: nn.text, isAlias: k > 0, label: n };
    });
    const a = acronym(inst.name, abbreviations);
    const p: Prepared = {
      inst, forms, acronym: a.acronym, initialsVariant: a.initialsVariant, distinctiveInitials: a.distinctiveInitials,
      city: inst.city.toLowerCase(), district: inst.district.toLowerCase(), pinPrefix: inst.pincode.slice(0, 3),
    };
    idx.prepared.push(p);
    idx.byId.set(inst.aicteId, p);
    for (const f of forms) {
      add(idx.byForm, f.text, i);
      for (const t of f.tokens) {
        if (GENERIC.has(t)) continue;
        add(idx.byToken, t, i);
        if (t.length >= 3) add(idx.byPrefix, t.slice(0, 3), i);
      }
      // learnt alias that is itself an abbreviation (e.g. "svit")
      if (f.isAlias && f.tokens.length === 1) add(idx.byAcronym, f.tokens[0], i);
    }
    add(idx.byAcronym, a.acronym, i);
    if (a.distinctiveInitials.length >= 2) add(idx.byAcronym, a.distinctiveInitials, i);
    if (a.initialsVariant) add(idx.byForm, a.initialsVariant, i);
    add(idx.byCity, p.city, i);
    citySet.add(p.city);
    if (p.district !== p.city) citySet.add(p.district);
  });
  idx.cities = [...citySet].sort((x, y) => y.length - x.length);
  return idx;
}

export function normalizeForIndex(raw: string, idx: MatchIndex): Normalized {
  return normalize(raw, { abbreviations: idx.abbreviations, cities: idx.cities });
}

/** Cheap overlap pre-score so only the most promising institutions get the full (expensive) comparison. */
function candidateIndices(n: Normalized, idx: MatchIndex, limit = 14): number[] {
  const votes = new Map<number, number>();
  const vote = (s: Set<number> | undefined, w: number) => s?.forEach((i) => votes.set(i, (votes.get(i) ?? 0) + w));
  for (const t of n.tokens) {
    if (GENERIC.has(t)) continue;
    vote(idx.byToken.get(t), 3);
    if (t.length >= 3) vote(idx.byPrefix.get(t.slice(0, 3)), 2);
    vote(idx.byAcronym.get(t), 3);
  }
  vote(idx.byForm.get(n.text), 10);
  if (n.city) vote(idx.byCity.get(n.city), 1);
  if (!votes.size) return idx.prepared.map((_, i) => i);
  return [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([i]) => i);
}

/** How well the raw distinctive tokens cover the institution's distinctive tokens (handles initials). */
function distinctiveScores(raw: string[], rawInitials: string[], inst: string[]): { coverage: number; precision: number } {
  if (!inst.length) return { coverage: raw.length ? 0.3 : 1, precision: raw.length ? 0.3 : 1 };
  const covered = new Array<number>(inst.length).fill(0);
  const rawBest = new Array<number>(raw.length).fill(0);

  raw.forEach((r, ri) => {
    if (rawInitials.includes(r)) {
      // "sv" covers a consecutive run of inst tokens whose initials spell it
      for (let s = 0; s + r.length <= inst.length; s++) {
        const run = inst.slice(s, s + r.length);
        if (run.map((t) => t[0]).join('') === r) {
          for (let k = 0; k < run.length; k++) covered[s + k] = Math.max(covered[s + k], 0.8);
          rawBest[ri] = 0.8;
          break;
        }
      }
      return;
    }
    inst.forEach((t, ti) => {
      const s = r === t ? 1 : jaroWinkler(r, t);
      const v = s >= 0.82 ? s : 0;
      covered[ti] = Math.max(covered[ti], v);
      rawBest[ri] = Math.max(rawBest[ri], v);
    });
  });

  const coverage = covered.reduce((a, b) => a + b, 0) / inst.length;
  const precision = raw.length ? rawBest.reduce((a, b) => a + b, 0) / raw.length : 0.5;
  return { coverage, precision };
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach((t) => sb.has(t) && inter++);
  return inter / (sa.size + sb.size - inter);
}

interface Scored { i: number; score: number; method: MatchResult['method']; reasons: string[] }

function scoreOne(n: Normalized, i: number, idx: MatchIndex): Scored {
  const p = idx.prepared[i];
  const reasons: string[] = [];
  const cityHit = !!n.city && (n.city === p.city || n.city === p.district);
  const cityMiss = !!n.city && !cityHit;
  const pinHit = !!n.pinPrefix && n.pinPrefix === p.pinPrefix;
  const cityLabel = titleCase(p.inst.city);

  // 1) alias / exact normalized name
  const formHit = p.forms.find((f) => f.text === n.text);
  if (formHit && n.tokens.length) {
    let score = cityHit || pinHit ? 96 : 92;
    if (cityMiss) score = 72;
    reasons.push(formHit.isAlias ? `Known alias: “${formHit.label}”` : 'Exact name match after normalisation');
    if (cityHit) reasons.push(`Same city: ${cityLabel}`);
    if (pinHit) reasons.push(`Pincode ${p.inst.pincode.slice(0, 3)}XXX`);
    if (cityMiss) reasons.push(`City differs: ${titleCase(n.city!)} vs ${cityLabel}`);
    return { i, score, method: 'alias', reasons };
  }
  if (p.initialsVariant && p.initialsVariant === n.text) {
    let score = cityHit || pinHit ? 94 : 92;
    if (cityMiss) score = 70;
    const ini = n.initials[0] ?? p.distinctiveInitials;
    reasons.push(`Initials match: ${ini.toUpperCase().split('').join('.')}. → ${p.inst.name.split(' ').slice(0, ini.length).join(' ')}`);
    if (cityHit) reasons.push(`Same city: ${cityLabel}`);
    if (pinHit) reasons.push(`Pincode ${p.inst.pincode.slice(0, 3)}XXX`);
    return { i, score, method: 'alias', reasons };
  }

  // 2) acronym in the text ("SVIT Engg Clg")
  const acrTok = n.tokens.find((t) => t.length >= 3 && (t === p.acronym || p.forms.some((f) => f.isAlias && f.text === t)));
  if (acrTok) {
    const extra = n.tokens.filter((t) => t !== acrTok && !GENERIC.has(t));
    let score = cityHit ? 93 : 88;
    if (pinHit) score += 1;
    if (cityMiss) score = 68;
    score -= Math.min(10, extra.length * 5);
    reasons.push(`Abbreviation match: ${acrTok.toUpperCase()}`);
    if (cityHit) reasons.push(`Same city: ${cityLabel}`);
    if (pinHit) reasons.push(`Pincode ${p.inst.pincode.slice(0, 3)}XXX`);
    if (cityMiss) reasons.push(`City differs: ${titleCase(n.city!)} vs ${cityLabel}`);
    return { i, score, method: 'alias', reasons };
  }

  // 3) fuzzy: Jaro-Winkler + token-set blend on normalized names
  const rawDist = n.tokens.filter((t) => !GENERIC.has(t));
  const rawGen = n.tokens.filter((t) => GENERIC.has(t));
  let best = 0;
  let bestForm = p.forms[0];
  for (const f of p.forms) {
    const instDist = f.tokens.filter((t) => !GENERIC.has(t));
    const instGen = f.tokens.filter((t) => GENERIC.has(t));
    const d = distinctiveScores(rawDist, n.initials, instDist);
    const gen = jaccard(rawGen, instGen);
    const tsr = tokenSetRatio(n.tokens, f.tokens);
    const jw = jaroWinkler(n.text, f.text);
    const s = 100 * (0.45 * d.coverage + 0.2 * d.precision + 0.1 * gen + 0.1 * tsr + 0.15 * jw);
    if (s > best) {
      best = s;
      bestForm = f;
    }
  }
  let score = best;
  reasons.push(`Name similarity ${Math.round(best)}% (Jaro-Winkler + token set)`);
  if (bestForm.isAlias) reasons.push(`Closest to alias “${bestForm.label}”`);
  if (cityHit) {
    score += 6;
    reasons.push(`Same city: ${cityLabel}`);
  } else if (cityMiss) {
    score -= 15;
    reasons.push(`City differs: ${titleCase(n.city!)} vs ${cityLabel}`);
  }
  if (pinHit) {
    score += 3;
    reasons.push(`Pincode ${p.inst.pincode.slice(0, 3)}XXX`);
  }
  return { i, score: Math.min(95, Math.max(0, score)), method: 'fuzzy', reasons };
}

const round = (x: number) => Math.round(x);

/**
 * Match raw complaint text to an institution.
 * Order: exact AICTE ID → alias / acronym (+ same city) → fuzzy. Always returns up to 3 candidates.
 */
export function matchInstitution(raw: string, institutions: Institution[] | MatchIndex, opts: MatchOptions = {}): MatchResult {
  const threshold = opts.threshold ?? 85;
  const idx = Array.isArray(institutions) ? buildIndex(institutions, opts.abbreviations) : institutions;
  const n = normalizeForIndex(raw, idx);

  if (n.aicteId) {
    const p = idx.byId.get(n.aicteId);
    if (p) {
      const reasons = [`AICTE ID ${n.aicteId} found in text`];
      if (n.city && (n.city === p.city || n.city === p.district)) reasons.push(`Same city: ${titleCase(p.inst.city)}`);
      return {
        aicteId: p.inst.aicteId, confidence: 99, reasons, method: 'exact-id',
        candidates: [{ aicteId: p.inst.aicteId, name: p.inst.name, city: p.inst.city, confidence: 99, reasons }],
      };
    }
  }

  const scored = candidateIndices(n, idx).map((i) => scoreOne(n, i, idx));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  if (!top.length || top[0].score <= 0) {
    return { aicteId: null, confidence: 0, reasons: ['No plausible institution found'], method: 'fuzzy', candidates: [] };
  }

  const first = top[0];
  let confidence = first.score;
  const reasons = [...first.reasons];
  // Look-alike guard: two institutions scoring almost the same never auto-link.
  const second = top[1];
  const gap = first.method !== 'fuzzy' && second?.method === 'fuzzy' ? 4 : 6;
  if (second && first.score - second.score < gap && second.score >= 60) {
    confidence = Math.min(confidence, 80);
    reasons.push(`Look-alike: ${idx.prepared[second.i].inst.name} scores ${round(second.score)}%`);
  }
  // Shared acronym/initials across institutions (no city to disambiguate)
  if (first.method === 'alias' && second && second.method === 'alias' && Math.abs(first.score - second.score) < 3) {
    confidence = Math.min(confidence, 78);
  }

  const candidates: MatchCandidate[] = top.map((s, k) => ({
    aicteId: idx.prepared[s.i].inst.aicteId,
    name: idx.prepared[s.i].inst.name,
    city: idx.prepared[s.i].inst.city,
    confidence: round(k === 0 ? confidence : Math.min(s.score, confidence - 1)),
    reasons: s.reasons,
  }));

  const conf = round(confidence);
  return {
    aicteId: conf >= threshold ? idx.prepared[first.i].inst.aicteId : null,
    confidence: conf,
    reasons,
    method: first.method,
    candidates,
  };
}
