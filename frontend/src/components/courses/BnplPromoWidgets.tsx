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
    // Tamara V2 widget reads its config from window.tamaraWidgetConfig —
    // NOT from HTML attributes on the <tamara-widget> element. Its
    // observedAttributes is just ["uuid"]; every other setting comes
    // from this global. Ship it BEFORE the widget script loads or the
    // custom element's initConfig() sees an empty object, misses
    // publicKey, logs "TamaraWidgetV2: Invalid public key" and renders
    // nothing (verified by reading the minified V2 loader source).
    tamaraWidgetConfig?: {
      lang: string;
      country: string;
      publicKey: string;
      amount: string;
      currency: string;
      type: string;
    };
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

  // Set Tamara's global config SYNCHRONOUSLY during render, before React
  // commits the DOM. Custom-element connectedCallback fires during commit
  // (before useEffect), so if we defer this to an effect the widget's
  // initConfig() reads an empty object and the whole widget silently no-ops.
  // React StrictMode may run this twice in dev — harmless; it's just a
  // window property assignment. The trailing useEffect below then handles
  // refresh() on later price changes when the script is already loaded.
  if (
    typeof window !== "undefined" &&
    showWidgets &&
    showTamara &&
    TAMARA_PUBLIC_KEY
  ) {
    window.tamaraWidgetConfig = {
      lang,
      country: "SA",
      publicKey: TAMARA_PUBLIC_KEY,
      amount: price.toFixed(2),
      currency,
      type: source === "checkout" ? "tamara-card-snippet" : "tamara-summary",
    };
  }

  useEffect(() => {
    if (!showWidgets || !showTabby || !TABBY_PUBLIC_KEY || !TABBY_MERCHANT_CODE) return;

    // Tabby ships two distinct widgets for two contexts:
    //   - TabbyPromo (product / cart pages): takes `source: 'product' | 'cart'`
    //   - TabbyCard  (checkout page): no `source` param, sits next to the
    //     payment method radio.
    // Different loader scripts (see the Script tag below).
    //
    // Re-init allowed by resetting the ref — React's `key` on the mount
    // div below also unmounts/remounts the DOM node when price changes
    // so the widget always sees a fresh empty target. (Previous attempt
    // here manually cleared innerHTML, which broke the cart widget on
    // unrelated re-renders by wiping Tabby's mounted content.)
    tabbyInstantiatedRef.current = false;

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
          // Tabby's canonical docs example uses shouldInheritBg: false on
          // BOTH the checkout TabbyCard and the product/cart TabbyPromo.
          // The previous `isCheckout` toggle was a cosmetic tweak (let the
          // widget inherit the radio's selected-blue background) but it
          // diverged from the docs example Tabby's QA bot compares against.
          // Match the docs verbatim so the widget renders the priced
          // installment view (their compact "Split your purchase" fallback
          // can otherwise appear when the config doesn't match the docs).
          shouldInheritBg: false,
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

  // Inject the Tamara V2 loader script once per page + call refresh() on
  // subsequent price/lang changes. Config itself is already on window from
  // the render-body assignment above.
  //
  // `tamara-summary` is the KSA-required widget type for PDP + cart (per
  // KSA Widget Implementation Guidelines Section 2.1 + 2.2) — shows the
  // "Pay SAR X/mo or in 4 payments. Sharia-compliant. More options" copy.
  // `tamara-card-snippet` is the compact checkout-tile variant (Section
  // 2.3) — shows "Monthly payments. Sharia-compliant." next to the radio.
  useEffect(() => {
    if (!showWidgets || !showTamara || !TAMARA_PUBLIC_KEY) return;
    if (typeof window === "undefined") return;

    // next/script's <Script> with lazyOnload is unreliable here because
    // the config must be on window BEFORE the script parses; manual head
    // injection makes the ordering explicit — the render-body assignment
    // above always beats this.
    if (!document.querySelector('script[data-tamara-widget-v2]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tamara.co/widget-v2/tamara-widget.js";
      script.async = true;
      script.setAttribute("data-tamara-widget-v2", "1");
      document.head.appendChild(script);
    }

    // If the script already loaded on a prior render (SPA nav between
    // pages), ask the widget to re-read the (now-updated) config and
    // re-render existing <tamara-widget> instances in place.
    if (window.TamaraWidgetV2?.refresh) {
      try {
        window.TamaraWidgetV2.refresh();
      } catch {
        // Older builds may not expose refresh — first render still works.
      }
    }
  }, [price, lang, currency, source, showWidgets, showTamara]);

  if (!showWidgets) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-label="Buy now, pay later options">
      {showTabby && TABBY_PUBLIC_KEY && TABBY_MERCHANT_CODE ? (
        <>
          {/* Tabby ships two SEPARATE loader scripts — one per widget class.
              Product/cart uses tabby-promo.js (exposes window.TabbyPromo);
              checkout uses tabby-card.js (exposes window.TabbyCard). Loading
              tabby-promo.js on checkout — the old behaviour — never defined
              window.TabbyCard so the checkout snippet silently failed to
              render. This was the "checkout snippet missing" line item
              in Tabby's QA report. */}
          <Script
            src={
              source === "checkout"
                ? "https://checkout.tabby.ai/tabby-card.js"
                : "https://checkout.tabby.ai/tabby-promo.js"
            }
            strategy="lazyOnload"
          />
          {/* `key` includes the rounded price — when the cart total or
              checkout total changes, React unmounts the old div and
              mounts a fresh one, guaranteeing TabbyPromo/TabbyCard sees
              an empty target instead of doubling up content. The widget
              has no documented destroy() method, so DOM remount is the
              reliable way to swap prices. */}
          <div
            key={`${tabbyMountId}-${price.toFixed(2)}`}
            id={tabbyMountId}
            ref={tabbyMountRef}
          />
        </>
      ) : null}
      {showTamara && TAMARA_PUBLIC_KEY ? (
        // Tamara V2's <tamara-widget> element takes ZERO configuration
        // attributes — it reads everything from window.tamaraWidgetConfig
        // (set in the useEffect above). Passing type/amount/currency as
        // HTML attributes is a no-op — the element's observedAttributes is
        // just ["uuid"]. Keying by price + source + lang forces React to
        // remount a fresh element when any of those change, so a stale
        // widget from a previous price never lingers on screen.
        createElement("tamara-widget", {
          key: `tamara-${source}-${lang}-${price.toFixed(2)}`,
        })
      ) : null}
    </div>
  );
}
