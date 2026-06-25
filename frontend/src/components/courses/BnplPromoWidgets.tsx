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
  /** When set, render only that one gateway's snippet (the other is
   *  skipped). Used on the checkout page so each gateway's snippet sits
   *  next to its own radio button. Leave undefined to render both
   *  side-by-side (product / cart pages). */
  only?: "tabby" | "tamara";
  className?: string;
}

const TABBY_PUBLIC_KEY = process.env.NEXT_PUBLIC_TABBY_PUBLIC_KEY || "";
const TABBY_MERCHANT_CODE = process.env.NEXT_PUBLIC_TABBY_MERCHANT_CODE || "";
const TAMARA_PUBLIC_KEY = process.env.NEXT_PUBLIC_TAMARA_PUBLIC_KEY || "";

declare global {
  interface Window {
    // Tabby exposes TWO different widget classes from the same script:
    //   TabbyPromo — for product / cart placement, takes a `source` param
    //   TabbyCard  — for checkout placement, no `source` param
    // Same loader script; just different constructors.
    TabbyPromo?: new (config: Record<string, unknown>) => unknown;
    TabbyCard?: new (config: Record<string, unknown>) => unknown;
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
  only,
  className = "",
}: BnplPromoWidgetsProps) {
  const locale = useLocale();
  const lang = locale === "ar" ? "ar" : "en";
  const tabbyMountRef = useRef<HTMLDivElement>(null);
  // Per-source-AND-filter mount id so the same page can mount Tabby twice
  // (e.g. checkout has one near the Tabby radio and one near Tamara — the
  // Tamara render still includes the wrapping element ref but no Tabby
  // widget). Suffixing with `only` prevents id collisions.
  const tabbyMountId = `tabby-promo-${source}${only ? `-${only}` : ""}`;
  const tabbyInstantiatedRef = useRef(false);
  const showTabby = !only || only === "tabby";
  const showTamara = !only || only === "tamara";

  const showWidgets = price >= 50 && currency === "SAR";

  useEffect(() => {
    if (!showWidgets || !showTabby || !TABBY_PUBLIC_KEY || !TABBY_MERCHANT_CODE) return;

    // Tabby ships two distinct widgets for two contexts:
    //   - TabbyPromo (product / cart pages): takes `source: 'product' | 'cart'`
    //   - TabbyCard  (checkout page): no `source` param, sits next to the
    //     payment method radio.
    // Same loader script; instantiated imperatively (no auto-mount). Wait
    // for the script + mount node, then construct the right class for the
    // surface we're on.
    const isCheckout = source === "checkout";
    const tryInstantiate = () => {
      if (tabbyInstantiatedRef.current) return;
      if (!tabbyMountRef.current) return;
      const Ctor = isCheckout ? window.TabbyCard : window.TabbyPromo;
      if (!Ctor) return;
      try {
        const config: Record<string, unknown> = {
          selector: `#${tabbyMountId}`,
          currency,
          price: price.toFixed(2),
          lang,
          // shouldInheritBg lets the widget pick up the surrounding card's
          // background instead of a hard white block — matters most on the
          // checkout radio cards (light blue when selected, white otherwise).
          shouldInheritBg: isCheckout,
          publicKey: TABBY_PUBLIC_KEY,
          merchantCode: TABBY_MERCHANT_CODE,
        };
        // TabbyCard explicitly omits `source`; only TabbyPromo takes it.
        if (!isCheckout) config.source = source;
        new Ctor(config);
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
  }, [price, currency, lang, source, tabbyMountId, showWidgets, showTabby]);

  // Re-run Tamara's widget initialisation when price changes — its web
  // component doesn't reactively re-render on attribute changes alone in
  // some builds, so we nudge it.
  useEffect(() => {
    if (!showWidgets || !showTamara || !TAMARA_PUBLIC_KEY) return;
    if (typeof window !== "undefined" && window.TamaraWidgetV2) {
      try {
        window.TamaraWidgetV2.refresh();
      } catch {
        // Refresh API not exposed in older builds — first render still works.
      }
    }
  }, [price, showWidgets, showTamara]);

  if (!showWidgets) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-label="Buy now, pay later options">
      {showTabby && TABBY_PUBLIC_KEY && TABBY_MERCHANT_CODE ? (
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
      {showTamara && TAMARA_PUBLIC_KEY ? (
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
