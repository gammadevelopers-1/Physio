"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";
import { toast } from "sonner";
import AuthNavbar from "@/components/AuthNavbar";
import Footer from "@/components/Footer";
import { setAccessToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

const ROLE_DASHBOARD: Record<string, string> = {
  STUDENT: "/dashboard/student",
  INSTRUCTOR: "/dashboard/instructor",
  TEACHING_ASSISTANT: "/dashboard/teaching-assistant",
  MANAGER: "/dashboard/manager",
  ADMIN: "/dashboard/admin",
  FINANCE: "/dashboard/finance",
  SUPPORT: "/dashboard/support",
  SUPER_ADMIN: "/dashboard/admin",
};

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const token = searchParams.get("token") || "";

  const [phase, setPhase] = useState<"validating" | "ready" | "submitting" | "invalid">(
    "validating",
  );
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }
    fetch(`${API_URL}/auth/password-setup/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok && j?.email) {
          setVerifiedEmail(j.email);
          setPhase("ready");
        } else {
          setPhase("invalid");
        }
      })
      .catch(() => setPhase("invalid"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error(isRTL ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters");
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      toast.error(
        isRTL
          ? "كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، ورقم"
          : "Password must contain at least one uppercase, lowercase, and number",
      );
      return;
    }
    if (password !== confirmPassword) {
      toast.error(isRTL ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
      toast.error(
        isRTL
          ? "يرجى إكمال التحقق \"لست برنامج روبوت\""
          : "Please complete the \"I'm not a robot\" verification",
      );
      return;
    }

    setPhase("submitting");
    try {
      const res = await fetch(`${API_URL}/auth/password-setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, recaptchaToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || "Failed to set password");
      }

      // Store access token + redirect to the user's dashboard
      if (json.accessToken) setAccessToken(json.accessToken);
      const role = json.user?.activeRole || "STUDENT";
      const dest = ROLE_DASHBOARD[role] || "/dashboard/student";
      toast.success(isRTL ? "تم تعيين كلمة المرور بنجاح" : "Password set successfully");
      router.push(`/${locale}${dest}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
      setPhase("ready");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <AuthNavbar />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-10 md:px-16 md:py-16">
        <div className="w-full max-w-[460px] bg-[var(--color-surface-card)] rounded-2xl shadow-sm p-8" dir={isRTL ? "rtl" : "ltr"}>
          {phase === "validating" && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
              <p className="text-[var(--color-text-secondary)] text-sm">
                {isRTL ? "جاري التحقق من الرابط..." : "Validating your link..."}
              </p>
            </div>
          )}

          {phase === "invalid" && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {isRTL ? "الرابط غير صالح أو منتهي" : "Link is invalid or expired"}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {isRTL
                  ? "يرجى التواصل مع الدعم لإعادة إرسال رابط جديد."
                  : "Please contact support to receive a new link."}
              </p>
            </div>
          )}

          {(phase === "ready" || phase === "submitting") && (
            <>
              <div className="text-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-[#16A34A] mx-auto mb-3" />
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
                  {isRTL ? "تعيين كلمة المرور" : "Set Your Password"}
                </h1>
                {verifiedEmail && (
                  <p className="text-sm text-[var(--color-text-secondary)]">{verifiedEmail}</p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    {isRTL ? "كلمة المرور" : "New Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="w-full h-11 px-3 pe-10 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary)] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-icon)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    {isRTL ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="w-full h-11 px-3 pe-10 bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary)] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-icon)]"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-5">
                  {isRTL
                    ? "8 أحرف على الأقل، تتضمن حرفًا كبيرًا، حرفًا صغيرًا، ورقمًا."
                    : "At least 8 characters, including uppercase, lowercase, and a number."}
                </p>

                {RECAPTCHA_SITE_KEY && (
                  <div className="flex justify-center" dir="ltr">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      hl={isRTL ? "ar" : "en"}
                      onChange={(t) => setRecaptchaToken(t)}
                      onExpired={() => setRecaptchaToken(null)}
                      onErrored={() => setRecaptchaToken(null)}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    phase === "submitting" ||
                    !password ||
                    !confirmPassword ||
                    (!!RECAPTCHA_SITE_KEY && !recaptchaToken)
                  }
                  className="mt-2 h-11 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: isRTL
                      ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
                      : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
                  }}
                >
                  {phase === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isRTL ? "تأكيد" : "Confirm"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordContent />
    </Suspense>
  );
}
