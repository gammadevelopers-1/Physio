"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthNavbar from "@/components/AuthNavbar";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const t = useTranslations("resetPasswordPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (!email || isResending || resendTimer > 0) return;
    setIsResending(true);
    try {
      await authApi.forgotPassword(email);
      toast.success(t("codeResent"));
      setResendTimer(60);
    } catch {
      toast.success(t("codeResent"));
      setResendTimer(60);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const codeStr = code.join("");
    if (codeStr.length !== 6) {
      toast.error(t("errors.codeRequired"));
      return;
    }

    if (!newPassword) {
      toast.error(t("errors.passwordRequired"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("errors.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("errors.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authApi.resetPassword(email, codeStr, newPassword);
      toast.success(result.message || t("success"));
      router.push(`/${locale}/signin`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("errors.generic");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
        <AuthNavbar />
        <main className="flex-1 bg-[var(--color-surface-page)] flex items-center justify-center">
          <div className="text-center">
            <p className="text-[var(--color-text-secondary)] mb-4">{t("noEmail")}</p>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              {t("goToForgotPassword")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <AuthNavbar />

      <main
        id="main-content"
        className="flex-1 bg-[var(--color-surface-page)] px-4 py-10 md:px-16 md:py-20"
      >
        <div className="flex items-center justify-center w-full">
          <div
            className="bg-white rounded-[24px] overflow-hidden w-full max-w-[1312px] flex flex-col lg:flex-row"
            style={{
              boxShadow:
                "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)",
            }}
          >
            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-[108px] lg:py-[67px]">
              <div
                className="w-full max-w-[400px] bg-white rounded-xl p-6"
                dir={isRTL ? "rtl" : "ltr"}
              >
                {/* Back link */}
                <Link
                  href={`/${locale}/forgot-password`}
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("back")}
                </Link>

                {/* Header */}
                <div className="flex flex-col gap-1 mb-6">
                  <h1
                    className="font-semibold text-[var(--color-text-primary)]"
                    style={{ fontSize: "16px", lineHeight: "24px" }}
                  >
                    {t("title")}
                  </h1>
                  <p
                    className="text-[var(--color-text-secondary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("description", { email })}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* OTP Code Input */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("codeLabel")}
                    </label>
                    <div className="flex gap-2 justify-center" dir="ltr">
                      {code.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { inputRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleCodeChange(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          disabled={isSubmitting}
                          className="w-11 h-12 text-center text-lg font-semibold border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors disabled:opacity-50"
                        />
                      ))}
                    </div>
                    <div className="text-center mt-1">
                      {resendTimer > 0 ? (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("resendIn", { seconds: resendTimer })}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={isResending}
                          className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
                        >
                          {isResending ? t("resending") : t("resendCode")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="newPassword"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("newPassword")}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full min-h-[36px] px-3 py-[7.5px] pe-10 bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="confirmPassword"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("confirmPassword")}
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-white border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10 px-5 py-2 rounded-xl text-white font-medium text-sm text-center hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: isRTL
                        ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
                        : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
                    }}
                  >
                    {isSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {t("resetButton")}
                  </button>
                </form>
              </div>
            </div>

            {/* Image Side */}
            <div className="hidden lg:flex flex-1 bg-[var(--color-surface-card)] items-center justify-center">
              <div className="relative w-full h-full min-h-[635px]">
                <Image
                  src="/signin_signup_image/signin_signup.svg"
                  alt="Reset password illustration"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
