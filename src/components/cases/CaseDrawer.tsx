'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCase } from '@/api/hooks';
import { caseHref, fmtDate, fmtDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';
import { Sheet, SheetContent } from '@/components/ui/overlays';
import { BureauTag, ConfidenceBar, ReasonChips, SlaBadge, StatusPill } from '@/components/common/badges';
import { ErrorState, LoadingRows } from '@/components/common/states';

function Body({ id }: { id: string }) {
  const { data: c, isLoading, error, refetch } = useCase(id);
  if (isLoading) return <LoadingRows rows={6} />;
  if (error || !c) return <div className="p-4"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <BureauTag bureau={c.bureau} full />
        <StatusPill status={c.status} overdue={c.overdue} />
        <SlaBadge daysLeft={c.daysLeft} disposed={c.status === 'Disposed'} />
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-white p-4 text-[13px]">
        <div><dt className="text-xs text-muted">Received</dt><dd className="font-medium">{fmtDate(c.receivedAt)}</dd></div>
        <div><dt className="text-xs text-muted">Officer</dt><dd className="font-medium">{c.officer}</dd></div>
        <div><dt className="text-xs text-muted">Category</dt><dd className="font-medium">{c.category}</dd></div>
        <div><dt className="text-xs text-muted">Expected disposal</dt><dd className="font-medium">{fmtDate(c.expectedDisposal)}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-muted">Description</dt><dd className="mt-0.5">{c.description}</dd></div>
      </dl>
      <div className="rounded-card border border-line bg-white p-4">
        <div className="text-xs text-muted">Institution as written</div>
        <div className="font-semibold">“{c.rawInstitutionText}”</div>
        <div className="mt-2 text-xs text-muted">Matched to</div>
        <div className="font-semibold">{c.institution?.name ?? 'Not linked yet'}</div>
        <ConfidenceBar value={c.match.confidence} className="mt-2" />
        <ReasonChips reasons={c.match.reasons} className="mt-2" />
      </div>
      <div className="rounded-card border border-line bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Latest actions</div>
        <ul className="space-y-1.5 text-xs">
          {c.actions.slice(-4).reverse().map((a) => (
            <li key={a.id}><span className="font-semibold text-navy">{a.type}</span> · {fmtDateTime(a.at)} · {a.by}{a.remarks && <span className="block text-muted">{a.remarks}</span>}</li>
          ))}
        </ul>
      </div>
      <Button asChild className="w-full"><Link href={caseHref(c.caseId)}>Open full case <ArrowRight /></Link></Button>
    </div>
  );
}

export function CaseDrawer({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!caseId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={caseId ?? ''} description="Case summary" width="max-w-md">
        {caseId && <Body id={caseId} />}
      </SheetContent>
    </Sheet>
  );
}
