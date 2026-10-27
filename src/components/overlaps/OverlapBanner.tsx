'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import type { ClusterView } from '@/api/types';
import { useDecideCluster } from '@/api/hooks';
import { BUREAU_NAMES, BUREAU_SHORT } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';

export function AlertIcon({ className }: { className?: string }) {
  return <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-saffron text-lg font-extrabold text-white', className)} aria-hidden>!</span>;
}

function joinBureaus(bs: string[]) {
  const b = bs.map((x) => `**${x}**`);
  return b.length <= 1 ? b.join('') : `${b.slice(0, -1).join(', ')} and ${b[b.length - 1]}`;
}

/** Renders "**x**" fragments as bold. */
export function Bold({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith('**') ? <strong key={i} className="font-bold text-navy">{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}

export function NotRelatedDialog({ cluster, open, onOpenChange, onDone }: { cluster: Pick<ClusterView, 'clusterId'>; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const decide = useDecideCluster(cluster.clusterId);
  const [reason, setReason] = React.useState('');
  const [err, setErr] = React.useState('');
  const submit = async () => {
    if (reason.trim().length < 5) {
      setErr('Give a short reason (at least 5 characters). It is recorded in the audit log.');
      return;
    }
    try {
      await decide.mutateAsync({ type: 'not-related', reason });
      toast({ tone: 'success', title: `${cluster.clusterId} dismissed`, description: 'Decision recorded in the audit log. Cases stay open with their own bureaus.' });
      onOpenChange(false);
      setReason('');
      onDone?.();
    } catch (e) {
      toast({ tone: 'error', title: 'Could not dismiss', description: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Mark as not related" description="These cases will no longer be grouped. No case is closed or changed — only the link is removed.">
        <label htmlFor="nr-reason" className="mb-1 block text-xs font-medium">Reason (required)</label>
        <Textarea id="nr-reason" value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} placeholder="e.g. Different campus of the same trust; separate issues already handled independently" />
        {err && <p className="mt-1 text-xs font-medium text-brand-red" role="alert">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" onClick={submit} disabled={decide.isPending}>{decide.isPending && <Loader2 className="animate-spin" />} Dismiss cluster</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** `compact` stacks the content for narrow columns (e.g. the case detail side panel). */
export function OverlapBanner({ cluster, readOnly, className, compact }: { cluster: ClusterView; readOnly?: boolean; className?: string; compact?: boolean }) {
  const router = useRouter();
  const decide = useDecideCluster(cluster.clusterId);
  const [nrOpen, setNrOpen] = React.useState(false);
  const active = cluster.cases.filter((c) => c.status !== 'Disposed').length;
  const text = `${cluster.institution.name} (AICTE ID ${cluster.aicteId}) has **${active} active cases** across ${joinBureaus(cluster.bureaus.map((b) => BUREAU_SHORT[b]))}. Suggested lead: ${BUREAU_NAMES[cluster.suggestedLead]}.`;

  return (
    <div className={cn('flex flex-col gap-3 rounded-card border-[1.5px] border-brand-saffron bg-[#FFF4E5] p-4', !compact && 'sm:flex-row sm:items-center', className)} role="alert" data-tour="overlap-banner">
      <div className="flex min-w-0 flex-1 gap-3">
        <AlertIcon className="animate-pulse-ring" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-navy">Potential Overlapping Cases – Coordination Required</div>
          <p className="mt-0.5 text-[13px] text-[#4A3A20]"><Bold text={text} /></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="navy" size="sm" asChild><Link href={`/overlaps/${cluster.clusterId}`}>View cluster</Link></Button>
        {!readOnly && (
          cluster.leadAccepted ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 text-xs font-semibold text-brand-green"><Check className="h-3.5 w-3.5" /> Lead accepted</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={decide.isPending}
              onClick={async () => {
                await decide.mutateAsync({ type: 'accept-lead' });
                toast({ tone: 'success', title: `Lead accepted: ${BUREAU_NAMES[cluster.suggestedLead]}`, description: 'All bureaus in the cluster have been notified.', action: { label: 'Open cluster', onClick: () => router.push(`/overlaps/${cluster.clusterId}`) } });
              }}
            >
              Accept lead
            </Button>
          )
        )}
        {!readOnly && <Button variant="ghost" size="sm" onClick={() => setNrOpen(true)}>Not related</Button>}
      </div>
      <NotRelatedDialog cluster={cluster} open={nrOpen} onOpenChange={setNrOpen} />
    </div>
  );
}
