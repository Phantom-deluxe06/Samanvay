'use client';
import Link from 'next/link';
import { useCounts } from '@/api/hooks';
import { cn } from '@/lib/utils';

export function CaseTabs({ active }: { active: 'all' | 'queue' }) {
  const { data: counts } = useCounts();
  return (
    <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
      {[
        { key: 'all', href: '/cases', label: 'All cases' },
        { key: 'queue', href: '/needs-confirmation', label: `Needs confirmation${counts?.queue ? ` (${counts.queue})` : ''}` },
      ].map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={cn('-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold', active === t.key ? 'border-brand-blue text-navy' : 'border-transparent text-muted hover:text-navy')}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
