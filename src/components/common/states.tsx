'use client';
import * as React from 'react';
import Link from 'next/link';
import { AlertOctagon, Inbox, RefreshCw } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title text-navy">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action, className }: { title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-bg p-3"><Inbox className="h-6 w-6 text-muted" /></div>
      <p className="text-sm font-semibold text-navy">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  const forbidden = typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 403;
  return (
    <Card className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-[#FBE1DE] p-3"><AlertOctagon className="h-6 w-6 text-brand-red" /></div>
      <p className="text-sm font-semibold text-navy">{forbidden ? 'Not available for your role' : 'Could not load this'}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted">{msg}</p>
      <div className="mt-4 flex gap-2">
        {onRetry && !forbidden && <Button variant="outline" onClick={onRetry}><RefreshCw /> Retry</Button>}
        <Button variant="ghost" asChild><Link href="/overview">Go to overview</Link></Button>
      </div>
    </Card>
  );
}

export function LoadingRows({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 p-4', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  );
}

export function LoadingCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4', className)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-card" />)}
    </div>
  );
}

export function KpiCard({ label, value, tone = 'navy', hint, onClick, active }: { label: string; value: React.ReactNode; tone?: 'navy' | 'red' | 'green' | 'amber' | 'saffron' | 'blue'; hint?: string; onClick?: () => void; active?: boolean }) {
  const color = { navy: '#0F2A52', red: '#C0392B', green: '#1E8449', amber: '#D68910', saffron: '#E67E22', blue: '#1A6FC4' }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn('group rounded-card border border-line bg-white p-3.5 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue', onClick && 'hover:shadow-md', active && 'ring-2 ring-brand-blue')}
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted group-hover:text-navy">{hint}</div>}
    </Comp>
  );
}

export function Field({ label, children, error, htmlFor, hint }: { label: string; children: React.ReactNode; error?: string; htmlFor?: string; hint?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-navy">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      {error && <p className="mt-1 text-[11px] font-medium text-brand-red" role="alert">{error}</p>}
    </div>
  );
}
