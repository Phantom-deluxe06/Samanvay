'use client';
import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info' | 'overlap';
interface ToastItem { id: number; title: string; description?: React.ReactNode; tone: Tone; action?: { label: string; onClick: () => void } }

const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: Date.now() + Math.random() }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export function toast(t: Omit<ToastItem, 'id' | 'tone'> & { tone?: Tone }) {
  useToasts.getState().push({ tone: 'info', ...t });
}

const ICON: Record<Tone, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-brand-green" />,
  error: <AlertTriangle className="h-5 w-5 text-brand-red" />,
  info: <Info className="h-5 w-5 text-brand-blue" />,
  overlap: <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-saffron text-xs font-bold text-white">!</span>,
};

export function Toaster() {
  const { items, remove } = useToasts();
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
      {items.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          onOpenChange={(o) => !o && remove(t.id)}
          className={cn(
            'flex items-start gap-3 rounded-card border bg-white p-3.5 pr-8 shadow-xl data-[state=open]:animate-pop-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80',
            t.tone === 'overlap' ? 'border-[1.5px] border-brand-saffron bg-[#FFF4E5]' : 'border-line',
          )}
        >
          {ICON[t.tone]}
          <div className="min-w-0 flex-1">
            <ToastPrimitive.Title className="text-[13px] font-semibold text-navy">{t.title}</ToastPrimitive.Title>
            {t.description && <ToastPrimitive.Description className="mt-0.5 text-xs text-muted">{t.description}</ToastPrimitive.Description>}
            {t.action && (
              <ToastPrimitive.Action altText={t.action.label} onClick={t.action.onClick} className="mt-2 rounded-md bg-navy px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-2">
                {t.action.label}
              </ToastPrimitive.Action>
            )}
          </div>
          <ToastPrimitive.Close aria-label="Dismiss" className="absolute right-2 top-2 rounded p-1 text-muted hover:text-navy">
            <X className="h-3.5 w-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
