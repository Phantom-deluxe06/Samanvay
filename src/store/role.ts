'use client';
import { REGION_TO_BUREAU, ROLES } from '@/lib/constants';
import type { BureauCode } from '@/lib/types';
import { useSession } from './session';

/** Convenience view of the current role for UI decisions (the API enforces the same rules). */
export function useRoleInfo() {
  const session = useSession((s) => s.session);
  const def = ROLES.find((r) => r.id === session?.role);
  const ownBureau: BureauCode | null =
    session?.role === 'PGRC' ? 'PGRC' : session?.role === 'RB' ? 'RB' : session?.role === 'RO' && session.region ? REGION_TO_BUREAU[session.region] : null;
  return {
    session,
    def,
    ownBureau,
    readOnly: !!def?.readOnly,
    seesAll: session?.role === 'SENIOR' || session?.role === 'ADMIN',
    isAdmin: session?.role === 'ADMIN',
  };
}
