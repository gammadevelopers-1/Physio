"use client";

import { createElement, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useLocale } from "next-intl";
import { paymentApi } from "@/lib/api";

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
// Tamara Widget V2 fetches the merchant config JSON from the SAME CDN it
// was loaded from — so a widget served by cdn.tamara.co looks for
// cdn.tamara.co/merchant_widget_config/{key}_...json, and a sandbox
// widget from cdn-sandbox.tamara.co looks in the sandbox bucket. Merchant
// configs live in one bucket or the other, never both, so a mismatch means
// the config 404s and the <tamara-widget> element stays empty. Default to
// prod; sandbox deploys set NEXT_PUBLIC_TAMARA_CDN_URL to the sandbox CDN.
const TAMARA_CDN_URL =
  process.env.NEXT_PUBLIC_TAMARA_CDN_URL || "https://cdn.tamara.co";

declare global {
  interface Window {
    // Tabby exposes TWO different widget classes from the same script:
    //   TabbyPromo — for product / cart placement, takes a `source` param
    //   TabbyCard  — for checkout placement, no `source` param
    // Same loader script; just different constructors.
    TabbyPromo?: new (config: Record<string, unknown>) => unknown;
    TabbyCard?: new (config: Record<string, unknown>) => unknown;
    TamaraWidgetV2?: { refresh: () => void };
    // Tamara V2 widget — per the official Tamara-summary docs
    // (https://widget-docs.tamara.co/tamara-summary) the config split is:
    //   window.tamaraWidgetConfig → page-level only (lang, country,
    //     publicKey, optional css / style). Nothing else goes here.
    //   <tamara-widget> element attributes → per-placement (type,
    //     amount, inline-type). This is where price + widget variant live.
    // Setting `type` or `amount` on the global is ignored, which is why the
    // widget renders only the Tamara logo badge (default inline-type=4);
    // fixed by moving type/amount to the element as HTML attributes below.
    tamaraWidgetConfig?: {
      lang: string;
      country: string;
      publicKey: string;
      style?: {
        fontSize?: string;
        badgeRatio?: number;
      };
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
  // Skeleton shown while the Tamara widget script fetches config and
  // paints. Custom elements mount synchronously but the visible content
  // takes a moment to appear; otherwise buyers see a bare rounded tile
  // for the first ~1s. Flipped off once the widget wrapper reports a
  // non-trivial height (real content painted) OR the 2.5s timeout fires
  // — whichever comes first. Whatever the widget looks like after that
  // (bare-logo while Tamara Ops finishes CDN provisioning, or the full
  // installment breakdown once they finish) is what we show; no
  // hardcoded fallback strip.
  const [tamaraLoading, setTamaraLoading] = useState(true);
  const tamaraWrapperRef = useRef<HTMLDivElement>(null);
  // Per-source-AND-filter mount id so the same page can mount Tabby twice
  // (e.g. checkout has one near the Tabby radio and one near Tamara — the
  // Tamara render still includes the wrapping element ref but no Tabby
  // widget). Suffixing with `only` prevents id collisions.
  const tabbyMountId = `tabby-promo-${source}${only ? `-${only}` : ""}`;
  const tabbyInstantiatedRef = useRef(false);

  // Admin-controlled per-gateway visibility. Missing → true (fail open so
  // rendering doesn't stall on network hiccups; backend still rejects
  // charges on disabled gateways). `null` while loading — during that
  // interval we render optimistically; disabling later hides the widget
  // on the next fetch.
  const [visibleGateways, setVisibleGateways] = useState<{
    tabby: boolean;
    tamara: boolean;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    paymentApi
      .getVisibleGateways()
      .then((v) => {
        if (!cancelled)
          setVisibleGateways({ tabby: v.tabby, tamara: v.tamara });
      })
      .catch(() => {
        if (!cancelled) setVisibleGateways({ tabby: true, tamara: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const gwTabbyOn = visibleGateways?.tabby !== false;
  const gwTamaraOn = visibleGateways?.tamara !== false;
  const showTabby = (!only || only === "tabby") && gwTabbyOn;
  const showTamara = (!only || only === "tamara") && gwTamaraOn;

  const showWidgets = price >= 50 && currency === "SAR";

  // Set Tamara's page-level config SYNCHRONOUSLY during render, before
  // React commits the DOM. Custom-element connectedCallback fires during
  // commit (before useEffect), so if we defer this to an effect the
  // widget's initConfig() reads an empty object, logs "TamaraWidgetV2:
  // Invalid public key", and renders nothing. React StrictMode may run
  // this twice in dev — harmless; it's just a window property assignment.
  //
  // NOTE (per Tamara V2 official docs): only lang / country / publicKey
  // belong here. `type`, `amount`, `inline-type` are per-placement
  // configuration and MUST be set as HTML attributes on the
  // <tamara-widget> element (see the createElement call below).
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
      // Match Tabby's compact visual weight — its promo pill has the
      // brand logo at ~40% of card height. Tamara's default badgeRatio 1
      // reads as an oversized gradient tile beside our smaller helper
      // text; 0.7 brings the badge roughly in line with Tabby's tile.
      style: { badgeRatio: 0.7 },
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
      script.src = `${TAMARA_CDN_URL}/widget-v2/tamara-widget.js`;
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

  // Poll for the widget rendering something (any content). We're not
  // deciding success vs failure — we're just deciding when to hide the
  // skeleton and reveal whatever the widget produced. 40px covers both
  // the bare-logo state (current sandbox) and the full breakdown; 2.5s
  // hard cap so the skeleton doesn't stall forever if the widget stays
  // 0px tall for any reason.
  useEffect(() => {
    if (!showWidgets || !showTamara || !TAMARA_PUBLIC_KEY) return;
    setTamaraLoading(true);
    const poll = setInterval(() => {
      const el = tamaraWrapperRef.current;
      if (el && el.offsetHeight >= 40) {
        setTamaraLoading(false);
        clearInterval(poll);
      }
    }, 200);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setTamaraLoading(false);
    }, 2500);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [price, lang, currency, source, showWidgets, showTamara]);

  if (!showWidgets) return null;
  // Nothing to show — both requested gateways are hidden by admin.
  if (!showTabby && !showTamara) return null;

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
        // Widget flows naturally so the offsetHeight poll measures its
        // true rendered height. Skeleton overlays it while loading; once
        // hidden, whatever the widget rendered (bare-logo during current
        // sandbox onboarding, or full installment breakdown once Tamara
        // Ops finishes provisioning our CDN config) is what buyers see.
        <div className={`relative ${tamaraLoading ? "min-h-14" : ""}`}>
          {/* Bare mount div — Tamara's V2 widget renders its own iframe
              (white background, 1px border, 16px rounded corners per the
              KSA guidelines) whenever inline-type ≥ 1 unlocks the "Use
              current template" content. An extra wrapper here would
              produce a card-within-a-card look; matches Tabby which also
              mounts into a bare div and lets the vendor script paint the
              frame. */}
          <div ref={tamaraWrapperRef} className="flex items-center justify-center">
            {/* Per Tamara V2's official widget docs
                (https://widget-docs.tamara.co/tamara-summary), the
                <tamara-widget> element takes THREE authoritative
                attributes that drive its rendered content:

                  - type         : "tamara-summary" (product/cart placement)
                                   or "tamara-card-snippet" (checkout row).
                  - amount       : the cart total to itemise (format DDDD.dd).
                  - inline-type  : rendering variant. Default is 4 —
                                   "Default is a Tamara logo badge" — which
                                   is why our earlier build showed only
                                   the tamara wordmark. inline-type="2" is
                                   the "Use current template" variant which
                                   renders the calculated downpayment and
                                   repayment as inline text next to the
                                   badge — exactly the "Pay SAR X / 4
                                   payments / Shariah-compliant / More
                                   options" content the KSA Widget
                                   Implementation Guidelines mandate.

                We only set inline-type on the summary widget; the checkout
                card-snippet variant renders its own compact copy from the
                same amount attribute. Keying by price + source + lang
                forces React to remount a fresh element when any of those
                change, so a stale widget from a previous price never
                lingers on screen. */}
            {createElement("tamara-widget", {
              key: `tamara-${source}-${lang}-${price.toFixed(2)}`,
              type:
                source === "checkout"
                  ? "tamara-card-snippet"
                  : "tamara-summary",
              amount: price.toFixed(2),
              ...(source === "checkout" ? {} : { "inline-type": "2" }),
            })}
          </div>
          {tamaraLoading && (
            // Opaque pulse tile that hides the still-mounting widget
            // behind it. `absolute inset-0` matches the wrapper's size
            // — the min-h-14 above guarantees at least the Tabby-promo
            // tile height until the widget grows past it.
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-[var(--color-border-subtle)] animate-pulse"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
