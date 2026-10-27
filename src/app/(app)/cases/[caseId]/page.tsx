'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Lock, Paperclip } from 'lucide-react';
import { api } from '@/api/client';
import { useCase, useCluster } from '@/api/hooks';
import type { CaseView } from '@/api/types';
import { BUREAU_NAMES } from '@/lib/constants';
import type { CaseAction } from '@/lib/types';
import { caseHref, cn, fmtDate, fmtDateTime } from '@/lib/utils';
import { useRoleInfo } from '@/store/role';
import { Button, Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { BureauTag, SlaBadge, StatusPill } from '@/components/common/badges';
import { EmptyState, ErrorState, LoadingCards } from '@/components/common/states';
import { CaseActions } from '@/components/cases/CaseActions';
import { CaseMatchPanel } from '@/components/cases/MatchPanel';
import { OverlapBanner } from '@/components/overlaps/OverlapBanner';

const ClusterGraph = dynamic(() => import('@/components/overlaps/ClusterGraph'), { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> });

const DOT: Partial<Record<CaseAction['type'], string>> = {
  Escalated: '#C0392B', 'Linked to cluster': '#F39C34', 'Overlap alert': '#F39C34', 'Lead accepted': '#F39C34', Unlinked: '#F39C34',
  Disposed: '#1E8449', 'Match confirmed': '#7A5CA8', 'Match rejected': '#7A5CA8',
};

function Timeline({ actions }: { actions: CaseAction[] }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5">
      {[...actions].reverse().map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white" style={{ background: DOT[a.type] ?? '#1A6FC4' }} aria-hidden />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <strong className="text-navy">{a.type}</strong>
            <BureauTag bureau={a.bureau} />
            <span className="text-xs text-muted">{fmtDateTime(a.at)} · {a.by}</span>
          </div>
          {a.remarks && <p className="mt-0.5 text-[13px] text-[#33435A]">{a.remarks}</p>}
          {a.attachments?.length ? <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Paperclip className="h-3 w-3" /> {a.attachments.join(', ')}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function Complainant({ c }: { c: CaseView }) {
  const [revealed, setRevealed] = React.useState<CaseView['complainant'] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const shown = revealed ?? c.complainant;
  return (
    <div className="rounded-md bg-bg p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Complainant · {c.complainant.type}</div>
        {c.contactMasked && !revealed && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setRevealed(await api.revealContact(c.caseId));
                toast({ tone: 'info', title: 'Contact revealed', description: 'This view has been recorded in the audit log.' });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Eye /> Reveal (audited)
          </Button>
        )}
      </div>
      <div className="mt-1 font-semibold">{shown.name}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
        {c.contactMasked && !revealed && <Lock className="h-3 w-3" aria-label="Masked" />}
        <span className="tabular-nums">{shown.phone}</span>
        <span>{shown.email}</span>
      </div>
      {!c.contactMasked && <p className="mt-1 text-[11px] text-muted">Visible because you are the assigned officer. Views are logged.</p>}
    </div>
  );
}

function LinkedCases({ c }: { c: CaseView }) {
  const router = useRouter();
  const { readOnly } = useRoleInfo();
  const { data: cl, isLoading } = useCluster(c.clusterId ?? '');
  if (!c.clusterId) {
    return (
      <Card>
        <CardHeader title="Linked cases" />
        <EmptyState title="No overlap cluster" body="This case is not linked to open cases of the same institution in other bureaus." />
      </Card>
    );
  }
  if (isLoading || !cl) return <Skeleton className="h-80 w-full rounded-card" />;
  return (
    <div className="space-y-3">
      {(cl.status === 'Open' || cl.status === 'Coordinating') && c.status !== 'Disposed' && <OverlapBanner cluster={cl} readOnly={readOnly} compact />}
      <Card>
        <CardHeader title={`Linked cases · ${cl.clusterId}`} action={<Link href={`/overlaps/${cl.clusterId}`} className="text-xs font-semibold text-brand-blue hover:underline">Open cluster →</Link>} />
        <ClusterGraph institution={cl.institution} risk={cl.risk} cases={cl.cases} extraCases={cl.extraCases} l2Edges={cl.l2Edges} height={280} compact onSelectCase={(id) => router.push(caseHref(id))} />
        <ul className="divide-y divide-line border-t border-line">
          {cl.cases.filter((x) => x.caseId !== c.caseId).map((x) => (
            <li key={x.caseId} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
              <Link href={caseHref(x.caseId)} className="font-semibold text-brand-blue hover:underline">{x.caseId}</Link>
              <BureauTag bureau={x.bureau} />
              <span className="min-w-0 flex-1 truncate text-muted">{x.category}</span>
              <StatusPill status={x.status} overdue={x.overdue} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const id = decodeURIComponent(params.caseId);
  const { data: c, isLoading, error, refetch } = useCase(id);
  const { readOnly } = useRoleInfo();

  if (isLoading) return <LoadingCards count={3} className="lg:grid-cols-2" />;
  if (error || !c) return <ErrorState error={error} onRetry={() => refetch()} />;
  const disposed = c.status === 'Disposed';

  return (
    <>
      <Link href="/cases" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Case Register</Link>
      <Card className="mb-4 mt-1">
        <CardBody className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-title">{c.caseId}</h1>
              <StatusPill status={c.status} overdue={c.overdue} />
              <BureauTag bureau={c.bureau} full />
              {c.escalatedTo && !disposed && <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-semibold text-white">Escalated → {c.escalatedTo}</span>}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {c.category} · Officer <strong className="text-navy">{c.officer}</strong> · received {fmtDate(c.receivedAt)} · {BUREAU_NAMES[c.bureau]}
            </p>
          </div>
          <div className={cn('rounded-card border px-4 py-2 text-right', c.overdue ? 'border-[#F2B8B0] bg-[#FBE1DE]' : 'border-line bg-bg')}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">SLA ({c.slaDays} days)</div>
            <SlaBadge daysLeft={c.daysLeft} disposed={disposed} className="text-base" />
            <div className="text-[11px] text-muted">{disposed ? `Disposed ${fmtDate(c.disposedAt)}` : `Expected by ${fmtDate(c.expectedDisposal)}`}</div>
          </div>
          <div className="w-full">
            <CaseActions c={c} canNote={!readOnly} />
            {!c.canEdit && !readOnly && <p className="mt-2 text-xs text-muted">This case belongs to {BUREAU_NAMES[c.bureau]}. You can see it because it overlaps with your bureau; only notes are allowed.</p>}
            {readOnly && <p className="mt-2 text-xs text-muted">Read-only access.</p>}
          </div>
        </CardBody>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Complaint" />
            <CardBody className="space-y-3">
              <p className="text-[13.5px] leading-relaxed">{c.description}</p>
              {!!c.attachments?.length && <p className="flex items-center gap-1 text-xs text-muted"><Paperclip className="h-3.5 w-3.5" /> {c.attachments.join(', ')}</p>}
              <Complainant c={c} />
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div><dt className="text-xs text-muted">Last action</dt><dd className="font-medium">{c.lastAction}</dd></div>
                <div><dt className="text-xs text-muted">Next action</dt><dd className="font-medium">{c.nextAction}</dd></div>
              </dl>
            </CardBody>
          </Card>
          <CaseMatchPanel c={c} />
          <Card>
            <CardHeader title="Timeline" subtitle={`${c.actions.length} actions · newest first`} />
            <CardBody><Timeline actions={c.actions} /></CardBody>
          </Card>
        </div>
        <div className="min-w-0"><LinkedCases c={c} /></div>
      </div>
    </>
  );
}
