import type { Institution } from '@/lib/types';
import type { Rng } from './rng';

const SHORT: Record<string, string[]> = {
  Institute: ['Inst.', 'Instt.', 'Institue', 'Inst'],
  Engineering: ['Engg', 'Engg.', 'Eng.', 'Engineerig'],
  College: ['Clg', 'Coll.', 'Colg', 'College'],
  Technology: ['Tech.', 'Tech', 'Technlogy'],
  Management: ['Mgmt', 'Mgmt.', 'Management'],
  Polytechnic: ['Poly.', 'Polytech', 'Polytechnic'],
  Pharmacy: ['Pharm.', 'Pharmacy'],
  Architecture: ['Arch.', 'Architecture'],
  Science: ['Sci.', 'Science'],
  Computer: ['Comp.', 'Computer'],
  Applications: ['Appl.', 'Applications'],
};

const GENERIC_WORDS = new Set(['Institute', 'Engineering', 'College', 'Technology', 'Management', 'Polytechnic', 'Pharmacy', 'Architecture',
  'Science', 'Computer', 'Applications', 'Studies', 'School', 'Business', 'Technical', 'Education', 'of', 'and']);

function typo(rng: Rng, word: string): string {
  if (word.length < 5) return word;
  const i = rng.int(1, word.length - 2);
  switch (rng.int(0, 2)) {
    case 0: return word.slice(0, i) + word.slice(i + 1); // deletion
    case 1: return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2); // transposition
    default: return word.slice(0, i) + word[i] + word.slice(i); // doubling
  }
}

export interface MessyOptions { forceId?: boolean; noId?: boolean }

/**
 * Turn a canonical institution name into the kind of thing complainants actually write:
 * abbreviations, dropped words, initials, typos, missing city, extra words, occasional AICTE ID.
 */
export function messyInstitutionText(rng: Rng, inst: Institution, opts: MessyOptions = {}): { text: string; kind: string[] } {
  const words = inst.name.split(' ');
  const kind: string[] = [];
  const distinct = words.filter((w) => !GENERIC_WORDS.has(w));
  let out = [...words];

  const r = rng.next();
  if (r < 0.12 && words.length >= 3) {
    // Acronym form: "SVIT Engg Clg"
    const acr = words.filter((w) => w !== 'of' && w !== 'and').map((w) => w[0]).join('').toUpperCase();
    out = [acr, ...(rng.chance(0.5) ? [rng.pick(['Engg Clg', 'College', 'Clg'])] : [])];
    kind.push('acronym');
  } else if (r < 0.24 && distinct.length >= 2) {
    // Initials: "S.V. Institute of Technology"
    const ini = distinct.map((w) => `${w[0]}.`).join('');
    out = [ini, ...words.slice(distinct.length)];
    kind.push('initials');
  } else {
    if (rng.chance(0.55)) {
      out = out.map((w) => (SHORT[w] && rng.chance(0.75) ? rng.pick(SHORT[w]) : w));
      kind.push('abbrev');
    }
    if (rng.chance(0.25)) {
      out = out.filter((w, i) => !(w === 'of' && rng.chance(0.7)) && !(i === 0 && /^(Sri|Shri|Sree|Saint|Swami)$/.test(w) && rng.chance(0.6)));
      kind.push('dropped');
    }
    if (rng.chance(0.3)) {
      const idxs = out.map((w, i) => (!GENERIC_WORDS.has(w) && w.length >= 5 ? i : -1)).filter((i) => i >= 0);
      if (idxs.length) {
        const i = rng.pick(idxs);
        out[i] = typo(rng, out[i]);
        if (rng.chance(0.25)) out[i] = typo(rng, out[i]);
        kind.push('typo');
      }
    }
  }

  let text = out.join(' ');
  const c = rng.next();
  if (c < 0.5) text += `, ${inst.city}`;
  else if (c < 0.62) text += `, ${inst.city}-${inst.pincode.slice(0, 3)}XXX`;
  else if (c < 0.7) text += ` ${inst.city}`;
  else kind.push('no-city');

  const caseR = rng.next();
  if (caseR < 0.08) text = text.toUpperCase();
  else if (caseR < 0.16) text = text.toLowerCase();

  if (!opts.noId && (opts.forceId || rng.chance(0.3))) {
    text += rng.pick([` (AICTE ID ${inst.aicteId})`, ` - ${inst.aicteId}`, ` AICTE: ${inst.aicteId}`]);
    kind.push('id');
  }
  return { text, kind };
}

/** Mask a phone number: 9876543221 → 98XXXXXX21. */
export function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length < 4 ? 'XXXX' : `${d.slice(0, 2)}XXXXXX${d.slice(-2)}`;
}

export function maskEmail(e: string): string {
  const [u, dom] = e.split('@');
  if (!dom) return 'XXXX';
  return `${u.slice(0, 2)}${'X'.repeat(Math.max(3, u.length - 2))}@${dom}`;
}
