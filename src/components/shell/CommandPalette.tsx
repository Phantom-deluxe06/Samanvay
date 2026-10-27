'use client';
import * as React from 'react';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { Building2, FileText, Search } from 'lucide-react';
import { useCases, useInstitutions } from '@/api/hooks';
import { caseHref, instHref } from '@/lib/utils';
import { useDemo } from '@/store/demo';
import { NAV } from './nav';

function useDebounced<T>(v: T, ms = 200) {
  const [d, setD] = React.useState(v);
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function SearchButton() {
  const setPalette = useDemo((s) => s.setPalette);
  return (
    <button
      onClick={() => setPalette(true)}
      className="flex h-9 w-full max-w-[360px] items-center gap-2 rounded-md border border-line bg-bg px-3 text-left text-[13px] text-muted hover:border-[#B9C7DA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      aria-label="Search institutions, aliases, AICTE IDs and cases"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="hidden flex-1 truncate md:inline">Search institution, alias, AICTE ID, case ID…</span>
      <kbd className="ml-auto hidden rounded border border-line bg-white px-1.5 text-[10px] font-semibold text-muted md:inline">Ctrl K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen: open, setPalette } = useDemo();
  const [q, setQ] = React.useState('');
  const dq = useDebounced(q.trim());
  const enabled = dq.length >= 2;
  const cases = useCases({ q: dq }, enabled);
  const insts = useInstitutions(dq, enabled);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(!useDemo.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);

  const go = (href: string) => {
    setPalette(false);
    setQ('');
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setPalette}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-navy/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-[60] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-card border border-line bg-white shadow-2xl animate-pop-in focus:outline-none">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search institutions, aliases, AICTE IDs and case IDs</DialogPrimitive.Description>
          <Command shouldFilter={false} label="Global search">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="h-4 w-4 text-muted" />
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Type an institution, alias (e.g. SVIT), AICTE ID or case ID…" className="h-12 flex-1 bg-transparent text-sm text-navy outline-none placeholder:text-[#8796AB]" />
              <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">Esc</kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[420px] overflow-y-auto p-2">
              {!enabled && (
                <Command.Group heading="Go to" className="text-[11px] font-semibold uppercase text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {NAV.map((n) => (
                    <Command.Item key={n.href} value={n.href} onSelect={() => go(n.href)} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] normal-case text-navy data-[selected=true]:bg-bg">
                      <n.icon className="h-4 w-4 text-muted" /> {n.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {enabled && (cases.isFetching || insts.isFetching) && <div className="px-3 py-2 text-xs text-muted">Searching…</div>}
              {enabled && !cases.isFetching && !insts.isFetching && !cases.data?.length && !insts.data?.length && (
                <div className="px-3 py-6 text-center text-xs text-muted">No institutions or cases match “{dq}”.</div>
              )}
              {enabled && !!insts.data?.length && (
                <Command.Group heading="Institutions" className="text-[11px] font-semibold uppercase text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {insts.data.slice(0, 6).map((i) => (
                    <Command.Item key={i.aicteId} value={`i-${i.aicteId}`} onSelect={() => go(instHref(i.aicteId))} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] normal-case text-navy data-[selected=true]:bg-bg">
                      <Building2 className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                      <span className="shrink-0 text-xs text-muted">{i.aicteId} · {i.city}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {enabled && !!cases.data?.length && (
                <Command.Group heading="Cases" className="text-[11px] font-semibold uppercase text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {cases.data.slice(0, 8).map((c) => (
                    <Command.Item key={c.caseId} value={`c-${c.caseId}`} onSelect={() => go(caseHref(c.caseId))} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] normal-case text-navy data-[selected=true]:bg-bg">
                      <FileText className="h-4 w-4 shrink-0 text-muted" />
                      <span className="shrink-0 font-semibold">{c.caseId}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{c.rawInstitutionText}</span>
                      <span className="shrink-0 text-xs text-muted">{c.category}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
