'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Repeat } from 'lucide-react';
import { useCounts } from '@/api/hooks';
import { ROLES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useSession } from '@/store/session';
import { Tooltip } from '@/components/ui/primitives';
import { NAV } from './nav';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="leading-none">
      <div className={cn('font-extrabold tracking-wide text-white', compact ? 'text-sm' : 'text-xl')}>
        SAMAN<span className="text-brand-saffron">VAY</span>
      </div>
      {!compact && <div className="mt-1 text-[10.5px] font-medium text-[#A9BCD8]">AICTE Complaint Monitoring</div>}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);
  const { data: counts } = useCounts();
  const role = ROLES.find((r) => r.id === session?.role);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col bg-navy text-white lg:w-[220px]" aria-label="Main navigation">
      <div className="flex h-14 items-center px-4 lg:h-16 lg:px-5">
        <Link href="/overview" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-saffron">
          <span className="hidden lg:block"><Logo /></span>
          <span className="lg:hidden"><Logo compact /></span>
        </Link>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = item.badge ? counts?.[item.badge] ?? 0 : 0;
          const Icon = item.icon;
          return (
            <Tooltip key={item.href} content={item.label} side="right">
              <Link
                href={item.href}
                data-tour={`nav-${item.href.slice(1)}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-[#C9D6EA] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-saffron',
                  'sub' in item && item.sub && 'lg:-mt-0.5 lg:py-1.5 lg:pl-10 lg:text-[12.5px]',
                  active && 'bg-navy-2 text-white',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', 'sub' in item && item.sub && 'lg:hidden')} aria-hidden />
                <span className="hidden flex-1 truncate lg:inline">{item.label}</span>
                {count > 0 && (
                  <span
                    className={cn('rounded-full px-1.5 text-[10.5px] font-bold leading-[18px]', item.badge === 'overlaps' ? 'bg-brand-red text-white' : 'bg-brand-saffron text-navy', 'absolute right-1 top-0.5 lg:static')}
                    aria-label={`${count} ${item.badge === 'overlaps' ? 'open overlap alerts' : 'cases need confirmation'}`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            </Tooltip>
          );
        })}
      </nav>
      {session && (
        <div className="border-t border-white/10 p-3">
          <div className="hidden lg:block">
            <div className="text-[11px] uppercase tracking-wide text-[#A9BCD8]">{role?.label}{session.region ? ` · ${session.region}` : ''}</div>
            <div className="mt-0.5 truncate text-[13px] font-semibold">{session.officer}</div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5 lg:flex-row">
            <button onClick={() => router.push('/login')} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-saffron" title="Switch role">
              <Repeat className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Switch role</span>
            </button>
            <button
              onClick={() => {
                signOut();
                router.push('/login');
              }}
              className="flex items-center justify-center rounded-md bg-white/10 px-2 py-1.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-saffron"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
