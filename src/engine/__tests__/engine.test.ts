import { beforeAll, describe, expect, it } from 'vitest';
import { generateSeed, HERO_CASE_IDS, HERO_ID, HERO_RO_CASE_ID, type SeedResult } from '@/mock/seed';
import { acronym, normalize } from '@/engine/normalize';
import { buildIndex, matchInstitution, type MatchIndex } from '@/engine/match';
import { detectOverlaps, suggestLead } from '@/engine/overlap';
import { buildIdf, issueSimilarity, jaroWinkler, tokenSetRatio } from '@/engine/similarity';
import { riskScore } from '@/engine/risk';
import { suggestCategory } from '@/engine/classify';
import { ANCHOR } from '@/lib/constants';
import type { Case } from '@/lib/types';

let seed: SeedResult;
let idx: MatchIndex;

beforeAll(() => {
  seed = generateSeed('full');
  idx = buildIndex(seed.institutions);
});

describe('normalize', () => {
  it('expands abbreviations, drops stop-words and extracts city, pincode and AICTE ID', () => {
    const n = normalize('SVIT Engg Clg, Chennai-600XXX (AICTE ID 1-4417XXXXXX)', { cities: ['chennai'] });
    expect(n.tokens).toEqual(['svit', 'engineering', 'college']);
    expect(n.city).toBe('chennai');
    expect(n.pinPrefix).toBe('600');
    expect(n.aicteId).toBe('1-4417XXXXXX');
  });
  it('merges initials', () => {
    const n = normalize('S.V. Institute of Technology');
    expect(n.tokens).toEqual(['sv', 'institute', 'technology']);
    expect(n.initials).toEqual(['sv']);
  });
  it('builds acronyms and initials variants', () => {
    expect(acronym('Sri Venkatesa Institute of Technology')).toMatchObject({ acronym: 'svit', initialsVariant: 'sv institute technology' });
  });
});

describe('similarity primitives', () => {
  it('jaro-winkler is 1 for equal strings and high for typos', () => {
    expect(jaroWinkler('venkatesa', 'venkatesa')).toBe(1);
    expect(jaroWinkler('venkatesa', 'venkatsa')).toBeGreaterThan(0.9);
  });
  it('token set ratio ignores order', () => {
    expect(tokenSetRatio(['kaveri', 'engineering', 'college'], ['college', 'engineering', 'kaveri'])).toBe(1);
  });
});

describe('matchInstitution', () => {
  it.each(['SVIT Engg Clg, Chennai', 'Sri Venkatesa Inst. of Tech.', 'S.V. Institute of Technology'])(
    'hero spelling "%s" links to 1-4417XXXXXX with at least 85% confidence',
    (raw) => {
      const m = matchInstitution(raw, idx);
      expect(m.aicteId).toBe(HERO_ID);
      expect(m.confidence).toBeGreaterThanOrEqual(85);
      expect(m.reasons.length).toBeGreaterThan(0);
    },
  );

  it('uses the exact AICTE ID when present', () => {
    const m = matchInstitution('some college (AICTE ID 1-4417XXXXXX)', idx);
    expect(m).toMatchObject({ aicteId: HERO_ID, confidence: 99, method: 'exact-id' });
  });

  it('returns at most 3 candidates', () => {
    const m = matchInstitution('Kaveri college', idx);
    expect(m.candidates!.length).toBeGreaterThan(0);
    expect(m.candidates!.length).toBeLessThanOrEqual(3);
  });

  it('never auto-links a short spelling of a look-alike institution to its twin', () => {
    for (const [a, b] of seed.truth.lookalikePairs) {
      for (const [self, twin] of [[a, b], [b, a]]) {
        const inst = seed.institutions.find((i) => i.aicteId === self)!;
        const raw = `${inst.name.split(' ').filter((w) => !/^(of|and)$/.test(w)).slice(0, 2).join(' ')}, ${inst.city}`;
        expect(matchInstitution(raw, idx).aicteId).not.toBe(twin);
      }
    }
  });

  it('never auto-links a seeded look-alike complaint to the twin institution', () => {
    const twin = new Map<string, string>();
    for (const [a, b] of seed.truth.lookalikePairs) twin.set(a, b).set(b, a);
    const wrong = seed.cases.filter((c) => {
      const truth = seed.truth.caseInstitution[c.caseId];
      return twin.has(truth) && c.match.method !== 'manual' && c.match.aicteId === twin.get(truth);
    });
    expect(wrong.map((c) => c.rawInstitutionText)).toEqual([]);
  });

  it('is at least 95% accurate on auto-linked synthetic cases', () => {
    const auto = seed.cases.filter((c) => c.match.method !== 'manual' && c.match.aicteId);
    const ok = auto.filter((c) => c.match.aicteId === seed.truth.caseInstitution[c.caseId]);
    expect(ok.length / auto.length).toBeGreaterThanOrEqual(0.95);
  });
});

describe('overlap detection on the hero cluster', () => {
  const byId = () => new Map(seed.cases.map((c) => [c.caseId, c]));
  const idf = () => buildIdf(seed.cases.map((c) => c.description));

  it('L1: the PGRC certificates case overlaps the RB fees case', () => {
    const c = byId().get(HERO_CASE_IDS[0])!;
    const { l1 } = detectOverlaps(c, seed.cases, { idf: idf() });
    expect(l1.map((x) => x.caseId)).toContain(HERO_CASE_IDS[1]);
    expect(l1.every((x) => x.bureau !== c.bureau)).toBe(true);
  });

  it('L2: the certificates complaint is the same issue as the 2025 RO-South case', () => {
    const c = byId().get(HERO_CASE_IDS[0])!;
    const { l2 } = detectOverlaps(c, seed.cases, { idf: idf(), l2Threshold: 0.75 });
    const hit = l2.find((h) => h.case.caseId === HERO_RO_CASE_ID);
    expect(hit).toBeDefined();
    expect(hit!.similarity).toBeGreaterThanOrEqual(0.75);
  });

  it('different issues are not flagged as L2', () => {
    const m = byId();
    const a = m.get(HERO_CASE_IDS[1])!;
    const b = m.get(HERO_CASE_IDS[2])!;
    expect(issueSimilarity(a.description, b.description, idf(), false)).toBeLessThan(0.75);
  });

  it('suggests RB as lead when RB is involved', () => {
    const m = byId();
    expect(suggestLead(HERO_CASE_IDS.map((id) => m.get(id)!))).toBe('RB');
  });

  it('otherwise suggests the bureau with the oldest open case', () => {
    const cs = [
      { bureau: 'PGRC', receivedAt: '2026-05-02', status: 'Under process' },
      { bureau: 'RO-S', receivedAt: '2026-04-01', status: 'Under process' },
    ] as Pick<Case, 'bureau' | 'receivedAt' | 'status'>[];
    expect(suggestLead(cs)).toBe('RO-S');
  });
});

describe('risk score and classifier', () => {
  it('rates the hero institution as high risk', () => {
    const r = riskScore(seed.cases.filter((c) => seed.truth.caseInstitution[c.caseId] === HERO_ID), ANCHOR);
    expect(r.label).toBe('High');
  });

  it('suggests a category from keywords', () => {
    expect(suggestCategory('The college is not returning my original certificates').category).toBe('Certificates withheld');
    expect(suggestCategory('Faculty salary unpaid for 4 months').category).toBe('Salary not paid');
  });
});
