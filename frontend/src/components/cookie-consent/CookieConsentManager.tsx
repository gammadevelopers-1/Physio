"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  CookieConsentState,
  readConsent,
} from "@/lib/cookie-consent";
import CookieConsentBanner from "./CookieConsentBanner";
import CookiePreferencesModal from "./CookiePreferencesModal";

// PDPL-compliant tracker gate.
//
// Third-party IDs live in one place. If you rotate a tracker or add a new
// vendor, update this block AND the cookies section of the Privacy Notice
// AND the third-party-services register.
const META_PIXEL_ID = "1956469491660011";
const GA4_ID = "G-Z9DZXJQCWY";
const GTM_ID = "GTM-P8RKDMNL";

// Custom DOM event fired by the footer link to reopen the preferences modal
// after the initial consent decision has been made.
export const COOKIE_CONSENT_OPEN_PREFERENCES_EVENT =
  "physioguidance:cookie-consent-open-preferences";

export default function CookieConsentManager({ nonce }: { nonce?: string }) {
  // `hydrated` gates every render decision on client-side hydration so the
  // banner never appears in the SSR HTML (avoids CLS + hydration mismatch).
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<CookieConsentState | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setState(readConsent());

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsentState>).detail;
      setState(detail ?? readConsent());
    };
    const onOpenPreferences = () => setPreferencesOpen(true);

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChange);
    window.addEventListener(COOKIE_CONSENT_OPEN_PREFERENCES_EVENT, onOpenPreferences);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onChange);
      window.removeEventListener(COOKIE_CONSENT_OPEN_PREFERENCES_EVENT, onOpenPreferences);
    };
  }, []);

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  if (!hydrated) return null;

  const analyticsAllowed = state?.analytics === true;
  const marketingAllowed = state?.marketing === true;
  const bannerVisible = state === null;

  return (
    <>
      {analyticsAllowed && (
        <>
          <Script
            id="gtm-base"
            strategy="afterInteractive"
            nonce={nonce}
          >{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            nonce={nonce}
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            nonce={nonce}
          >{`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${GA4_ID}');`}</Script>
        </>
      )}

      {marketingAllowed && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          nonce={nonce}
        >{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${META_PIXEL_ID}');fbq('track', 'PageView');`}</Script>
      )}

      {bannerVisible && <CookieConsentBanner onOpenPreferences={openPreferences} />}
      {preferencesOpen && (
        <CookiePreferencesModal state={state} onClose={closePreferences} />
      )}
    </>
  );
}
