'use client';
import * as React from 'react';
import Link from 'next/link';
import { Building2, Loader2, Pencil, Search, Unlink } from 'lucide-react';
import { useConfirmMatch, useInstitutions, useUnlinkMatch } from '@/api/hooks';
import type { CaseView } from '@/api/types';
import { instHref } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button, Card, CardBody, CardHeader, Input, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { ConfidenceBar, ReasonChips } from '@/components/common/badges';
import { announceOverlap } from '@/components/overlaps/announce';

export function ChangeMatchDialog({ c, open, onOpenChange }: { c: CaseView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = React.useState('');
  const { data: results, isFetching } = useInstitutions(q.trim(), q.trim().length >= 2);
  const confirm = useConfirmMatch();
  const router = useRouter();
  const pick = async (aicteId: string) => {
    try {
      const res = await confirm.mutateAsync({ caseId: c.caseId, aicteId });
      toast({ tone: 'success', title: 'Match confirmed', description: `Linked to ${res.case.institution?.name}. Spelling learnt as an alias.` });
      onOpenChange(false);
      announceOverlap(res, (href) => router.push(href));
    } catch (e) {
      toast({ tone: 'error', title: 'Could not confirm', description: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Change institution match" description={`“${c.rawInstitutionText}” — pick a candidate or search the directory.`} className="max-w-xl">
        <div className="space-y-2">
          {(c.match.candidates ?? []).map((cand) => (
            <button key={cand.aicteId} onClick={() => pick(cand.aicteId)} disabled={confirm.isPending} className="w-full rounded-md border border-line p-2.5 text-left hover:border-brand-blue hover:bg-[#F5F9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
              <div className="flex items-center justify-between gap-2 text-[13px]"><span className="font-semibold">{cand.name}</span><span className="text-xs text-muted">{cand.aicteId} · {cand.city}</span></div>
              <ConfidenceBar value={cand.confidence} className="mt-1.5" />
            </button>
          ))}
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, alias, AICTE ID or city" className="pl-8" aria-label="Search institutions" />
        </div>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {isFetching && <li className="text-xs text-muted">Searching…</li>}
          {q.trim().length >= 2 && results?.slice(0, 20).map((i) => (
            <li key={i.aicteId}>
              <button onClick={() => pick(i.aicteId)} disabled={confirm.isPending} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-bg">
                <Building2 className="h-4 w-4 text-muted" /> <span className="flex-1 truncate">{i.name}</span> <span className="text-xs text-muted">{i.aicteId} · {i.city}</span>
              </button>
            </li>
          ))}
        </ul>
        {confirm.isPending && <p className="mt-2 flex items-center gap-1 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Linking and re-checking overlaps…</p>}
      </DialogContent>
    </Dialog>
  );
}

export function CaseMatchPanel({ c }: { c: CaseView }) {
  const [changeOpen, setChangeOpen] = React.useState(false);
  const [unlinkOpen, setUnlinkOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const unlink = useUnlinkMatch();
  return (
    <Card>
      <CardHeader
        title="Institution match"
        subtitle="Automated links are recommendations — confirm, change or undo them."
        action={c.canEdit && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setChangeOpen(true)}><Pencil /> {c.match.aicteId ? 'Change match' : 'Confirm match'}</Button>
            {c.match.aicteId && <Button size="sm" variant="ghost" onClick={() => setUnlinkOpen(true)}><Unlink /> Unlink</Button>}
          </div>
        )}
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-md bg-bg p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">As written</div>
            <div className="mt-0.5 font-semibold">“{c.rawInstitutionText}”</div>
          </div>
          <div className="hidden text-center text-lg text-muted sm:block" aria-hidden>→</div>
          <div className="rounded-md bg-bg p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Matched institution</div>
            {c.institution ? (
              <Link href={instHref(c.institution.aicteId)} className="mt-0.5 block font-semibold text-brand-blue hover:underline">{c.institution.name}</Link>
            ) : (
              <div className="mt-0.5 font-semibold text-[#A36A00]">Not linked — needs confirmation</div>
            )}
            {c.institution && <div className="text-xs text-muted">{c.institution.aicteId} · {c.institution.city} · {c.institution.region}</div>}
          </div>
        </div>
        <ConfidenceBar value={c.match.confidence} className="mt-3" />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>Method: <strong className="text-navy">{c.match.method}</strong></span>
          <span>{c.match.confirmedBy ? <>Confirmed by <strong className="text-navy">{c.match.confirmedBy}</strong></> : c.match.aicteId ? 'Auto-linked (above threshold)' : 'Waiting for an officer'}</span>
        </div>
        <ReasonChips reasons={c.match.reasons} className="mt-2" />
      </CardBody>
      <ChangeMatchDialog c={c} open={changeOpen} onOpenChange={setChangeOpen} />
      <Dialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <DialogContent title="Unlink institution" description="The case returns to the confirmation queue and leaves any overlap cluster. Recorded in the audit log.">
          <label htmlFor="ul" className="mb-1 block text-xs font-medium">Reason (required)</label>
          <Textarea id="ul" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Complainant clarified a different campus" />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnlinkOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 3 || unlink.isPending}
              onClick={async () => {
                await unlink.mutateAsync({ caseId: c.caseId, reason });
                toast({ tone: 'success', title: 'Unlinked', description: 'Case moved to the Needs confirmation queue.' });
                setUnlinkOpen(false);
                setReason('');
              }}
            >
              {unlink.isPending && <Loader2 className="animate-spin" />} Unlink
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
