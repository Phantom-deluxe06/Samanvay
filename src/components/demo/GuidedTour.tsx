'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { api } from '@/api/client';
import type { CreateCaseInput } from '@/api/types';
import { ROLES } from '@/lib/constants';
import type { RoleId } from '@/lib/types';
import { HERO_ID } from '@/mock/seed';
import { HERO_TEXTS } from '@/mock/texts';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { announceOverlap } from '@/components/overlaps/announce';

const PG_INPUT: CreateCaseInput = {
  bureau: 'PGRC',
  complainant: { type: 'Student', name: 'Priya Raghavan', phone: '9840012321', email: 'priya.r@example.in' },
  rawInstitutionText: 'SVIT Engg Clg',
  city: 'Chennai',
  category: 'Certificates withheld',
  description: HERO_TEXTS.certificates,
  attachments: ['fee_clearance.pdf'],
};
const RB_INPUT: CreateCaseInput = {
  bureau: 'RB',
  complainant: { type: 'Parent', name: 'K. Subramanian', phone: '9444055021', email: 'ksubra@example.in' },
  rawInstitutionText: 'Sri Venkatesa Inst. of Tech.',
  category: 'Excess fee collection',
  description: HERO_TEXTS.fees,
  attachments: ['cash_receipt_photo.jpg'],
};

interface Ctx {
  go: (href: string) => void;
  as: (role: RoleId) => void;
  invalidate: () => Promise<void>;
}

interface Step {
  title: string;
  body: React.ReactNode;
  /** First selector found on the page is spotlighted. */
  targets: string[];
  enter: (ctx: Ctx) => Promise<void>;
}

async function ensureCase(key: 'pg' | 'rb', input: CreateCaseInput, go: (href: string) => void) {
  const d = useDemo.getState();
  if (d.tourCases[key]) return;
  const res = await api.createCase(input);
  d.setTourCase(key, res.case.caseId);
  announceOverlap(res, go);
}

const STEPS: Step[] = [
  {
    title: '1 · PGRC registers a complaint',
    body: <>As a <strong>PGRC officer</strong>, register “SVIT Engg Clg – certificates withheld”. The live panel matches the abbreviation to <strong>Sri Venkatesa Institute of Technology</strong> with a confidence and reasons. Click <strong>Register complaint</strong> — Samanvay also notices it repeats an old, disposed RO-South complaint (no coordination needed).</>,
    targets: ['[data-tour="intake-submit"]', '[data-tour="live-match"]'],
    enter: async ({ go, as, invalidate }) => {
      await api.resetDemo('demo');
      useDemo.getState().clearTourCases();
      as('PGRC');
      await invalidate();
      go('/cases');
      useDemo.getState().openIntake({ ...PG_INPUT, tourKey: 'pg' });
    },
  },
  {
    title: '2 · RB registers a differently-spelt complaint',
    body: <>Now as the <strong>Regulation Bureau</strong>: “Sri Venkatesa Inst. of Tech. – excess fees”. Different words, same institution. Click <strong>Register complaint</strong>.</>,
    targets: ['[data-tour="intake-submit"]', '[data-tour="live-match"]'],
    enter: async ({ go, as, invalidate }) => {
      const d = useDemo.getState();
      d.closeIntake();
      d.showOverlap(null);
      as('PGRC');
      await ensureCase('pg', PG_INPUT, go);
      d.showOverlap(null);
      as('RB');
      await invalidate();
      go('/cases');
      if (!useDemo.getState().tourCases.rb) setTimeout(() => useDemo.getState().openIntake({ ...RB_INPUT, tourKey: 'rb' }), 200);
    },
  },
  {
    title: '3 · The overlap alert fires',
    body: <>Samanvay matched both spellings to the same AICTE ID and found open cases in <strong>PGRC</strong> and <strong>RB</strong>. It raises <em>Potential Overlapping Cases – Coordination Required</em> and notifies both bureaus. Nothing is merged or closed.</>,
    targets: ['[data-tour="overlap-modal"]', '[data-tour="overlap-banner"]'],
    enter: async ({ as, invalidate, go }) => {
      useDemo.getState().closeIntake();
      as('RB');
      await ensureCase('rb', RB_INPUT, go);
      await invalidate();
      go('/cases');
    },
  },
  {
    title: '4 · Why these cases were linked',
    body: <>The cluster view shows the institution at the centre and each case around it. On the right, every link is explained: the raw text, the confidence and the reasons. The dashed edge is an <strong>L2 “same issue?”</strong> link to an older RO-South complaint.</>,
    targets: ['[data-tour="why-linked"]', '[data-tour="cluster-graph"]'],
    enter: async ({ go, as }) => {
      const d = useDemo.getState();
      d.showOverlap(null);
      as('RB');
      const clusters = await api.listClusters();
      const cl = clusters.find((c) => c.aicteId === HERO_ID && c.level === 'L1-institution' && c.status !== 'Dismissed');
      if (cl) d.setTourCase('cluster', cl.clusterId);
      go(cl ? `/overlaps/${cl.clusterId}` : '/overlaps');
    },
  },
  {
    title: '5 · Accept the lead bureau and coordinate',
    body: <>Regulation Bureau is suggested as lead because it holds regulatory powers. Click <strong>Accept lead</strong> and add a shared note — both are written to every case timeline and the audit log.</>,
    targets: ['[data-tour="coordination"]'],
    enter: async () => {
      /* stays on the cluster page */
    },
  },
  {
    title: '6 · SLA breach and auto-escalation',
    body: <>The demo clock jumps <strong>7 days</strong>. The SLA monitor finds cases past their expected disposal date and escalates them up the chain (Officer → Deputy Director → Director). Each breach row shows who it went to and when.</>,
    targets: ['[data-tour="escalation-log"]'],
    enter: async ({ go, as, invalidate }) => {
      as('SENIOR');
      const res = await api.advanceClock(7);
      await invalidate();
      go('/sla');
      toast({ tone: 'error', title: 'Clock moved +7 days', description: `${res.escalated.length} case(s) breached SLA and were auto-escalated.` });
    },
  },
];

