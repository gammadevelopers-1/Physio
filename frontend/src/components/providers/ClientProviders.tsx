'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts';
import { CalendarProvider } from '@/contexts/CalendarContext';
import { FavouritesProvider } from '@/contexts/FavouritesContext';
import { PlatformLocaleProvider } from '@/contexts/PlatformLocaleContext';
import { PlatformGeneralProvider } from '@/contexts/PlatformGeneralContext';
import type { PlatformLocaleSettings } from '@/lib/platform-locale';
import type { PlatformGeneralSettings } from '@/lib/platform-general';

interface ClientProvidersProps {
  children: ReactNode;
  platformLocale?: PlatformLocaleSettings;
  platformGeneral?: PlatformGeneralSettings;
}

export function ClientProviders({ children, platformLocale, platformGeneral }: ClientProvidersProps) {
  return (
    <AuthProvider>
      <PlatformLocaleProvider initial={platformLocale}>
        <PlatformGeneralProvider initial={platformGeneral}>
          <CalendarProvider>
            <FavouritesProvider>
              {children}
            </FavouritesProvider>
          </CalendarProvider>
        </PlatformGeneralProvider>
      </PlatformLocaleProvider>
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
