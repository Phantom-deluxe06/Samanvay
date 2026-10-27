'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Link2, Loader2, MessageSquarePlus, XCircle } from 'lucide-react';
import { useCluster, useDecideCluster, useInstitution } from '@/api/hooks';
import type { ClusterView } from '@/api/types';
import { BUREAU_NAMES } from '@/lib/constants';
import type { BureauCode } from '@/lib/types';
import { caseHref, fmtDate, fmtDateTime, instHref, plural } from '@/lib/utils';
import { useRoleInfo } from '@/store/role';
import { Button, Card, CardBody, CardHeader, Checkbox, Skeleton, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { BureauTag, ClusterStatusPill, ConfidenceBar, LevelBadge, ReasonChips, RiskBadge, SlaBadge, StatusPill } from '@/components/common/badges';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { CaseDrawer } from '@/components/cases/CaseDrawer';
import { NotRelatedDialog } from '@/components/overlaps/OverlapBanner';

const ClusterGraph = dynamic(() => import('@/components/overlaps/ClusterGraph'), { ssr: false, loading: () => <Skeleton className="h-[440px] w-full" /> });

function Legend() {
  const item = (color: string, label: string, extra?: string) => (
    <span className="inline-flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded-full ${extra ?? ''}`} style={{ background: color }} />{label}</span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-muted">
      {item('#1A6FC4', 'PGRC')}
      {item('#E67E22', 'RB')}
      {item('#1E8449', 'Regional Office')}
      {item('#7A5CA8', 'Other cell')}
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-[3px] border-brand-red" />Overdue</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-brand-saffron" />L2 same issue</span>
    </div>
  );
}

function WhyLinked({ cl, onOpen }: { cl: ClusterView; onOpen: (id: string) => void }) {
  return (
    <Card data-tour="why-linked">
      <CardHeader title="Why these cases were linked" subtitle={`All ${plural(cl.cases.length, 'case')} resolve to AICTE ID ${cl.aicteId}`} />
      <CardBody className="space-y-3">
        {cl.cases.map((c) => (
          <div key={c.caseId} className="rounded-md border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => onOpen(c.caseId)} className="text-[13px] font-bold text-brand-blue hover:underline">{c.caseId}</button>
              <BureauTag bureau={c.bureau} />
              <span className="text-xs text-muted">{c.category}</span>
              <span className="ml-auto text-[11px] text-muted">method: {c.match.method}{c.match.confirmedBy ? ` · ${c.match.confirmedBy}` : ''}</span>
            </div>
            <div className="mt-1.5 text-[13px]">
              <span className="font-medium">“{c.rawInstitutionText}”</span> <span className="text-muted">→</span> <span className="font-semibold">{cl.institution.name}</span>
            </div>
            <ConfidenceBar value={c.match.confidence} className="mt-2" />
            <ReasonChips reasons={c.match.reasons} className="mt-2" />
          </div>
        ))}
        {cl.l2Edges.length > 0 && (
          <div className="rounded-md border border-[#F5C8A0] bg-[#FFF4E5] p-3 text-[13px]">
            <div className="font-semibold text-[#A35A0A]">Same issue raised more than once (L2)</div>
            <ul className="mt-1 space-y-1">
              {cl.l2Edges.map((e) => (
                <li key={`${e.a}-${e.b}`}>
                  <button className="font-semibold text-brand-blue hover:underline" onClick={() => onOpen(e.a)}>{e.a}</button> ↔{' '}
                  <button className="font-semibold text-brand-blue hover:underline" onClick={() => onOpen(e.b)}>{e.b}</button> · same issue? <strong>{e.similarity.toFixed(2)}</strong>
                  <span className="text-muted"> (TF-IDF cosine on complaint text + category synonyms)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LinkCasesDialog({ cl, open, onOpenChange }: { cl: ClusterView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: inst, isLoading } = useInstitution(cl.aicteId);
  const decide = useDecideCluster(cl.clusterId);
  const [pick, setPick] = React.useState<string[]>([]);
  const candidates = (inst?.cases ?? []).filter((c) => !cl.caseIds.includes(c.caseId) && c.status !== 'Disposed');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Link more cases to this cluster" description={`Other open cases on ${cl.institution.name}. Linking never merges or closes cases.`}>
        {isLoading ? <Skeleton className="h-24" /> : !candidates.length ? <p className="text-[13px] text-muted">No other open cases on this institution.</p> : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.caseId}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-line p-2 text-[13px] hover:bg-bg">
                  <Checkbox checked={pick.includes(c.caseId)} onCheckedChange={(v) => setPick((p) => (v ? [...p, c.caseId] : p.filter((x) => x !== c.caseId)))} />
                  <span className="font-semibold">{c.caseId}</span> <BureauTag bureau={c.bureau} /> <span className="truncate text-muted">{c.category}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!pick.length || decide.isPending}
            onClick={async () => {
              await decide.mutateAsync({ type: 'link', caseIds: pick });
              toast({ tone: 'success', title: `${pick.length} case(s) linked to ${cl.clusterId}` });
              setPick([]);
              onOpenChange(false);
            }}
          >
            Link {pick.length || ''} case(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Coordination({ cl, readOnly }: { cl: ClusterView; readOnly: boolean }) {
  const decide = useDecideCluster(cl.clusterId);
  const [lead, setLead] = React.useState<BureauCode>(cl.suggestedLead);
  const [note, setNote] = React.useState('');
  const [nrOpen, setNrOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  React.useEffect(() => setLead(cl.suggestedLead), [cl.suggestedLead]);
  const closed = cl.status === 'Dismissed' || cl.status === 'Resolved';

  return (
    <Card data-tour="coordination">
      <CardHeader title="Coordination" subtitle="Officers decide. Every decision is written to each case timeline and the audit log." />
      <CardBody className="space-y-4">
        <div>
          <div className="text-xs text-muted">Suggested lead bureau</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <BureauTag bureau={cl.suggestedLead} full />
            {cl.leadAccepted && <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green"><Check className="h-3.5 w-3.5" /> Accepted</span>}
          </div>
          <p className="mt-1 text-xs text-muted">{cl.leadReason}</p>
        </div>
        {cl.status === 'Dismissed' && (
          <div className="rounded-md bg-bg p-3 text-xs"><strong>Dismissed as not related.</strong> {cl.dismissedReason}</div>
        )}
        {!readOnly && !closed && (
          <div className="space-y-2">
            {!cl.leadAccepted && cl.bureaus.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Lead:</span>
                <div className="flex-1"><Select ariaLabel="Lead bureau" value={lead} onValueChange={(v) => setLead(v as BureauCode)} options={cl.bureaus.map((b) => ({ value: b, label: BUREAU_NAMES[b] }))} className="h-8 text-xs" /></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="navy"
                size="sm"
                disabled={cl.leadAccepted || decide.isPending}
                data-tour="accept-lead"
                onClick={async () => {
                  await decide.mutateAsync({ type: 'accept-lead', lead });
                  toast({ tone: 'success', title: `Lead accepted: ${BUREAU_NAMES[lead]}`, description: 'All bureaus in the cluster were notified.' });
                }}
              >
                {decide.isPending ? <Loader2 className="animate-spin" /> : <Check />} Accept lead
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}><Link2 /> Link cases</Button>
              <Button variant="ghost" size="sm" onClick={() => setNrOpen(true)}><XCircle /> Not related</Button>
            </div>
          </div>
        )}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shared notes</div>
          {!cl.sharedNotes.length && <p className="text-xs text-muted">No notes yet. Notes are visible to every bureau in the cluster.</p>}
          <ul className="space-y-2">
            {cl.sharedNotes.map((n, i) => (
              <li key={i} className="rounded-md bg-bg p-2.5 text-[13px]">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted"><strong className="text-navy">{n.by}</strong> <BureauTag bureau={n.bureau} /> {fmtDateTime(n.at)}</div>
                {n.text}
              </li>
            ))}
          </ul>
          {!readOnly && cl.status !== 'Dismissed' && (
            <form
              className="mt-2 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                await decide.mutateAsync({ type: 'note', text: note });
                setNote('');
                toast({ tone: 'success', title: 'Shared note added' });
              }}
            >
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. RB will lead the inquiry; PGRC to share complainant documents by Friday." rows={3} aria-label="Shared note" />
              <Button type="submit" size="sm" variant="outline" disabled={!note.trim() || decide.isPending}><MessageSquarePlus /> Add note</Button>
            </form>
          )}
        </div>
      </CardBody>
      <NotRelatedDialog cluster={cl} open={nrOpen} onOpenChange={setNrOpen} />
      <LinkCasesDialog cl={cl} open={linkOpen} onOpenChange={setLinkOpen} />
    </Card>
  );
}

export default function ClusterPage() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const { data: cl, isLoading, error, refetch } = useCluster(clusterId);
  const { readOnly } = useRoleInfo();
  const [drawer, setDrawer] = React.useState<string | null>(null);

  if (isLoading) return <LoadingCards count={2} className="lg:grid-cols-2" />;
  if (error || !cl) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <>
      <div className="mb-4">
        <Link href="/overlaps" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Overlap alerts</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-title">Case Cluster {cl.clusterId}</h1>
          <LevelBadge level={cl.level} />
          <ClusterStatusPill status={cl.status} />
        </div>
        <p className="mt-1 text-[13px] text-muted">
          <Link href={instHref(cl.aicteId)} className="font-semibold text-navy hover:underline">{cl.institution.name}</Link> · AICTE ID {cl.aicteId} · {cl.institution.city}, {cl.institution.region} · raised {fmtDate(cl.createdAt)} ({cl.ageDays} d ago) · risk <RiskBadge risk={cl.risk} />
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <Card data-tour="cluster-graph">
            <CardHeader title="Linked cases" subtitle="Click a case to open it. Dashed orange lines are L2 “same issue?” links." />
            <ClusterGraph institution={cl.institution} risk={cl.risk} cases={cl.cases} extraCases={cl.extraCases} l2Edges={cl.l2Edges} onSelectCase={setDrawer} />
            <Legend />
          </Card>
          <Card>
            <CardHeader title="Cases in this cluster" />
            <ul className="divide-y divide-line">
              {[...cl.cases, ...cl.extraCases].map((c) => (
                <li key={c.caseId} className="flex flex-wrap items-center gap-2 px-4 py-2 text-[13px]">
                  <Link href={caseHref(c.caseId)} className="font-semibold text-brand-blue hover:underline">{c.caseId}</Link>
                  <BureauTag bureau={c.bureau} />
                  <span className="min-w-0 flex-1 truncate">{c.category} · {c.officer}{!cl.caseIds.includes(c.caseId) && <span className="text-muted"> · linked by L2 only</span>}</span>
                  <StatusPill status={c.status} overdue={c.overdue} />
                  <SlaBadge daysLeft={c.daysLeft} disposed={c.status === 'Disposed'} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-4">
          <WhyLinked cl={cl} onOpen={setDrawer} />
          <Coordination cl={cl} readOnly={readOnly} />
        </div>
      </div>
      <CaseDrawer caseId={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}
