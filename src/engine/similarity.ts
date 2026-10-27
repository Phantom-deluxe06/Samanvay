/** String and text similarity primitives. Mirrors RapidFuzz / scikit-learn behaviour closely enough for the prototype. */

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const window = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array<boolean>(la).fill(false);
  const mb = new Array<boolean>(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(i + window + 1, lb);
    for (let j = lo; j < hi; j++) {
      if (mb[j] || a[i] !== b[j]) continue;
      ma[i] = mb[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / la + matches / lb + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < la && prefix < lb && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Indel-normalised similarity (RapidFuzz `ratio` / 100): 2·LCS / (|a|+|b|). */
export function ratio(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  const cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}

/** RapidFuzz-style token_set_ratio in 0..1. */
export function tokenSetRatio(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((t) => sb.has(t)).sort();
  const da = [...sa].filter((t) => !sb.has(t)).sort();
  const db = [...sb].filter((t) => !sa.has(t)).sort();
  const t0 = inter.join(' ');
  const t1 = [...inter, ...da].join(' ').trim();
  const t2 = [...inter, ...db].join(' ').trim();
  if (!t1 && !t2) return 1;
  const scores = [ratio(t1, t2)];
  if (t0) scores.push(ratio(t0, t1), ratio(t0, t2));
  return Math.max(...scores);
}

// ───────────────────────── complaint-text similarity (L2) ─────────────────────────

const TEXT_STOP = new Set([
  'i', 'me', 'my', 'we', 'our', 'us', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had',
  'and', 'or', 'of', 'to', 'in', 'on', 'for', 'from', 'by', 'with', 'at', 'it', 'its', 'this', 'that', 'they', 'them',
  'their', 'he', 'she', 'his', 'her', 'college', 'institute', 'institution', 'management', 'please', 'kindly', 'sir',
  'madam', 'even', 'also', 'still', 'after', 'since', 'now', 'so', 'but', 'as', 'all', 'any', 'no', 'not', 'yet',
  'being', 'which', 'who', 'what', 'when', 'despite', 'into', 'about', 'than', 'then', 'there', 'here', 'will', 'would',
  'can', 'could', 'should', 'may', 'do', 'does', 'did', 'done', 'request', 'requested', 'take', 'action', 'aicte',
  'rs', 'year', 'years', 'given', 'again', 'every', 'night', 'five', 'reason', 'middle', 'continues', 'happen', 'never', 'due', 'asked', 'get', 'got', 'very', 'most', 'posts', 'filled', 'student', 'students', 'during', 'without', 'only', 'more', 'many', 'some', 'several',
]);

/** Category-synonym map: different words for the same issue collapse to one concept token. */
export const CONCEPTS: Record<string, string[]> = {
  CERT: ['certificate', 'certificates', 'marksheet', 'marksheets', 'mark', 'marks', 'original', 'originals', 'documents', 'document', 'transcript', 'transcripts', 'tc', 'degree', 'provisional', 'migration'],
  WITHHOLD: ['withheld', 'withhold', 'withholding', 'holding', 'retained', 'retain', 'retaining', 'returning', 'return', 'returned', 'release', 'released', 'releasing', 'refusing', 'refused', 'refuse', 'denied', 'deny', 'kept', 'keeping', 'hand', 'handed', 'giving', 'give', 'back'],
  LEAVE: ['left', 'leave', 'leaving', 'quit', 'discontinued', 'discontinue', 'completed', 'completing', 'passed', 'graduated', 'transfer', 'joined', 'another', 'job'],
  FEE: ['fee', 'fees', 'charges', 'charge', 'charged', 'charging', 'amount', 'money', 'collected', 'collecting', 'collection', 'demanded', 'demanding', 'dues', 'payment', 'lakh', 'rupees', 'tuition'],
  EXCESS: ['excess', 'extra', 'additional', 'over', 'higher', 'inflated', 'beyond', 'exorbitant', 'unauthorised', 'unauthorized', 'hidden', 'arbitrary', 'hike', 'hiked', 'increase', 'increased'],
  RECEIPT: ['receipt', 'receipts', 'unreceipted', 'cash', 'bill'],
  SALARY: ['salary', 'salaries', 'wages', 'wage', 'pay', 'paid', 'unpaid', 'remuneration', 'arrears', 'payroll'],
  FACULTY: ['faculty', 'teacher', 'teachers', 'staff', 'lecturer', 'lecturers', 'professor', 'professors', 'teaching', 'hod', 'employees', 'employee'],
  MONTHS: ['months', 'month', 'delayed', 'delay', 'pending', 'overdue'],
  RAGGING: ['ragging', 'ragged', 'harassment', 'harassed', 'harass', 'bullying', 'bullied', 'seniors', 'senior', 'abuse', 'abused', 'assault', 'threatened', 'intimidation'],
  HOSTEL: ['hostel', 'mess', 'room', 'dormitory'],
  LAB: ['lab', 'labs', 'laboratory', 'laboratories', 'equipment', 'infrastructure', 'classroom', 'classrooms', 'building', 'library', 'computers', 'machines', 'workshop', 'facilities', 'broken', 'nonfunctional'],
  SHORTAGE: ['shortage', 'vacant', 'vacancies', 'insufficient', 'inadequate', 'lack', 'lacking', 'missing', 'few', 'unqualified'],
  INTAKE: ['intake', 'seats', 'seat', 'sanctioned', 'approved', 'approval', 'unapproved', 'capacity', 'admitted', 'additional'],
  ADMISSION: ['admission', 'admissions', 'capitation', 'donation', 'counselling', 'counseling', 'quota', 'merit', 'eligibility', 'irregular', 'irregularity'],
  SCHOLAR: ['scholarship', 'scholarships', 'refund', 'refunded', 'reimbursement', 'stipend', 'fellowship', 'caution', 'deposit', 'cancellation', 'cancelled'],
  EXAM: ['exam', 'exams', 'examination', 'hall', 'ticket', 'results', 'result'],
  COURSE: ['course', 'program', 'programme', 'branch', 'btech', 'diploma', 'mba', 'mca', 'semester'],
};

const CONCEPT_SET = new Set(Object.keys(CONCEPTS));
const WORD_TO_CONCEPT: Record<string, string> = {};
for (const [concept, words] of Object.entries(CONCEPTS)) for (const w of words) WORD_TO_CONCEPT[w] = concept;

export function conceptTokens(text: string): string[] {
  const out: string[] = [];
  for (const w of text.toLowerCase().replace(/[^a-z ]+/g, ' ').split(' ')) {
    if (!w || w.length < 2 || TEXT_STOP.has(w)) continue;
    out.push(WORD_TO_CONCEPT[w] ?? WORD_TO_CONCEPT[w.replace(/s$/, '')] ?? w);
  }
  return out;
}

export type Idf = Map<string, number>;

export function buildIdf(docs: string[]): Idf {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(conceptTokens(d))) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length || 1;
  const idf: Idf = new Map();
  for (const [t, f] of df) idf.set(t, Math.log((1 + n) / (1 + f)) + 1);
  return idf;
}

function tfidf(text: string, idf: Idf): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of conceptTokens(text)) v.set(t, (v.get(t) ?? 0) + 1);
  const defaultIdf = idf.size ? Math.max(...idf.values()) : 1;
  // Concept tokens carry the issue; leftover words only add a little (they are often rare and would dominate IDF).
  for (const [t, c] of v) v.set(t, (1 + Math.log(c)) * (idf.get(t) ?? defaultIdf) * (CONCEPT_SET.has(t) ? 1 : 0.3));
  return v;
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, x] of a) {
    na += x * x;
    const y = b.get(t);
    if (y) dot += x * y;
  }
  for (const y of b.values()) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * L2 "same issue?" similarity: TF-IDF cosine over concept-mapped tokens,
 * nudged up when both complaints carry the same category.
 */
export function issueSimilarity(textA: string, textB: string, idf: Idf, sameCategory: boolean): number {
  const cos = cosine(tfidf(textA, idf), tfidf(textB, idf));
  const s = sameCategory ? 0.75 * cos + 0.25 : 0.85 * cos;
  return Math.round(Math.min(1, s) * 100) / 100;
}
