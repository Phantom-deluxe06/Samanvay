'use client';
import * as React from 'react';
import Link from 'next/link';
import { Building2, Check, Loader2, Plus, Search } from 'lucide-react';
import { useConfirmMatch, useCreateInstitution, useQueue, useSettings } from '@/api/hooks';
import type { QueueItem } from '@/api/types';
import { REGIONS } from '@/lib/constants';
import type { Institution, Region } from '@/lib/types';
import { caseHref, fmtDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useRoleInfo } from '@/store/role';
import { Button, Card, Input } from '@/components/ui/primitives';
import { Dialog, DialogContent, Select } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { BureauTag, ConfidenceBar, ReasonChips } from '@/components/common/badges';
import { EmptyState, ErrorState, Field, LoadingCards, PageHeader } from '@/components/common/states';
import { CaseTabs } from '@/components/cases/CaseTabs';
import { ChangeMatchDialog } from '@/components/cases/MatchPanel';
import { announceOverlap } from '@/components/overlaps/announce';

function NewInstitutionDialog({ item, open, onOpenChange }: { item: QueueItem; open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateInstitution();
  const confirm = useConfirmMatch();
  const router = useRouter();
  const [v, setV] = React.useState({ name: item.case.rawInstitutionText.replace(/,.*$/, ''), city: '', state: '', pincode: '', region: 'Southern' as Region, type: 'Engineering' as Institution['type'] });
  const [err, setErr] = React.useState('');
  const busy = create.isPending || confirm.isPending;
  const submit = async () => {
    if (v.name.trim().length < 5 || !v.city.trim() || !v.state.trim() || !/^\d{6}$/.test(v.pincode)) {
      setErr('Name, city, state and a 6-digit pincode are required.');
      return;
    }
    const inst = await create.mutateAsync(v);
    const res = await confirm.mutateAsync({ caseId: item.case.caseId, aicteId: inst.aicteId });
    toast({ tone: 'success', title: 'Provisional institution created', description: `${inst.name} (${inst.aicteId}) — pending AICTE verification. ${item.case.caseId} linked.` });
    onOpenChange(false);
    announceOverlap(res, (href) => router.push(href));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create new institution" description="Use only when the institution is genuinely missing from the directory. A provisional ID is issued and the action is audited.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Institution name" htmlFor="ni-name"><Input id="ni-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field></div>
          <Field label="City" htmlFor="ni-city"><Input id="ni-city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} /></Field>
          <Field label="State" htmlFor="ni-state"><Input id="ni-state" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} /></Field>
          <Field label="Pincode" htmlFor="ni-pin"><Input id="ni-pin" inputMode="numeric" value={v.pincode} onChange={(e) => setV({ ...v, pincode: e.target.value })} /></Field>
          <Field label="Region"><Select ariaLabel="Region" value={v.region} onValueChange={(r) => setV({ ...v, region: r as Region })} options={REGIONS.map((r) => ({ value: r, label: r }))} /></Field>
          <Field label="Type"><Select ariaLabel="Type" value={v.type} onValueChange={(t) => setV({ ...v, type: t as Institution['type'] })} options={['Engineering', 'Management', 'Polytechnic', 'Pharmacy', 'Architecture', 'MCA'].map((t) => ({ value: t, label: t }))} /></Field>
        </div>
        {err && <p className="mt-2 text-xs font-medium text-brand-red" role="alert">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create and link</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QueueCard({ item, threshold, canAct }: { item: QueueItem; threshold: number; canAct: boolean }) {
  const confirm = useConfirmMatch();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const c = item.case;

  const pick = async (aicteId: string) => {
    setPending(aicteId);
    try {
      const res = await confirm.mutateAsync({ caseId: c.caseId, aicteId });
      toast({ tone: 'success', title: `${c.caseId} linked`, description: `Confirmed ${res.case.institution?.name}. “${c.rawInstitutionText}” learnt as an alias.` });
      announceOverlap(res, (href) => router.push(href));
    } catch (e) {
      toast({ tone: 'error', title: 'Could not confirm', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={caseHref(c.caseId)} className="text-[13px] font-bold text-brand-blue hover:underline">{c.caseId}</Link>
        <BureauTag bureau={c.bureau} />
        <span className="text-xs text-muted">{c.category} · received {fmtDate(c.receivedAt)} · {c.officer}</span>
      </div>
      <div className="mt-2 rounded-md bg-bg px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Institution as written</div>
        <div className="text-[14px] font-semibold">“{c.rawInstitutionText}”</div>
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Top candidates (best {c.match.confidence}% — below the {threshold}% auto-link threshold)</div>
      <ul className="mt-1.5 space-y-2">
        {item.candidates.map((cand, i) => (
          <li key={cand.aicteId} className="rounded-md border border-line p-2.5">
            <div className="flex flex-wrap items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{cand.name}</div>
                <div className="text-[11px] text-muted">{cand.aicteId} · {cand.city}{cand.institution ? `, ${cand.institution.state}` : ''}</div>
              </div>
              {canAct && (
                <Button size="sm" variant={i === 0 ? 'default' : 'outline'} onClick={() => pick(cand.aicteId)} disabled={confirm.isPending}>
                  {pending === cand.aicteId ? <Loader2 className="animate-spin" /> : <Check />} {i === 0 ? 'Confirm' : 'Pick this'}
                </Button>
              )}
            </div>
            <ConfidenceBar value={cand.confidence} threshold={threshold} className="mt-2" />
            {cand.reasons && <ReasonChips reasons={cand.reasons} className="mt-1.5" />}
          </li>
        ))}
        {!item.candidates.length && <li className="text-xs text-muted">No candidates found — search the directory or create the institution.</li>}
      </ul>
      {canAct && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}><Search /> Pick other…</Button>
          <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}><Plus /> Create new institution</Button>
        </div>
      )}
      <ChangeMatchDialog c={c} open={searchOpen} onOpenChange={setSearchOpen} />
      {newOpen && <NewInstitutionDialog item={item} open={newOpen} onOpenChange={setNewOpen} />}
    </Card>
  );
}

export default function NeedsConfirmationPage() {
  const { data, isLoading, error, refetch } = useQueue();
  const { data: settings } = useSettings();
  const { readOnly } = useRoleInfo();
  const [q, setQ] = React.useState('');
  const items = (data ?? []).filter((i) => !q.trim() || `${i.case.caseId} ${i.case.rawInstitutionText}`.toLowerCase().includes(q.trim().toLowerCase()));

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <>
      <PageHeader
        title="Needs Confirmation"
        subtitle={`Complaints whose institution match scored below ${settings?.matchThreshold ?? 85}%. Confirming links the case, learns the spelling as an alias and re-runs overlap detection.`}
      />
      <CaseTabs active="queue" />
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by case ID or text" className="pl-8" aria-label="Filter queue" />
        </div>
        <span className="text-xs text-muted">{items.length} waiting</span>
      </div>
      {isLoading ? <LoadingCards count={4} className="lg:grid-cols-2" /> : !items.length ? (
        <Card><EmptyState title="Queue is empty" body="Every open complaint in your scope is linked to an institution." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((it) => <QueueCard key={it.case.caseId} item={it} threshold={settings?.matchThreshold ?? 85} canAct={!readOnly && it.case.canEdit} />)}
        </div>
      )}
    </>
  );
}
