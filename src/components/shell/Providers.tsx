'use client';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/primitives';
import { Toaster } from '@/components/ui/toast';
import { useSession } from '@/store/session';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false } } }),
  );
  const hydrate = useSession((s) => s.hydrate);
  React.useEffect(() => hydrate(), [hydrate]);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
