'use client';
import { create } from 'zustand';
import type { Session } from '@/lib/types';
import { api } from '@/api/client';

const KEY = 'samanvay.session';

function load(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

interface SessionState {
  session: Session | null;
  hydrated: boolean;
  hydrate: () => void;
  signIn: (s: Session) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  session: null,
  hydrated: false,
  hydrate: () => {
    const s = load();
    api.setSession(s);
    set({ session: s, hydrated: true });
  },
  signIn: (s) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage blocked: the session lives in memory */
    }
    api.setSession(s);
    void api.logRoleSwitch(s);
    set({ session: s });
  },
  signOut: () => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    api.setSession(null);
    set({ session: null });
  },
}));
