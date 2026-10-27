import { DEFAULT_ABBREVIATIONS } from '@/lib/constants';

export const STOPWORDS = new Set(['of', 'the', 'and', 'for', 'at', 'in', 'a', 'an', 'to']);

/** Words that describe *what kind* of institution it is, not *which* one. */
export const GENERIC = new Set([
  'institute', 'technology', 'college', 'engineering', 'management', 'polytechnic', 'university', 'science', 'sciences',
  'studies', 'pharmacy', 'architecture', 'school', 'academy', 'research', 'applications', 'computer', 'business',
  'arts', 'advanced', 'technical', 'professional', 'education', 'women', 'institution', 'institutions', 'group',
]);

/** Noise that complainants add around the name. */
const NOISE = new Set(['aicte', 'id', 'pin', 'pincode', 'no', 'district', 'near', 'opp', 'ltd']);

export interface NormalizeOptions {
  abbreviations?: Record<string, string>;
  /** Lower-cased city names known to the system; multi-word cities allowed. */
  cities?: string[];
}

export interface Normalized {
  tokens: string[];
  /** Tokens joined with single spaces. */
  text: string;
  /** Tokens that were written as initials, e.g. "S.V." → "sv". */
  initials: string[];
  aicteId?: string;
  pincode?: string;
  pinPrefix?: string;
  city?: string;
}

const CITY_RE = new Map<string, RegExp>();
function cityRe(city: string): RegExp {
  let re = CITY_RE.get(city);
  if (!re) CITY_RE.set(city, (re = new RegExp(`(^| )${city.replace(/[^a-z ]/g, '')}( |$)`)));
  return re;
}

export const AICTE_ID_RE = /\b1-[0-9X]{10}\b/i;
const PIN_RE = /\b(\d{3})\s?(\d{3}|x{3})\b/i;

export function normalize(raw: string, opts: NormalizeOptions = {}): Normalized {
  const abbreviations = opts.abbreviations ?? DEFAULT_ABBREVIATIONS;
  let s = ` ${raw} `;
  const out: Normalized = { tokens: [], text: '', initials: [] };

  const id = s.match(AICTE_ID_RE);
  if (id) {
    out.aicteId = id[0].toUpperCase();
    s = s.replace(id[0], ' ');
  }
  const pin = s.match(PIN_RE);
  if (pin) {
    out.pinPrefix = pin[1];
    if (/^\d{3}$/.test(pin[2])) out.pincode = pin[1] + pin[2];
    s = s.replace(pin[0], ' ');
  }

  s = s.toLowerCase().replace(/&/g, ' and ');
  // "S.V." / "S. V." → "s v" (kept as separate single letters, merged below)
  s = s.replace(/[^a-z0-9]+/g, ' ');

  if (opts.cities?.length) {
    for (const city of opts.cities) {
      const re = cityRe(city);
      if (re.test(s)) {
        out.city = city;
        s = s.replace(re, ' ');
        break;
      }
    }
  }

  const raw0 = s.split(' ').filter(Boolean);
  const expanded: string[] = [];
  for (const t of raw0) {
    if (/^\d+$/.test(t) || NOISE.has(t)) continue;
    const e = abbreviations[t] ?? t;
    for (const part of e.split(' ')) if (part && !STOPWORDS.has(part)) expanded.push(part);
  }

  // Merge runs of single letters: ["s","v","institute"] → ["sv","institute"]
  const tokens: string[] = [];
  let run = '';
  for (const t of expanded) {
    if (t.length === 1) {
      run += t;
      continue;
    }
    if (run) {
      tokens.push(run);
      if (run.length > 1) out.initials.push(run);
      run = '';
    }
    tokens.push(t);
  }
  if (run) {
    tokens.push(run);
    if (run.length > 1) out.initials.push(run);
  }

  out.tokens = tokens;
  out.text = tokens.join(' ');
  return out;
}

export function isGeneric(token: string): boolean {
  return GENERIC.has(token);
}

/** Normalized canonical tokens for an institution name (no city stripping needed). */
export function nameTokens(name: string, abbreviations?: Record<string, string>): string[] {
  return normalize(name, { abbreviations }).tokens;
}

/**
 * "Sri Venkatesa Institute of Technology" → { acronym: "svit", initialsVariant: "sv institute technology" }.
 */
export function acronym(name: string, abbreviations?: Record<string, string>): { acronym: string; initialsVariant: string | null; distinctiveInitials: string } {
  const toks = nameTokens(name, abbreviations);
  const acr = toks.map((t) => t[0]).join('');
  const distinct: string[] = [];
  let i = 0;
  while (i < toks.length && !GENERIC.has(toks[i])) distinct.push(toks[i++]);
  const rest = toks.slice(i);
  const distinctiveInitials = distinct.map((t) => t[0]).join('');
  const initialsVariant = distinct.length >= 2 ? [distinctiveInitials, ...rest].join(' ') : null;
  return { acronym: acr, initialsVariant, distinctiveInitials };
}

export function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
