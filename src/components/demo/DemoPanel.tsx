'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Loader2, Play, RotateCcw, UserCog } from 'lucide-react';
import { useAdvanceClock, useClock, useResetDemo } from '@/api/hooks';
import { REGIONAL_OFFICERS, REGIONS, ROLES } from '@/lib/constants';
import type { Region, RoleId } from '@/lib/types';
import { cn, fmtDate } from '@/lib/utils';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/primitives';
import { Select, Sheet, SheetContent } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { homeFor } from '@/components/shell/nav';

export function DemoPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const { panelOpen, setPanel, setTourStep, clearTourCases } = useDemo();
  const { session, signIn } = useSession();
  const { data: clock } = useClock();
  const advance = useAdvanceClock();
  const reset = useResetDemo();
  const [region, setRegion] = React.useState<Region>(session?.region ?? 'Southern');
  const [confirmReset, setConfirmReset] = React.useState(false);

  const travel = async (days: number) => {
    const res = await advance.mutateAsync(days);
    toast({
      tone: res.escalated.length ? 'error' : 'info',
      title: `Clock moved +${days} day${days === 1 ? '' : 's'}`,
      description: res.escalated.length ? `${res.escalated.length} case(s) breached SLA and were auto-escalated (e.g. ${res.escalated.slice(0, 3).join(', ')}).` : 'No new SLA breaches.',
      action: res.escalated.length ? { label: 'View escalations', onClick: () => router.push('/sla') } : undefined,
    });
  };

  const switchRole = (id: RoleId) => {
    const r = ROLES.find((x) => x.id === id)!;
    signIn({ role: id, officer: id === 'RO' ? REGIONAL_OFFICERS[region] : r.officer, region: id === 'RO' ? region : undefined });
    qc.invalidateQueries();
    setPanel(false);
    router.push(homeFor(id));
  };

  return (
    <Sheet open={panelOpen} onOpenChange={setPanel}>
      <SheetContent title="Demo controls" description="Prototype-only tools for judging. All data is synthetic." width="max-w-sm">
        <div className="space-y-4 p-4">
          <section className="rounded-card border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Play className="h-4 w-4 text-brand-saffron" /> Guided demo</div>
            <p className="mt-1 text-xs text-muted">Six steps on the real UI: two complaints with different spellings, the overlap alert, the cluster, the lead decision and an SLA breach. Starts from a clean demo dataset.</p>
            <Button
              className="mt-3 w-full"
              variant="saffron"
              onClick={() => {
                clearTourCases();
                setPanel(false);
                setTourStep(0);
              }}
            >
              <Play /> Play guided demo
            </Button>
          </section>

          <section className="rounded-card border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-brand-blue" /> Time travel</div>
            <p className="mt-1 text-xs text-muted">Demo clock: <strong className="text-navy">{clock ? fmtDate(clock.now) : '…'}</strong>{clock?.offsetDays ? ` (+${clock.offsetDays} days)` : ''}. Jumping ahead runs the SLA monitor so breaches and escalations happen live.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[1, 7, 30].map((d) => (
                <Button key={d} variant="outline" disabled={advance.isPending} onClick={() => travel(d)} data-tour={`travel-${d}`}>
                  {advance.isPending ? <Loader2 className="animate-spin" /> : null}+{d} day{d > 1 ? 's' : ''}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><UserCog className="h-4 w-4 text-navy-2" /> Role quick-switch</div>
            <div className="mt-3 space-y-1.5">
              {ROLES.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Button variant={session?.role === r.id ? 'navy' : 'outline'} size="sm" className="flex-1 justify-start" onClick={() => switchRole(r.id)}>
                    {r.label} <span className={cn('ml-auto text-[11px]', session?.role === r.id ? 'text-[#C9D6EA]' : 'text-muted')}>{r.id === 'RO' ? REGIONAL_OFFICERS[region] : r.officer}</span>
                  </Button>
                  {r.id === 'RO' && <div className="w-32"><Select ariaLabel="Region" value={region} onValueChange={(v) => setRegion(v as Region)} options={REGIONS.map((x) => ({ value: x, label: x }))} className="h-8 text-xs" /></div>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-card border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="h-4 w-4 text-brand-red" /> Reset demo data</div>
            <p className="mt-1 text-xs text-muted">Re-seeds the synthetic dataset (seed 2026) and clears everything stored in this browser: new cases, decisions, settings, the clock.</p>
            {!confirmReset ? (
              <Button className="mt-3 w-full" variant="outline" onClick={() => setConfirmReset(true)}>Reset demo data</Button>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmReset(false)}>Cancel</Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={reset.isPending}
                  onClick={async () => {
                    await reset.mutateAsync('full');
                    clearTourCases();
                    setConfirmReset(false);
                    toast({ tone: 'success', title: 'Demo data reset', description: 'Fresh synthetic dataset loaded.' });
                  }}
                >
                  {reset.isPending && <Loader2 className="animate-spin" />} Confirm reset
                </Button>
              </div>
            )}
            {clock?.scenario === 'demo' && <p className="mt-2 text-[11px] text-muted">Currently on the guided-demo dataset (hero cases are created during the tour).</p>}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
