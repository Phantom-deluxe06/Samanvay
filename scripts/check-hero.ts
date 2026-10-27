/* Prints the engine's match for the three hero spellings and seed-level quality stats. Run: npm run check:hero */
import { generateSeed, HERO_ID } from '../src/mock/seed';
import { buildIndex, matchInstitution } from '../src/engine/match';
import { buildIdf, issueSimilarity } from '../src/engine/similarity';
import { HERO_TEXTS } from '../src/mock/texts';

const t0 = Date.now();
const seed = generateSeed('full');
console.log(`Seed: ${seed.institutions.length} institutions, ${seed.cases.length} cases in ${Date.now() - t0} ms`);

const idx = buildIndex(seed.institutions);
for (const raw of ['SVIT Engg Clg, Chennai', 'Sri Venkatesa Inst. of Tech.', 'S.V. Institute of Technology']) {
  const m = matchInstitution(raw, idx);
  console.log(`\n"${raw}" → ${m.aicteId} (${m.confidence}%, ${m.method}) ${m.aicteId === HERO_ID ? 'OK' : 'FAIL'}`);
  m.reasons.forEach((r) => console.log(`   · ${r}`));
}

const truth = seed.truth.caseInstitution;
let auto = 0, correct = 0, queue = 0, openQueue = 0;
const wrong: string[] = [];
for (const c of seed.cases) {
  const m = c.match.method === 'manual' ? null : c.match;
  if (!m) { queue++; continue; }
  if (m.aicteId) { auto++; if (m.aicteId === truth[c.caseId]) correct++; else wrong.push(`${c.rawInstitutionText} → ${m.candidates?.[0]?.name} [true: ${seed.institutions.find(i=>i.aicteId===truth[c.caseId])?.name}]`); }
  else { queue++; if (c.status !== 'Disposed') openQueue++; }
}
console.log(`\nAuto-linked ${auto}/${seed.cases.length}, accuracy ${(100 * correct / auto).toFixed(1)}%, below-threshold ${queue} (open in queue: ${openQueue})`);
console.log('Sample wrong links:'); wrong.slice(0, 12).forEach((w) => console.log('  ' + w));

const idf = buildIdf(seed.cases.map((c) => c.description));
console.log(`\nHero L2 (certificates vs RO 2025): ${issueSimilarity(HERO_TEXTS.certificates, HERO_TEXTS.roDisposed, idf, true)}`);
const byId = new Map(seed.cases.map((c) => [c.caseId, c]));
for (const [a, b] of seed.truth.l2Pairs) {
  const A = byId.get(a)!, B = byId.get(b)!;
  console.log(`L2 ${a} ~ ${b}: ${issueSimilarity(A.description, B.description, idf, A.category === B.category)}`);
}
