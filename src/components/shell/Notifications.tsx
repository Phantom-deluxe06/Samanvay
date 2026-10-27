'use client';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, CheckCheck, ClipboardCheck, Info, Timer, TrendingUp } from 'lucide-react';
import { useClock, useMarkRead, useNotifications } from '@/api/hooks';
import type { AppNotification } from '@/lib/types';
import { cn, fmtAgo } from '@/lib/utils';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/primitives';
import { BureauTag } from '@/components/common/badges';

const ICONS: Record<AppNotification['kind'], React.ReactNode> = {
  overlap: <AlertTriangle className="h-4 w-4 text-brand-orange" />,
  sla: <Timer className="h-4 w-4 text-brand-amber" />,
  escalation: <TrendingUp className="h-4 w-4 text-brand-red" />,
  match: <ClipboardCheck className="h-4 w-4 text-brand-blue" />,
  info: <Info className="h-4 w-4 text-brand-blue" />,
};

export function NotificationsBell() {
  const router = useRouter();
  const { data = [], isLoading } = useNotifications();
  const { data: clock } = useClock();
  const mark = useMarkRead();
  const unread = data.filter((n) => !n.read).length;
  const now = clock ? new Date(clock.now) : new Date();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 text-navy hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue" aria-label={`Notifications, ${unread} unread`} data-tour="bell">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-brand-red px-1 text-center text-[10px] font-bold leading-[18px] text-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] max-w-[calc(100vw-32px)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <Button variant="ghost" size="sm" onClick={() => mark.mutate(undefined)} disabled={!unread}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {isLoading && <p className="p-4 text-xs text-muted">Loading…</p>}
          {!isLoading && !data.length && <p className="p-6 text-center text-xs text-muted">You are all caught up.</p>}
          {data.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                mark.mutate([n.id]);
                router.push(n.href);
              }}
              className={cn('flex w-full gap-3 border-b border-line/70 px-4 py-2.5 text-left hover:bg-bg focus-visible:bg-bg focus-visible:outline-none', !n.read && 'bg-[#F5F9FF]')}
            >
              <span className="mt-0.5">{ICONS[n.kind]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn('truncate text-[13px]', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-blue" aria-label="unread" />}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  {n.bureau !== 'ALL' && <BureauTag bureau={n.bureau} />}
                  {fmtAgo(n.at, now)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
