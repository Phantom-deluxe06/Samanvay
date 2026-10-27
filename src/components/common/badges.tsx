'use client';
import * as React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Link2 } from 'lucide-react';
import { BUREAU_COLORS, BUREAU_NAMES, BUREAU_SHORT, bureauKind } from '@/lib/constants';
import type { BureauCode, CaseStatus, Cluster, RiskBreakdown } from '@/lib/types';
import { cn, slaText, slaTone } from '@/lib/utils';
import { Tooltip } from '@/components/ui/primitives';

const pill = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4';

export function BureauTag({ bureau, full, className }: { bureau: BureauCode; full?: boolean; className?: string }) {
  const [bg, fg] = BUREAU_COLORS[bureauKind(bureau)];
  return (
    <span className={cn(pill, className)} style={{ background: bg, color: fg }} title={BUREAU_NAMES[bureau]}>
      {full ? BUREAU_NAMES[bureau] : BUREAU_SHORT[bureau]}
    </span>
  );
}

const STATUS_STYLE: Record<string, [string, string]> = {
  Overdue: ['#FBE1DE', '#C0392B'],
  'Under process': ['#FFF1D6', '#A36A00'],
  'Inquiry initiated': ['#FFF1D6', '#A36A00'],
  Received: ['#EEF2F7', '#33435A'],
  Disposed: ['#DFF3E6', '#1E8449'],
  Transferred: ['#E3ECFA', '#1F4B8A'],
  Escalated: ['#C0392B', '#FFFFFF'],
};

/** Status is always shown as text; colour is an extra cue only. */
export function StatusPill({ status, overdue, className }: { status: CaseStatus | 'Overdue'; overdue?: boolean; className?: string }) {
  const label = overdue && status !== 'Disposed' && status !== 'Escalated' ? 'Overdue' : status;
  const [bg, fg] = STATUS_STYLE[label] ?? STATUS_STYLE.Received;
  return (
    <span className={cn(pill, className)} style={{ background: bg, color: fg }}>
      {label === 'Overdue' && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {label === 'Disposed' && <CheckCircle2 className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}

export function SlaBadge({ daysLeft, disposed, className }: { daysLeft: number; disposed: boolean; className?: string }) {
  const tone = slaTone(daysLeft, disposed);
  const color = { red: 'text-brand-red', amber: 'text-[#A36A00]', green: 'text-brand-green', muted: 'text-muted' }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold tabular-nums', color, className)}>
      {!disposed && <Clock className="h-3 w-3" aria-hidden />}
      {slaText(daysLeft, disposed)}
    </span>
  );
}

export function confidenceColor(c: number, threshold = 85) {
  if (c >= threshold) return '#1E8449';
  if (c >= 70) return '#D68910';
  return '#C0392B';
}

export function ConfidenceBar({ value, threshold = 85, className, showLabel = true }: { value: number; threshold?: number; className?: string; showLabel?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#E1E8F1]" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Match confidence">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${value}%`, background: confidenceColor(value, threshold) }} />
        <div className="absolute inset-y-0 w-px bg-navy/40" style={{ left: `${threshold}%` }} title={`Auto-link threshold ${threshold}%`} />
      </div>
      {showLabel && <span className="w-10 text-right text-xs font-bold tabular-nums" style={{ color: confidenceColor(value, threshold) }}>{value}%</span>}
    </div>
  );
}

export function ReasonChips({ reasons, className }: { reasons: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {reasons.map((r) => (
        <span key={r} className={cn('rounded-md border px-1.5 py-0.5 text-[11px] leading-4', r.startsWith('Look-alike') || r.startsWith('City differs') ? 'border-[#F5C8A0] bg-[#FFF4E5] text-[#A35A0A]' : 'border-line bg-[#F5F8FC] text-[#33435A]')}>
          {r}
        </span>
      ))}
    </div>
  );
}

export function riskColor(score: number) {
  if (score >= 60) return '#C0392B';
  if (score >= 30) return '#D68910';
  return '#1E8449';
}

export function RiskBadge({ risk, size = 'sm' }: { risk: RiskBreakdown; size?: 'sm' | 'lg' }) {
  const color = riskColor(risk.score);
  const content = (
    <div className="space-y-1">
      <div className="font-semibold">Risk {risk.score} · {risk.label}</div>
      {risk.parts.map((p) => (
        <div key={p.label} className="flex justify-between gap-4">
          <span>{p.label} ({p.value})</span>
          <span className="tabular-nums">+{p.points}</span>
        </div>
      ))}
    </div>
  );
  return (
    <Tooltip content={content}>
      <button type="button" className={cn('inline-flex items-center gap-1.5 rounded-full font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue', size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs')} style={{ background: `${color}1A`, color }}>
        {risk.score}
        <span className="font-semibold">{risk.label}</span>
      </button>
    </Tooltip>
  );
}

export function LevelBadge({ level }: { level: Cluster['level'] }) {
  return level === 'L1-institution' ? (
    <span className={cn(pill, 'bg-[#FFF4E5] text-[#A35A0A] ring-1 ring-brand-saffron')}>L1 · institution</span>
  ) : (
    <span className={cn(pill, 'bg-[#EFE9F7] text-[#7A5CA8] ring-1 ring-[#C9B8E3]')}>L2 · same issue</span>
  );
}

const CLUSTER_STATUS: Record<Cluster['status'], [string, string]> = {
  Open: ['#FFF4E5', '#A35A0A'],
  Coordinating: ['#E3ECFA', '#1F4B8A'],
  Resolved: ['#DFF3E6', '#1E8449'],
  Dismissed: ['#EEF2F7', '#5B6B82'],
};
export function ClusterStatusPill({ status }: { status: Cluster['status'] }) {
  const [bg, fg] = CLUSTER_STATUS[status];
  return <span className={pill} style={{ background: bg, color: fg }}>{status}</span>;
}

export function LinkedTo({ aicteId, confidence, inCluster, method }: { aicteId: string | null; confidence: number; inCluster?: boolean; method?: string }) {
  if (!aicteId) {
    return <span className={cn(pill, 'bg-[#FFF1D6] text-[#A36A00]')}>Needs confirmation · {confidence}%</span>;
  }
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium tabular-nums', inCluster ? 'font-semibold text-brand-red' : 'text-navy')}>
      {inCluster && <Link2 className="h-3 w-3" aria-label="Part of an overlap cluster" />}
      {aicteId} · {method === 'manual' ? 'confirmed' : `${confidence}%`}
    </span>
  );
}
