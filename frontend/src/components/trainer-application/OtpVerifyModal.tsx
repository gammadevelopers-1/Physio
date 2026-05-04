"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useLocale } from "next-intl";

interface OtpVerifyModalProps {
  isOpen: boolean;
  email: string;
  recaptchaToken: string | null;
  onVerified: (scopedToken: string) => void;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
const RESEND_COOLDOWN = 60; // seconds

const OtpVerifyModal = ({
  isOpen,
  email,
  recaptchaToken,
  onVerified,
  onClose,
}: OtpVerifyModalProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [phase, setPhase] = useState<"sending" | "ready" | "verifying">("sending");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const requestedRef = useRef(false);

  const sendOtp = async () => {
    setError(null);
    setPhase("sending");
    try {
      const res = await fetch(`${API_URL}/trainer-applications/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recaptchaToken,
          locale,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Failed to send code");
      }
      setPhase("ready");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
      setPhase("ready");
    }
  };

  // Send OTP automatically on first open
  useEffect(() => {
    if (isOpen && !requestedRef.current) {
      requestedRef.current = true;
      sendOtp();
    }
    if (!isOpen) {
      requestedRef.current = false;
      setCode("");
      setError(null);
      setCooldown(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError(isRTL ? "الرمز يجب أن يكون 6 أرقام" : "Code must be 6 digits");
      return;
    }
    setPhase("verifying");
    setError(null);
    try {
      const res = await fetch(`${API_URL}/trainer-applications/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.token) {
        throw new Error(json.message || "Invalid code");
      }
      onVerified(json.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setPhase("ready");
    }
  };

  if (!isOpen) return null;

  const heading = isRTL ? "تحقق من بريدك الإلكتروني" : "Verify your email";
  const description = isRTL
    ? `أدخل الرمز المكون من 6 أرقام الذي أرسلناه إلى ${email}`
    : `Enter the 6-digit code we sent to ${email}`;
  const verifyLabel = isRTL ? "تحقق" : "Verify";
  const resendLabel = isRTL ? "إعادة إرسال الرمز" : "Resend code";
  const closeLabel = isRTL ? "إغلاق" : "Close";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {heading}
          </h2>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1.5 rounded-full hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-icon)]" />
          </button>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          {description}
        </p>

        {phase === "sending" ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              dir="ltr"
              autoFocus
            />

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleVerify}
              disabled={code.length !== 6 || phase === "verifying"}
              className="mt-5 w-full h-11 btn-gold text-[var(--color-button-text)] rounded-xl font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {phase === "verifying" && <Loader2 className="w-4 h-4 animate-spin" />}
              {verifyLabel}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={sendOtp}
                disabled={cooldown > 0}
                className="text-sm text-[var(--color-primary)] hover:underline disabled:text-[var(--color-text-secondary)] disabled:no-underline disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `${resendLabel} (${cooldown}s)` : resendLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OtpVerifyModal;
