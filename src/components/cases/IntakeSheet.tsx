'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2, Paperclip, Sparkles, Wand2 } from 'lucide-react';
import { api } from '@/api/client';
import { useCreateCase, useSettings } from '@/api/hooks';
import { BUREAUS, BUREAU_NAMES, CATEGORIES, ROLES, REGION_TO_BUREAU } from '@/lib/constants';
import type { BureauCode, Category, MatchResult } from '@/lib/types';
import { caseHref, cn } from '@/lib/utils';
import { suggestCategory } from '@/engine/classify';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import { Button, Input, Textarea } from '@/components/ui/primitives';
import { Select, Sheet, SheetContent } from '@/components/ui/overlays';
import { toast } from '@/components/ui/toast';
import { ConfidenceBar, ReasonChips } from '@/components/common/badges';
import { Field } from '@/components/common/states';
import { announceOverlap } from '@/components/overlaps/announce';

const schema = z.object({
  bureau: z.string().min(1),
  complainantType: z.enum(['Student', 'Parent', 'Faculty', 'Staff', 'Other']),
  complainantName: z.string().trim().min(2, 'Enter the complainant’s name'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'),
  email: z.string().trim().email('Enter a valid e-mail').or(z.literal('')),
  rawInstitutionText: z.string().trim().min(3, 'Write the institution exactly as the complainant did'),
  aicteId: z.string().trim().regex(/^1-[0-9X]{10}$/i, 'Format: 1-XXXXXXXXXX').or(z.literal('')),
  city: z.string().trim(),
  category: z.enum(CATEGORIES as [Category, ...Category[]]),
  description: z.string().trim().min(15, 'Describe the complaint in at least 15 characters'),
  attachments: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

function useLiveMatch(raw: string, aicteId: string, city: string) {
  const [state, setState] = React.useState<{ result: MatchResult | null; loading: boolean }>({ result: null, loading: false });
  React.useEffect(() => {
    if (raw.trim().length < 3 && !/^1-/.test(aicteId)) {
      setState({ result: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    let alive = true;
    const t = setTimeout(async () => {
      const result = await api.previewMatch(raw, { aicteId: aicteId || undefined, city: city || undefined });
      if (alive) setState({ result, loading: false });
    }, 140);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [raw, aicteId, city]);
  return state;
}

function MatchPanel({ raw, aicteId, city, threshold }: { raw: string; aicteId: string; city: string; threshold: number }) {
  const { result, loading } = useLiveMatch(raw, aicteId, city);
  const best = result?.candidates?.[0];
  const alts = result?.candidates?.slice(1, 3) ?? [];
  const linked = !!result?.aicteId;
  return (
    <div className="rounded-card border border-line bg-white" data-tour="live-match" aria-live="polite">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-saffron" /> Live institution match</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Matching" />}
      </div>
      <div className="p-4">
        {!result && <p className="text-[13px] text-muted">Start typing the institution as the complainant wrote it — abbreviations, initials and typos are fine.</p>}
        {result && !best && <p className="text-[13px] text-muted">No plausible institution yet. Add a city or AICTE ID.</p>}
        {best && (
          <div key={best.aicteId + result!.confidence} className="animate-pop-in">
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-navy-2" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold leading-tight text-navy">{best.name}</div>
                <div className="text-xs text-muted">{best.aicteId} · {best.city}</div>
              </div>
            </div>
            <ConfidenceBar value={result!.confidence} threshold={threshold} className="mt-3" />
            <div className={cn('mt-2 rounded-md px-2 py-1 text-xs font-semibold', linked ? 'bg-[#DFF3E6] text-brand-green' : 'bg-[#FFF1D6] text-[#A36A00]')}>
              {linked ? `Will auto-link (≥ ${threshold}%) · method: ${result!.method}` : `Below ${threshold}% — will go to the “Needs confirmation” queue`}
            </div>
            <ReasonChips reasons={result!.reasons} className="mt-2" />
            {!!alts.length && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Alternatives</div>
                <ul className="space-y-1.5">
                  {alts.map((a) => (
                    <li key={a.aicteId} className="flex items-center justify-between gap-2 rounded-md bg-bg px-2 py-1.5 text-xs">
                      <span className="min-w-0 truncate"><span className="font-medium text-navy">{a.name}</span> <span className="text-muted">· {a.city}</span></span>
                      <span className="shrink-0 font-semibold tabular-nums text-muted">{a.confidence}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function IntakeSheet() {
  const router = useRouter();
  const { intakeOpen, intakePrefill, closeIntake, setTourCase } = useDemo();
  const session = useSession((s) => s.session);
  const { data: settings } = useSettings();
  const create = useCreateCase();
  const ownBureau: BureauCode | null = session?.role === 'PGRC' ? 'PGRC' : session?.role === 'RB' ? 'RB' : session?.role === 'RO' && session.region ? REGION_TO_BUREAU[session.region] : null;
  const readOnly = !!ROLES.find((r) => r.id === session?.role)?.readOnly;

  const defaults = React.useCallback((): FormValues => ({
    bureau: intakePrefill?.bureau ?? ownBureau ?? 'PGRC',
    complainantType: intakePrefill?.complainant?.type ?? 'Student',
    complainantName: intakePrefill?.complainant?.name ?? '',
    phone: intakePrefill?.complainant?.phone ?? '',
    email: intakePrefill?.complainant?.email ?? '',
    rawInstitutionText: intakePrefill?.rawInstitutionText ?? '',
    aicteId: intakePrefill?.aicteId ?? '',
    city: intakePrefill?.city ?? '',
    category: intakePrefill?.category ?? 'Certificates withheld',
    description: intakePrefill?.description ?? '',
    attachments: intakePrefill?.attachments ?? [],
  }), [intakePrefill, ownBureau]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = form;
  React.useEffect(() => {
    if (intakeOpen) reset(defaults());
  }, [intakeOpen, defaults, reset]);

  const raw = watch('rawInstitutionText');
  const aicteId = watch('aicteId');
  const city = watch('city');
  const attachments = watch('attachments');
  const [suggestHits, setSuggestHits] = React.useState<string[] | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const res = await create.mutateAsync({
        bureau: v.bureau as BureauCode,
        complainant: { type: v.complainantType, name: v.complainantName, phone: v.phone, email: v.email },
        rawInstitutionText: v.rawInstitutionText,
        aicteId: v.aicteId ? v.aicteId.toUpperCase() : undefined,
        city: v.city || undefined,
        category: v.category,
        description: v.description,
        attachments: v.attachments,
      });
      if (intakePrefill?.tourKey) setTourCase(intakePrefill.tourKey, res.case.caseId);
      closeIntake();
      if (!announceOverlap(res, (href) => router.push(href))) {
        toast({
          tone: 'success',
          title: `${res.case.caseId} registered`,
          description: res.case.match.aicteId ? `Linked to ${res.case.institution?.name} (${res.case.match.confidence}%).` : 'Sent to the “Needs confirmation” queue.',
          action: { label: 'Open case', onClick: () => router.push(caseHref(res.case.caseId)) },
        });
      }
    } catch (e) {
      toast({ tone: 'error', title: 'Could not register complaint', description: e instanceof Error ? e.message : String(e) });
    }
  });

  return (
    <Sheet open={intakeOpen} onOpenChange={(o) => !o && closeIntake()}>
      <SheetContent title="New complaint" description="Register a complaint. Samanvay matches the institution live and checks for overlaps on submit." width="max-w-5xl">
        {readOnly ? (
          <p className="p-6 text-[13px] text-muted">Senior Management has read-only access and cannot register complaints.</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]" noValidate>
            <div className="space-y-4">
              <section className="space-y-3 rounded-card border border-line bg-white p-4">
                <h3 className="text-sm font-semibold">Institution & complaint</h3>
                <Field label="Institution — exactly as written by the complainant" htmlFor="raw" error={errors.rawInstitutionText?.message}>
                  <Input id="raw" autoFocus placeholder="e.g. SVIT Engg Clg, Chennai" {...register('rawInstitutionText')} data-tour="intake-institution" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="AICTE Permanent ID (optional)" htmlFor="aid" error={errors.aicteId?.message}>
                    <Input id="aid" placeholder="1-XXXXXXXXXX" {...register('aicteId')} />
                  </Field>
                  <Field label="City (optional)" htmlFor="city">
                    <Input id="city" placeholder="e.g. Chennai" {...register('city')} />
                  </Field>
                </div>
                <Field label="Description" htmlFor="desc" error={errors.description?.message}>
                  <Textarea id="desc" rows={4} placeholder="What happened, since when, what the complainant wants" {...register('description')} />
                </Field>
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                  <Field label="Category" error={errors.category?.message} hint={suggestHits ? (suggestHits.length ? `Suggested from: ${suggestHits.join(', ')}` : 'No strong keywords — check manually') : undefined}>
                    <Select ariaLabel="Category" value={watch('category')} onValueChange={(v) => setValue('category', v as Category, { shouldValidate: true })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const s = suggestCategory(watch('description'));
                      setValue('category', s.category, { shouldValidate: true });
                      setSuggestHits(s.hits);
                    }}
                  >
                    <Wand2 /> Suggest
                  </Button>
                </div>
                <Field label="Attachments (file names only in this prototype)">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line bg-bg px-3 py-2 text-xs text-muted hover:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue">
                    <Paperclip className="h-4 w-4" />
                    {attachments.length ? attachments.join(', ') : 'Choose files…'}
                    <input type="file" multiple className="sr-only" onChange={(e) => setValue('attachments', [...(e.target.files ?? [])].map((f) => f.name))} />
                  </label>
                </Field>
              </section>
              <section className="space-y-3 rounded-card border border-line bg-white p-4">
                <h3 className="text-sm font-semibold">Complainant</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bureau / Cell" hint={ownBureau ? 'Prefilled from your role' : undefined}>
                    <Select ariaLabel="Bureau" value={watch('bureau')} disabled={!!ownBureau} onValueChange={(v) => setValue('bureau', v)} options={BUREAUS.map((b) => ({ value: b, label: BUREAU_NAMES[b] }))} />
                  </Field>
                  <Field label="Complainant type">
                    <Select ariaLabel="Complainant type" value={watch('complainantType')} onValueChange={(v) => setValue('complainantType', v as FormValues['complainantType'])} options={['Student', 'Parent', 'Faculty', 'Staff', 'Other'].map((x) => ({ value: x, label: x }))} />
                  </Field>
                  <Field label="Name" htmlFor="cname" error={errors.complainantName?.message}>
                    <Input id="cname" {...register('complainantName')} />
                  </Field>
                  <Field label="Mobile" htmlFor="phone" error={errors.phone?.message}>
                    <Input id="phone" inputMode="numeric" placeholder="10 digits" {...register('phone')} />
                  </Field>
                  <Field label="E-mail (optional)" htmlFor="email" error={errors.email?.message}>
                    <Input id="email" type="email" {...register('email')} />
                  </Field>
                </div>
              </section>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeIntake}>Cancel</Button>
                <Button type="submit" disabled={create.isPending} data-tour="intake-submit">
                  {create.isPending && <Loader2 className="animate-spin" />} Register complaint
                </Button>
              </div>
            </div>
            <div className="lg:sticky lg:top-0 lg:self-start">
              <MatchPanel raw={raw} aicteId={aicteId} city={city} threshold={settings?.matchThreshold ?? 85} />
              <p className="mt-3 px-1 text-[11px] text-muted">Samanvay only <em>recommends</em>. Links below the threshold always wait for an officer, and every link can be changed or undone later.</p>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
