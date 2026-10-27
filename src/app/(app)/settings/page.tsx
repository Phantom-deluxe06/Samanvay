'use client';
import * as React from 'react';
import { Lock, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useSettings, useUpdateSettings } from '@/api/hooks';
import { BUREAU_NAMES, DEFAULT_SETTINGS } from '@/lib/constants';
import type { Category, Settings } from '@/lib/types';
import { useRoleInfo } from '@/store/role';
import { Button, Card, CardBody, CardHeader, Input, Slider } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';
import { BureauTag } from '@/components/common/badges';
import { ErrorState, LoadingCards, PageHeader } from '@/components/common/states';

export default function SettingsPage() {
  const { data, isLoading, error, refetch } = useSettings();
  const update = useUpdateSettings();
  const { isAdmin } = useRoleInfo();
  const [s, setS] = React.useState<Settings | null>(null);
  const [newAbbr, setNewAbbr] = React.useState({ k: '', v: '' });
  React.useEffect(() => {
    if (data) setS(structuredClone(data));
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !s || !data) return <LoadingCards count={3} className="lg:grid-cols-2" />;

  const dirty = JSON.stringify(s) !== JSON.stringify(data);
  const ro = !isAdmin;
  const save = async (next: Settings = s) => {
    try {
      await update.mutateAsync(next);
      toast({ tone: 'success', title: 'Settings saved', description: 'Changes take effect immediately and are recorded in the audit log.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Could not save', description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Matching thresholds, SLA rules, escalation chain and dictionaries. Every change is audited."
        actions={isAdmin && (
          <>
            <Button variant="outline" size="sm" onClick={() => setS(structuredClone(DEFAULT_SETTINGS))}><RotateCcw /> Defaults</Button>
            <Button size="sm" onClick={() => save()} disabled={!dirty || update.isPending}><Save /> Save changes</Button>
          </>
        )}
      />
      {ro && (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-line bg-white p-3 text-[13px] text-muted">
          <Lock className="h-4 w-4" /> Only the System Admin can change settings. You are seeing the current values.
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Matching & overlap thresholds" />
          <CardBody className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-[13px]"><label id="th-l" className="font-semibold">Auto-link threshold</label><span className="font-bold tabular-nums">{s.matchThreshold}%</span></div>
              <Slider aria-labelledby="th-l" className="mt-3" min={60} max={99} step={1} value={[s.matchThreshold]} onValueChange={([v]) => setS({ ...s, matchThreshold: v })} disabled={ro} />
              <p className="mt-2 text-xs text-muted">Matches at or above this confidence link automatically; below it they wait in “Needs confirmation”. Look-alike institutions are capped at 80% so they never auto-link at the default.</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-[13px]"><label id="l2-l" className="font-semibold">L2 “same issue” similarity</label><span className="font-bold tabular-nums">{s.l2Threshold.toFixed(2)}</span></div>
              <Slider aria-labelledby="l2-l" className="mt-3" min={0.5} max={0.95} step={0.01} value={[s.l2Threshold]} onValueChange={([v]) => setS({ ...s, l2Threshold: Math.round(v * 100) / 100 })} disabled={ro} />
              <p className="mt-2 text-xs text-muted">TF-IDF cosine over complaint text with the category-synonym map. Applies to new detections and to the cluster graph.</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Escalation chain" subtitle="Used by the SLA monitor" />
          <CardBody className="space-y-3">
            {s.escalationChain.map((lvl, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 text-xs font-semibold text-muted">Level {i}</span>
                <Input aria-label={`Escalation level ${i}`} value={lvl} disabled={ro} onChange={(e) => setS({ ...s, escalationChain: s.escalationChain.map((x, j) => (j === i ? e.target.value : x)) })} />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs font-semibold text-muted">Step</span>
              <Input aria-label="Days overdue per escalation step" type="number" min={1} max={60} className="w-24" value={s.escalationStepDays} disabled={ro} onChange={(e) => setS({ ...s, escalationStepDays: Math.max(1, Number(e.target.value) || 1) })} />
              <span className="text-xs text-muted">days overdue before moving to level 2</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Categories & SLA (days)" subtitle="Changing an SLA re-computes the expected disposal date of open cases" />
          <ul className="divide-y divide-line">
            {s.categories.map((cat: Category) => (
              <li key={cat} className="flex items-center justify-between gap-3 px-4 py-1.5 text-[13px]">
                <span>{cat}</span>
                <div className="flex items-center gap-1.5">
                  <Input aria-label={`SLA days for ${cat}`} type="number" min={1} max={180} className="h-8 w-20 text-right" value={s.slaDays[cat]} disabled={ro} onChange={(e) => setS({ ...s, slaDays: { ...s.slaDays, [cat]: Math.max(1, Number(e.target.value) || 1) } })} />
                  <span className="text-xs text-muted">days</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Abbreviation dictionary" subtitle="Expanded before matching (e.g. engg → engineering). Changes rebuild the match index." />
          <CardBody>
            <div className="scrollbar-thin max-h-72 overflow-y-auto rounded-md border border-line">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-[#F5F8FC]">
                  <tr className="text-left text-[11.5px] uppercase tracking-wide text-muted"><th scope="col" className="px-3 py-1.5">Written as</th><th scope="col" className="px-3 py-1.5">Means</th><th className="w-10" /></tr>
                </thead>
                <tbody>
                  {Object.entries(s.abbreviations).sort().map(([k, v]) => (
                    <tr key={k} className="border-t border-line/70">
                      <td className="px-3 py-1 font-mono text-xs">{k}</td>
                      <td className="px-3 py-1">{v}</td>
                      <td className="px-1">
                        {!ro && (
                          <button aria-label={`Remove ${k}`} className="rounded p-1 text-muted hover:bg-bg hover:text-brand-red" onClick={() => { const a = { ...s.abbreviations }; delete a[k]; setS({ ...s, abbreviations: a }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!ro && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const k = newAbbr.k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                  const v = newAbbr.v.trim().toLowerCase();
                  if (!k || !v) return;
                  setS({ ...s, abbreviations: { ...s.abbreviations, [k]: v } });
                  setNewAbbr({ k: '', v: '' });
                }}
              >
                <Input aria-label="Abbreviation" placeholder="e.g. polytch" value={newAbbr.k} onChange={(e) => setNewAbbr({ ...newAbbr, k: e.target.value })} />
                <Input aria-label="Expansion" placeholder="e.g. polytechnic" value={newAbbr.v} onChange={(e) => setNewAbbr({ ...newAbbr, v: e.target.value })} />
                <Button type="submit" variant="outline"><Plus /> Add</Button>
              </form>
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Bureaus & cells" subtitle="Bureaus that can own cases. Regional Offices map one-to-one to AICTE regions." />
          <CardBody className="flex flex-wrap gap-2">
            {s.bureaus.map((b) => (
              <span key={b} className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs">
                <BureauTag bureau={b} /> {BUREAU_NAMES[b]}
              </span>
            ))}
          </CardBody>
        </Card>
      </div>
      {isAdmin && dirty && (
        <div className="sticky bottom-4 mt-4 flex justify-end">
          <div className="flex items-center gap-3 rounded-card border border-line bg-white p-3 shadow-lg">
            <span className="text-xs text-muted">Unsaved changes</span>
            <Button variant="outline" size="sm" onClick={() => setS(structuredClone(data))}>Discard</Button>
            <Button size="sm" onClick={() => save()} disabled={update.isPending}><Save /> Save changes</Button>
          </div>
        </div>
      )}
    </>
  );
}
