"use client";

import { useState, Suspense, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useNavbarChrome } from "@/hooks/useNavbarChrome";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts";
import { ApiError } from "@/lib/api";
import { isValidSaudiNationalId } from "@/lib/saudi-id";
import { toast } from "sonner";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import PasswordPolicyHint from "@/components/shared/PasswordPolicyHint";
import { usePasswordPolicy, checkPasswordAgainstPolicy } from "@/hooks/usePasswordPolicy";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";


function SignUpForm() {
  const t = useTranslations("signupPage");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const chrome = useNavbarChrome();
  const router = useRouter();
  const isRTL = locale === "ar";
  const { register, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const { policy } = usePasswordPolicy();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [scfhsNumber, setScfhsNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword || !nationalId) {
      const msg = tToasts("fillRequiredFields");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (firstName.length < 2 || lastName.length < 2) {
      const msg = tToasts("firstLastNameMinLength");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!isValidSaudiNationalId(nationalId.trim())) {
      const msg = tToasts("invalidNationalId");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = tToasts("passwordMismatch");
      setError(msg);
      toast.error(msg);
      return;
    }

    // Pre-validate against the admin-configured password policy.
    // Server enforces too; this short-circuits before submit so users
    // see the rule they violated without a round-trip.
    const policyErrors = checkPasswordAgainstPolicy(password, policy);
    if (policyErrors.length) {
      const msg = policyErrors[0];
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!acceptTerms) {
      const msg = tToasts("acceptTerms");
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!recaptchaToken) {
      const msg = tToasts("captchaRequired");
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        nationalId: nationalId.trim(),
        ...(scfhsNumber.trim() && { scfhsNumber: scfhsNumber.trim() }),
        recaptchaToken,
        termsAccepted: true,
      });
      setSuccess(true);
      toast.success(tToasts("accountCreated"));
      // Redirect to signin after 2 seconds, preserving redirect param
      setTimeout(() => {
        router.push(`/${locale}/signin${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`);
      }, 2000);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : tToasts("genericError");
      setError(message);
      toast.error(message);
      // reset captcha — Google tokens are single-use
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = isLoading || isSubmitting;

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
        <Navbar siteSettings={chrome.siteSettings} navLinks={chrome.navLinks} footerLinks={chrome.footerLinks} />
        <main id="main-content" className="flex-1 bg-[var(--color-surface-page)] flex items-center justify-center px-4 py-10">
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              {t("success.title")}
            </h1>
            <p className="text-[var(--color-text-secondary)] mb-4">
              {t("success.description")}
            </p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--color-icon)]" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Navbar siteSettings={chrome.siteSettings} navLinks={chrome.navLinks} footerLinks={chrome.footerLinks} />

      {/* Main Content */}
      <main id="main-content" className="flex-1 bg-[var(--color-surface-page)] px-4 py-10 md:px-16 md:py-20">
        <div className="flex items-center justify-center w-full">
          {/* Auth Card Container */}
          <div
            className="bg-[var(--color-surface-card)] rounded-[24px] overflow-hidden w-full max-w-[1312px] flex flex-col lg:flex-row"
            style={{
              boxShadow: "-2px 8px 2px 0px rgba(0,0,0,0), -1px 5px 2px 0px rgba(0,0,0,0.01), -1px 3px 2px 0px rgba(0,0,0,0.03), 0px 1px 1px 0px rgba(0,0,0,0.05), 0px 0px 1px 0px rgba(0,0,0,0.06)"
            }}
          >
            {/* Form Side - First in DOM (LEFT in LTR, RIGHT in RTL) */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-[108px] lg:py-[67px]">
              <div className="w-full max-w-[400px] bg-[var(--color-surface-card)] rounded-xl p-6" dir={isRTL ? "rtl" : "ltr"}>
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
                    {t("description")}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert" aria-live="polite">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Name Fields */}
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label
                        htmlFor="firstName"
                        className="font-medium text-[var(--color-text-primary)]"
                        style={{ fontSize: "14px", lineHeight: "20px" }}
                      >
                        {t("form.firstName")} *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label
                        htmlFor="lastName"
                        className="font-medium text-[var(--color-text-primary)]"
                        style={{ fontSize: "14px", lineHeight: "20px" }}
                      >
                        {t("form.lastName")} *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* SCFHS Registration Number (optional) */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="scfhsNumber"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.scfhsNumber")} <span className="text-[var(--color-text-secondary)] font-normal text-xs">({t("form.optional")})</span>
                    </label>
                    <input
                      type="text"
                      id="scfhsNumber"
                      value={scfhsNumber}
                      onChange={(e) => setScfhsNumber(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder={t("form.scfhsPlaceholder")}
                    />
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("form.scfhsHint")}</p>
                  </div>

                  {/* National ID / Iqama (required, KSA-validated, immutable once set) */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="nationalId"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.nationalId")} <span className="text-[var(--color-error,#DC2626)]">*</span>
                    </label>
                    <input
                      type="text"
                      id="nationalId"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                      disabled={loading}
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[12][0-9]{9}"
                      autoComplete="off"
                      required
                      dir="ltr"
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px",
                      }}
                      placeholder={t("form.nationalIdPlaceholder")}
                    />
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("form.nationalIdHint")}</p>
                  </div>

                  {/* Email Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="email"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.email")} *
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="w-full min-h-[36px] px-3 py-[7.5px] bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50"
                      style={{
                        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                        fontSize: "14px"
                      }}
                      placeholder=""
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="password"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.password")} *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] pe-10 bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        placeholder=""
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-icon)] hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <PasswordPolicyHint password={password} />
                  </div>

                  {/* Confirm Password Field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <label
                      htmlFor="confirmPassword"
                      className="font-medium text-[var(--color-text-primary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.confirmPassword")} *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="w-full min-h-[36px] px-3 py-[7.5px] pe-10 bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] transition-colors disabled:opacity-50"
                        style={{
                          boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                          fontSize: "14px"
                        }}
                        placeholder=""
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-icon)] hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setAcceptTerms(!acceptTerms)}
                      disabled={loading}
                      className={`w-4 h-4 mt-0.5 rounded border ${acceptTerms ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'bg-[var(--color-surface-page)] border-[var(--color-border)]'} flex items-center justify-center transition-colors shrink-0 disabled:opacity-50`}
                    >
                      {acceptTerms && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <span
                      className="font-medium text-[var(--color-text-secondary)]"
                      style={{ fontSize: "14px", lineHeight: "20px" }}
                    >
                      {t("form.acceptTermsPrefix")}{" "}
                      <Link href={`/${locale}/terms`} className="underline text-[var(--color-text-primary)] hover:text-[var(--on-surface-primary)]">
                        {t("form.termsAndConditions")}
                      </Link>
                      {" "}{t("form.and")}{" "}
                      <Link href={`/${locale}/privacy`} className="underline text-[var(--color-text-primary)] hover:text-[var(--on-surface-primary)]">
                        {t("form.privacyPolicy")}
                      </Link>
                      .
                    </span>
                  </div>

                  {/* reCAPTCHA */}
                  {RECAPTCHA_SITE_KEY && (
                    <div className="flex justify-center" dir="ltr">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={RECAPTCHA_SITE_KEY}
                        hl={locale === "ar" ? "ar" : "en"}
                        onChange={(token) => setRecaptchaToken(token)}
                        onExpired={() => setRecaptchaToken(null)}
                        onErrored={() => setRecaptchaToken(null)}
                      />
                    </div>
                  )}

                  {/* Register Button */}
                  <button
                    type="submit"
                    disabled={loading || !recaptchaToken}
                    className="w-full h-10 px-5 py-2 rounded-xl text-white font-medium text-sm text-center hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: isRTL
                        ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
                        : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
                    }}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t("form.register")}
                  </button>

                </form>

                {/* Footer Link */}
                <div className="mt-6 text-center">
                  <span
                    className="text-[var(--color-text-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("footer.hasAccount")}{" "}
                  </span>
                  <Link
                    href={`/${locale}/signin${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                    className="text-[var(--color-text-primary)] underline hover:text-[var(--on-surface-primary)]"
                    style={{ fontSize: "14px", lineHeight: "20px" }}
                  >
                    {t("footer.logIn")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Image Side - Second in DOM (RIGHT in LTR, LEFT in RTL) */}
            <div className="hidden lg:flex flex-1 bg-[var(--color-surface-card)] items-center justify-center">
              <div className="relative w-full h-full min-h-[635px]">
                <Image
                  src="/signin_signup_image/signin_signup.svg"
                  alt="Sign up illustration"
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

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
