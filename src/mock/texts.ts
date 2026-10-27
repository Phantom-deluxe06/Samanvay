import type { Category } from '@/lib/types';

/** Background complaint texts. Slots: {course} {amount} {months} {yr}. */
export const DESCRIPTIONS: Record<Category, string[]> = {
  'Certificates withheld': [
    'I completed my {course} in {yr} but the college has not released my original 10th and 12th certificates. They say I must first pay pending dues.',
    'My provisional degree certificate and migration certificate are being held back by the office for over {months} months.',
    'Requested my TC and transcripts for higher studies abroad. Administration keeps postponing and now asks for a no-dues clearance that was already given.',
    'Original documents submitted at admission are not handed over even though I have cancelled admission within the allowed period.',
  ],
  'Excess fee collection': [
    'The institute collected Rs {amount} over and above the fee fixed by the fee regulatory committee for {course}. No receipt was issued for the extra amount.',
    'We were charged hidden charges for "development" and "placement training" totalling Rs {amount} this semester, which is not part of the approved fee.',
    'Hostel and bus fees were hiked mid-year without notice. Parents were told to pay Rs {amount} in cash.',
    'Tuition fee demanded for the full course in advance for {course}, against norms. Students who refused were threatened with detention.',
  ],
  'Salary not paid': [
    'Faculty of the {course} department have not been paid salary for the last {months} months. Management gives no written reason.',
    'I worked as assistant professor and resigned in {yr}. My last {months} months of wages and PF are still unpaid.',
    'Teaching staff are paid far below the pay scale shown in the AICTE disclosure. Arrears from the pay revision are pending.',
    'Non-teaching staff salaries delayed every month by 45-60 days; several employees have taken loans to survive.',
  ],
  Ragging: [
    'First-year students in the hostel are being ragged by seniors late at night. Wardens ignore complaints.',
    'My son was harassed and physically threatened by a group of seniors. The anti-ragging committee has not met.',
    'Seniors forcing juniors to do assignments and perform humiliating acts in the mess. Anti-ragging helpline poster missing.',
  ],
  'Infrastructure / lab': [
    'Labs for {course} have broken equipment; most practicals are done only on paper. Library has very few books.',
    'Computer lab has 20 working machines for 180 students. Workshop machines have not been serviced in years.',
    'Classrooms leak during monsoon and there is no proper drinking water or toilets in the academic block.',
    'Approved building shown during inspection is used by another trust; our classes run in a rented hall.',
  ],
  'Faculty shortage': [
    'The {course} department has only 3 regular teachers for four batches. Most classes are taken by final-year students.',
    'No qualified faculty for core subjects this semester; timetable shows "TBA" for half the periods.',
    'HOD post vacant for two years; visiting lecturers change every month and syllabus is not completed.',
  ],
  'Unapproved intake': [
    'The college admitted around {amount} more students than its approved intake for {course}. Extra students were told their results will be "adjusted".',
    'A new {course} branch is being advertised and run without AICTE approval. We were not told this at admission.',
    'Lateral entry seats filled beyond sanctioned capacity; some students have no university registration number.',
  ],
  'Admission irregularity': [
    'Management quota seats sold for capitation of Rs {amount}. Merit list not displayed publicly.',
    'Eligible candidates from the counselling list were refused admission and seats given to lower-ranked applicants.',
    'Admission confirmed without verifying eligibility; now the university has cancelled the registration of several students.',
  ],
  'Scholarship / refund': [
    'Post-matric scholarship amount credited to the college was not passed on to me for {yr}.',
    'I cancelled my admission before the cut-off date but the college is refusing to refund the fee of Rs {amount}.',
    'Caution deposit of Rs {amount} not refunded after course completion despite repeated emails.',
    'Tuition fee waiver scheme benefit was denied; college says the quota is "full" although AICTE portal shows vacancies.',
  ],
  Other: [
    'Institute is not displaying mandatory disclosure information on its website as required by AICTE.',
    'Internal complaints committee and grievance cell exist only on paper; no meeting held this year.',
    'Students forced to buy uniforms, books and laptops only from a vendor linked to the management.',
  ],
};

/**
 * Planted L2 pairs: the same issue in different words. Index 0 is the earlier complaint.
 * The pairs share the underlying concepts (via the synonym map) but not the wording.
 */
export const L2_PAIRS: { category: Category; a: string; b: string }[] = [
  { category: 'Certificates withheld', a: 'College not returning my original marksheet even after I discontinued the course.', b: 'My certificates are withheld after I left; they refuse to hand back the original documents.' },
  { category: 'Excess fee collection', a: 'Extra fees of Rs 45,000 collected in cash without receipt for the second year.', b: 'Management charged additional amount beyond approved fee and gave no receipt for the cash payment.' },
  { category: 'Salary not paid', a: 'Faculty salaries pending for five months, no reason given.', b: 'Teachers have not been paid their wages for months; payroll delayed again.' },
  { category: 'Ragging', a: 'Juniors in the hostel are ragged by seniors every night.', b: 'Seniors harass first year students in the hostel rooms; ragging continues.' },
  { category: 'Infrastructure / lab', a: 'Lab equipment broken and practicals not conducted.', b: 'Laboratories lack working machines; practical classes never happen due to broken equipment.' },
  { category: 'Faculty shortage', a: 'Shortage of teaching faculty, most posts vacant.', b: 'Insufficient teachers in the department, faculty vacancies not filled.' },
  { category: 'Scholarship / refund', a: 'Fee refund not given after cancellation of admission.', b: 'I cancelled my seat but the college is refusing the refund of fees.' },
  { category: 'Unapproved intake', a: 'Students admitted beyond approved intake in the branch.', b: 'Seats filled above sanctioned capacity; extra students admitted without approval.' },
  { category: 'Admission irregularity', a: 'Capitation donation demanded for management quota admission.', b: 'They asked for donation money to give admission under management quota.' },
  { category: 'Certificates withheld', a: 'Provisional degree certificate and transcripts not released to me.', b: 'Institute is holding back my degree certificate and transcript.' },
  { category: 'Excess fee collection', a: 'Tuition fee hiked arbitrarily mid-year.', b: 'Arbitrary increase in tuition fees in the middle of the year.' },
  { category: 'Salary not paid', a: 'Staff salary arrears unpaid after pay revision.', b: 'Pay revision arrears for teaching staff are still not paid.' },
  { category: 'Scholarship / refund', a: 'Caution deposit not refunded after completion.', b: 'After completing the course my caution deposit has not been refunded.' },
  { category: 'Infrastructure / lab', a: 'No working computers in the computer lab.', b: 'Computer laboratory machines are not working for months.' },
  { category: 'Ragging', a: 'Ragging complaint: seniors abused and threatened my son.', b: 'My son was threatened and abused by senior students — ragging.' },
];

/** Hero institution's case texts (reproduce the reference screenshots). */
export const HERO_TEXTS = {
  certificates: 'Certificates withheld after I left the college. They are refusing to return my original marksheets and TC even though all dues are cleared.',
  fees: 'The institute collected Rs 65,000 over the fee fixed by the fee regulatory committee for B.Tech second year. Extra amount was taken in cash with no receipt.',
  salary: 'Faculty of the ECE department have not been paid salary for the last 4 months. Management gives no written reason and threatens termination.',
  roDisposed: 'College not returning my original marksheet and certificates after I discontinued the course in 2024.',
};

export const COURSES = ['B.Tech', 'B.E.', 'Diploma', 'MBA', 'MCA', 'B.Pharm', 'B.Arch', 'M.Tech', 'PGDM'];
