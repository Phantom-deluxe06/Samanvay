'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { useSession } from '@/store/session';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { IntakeSheet } from '@/components/cases/IntakeSheet';
import { OverlapAlertModal } from '@/components/overlaps/OverlapAlertModal';
import { DemoPanel } from '@/components/demo/DemoPanel';
import { GuidedTour } from '@/components/demo/GuidedTour';
import { Logo } from '@/components/shell/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, hydrated } = useSession();
  // Warm the in-browser database (deterministic seed + overlap engine) once.
  const ready = useQuery({ queryKey: ['db-ready'], queryFn: () => api.getClock(), enabled: hydrated && !!session, staleTime: Infinity });

  useEffect(() => {
    if (hydrated && !session) router.replace('/login');
  }, [hydrated, session, router]);

  if (!hydrated || !session || !ready.isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy text-white">
        <Logo />
        <div className="flex items-center gap-2 text-sm text-[#C9D6EA]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {ready.isError ? 'Could not prepare the demo database.' : 'Preparing synthetic data and running the matching engine…'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-col pl-16 lg:pl-[220px]">
        <Topbar />
        <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
        <footer className="px-6 pb-4 text-[11px] text-[#8796AB]">Prototype · synthetic data · SIH 2026 PS 26264</footer>
      </div>
      <CommandPalette />
      <IntakeSheet />
      <OverlapAlertModal />
      <DemoPanel />
      <GuidedTour />
    </div>
  );
}
