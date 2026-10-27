'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/store/session';
import { homeFor } from '@/components/shell/nav';

export default function Home() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  useEffect(() => {
    if (!hydrated) return;
    router.replace(session ? homeFor(session.role) : '/login');
  }, [hydrated, session, router]);
  return null;
}
