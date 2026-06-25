"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { paymentApi } from "@/lib/api";

export default function PaymentCallbackPage() {
  const t = useTranslations("paymentCallback");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id") || searchParams.get("paymentId");
  // Moyasar redirects back with ITS ids (no payment_id): invoice_id == our
  // gatewayChargeId; fall back to id. Used to resolve our payment when
  // payment_id isn't present in the return URL.
  const chargeId = searchParams.get("invoice_id") || searchParams.get("id");
  // The gateway reports the outcome directly in the redirect URL. Our webhook
  // completes the payment server-side, so we honour this status for the final
  // redirect even when the cross-origin verify() call below can't authenticate
  // (after a gateway redirect the in-memory access token is gone and the CSRF
  // cookie set on api.* can't be read by the storefront origin).
  //
  // Param naming varies per gateway:
  //   - Moyasar:  ?status=paid|failed
  //   - Tamara:   ?paymentStatus=approved|declined|cancelled|failed
  //   - Tabby:    ?payment_status=closed|rejected|expired
  // Normalize all three into our internal vocabulary ('paid' | 'failed' |
  // 'cancelled') before branching.
  const gateway = searchParams.get("gateway");
  const rawGatewayStatus =
    searchParams.get("status") ||
    searchParams.get("paymentStatus") ||
    searchParams.get("payment_status");
  const gatewayStatus = normalizeGatewayStatus(gateway, rawGatewayStatus);

  const [status, setStatus] = useState<string>("processing");
  const [error, setError] = useState<string | null>(null);
  const pollCount = useRef(0);
  const maxPolls = 20; // 60 seconds max (20 × 3s)
  // Tamara's webhook fires slower than Moyasar's; give it more breathing room
  // before bailing to the "Try again" timeout state. The buyer has already
  // seen "Approved" on Tamara's page so a few extra seconds is fine.
  const gracePeriodMs = gateway === "tamara" ? 8000 : 4000;

  useEffect(() => {
    if (!paymentId && !chargeId && !gatewayStatus) {
      setError("No payment reference provided");
      return;
    }

    const goToCourses = () =>
      router.replace(`/${locale}/dashboard/student/courses`);
    const goToFailed = (reason?: string) => {
      const params = new URLSearchParams();
      if (paymentId) params.set("paymentId", paymentId);
      if (reason) params.set("error", reason);
      const qs = params.toString();
      router.replace(`/${locale}/payment/failed${qs ? `?${qs}` : ""}`);
    };

    // Primary path: the gateway tells us the outcome in the redirect and our
    // webhook completes the payment server-side. So honour gatewayStatus after a
    // short grace period (lets the webhook finish) — this works even though the
    // cross-origin verify() call below can't authenticate after the redirect.
    const graceTimer = setTimeout(() => {
      if (gatewayStatus === "paid") goToCourses();
      else if (gatewayStatus === "failed" || gatewayStatus === "cancelled") goToFailed();
      else setStatus("timeout");
    }, gracePeriodMs);

    // Best-effort fast-path: if verify() does succeed (same-origin / token
    // present), redirect immediately instead of waiting for the grace timer.
    const pollInterval = setInterval(async () => {
      try {
        pollCount.current += 1;
        const result = paymentId
          ? await paymentApi.verify(paymentId)
          : await paymentApi.verifyByCharge(chargeId as string);

        if (result.status === "paid") {
          clearInterval(pollInterval);
          clearTimeout(graceTimer);
          goToCourses();
        } else if (result.status === "failed") {
          clearInterval(pollInterval);
          clearTimeout(graceTimer);
          goToFailed(result.failureReason);
        } else if (pollCount.current >= maxPolls) {
          clearInterval(pollInterval);
          setStatus("timeout");
        }
      } catch {
        // verify() can't authenticate cross-origin here — the grace timer above
        // handles the redirect from the gateway status, so just keep trying.
        if (pollCount.current >= maxPolls) {
          clearInterval(pollInterval);
          setStatus("timeout");
        }
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(graceTimer);
    };
  }, [paymentId, chargeId, gatewayStatus, gracePeriodMs, locale, router]);

  return (
    <div className="min-h-screen bg-[#EEF3F7] flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">&#10060;</span>
              </div>
              <h1 className="text-xl font-bold text-[#1a1a1a] mb-2">
                {t("errorTitle")}
              </h1>
              <p className="text-[#737373] mb-6">{error}</p>
              <button
                onClick={() => router.push(`/${locale}/courses`)}
                className="btn-gold px-6 py-3 rounded-xl text-white font-medium"
              >
                {t("backToCourses")}
              </button>
            </>
          ) : status === "timeout" ? (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">&#9888;&#65039;</span>
              </div>
              <h1 className="text-xl font-bold text-[#1a1a1a] mb-2">
                {t("timeoutTitle")}
              </h1>
              <p className="text-[#737373] mb-6">{t("timeoutMessage")}</p>
              <button
                onClick={() => {
                  pollCount.current = 0;
                  setStatus("processing");
                }}
                className="btn-gold px-6 py-3 rounded-xl text-white font-medium"
              >
                {t("tryAgain")}
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-[#B8860B] animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-bold text-[#1a1a1a] mb-2">
                {t("processingTitle")}
              </h1>
              <p className="text-[#737373]">{t("processingMessage")}</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Collapse the per-gateway return-status vocabularies into our three
 * actionable buckets. Unknown values return null so we fall through to
 * the verify() poll / timeout state instead of misclassifying.
 */
function normalizeGatewayStatus(
  gateway: string | null,
  raw: string | null,
): "paid" | "failed" | "cancelled" | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (gateway === "tamara") {
    if (v === "approved") return "paid";
    if (v === "cancelled" || v === "canceled") return "cancelled";
    if (v === "declined" || v === "failed") return "failed";
    return null;
  }
  if (gateway === "tabby") {
    if (v === "closed" || v === "captured" || v === "authorized") return "paid";
    if (v === "rejected" || v === "expired") return "failed";
    if (v === "cancelled" || v === "canceled") return "cancelled";
    return null;
  }
  // Moyasar (and any future gateway that follows its convention): paid/failed
  // are the terminal statuses; pending/initiated stay null so we keep polling.
  if (v === "paid") return "paid";
  if (v === "failed") return "failed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return null;
}
