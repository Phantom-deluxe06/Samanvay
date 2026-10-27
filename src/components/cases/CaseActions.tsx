'use client';
import * as React from 'react';
import { ArrowRightLeft, CheckCircle2, FileSignature, Loader2, MessageSquarePlus, RefreshCw, TrendingUp } from 'lucide-react';
import { useCaseAction } from '@/api/hooks';
import type { CaseActionInput, CaseView } from '@/api/types';
import { BUREAUS, BUREAU_NAMES } from '@/lib/constants';
import type { BureauCode } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Button, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { announceOverlap } from '@/components/overlaps/announce';

type Kind = 'status' | 'notice' | 'transfer' | 'escalate' | 'note' | 'dispose';

const META: Record<Kind, { title: string; description: string; cta: string; requireRemarks: boolean }> = {
  status: { title: 'Update status', description: 'Change the working status of this case.', cta: 'Update status', requireRemarks: false },
  notice: { title: 'Issue notice', description: 'Record a notice sent to the institution.', cta: 'Record notice', requireRemarks: true },
  transfer: { title: 'Transfer case', description: 'Move this case to another Bureau / Cell. The receiving bureau is notified.', cta: 'Transfer', requireRemarks: true },
  escalate: { title: 'Escalate', description: 'Escalate to the next level of the chain (Deputy Director).', cta: 'Escalate', requireRemarks: true },
  note: { title: 'Add note', description: 'Internal note on the case timeline.', cta: 'Add note', requireRemarks: true },
  dispose: { title: 'Dispose with remarks', description: 'Close this case. Disposal remarks are mandatory and permanent.', cta: 'Dispose case', requireRemarks: true },
};

export function CaseActions({ c, canNote }: { c: CaseView; canNote: boolean }) {
  const [kind, setKind] = React.useState<Kind | null>(null);
  const [remarks, setRemarks] = React.useState('');
  const [status, setStatus] = React.useState<'Received' | 'Under process' | 'Inquiry initiated' | 'Escalated'>('Under process');
  const [to, setTo] = React.useState<BureauCode>(c.bureau === 'RB' ? 'PGRC' : 'RB');
  const [err, setErr] = React.useState('');
  const act = useCaseAction(c.caseId);
  const router = useRouter();
  const open = c.status !== 'Disposed';

  const start = (k: Kind) => {
    setKind(k);
    setRemarks('');
    setErr('');
  };

  const submit = async () => {
    if (!kind) return;
    if (META[kind].requireRemarks && remarks.trim().length < 3) {
      setErr('Remarks are required.');
      return;
    }
    const input: CaseActionInput =
      kind === 'status' ? { type: 'status', status, remarks: remarks || undefined }
        : kind === 'transfer' ? { type: 'transfer', toBureau: to, remarks }
          : { type: kind, remarks };
    try {
      const res = await act.mutateAsync(input);
      toast({ tone: 'success', title: `${META[kind].title}: done`, description: `${c.caseId} · recorded in the timeline and audit log.` });
      setKind(null);
      announceOverlap(res, (href) => router.push(href));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {c.canEdit && open && (
          <>
            <Button size="sm" variant="outline" onClick={() => start('status')}><RefreshCw /> Update status</Button>
            <Button size="sm" variant="outline" onClick={() => start('notice')}><FileSignature /> Issue notice</Button>
            <Button size="sm" variant="outline" onClick={() => start('transfer')}><ArrowRightLeft /> Transfer</Button>
            <Button size="sm" variant="outline" onClick={() => start('escalate')}><TrendingUp /> Escalate</Button>
          </>
        )}
        {canNote && <Button size="sm" variant="outline" onClick={() => start('note')}><MessageSquarePlus /> Add note</Button>}
        {c.canEdit && open && <Button size="sm" variant="navy" onClick={() => start('dispose')}><CheckCircle2 /> Dispose</Button>}
      </div>
      <Dialog open={!!kind} onOpenChange={(o) => !o && setKind(null)}>
        {kind && (
          <DialogContent title={`${META[kind].title} · ${c.caseId}`} description={META[kind].description}>
            <div className="space-y-3">
              {kind === 'status' && (
                <div>
                  <label className="mb-1 block text-xs font-medium">New status</label>
                  <Select ariaLabel="New status" value={status} onValueChange={(v) => setStatus(v as typeof status)} options={['Received', 'Under process', 'Inquiry initiated', 'Escalated'].map((s) => ({ value: s, label: s }))} />
                </div>
              )}
              {kind === 'transfer' && (
                <div>
                  <label className="mb-1 block text-xs font-medium">Transfer to</label>
                  <Select ariaLabel="Transfer to" value={to} onValueChange={(v) => setTo(v as BureauCode)} options={BUREAUS.filter((b) => b !== c.bureau).map((b) => ({ value: b, label: BUREAU_NAMES[b] }))} />
                </div>
              )}
              <div>
                <label htmlFor="remarks" className="mb-1 block text-xs font-medium">Remarks{META[kind].requireRemarks ? ' (required)' : ' (optional)'}</label>
                <Textarea id="remarks" value={remarks} onChange={(e) => { setRemarks(e.target.value); setErr(''); }} rows={4} />
                {err && <p className="mt-1 text-xs font-medium text-brand-red" role="alert">{err}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setKind(null)}>Cancel</Button>
                <Button variant={kind === 'dispose' ? 'navy' : 'default'} onClick={submit} disabled={act.isPending}>
                  {act.isPending && <Loader2 className="animate-spin" />} {META[kind].cta}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
