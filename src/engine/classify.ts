import type { Category } from '@/lib/types';

/** Keyword classifier for the "suggest category" button. */
export const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  'Certificates withheld': ['certificate', 'marksheet', 'original', 'tc', 'transcript', 'withheld', 'withholding', 'migration', 'documents', 'degree'],
  'Excess fee collection': ['excess', 'extra fee', 'fee', 'fees', 'charged', 'hidden', 'cash', 'receipt', 'hike', 'collected'],
  'Salary not paid': ['salary', 'wages', 'unpaid', 'arrears', 'pay scale', 'payroll', 'remuneration'],
  Ragging: ['ragging', 'ragged', 'senior', 'harass', 'bully', 'threat'],
  'Infrastructure / lab': ['lab', 'laboratory', 'equipment', 'infrastructure', 'classroom', 'library', 'building', 'toilet', 'water'],
  'Faculty shortage': ['faculty shortage', 'no faculty', 'vacant', 'teachers', 'shortage', 'hod', 'qualified faculty'],
  'Unapproved intake': ['intake', 'beyond approved', 'without approval', 'unapproved', 'sanctioned', 'capacity'],
  'Admission irregularity': ['admission', 'capitation', 'donation', 'merit', 'counselling', 'quota', 'eligibility'],
  'Scholarship / refund': ['scholarship', 'refund', 'caution deposit', 'waiver', 'stipend', 'cancelled'],
  Other: [],
};

/** Keyword classifier behind the intake form's "Suggest" button. Returns the best category and the words that triggered it. */
export function suggestCategory(description: string): { category: Category; hits: string[] } {
  const text = ` ${description.toLowerCase()} `;
  let best: { category: Category; hits: string[] } = { category: 'Other', hits: [] };
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    const hits = words.filter((w) => text.includes(w));
    if (hits.length > best.hits.length) best = { category: cat, hits };
  }
  return best;
}
