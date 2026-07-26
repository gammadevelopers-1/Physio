'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { useLocale } from 'next-intl';
import { AuthProvider, CartProvider } from '@/contexts';
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
  const locale = useLocale();
  const isRTL = locale === 'ar';
  return (
    <AuthProvider>
      <PlatformLocaleProvider initial={platformLocale}>
        <PlatformGeneralProvider initial={platformGeneral}>
          <CalendarProvider>
            <FavouritesProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </FavouritesProvider>
          </CalendarProvider>
        </PlatformGeneralProvider>
      </PlatformLocaleProvider>
      <Toaster
        position={isRTL ? 'top-left' : 'top-right'}
        dir={isRTL ? 'rtl' : 'ltr'}
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
