'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Building, Eye, FileSearch, Gavel, MapPin, ShieldCheck } from 'lucide-react';
import { REGIONAL_OFFICERS, REGIONS, ROLES } from '@/lib/constants';
import type { Region, RoleId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/primitives';
import { Select } from '@/components/ui/overlays';
import { homeFor } from '@/components/shell/nav';

const ICON: Record<RoleId, React.ReactNode> = {
  PGRC: <FileSearch className="h-5 w-5" />,
  RB: <Gavel className="h-5 w-5" />,
  RO: <MapPin className="h-5 w-5" />,
  SENIOR: <Eye className="h-5 w-5" />,
  ADMIN: <ShieldCheck className="h-5 w-5" />,
};

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { signIn, session } = useSession();
  const [region, setRegion] = useState<Region>('Southern');

  const choose = (id: RoleId) => {
    const role = ROLES.find((r) => r.id === id)!;
    signIn({ role: id, officer: id === 'RO' ? REGIONAL_OFFICERS[region] : role.officer, region: id === 'RO' ? region : undefined });
    qc.invalidateQueries();
    router.push(homeFor(id));
  };

  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-white">
          <div className="text-4xl font-extrabold tracking-wide">SAMAN<span className="text-brand-saffron">VAY</span></div>
          <p className="mt-2 max-w-2xl text-[15px] text-[#C9D6EA]">
            One window for every complaint about a technical institution — across PGRC, Regulation Bureau and the Regional Offices.
            Samanvay links the same institution however it is spelt, spots overlapping cases, and keeps every decision with an officer.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-[#C9D6EA]">
            <Building className="h-3.5 w-3.5" /> Mock sign-in · pick a role to explore. No real authentication.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.id} className={cn('flex flex-col rounded-card border border-white/10 bg-white p-4', session?.role === r.id && 'ring-2 ring-brand-saffron')}>
              <div className="flex items-center gap-2 text-navy">
                <span className="rounded-md bg-[#E3ECFA] p-1.5 text-navy-2">{ICON[r.id]}</span>
                <div>
                  <div className="text-sm font-bold">{r.label}</div>
                  <div className="text-xs text-muted">{r.id === 'RO' ? REGIONAL_OFFICERS[region] : r.officer}</div>
                </div>
              </div>
              <p className="mt-3 flex-1 text-[13px] text-muted">{r.description}</p>
              {r.id === 'RO' && (
                <div className="mt-3">
                  <Select ariaLabel="Region" value={region} onValueChange={(v) => setRegion(v as Region)} options={REGIONS.map((x) => ({ value: x, label: `${x} Region` }))} />
                </div>
              )}
              <Button className="mt-3" variant={r.id === 'SENIOR' ? 'navy' : 'default'} onClick={() => choose(r.id)}>
                Continue as {r.label}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <footer className="pb-4 text-center text-[11px] text-[#8FA3C2]">Prototype · synthetic data · SIH 2026 PS 26264 · all institution names are fictional</footer>
    </div>
  );
}
