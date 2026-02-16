"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft, MailOpen } from "lucide-react";
import AuthNavbar from "@/components/AuthNavbar";
import Footer from "@/components/Footer";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

function VerifyForm() {
  const t = useTranslations("verifyPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const { verify2FA, resend2FA, twoFactorPending, isLoading } = useAuth();
  const searchParams = useSearchParams();

  const challengeIdParam = searchParams.get("challengeId");
  const redirectTo = searchParams.get("redirect");

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [currentChallengeId, setCurrentChallengeId] = useState(
    challengeIdParam || twoFactorPending?.challengeId || ""
  );

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Redirect if no challenge
  useEffect(() => {
    if (!currentChallengeId && !twoFactorPending?.challengeId) {
      router.replace(`/${locale}/signin`);
    }
  }, [currentChallengeId, twoFactorPending, router, locale]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Only accept digits
      const digit = value.replace(/\D/g, "").slice(-1);

      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });
      setError(null);

      // Auto-focus next input
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        // Move to previous input on backspace when current is empty
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        inputRefs.current[isRTL ? index + 1 : index - 1]?.focus();
      }
      if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
        e.preventDefault();
        inputRefs.current[isRTL ? index - 1 : index + 1]?.focus();
      }
    },
    [digits, isRTL]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, OTP_LENGTH);

      if (pasted.length > 0) {
        const newDigits = Array(OTP_LENGTH).fill("");
        pasted.split("").forEach((d, i) => {
          newDigits[i] = d;
        });
        setDigits(newDigits);
        setError(null);

        // Focus the input after the last pasted digit
        const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
        inputRefs.current[focusIndex]?.focus();
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (submittedDigits?: string[]) => {
      const code = (submittedDigits || digits).join("");
      if (code.length !== OTP_LENGTH) {
        setError(t("errors.invalidCode"));
        return;
      }

      const challengeId =
        currentChallengeId || twoFactorPending?.challengeId || "";
      if (!challengeId) {
        setError(t("errors.verificationFailed"));
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await verify2FA(challengeId, code, redirectTo || undefined);
        // Success → AuthContext handles redirect
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : t("errors.verificationFailed");
        setError(message);
        toast.error(message);
        // Clear inputs on error
        setDigits(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      } finally {
        setIsSubmitting(false);
      }
    },
    [digits, currentChallengeId, twoFactorPending, verify2FA, t]
  );

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (digits.every((d) => d !== "") && !isSubmitting) {
      handleSubmit(digits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const handleResend = async () => {
    if (resendTimer > 0) return;

    const challengeId =
      currentChallengeId || twoFactorPending?.challengeId || "";
    if (!challengeId) return;

    try {
      const response = await resend2FA(challengeId);
      if (response.challengeId) {
        setCurrentChallengeId(response.challengeId);
      }
      setResendTimer(RESEND_COOLDOWN);
      toast.success(t("codeSent"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("errors.verificationFailed");
      toast.error(message);
    }
  };

  const handleBackToLogin = () => {
    router.push(`/${locale}/signin`);
  };

  const loading = isLoading || isSubmitting;
  const maskedEmail = twoFactorPending?.email
    ? maskEmail(twoFactorPending.email)
    : "***@***.***";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <AuthNavbar />

      <main className="flex-1 bg-[#EEF3F7] px-4 py-10 md:px-16 md:py-20">
        <div className="flex items-center justify-center w-full">
          <div
            className="bg-white rounded-[24px] overflow-hidden w-full max-w-[520px]"
            style={{
              boxShadow:
                "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
            }}
          >
            <div
              className="px-6 py-10 sm:px-10"
              dir={isRTL ? "rtl" : "ltr"}
            >
              {/* Shield Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#a37f49]/10 to-[#a37f49]/20 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-[#a37f49]" />
                </div>
              </div>

              {/* Title */}
              <h1
                className="text-center font-semibold text-[#171717] mb-2"
                style={{ fontSize: "20px", lineHeight: "28px" }}
              >
                {t("title")}
              </h1>

              {/* Subtitle with email */}
              <div className="text-center mb-8">
                <p
                  className="text-[#737373] mb-1"
                  style={{ fontSize: "14px", lineHeight: "20px" }}
                >
                  {t("subtitle")}
                </p>
                <div className="inline-flex items-center gap-1.5 bg-[#f8fafc] px-3 py-1.5 rounded-full border border-[#e5e7eb]">
                  <MailOpen className="w-3.5 h-3.5 text-[#a37f49]" />
                  <span
                    className="text-[#1a1a1a] font-medium"
                    style={{ fontSize: "13px" }}
                  >
                    {maskedEmail}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg"
                  role="alert"
                  aria-live="polite"
                >
                  <p className="text-sm text-red-600 text-center">{error}</p>
                </div>
              )}

              {/* OTP Input Boxes */}
              <div className="mb-6">
                <label
                  className="block text-center font-medium text-[#0a0a0a] mb-3"
                  style={{ fontSize: "14px", lineHeight: "20px" }}
                >
                  {t("codeLabel")}
                </label>
                <div
                  className="flex justify-center gap-2 sm:gap-3"
                  dir="ltr" // Always LTR for digit input
                >
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      disabled={loading}
                      onChange={(e) =>
                        handleDigitChange(index, e.target.value)
                      }
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className={`w-11 h-14 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 outline-none transition-all
                        ${
                          error
                            ? "border-red-300 bg-red-50/50"
                            : digit
                              ? "border-[#a37f49] bg-[#faf6f0]"
                              : "border-[#e5e5e5] bg-white"
                        }
                        focus:border-[#a37f49] focus:ring-2 focus:ring-[#a37f49]/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        text-[#1a1a1a]`}
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        caretColor: "#a37f49",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Verify Button */}
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading || digits.some((d) => !d)}
                className="w-full h-11 px-5 py-2 rounded-xl text-white font-medium text-sm text-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                style={{
                  background: isRTL
                    ? "linear-gradient(to left, #a37f49, #6b4e24)"
                    : "linear-gradient(to right, #a37f49, #6b4e24)",
                }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? t("verifying") : t("verifyButton")}
              </button>

              {/* Resend / Timer */}
              <div className="text-center mb-4">
                {resendTimer > 0 ? (
                  <p
                    className="text-[#737373]"
                    style={{ fontSize: "14px" }}
                  >
                    {t("resendIn", { seconds: resendTimer })}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-[#a37f49] hover:text-[#6b4e24] font-medium transition-colors disabled:opacity-50"
                    style={{ fontSize: "14px" }}
                  >
                    {t("resendCode")}
                  </button>
                )}
              </div>

              {/* Back to Login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="inline-flex items-center gap-1.5 text-[#737373] hover:text-[#1a1a1a] transition-colors"
                  style={{ fontSize: "14px" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("notYou")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const visible = localPart.slice(0, 2);
  const masked = "*".repeat(Math.max(localPart.length - 2, 3));
  return `${visible}${masked}@${domain}`;
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
