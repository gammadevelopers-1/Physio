"use client";

import { createElement, useEffect, useRef } from "react";
import Script from "next/script";
import { useLocale } from "next-intl";

interface BnplPromoWidgetsProps {
  /** Final price the buyer would pay (post-sale). Widgets show the
   *  installment plan computed from this amount. */
  price: number;
  currency?: string;
  /** Where this widget is mounted — Tabby uses this for funnel attribution. */
  source?: "product" | "cart" | "checkout";
  className?: string;
}

const TABBY_PUBLIC_KEY = process.env.NEXT_PUBLIC_TABBY_PUBLIC_KEY || "";
const TABBY_MERCHANT_CODE = process.env.NEXT_PUBLIC_TABBY_MERCHANT_CODE || "";
const TAMARA_PUBLIC_KEY = process.env.NEXT_PUBLIC_TAMARA_PUBLIC_KEY || "";

declare global {
  interface Window {
    TabbyPromo?: new (config: Record<string, unknown>) => unknown;
    TamaraWidgetV2?: { refresh: () => void };
  }
}

/**
 * Renders Tabby + Tamara promotional widgets ("Pay in 4 of SAR X" /
 * "3 interest-free monthly payments"). Both widgets fail silently if their
 * public keys are missing, so this component is safe to render even before
 * the BNPL gateways are fully enabled.
 *
 * Skipped entirely for amounts under each gateway's minimum (Tabby: 50 SAR,
 * Tamara: 50 SAR) — the widgets themselves filter, but rendering when we
 * already know it's a no-op saves DOM noise.
 */
export default function BnplPromoWidgets({
  price,
  currency = "SAR",
  source = "product",
  className = "",
}: BnplPromoWidgetsProps) {
  const locale = useLocale();
  const lang = locale === "ar" ? "ar" : "en";
  const tabbyMountRef = useRef<HTMLDivElement>(null);
  const tabbyMountId = `tabby-promo-${source}`;
  const tabbyInstantiatedRef = useRef(false);

  const showWidgets = price >= 50 && currency === "SAR";

  useEffect(() => {
    if (!showWidgets || !TABBY_PUBLIC_KEY || !TABBY_MERCHANT_CODE) return;

    // Tabby's widget is instantiated imperatively (it doesn't auto-mount
    // like Tamara's web component). Wait for the script to load and the
    // mount node to be in the DOM, then construct.
    const tryInstantiate = () => {
      if (tabbyInstantiatedRef.current) return;
      if (!window.TabbyPromo || !tabbyMountRef.current) return;
      try {
        new window.TabbyPromo({
          selector: `#${tabbyMountId}`,
          currency,
          price: price.toFixed(2),
          lang,
          source,
          publicKey: TABBY_PUBLIC_KEY,
          merchantCode: TABBY_MERCHANT_CODE,
        });
        tabbyInstantiatedRef.current = true;
      } catch {
        // Tabby's script crashed (network, sandbox quirk) — silently skip.
      }
    };

    tryInstantiate();
    const interval = setInterval(tryInstantiate, 500);
    const timeout = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [price, currency, lang, source, tabbyMountId, showWidgets]);

  // Re-run Tamara's widget initialisation when price changes — its web
  // component doesn't reactively re-render on attribute changes alone in
  // some builds, so we nudge it.
  useEffect(() => {
    if (!showWidgets || !TAMARA_PUBLIC_KEY) return;
    if (typeof window !== "undefined" && window.TamaraWidgetV2) {
      try {
        window.TamaraWidgetV2.refresh();
      } catch {
        // Refresh API not exposed in older builds — first render still works.
      }
    }
  }, [price, showWidgets]);

  if (!showWidgets) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-label="Buy now, pay later options">
      {TABBY_PUBLIC_KEY && TABBY_MERCHANT_CODE ? (
        <>
          <Script
            src="https://checkout.tabby.ai/tabby-promo.js"
            strategy="lazyOnload"
          />
          <div
            id={tabbyMountId}
            ref={tabbyMountRef}
            className="min-h-[40px]"
          />
        </>
      ) : null}
      {TAMARA_PUBLIC_KEY ? (
        <>
          <Script
            src="https://cdn.tamara.co/widget-v2/tamara-widget.js"
            strategy="lazyOnload"
          />
          {createElement("tamara-widget", {
            type: "tamara-summary",
            amount: price.toFixed(2),
            currency,
            "inline-type": "6",
            "inline-position": "center",
            lang,
            "public-key": TAMARA_PUBLIC_KEY,
          })}
        </>
      ) : null}
    </div>
  );
}
