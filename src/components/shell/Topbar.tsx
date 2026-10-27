'use client';
import { usePathname } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { useClock } from '@/api/hooks';
import { ROLES } from '@/lib/constants';
import { fmtDate } from '@/lib/utils';
import { useDemo } from '@/store/demo';
import { useSession } from '@/store/session';
import { Button, Tooltip } from '@/components/ui/primitives';
import { SearchButton } from './CommandPalette';
import { NotificationsBell } from './Notifications';
import { titleFor } from './nav';

export function Topbar() {
  const pathname = usePathname();
  const session = useSession((s) => s.session);
  const setPanel = useDemo((s) => s.setPanel);
  const { data: clock } = useClock();
  const role = ROLES.find((r) => r.id === session?.role);
  const rolePill = session ? `${role?.label}${session.region ? ` · ${session.region} Region` : ''} · ${session.officer}` : '';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:h-16 lg:px-6">
      <h1 className="min-w-0 truncate text-base font-bold text-navy lg:text-lg">{titleFor(pathname)}</h1>
      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
        <SearchButton />
        <NotificationsBell />
        {session && (
          <span className="hidden whitespace-nowrap rounded-full bg-[#E3ECFA] px-3 py-1 text-xs font-semibold text-navy-2 xl:inline" data-tour="role-pill">
            {rolePill}
            {role?.readOnly && <span className="ml-1 font-medium text-muted">(read-only)</span>}
          </span>
        )}
        <Tooltip content={clock ? `Demo clock: ${fmtDate(clock.now)}${clock.offsetDays ? ` (+${clock.offsetDays} d)` : ''}` : 'Demo controls'}>
          <Button variant="saffron" size="sm" onClick={() => setPanel(true)} data-tour="demo-button" className="shrink-0">
            <FlaskConical /> <span className="hidden sm:inline">Demo</span>
            {!!clock?.offsetDays && <span className="rounded bg-navy px-1 text-[10px] text-white">+{clock.offsetDays}d</span>}
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
