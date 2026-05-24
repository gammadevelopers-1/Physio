"use client";

import { Check, X } from "lucide-react";
import { usePasswordPolicy, checkPasswordAgainstPolicy } from "@/hooks/usePasswordPolicy";

interface PasswordPolicyHintProps {
  password: string;
  className?: string;
}

/**
 * Renders a live checklist of admin-configured password rules. Each
 * rule shows green when the current password value satisfies it.
 * Hides itself entirely if the policy hasn't loaded yet — UX choice
 * to avoid flashing default rules then changing them.
 */
export default function PasswordPolicyHint({ password, className }: PasswordPolicyHintProps) {
  const { policy, loaded } = usePasswordPolicy();
  if (!loaded) return null;

  const rules: { label: string; ok: boolean }[] = [
    {
      label: `At least ${policy.minLength} characters`,
      ok: password.length >= policy.minLength,
    },
  ];
  if (policy.requireUppercase) {
    rules.push({
      label: "At least one uppercase letter",
      ok: /[A-Z]/.test(password),
    });
  }
  if (policy.requireNumber) {
    rules.push({
      label: "At least one number",
      ok: /[0-9]/.test(password),
    });
  }
  if (policy.requireSpecial) {
    rules.push({
      label: "At least one special character",
      ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    });
  }

  return (
    <ul className={`mt-2 space-y-1 text-xs ${className ?? ""}`}>
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 ${
            rule.ok ? "text-[#16A34A]" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {rule.ok ? (
            <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />
          ) : (
            <X className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Convenience: returns true when the password satisfies every active rule. */
export function usePasswordPolicyPasses(password: string): boolean {
  const { policy, loaded } = usePasswordPolicy();
  if (!loaded) return password.length >= 6; // graceful default
  return checkPasswordAgainstPolicy(password, policy).length === 0;
}
