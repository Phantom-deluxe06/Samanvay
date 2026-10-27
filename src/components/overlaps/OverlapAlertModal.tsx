'use client';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, X } from 'lucide-react';
import { BUREAU_NAMES } from '@/lib/constants';
import { caseHref } from '@/lib/utils';
import { useDemo } from '@/store/demo';
import { Button } from '@/components/ui/primitives';
import { BureauTag, LevelBadge, SlaBadge, StatusPill } from '@/components/common/badges';
import { AlertIcon } from './OverlapBanner';

/** The key demo moment: shown right after a complaint is registered and the engine finds an overlap. */
export function OverlapAlertModal() {
  const router = useRouter();
  const { overlapAlert: a, showOverlap } = useDemo();
  const primary = a?.clusters.find((c) => c.level === 'L1-institution') ?? a?.clusters[0];

  return (
    <DialogPrimitive.Root open={!!a} onOpenChange={(o) => !o && showOverlap(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-navy/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-tour="overlap-modal"
          className="fixed left-1/2 top-1/2 z-[55] w-[620px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-card border-[1.5px] border-brand-saffron bg-white shadow-2xl animate-pop-in focus:outline-none"
        >
          {a && primary && (
            <>
              <div className="flex gap-3 bg-[#FFF4E5] p-5">
                <AlertIcon className="animate-pulse-ring" />
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-base font-bold text-navy">Potential Overlapping Cases – Coordination Required</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-1 text-[13px] text-[#4A3A20]">
                    <strong className="text-navy">{a.caseId}</strong> was linked to <strong className="text-navy">{a.institution.name}</strong> (AICTE ID {a.institution.aicteId}), which already has open cases in other bureaus.
                    {primary.level === 'L1-institution' && <> Suggested lead: <strong className="text-navy">{BUREAU_NAMES[primary.suggestedLead]}</strong>.</>}
                  </DialogPrimitive.Description>
                  <div className="mt-2 flex flex-wrap gap-1.5">{a.clusters.map((c) => <LevelBadge key={c.clusterId} level={c.level} />)}</div>
                </div>
                <DialogPrimitive.Close className="ml-auto h-fit rounded p-1 text-muted hover:bg-white hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" aria-label="Close">
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>
              <div className="p-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Other cases on this institution</div>
                <ul className="divide-y divide-line rounded-md border border-line">
                  {a.related.map((c) => (
                    <li key={c.caseId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                      <button className="font-semibold text-brand-blue hover:underline" onClick={() => { showOverlap(null); router.push(caseHref(c.caseId)); }}>{c.caseId}</button>
                      <BureauTag bureau={c.bureau} />
                      <span className="min-w-0 flex-1 truncate text-muted">“{c.rawInstitutionText}” · {c.category}</span>
                      <StatusPill status={c.status} overdue={c.overdue} />
                      <SlaBadge daysLeft={c.daysLeft} disposed={c.status === 'Disposed'} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">Officers of every bureau involved have been notified. Nothing has been merged or closed — the cluster waits for an officer’s decision.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => showOverlap(null)}>Later</Button>
                  <Button variant="navy" data-tour="open-cluster" onClick={() => { showOverlap(null); router.push(`/overlaps/${primary.clusterId}`); }}>
                    Open cluster <ArrowRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