function useTargetRect(selectors: string[] | undefined) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useEffect(() => {
    if (!selectors) return;
    let scrolled = false;
    const tick = () => {
      const el = selectors.map((s) => document.querySelector(s)).find(Boolean) as HTMLElement | undefined;
      const r = el?.getBoundingClientRect();
      // Bring the target on screen once per step (e.g. the submit button at the bottom of the intake form).
      if (el && r && !scrolled && (r.top < 0 || r.bottom > window.innerHeight)) {
        scrolled = true;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setRect(r && r.width > 0 ? r : null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [selectors]);
  return rect;
}

export function GuidedTour() {
  const router = useRouter();
  const qc = useQueryClient();
  const { tourStep, setTourStep } = useDemo();
  const signIn = useSession((s) => s.signIn);
  const [busy, setBusy] = React.useState(false);
  const step = tourStep === null ? undefined : STEPS[tourStep];
  const rect = useTargetRect(step?.targets);
  const entered = React.useRef<number | null>(null);

  const ctx: Ctx = React.useMemo(() => ({
    go: (href) => router.push(href),
    as: (role) => {
      const s = useSession.getState().session;
      if (s?.role === role) return;
      const r = ROLES.find((x) => x.id === role)!;
      signIn({ role, officer: r.officer });
    },
    invalidate: () => qc.invalidateQueries(),
  }), [router, signIn, qc]);

  React.useEffect(() => {
    if (tourStep === null) {
      entered.current = null;
      return;
    }
    if (entered.current === tourStep) return;
    entered.current = tourStep;
    setBusy(true);
    STEPS[tourStep]
      .enter(ctx)
      .catch((e) => toast({ tone: 'error', title: 'Demo step failed', description: e instanceof Error ? e.message : String(e) }))
      .finally(() => setBusy(false));
  }, [tourStep, ctx]);

  React.useEffect(() => {
    if (tourStep === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setTourStep(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourStep, setTourStep]);

  if (tourStep === null || !step) return null;
  const last = tourStep === STEPS.length - 1;

  return (
    <>
      {rect && <div className="tour-spotlight" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} aria-hidden />}
      <div
        role="dialog"
        aria-label="Guided demo"
        className="fixed bottom-4 left-4 z-[150] w-[340px] max-w-[calc(100vw-32px)] rounded-card border-2 border-brand-saffron bg-white p-4 shadow-2xl animate-pop-in"
        style={{ pointerEvents: 'auto' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-orange">Guided demo · step {tourStep + 1} of {STEPS.length}</div>
            <div className="mt-0.5 text-sm font-bold text-navy">{step.title}</div>
          </div>
          <button onClick={() => setTourStep(null)} className="rounded p-1 text-muted hover:bg-bg hover:text-navy" aria-label="End demo"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#33435A]">{step.body}</p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= tourStep ? 'bg-brand-saffron' : 'bg-line'}`} />)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={tourStep === 0 || busy} onClick={() => setTourStep(tourStep - 1)}><ArrowLeft /> Back</Button>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Working" />}
          <Button size="sm" variant={last ? 'navy' : 'default'} disabled={busy} onClick={() => setTourStep(last ? null : tourStep + 1)}>
            {last ? 'Finish' : <>Next <ArrowRight /></>}
          </Button>
        </div>
      </div>
    </>
  );
}
