'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts';
import { CalendarProvider } from '@/contexts/CalendarContext';

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AuthProvider>
      <CalendarProvider>
      {children}
      </CalendarProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="aria-live-region" />
    </AuthProvider>
  );
}
