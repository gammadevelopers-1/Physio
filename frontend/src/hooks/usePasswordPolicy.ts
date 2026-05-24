"use client";

import { useEffect, useState } from "react";
import { publicSettingsApi, type PublicPasswordPolicy } from "@/lib/api";

const DEFAULT_POLICY: PublicPasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireNumber: false,
  requireSpecial: false,
};

let cached: PublicPasswordPolicy | null = null;
let inFlight: Promise<PublicPasswordPolicy> | null = null;

/**
 * Module-scope cache so multiple forms on the same page don't refetch.
 * Lasts the lifetime of the SPA — admin-tab Save also bumps the value
 * via the AuthTab save flow if we wire it later.
 */
async function fetchPolicy(): Promise<PublicPasswordPolicy> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = publicSettingsApi
    .getPasswordPolicy()
    .then((data) => {
      cached = {
        minLength: data.minLength ?? DEFAULT_POLICY.minLength,
        requireUppercase: !!data.requireUppercase,
        requireNumber: !!data.requireNumber,
        requireSpecial: !!data.requireSpecial,
      };
      return cached;
    })
    .catch(() => DEFAULT_POLICY)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function usePasswordPolicy(): {
  policy: PublicPasswordPolicy;
  loaded: boolean;
} {
  const [policy, setPolicy] = useState<PublicPasswordPolicy>(cached ?? DEFAULT_POLICY);
  const [loaded, setLoaded] = useState<boolean>(cached !== null);

  useEffect(() => {
    if (cached) {
      setPolicy(cached);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    fetchPolicy().then((p) => {
      if (cancelled) return;
      setPolicy(p);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { policy, loaded };
}

/**
 * Pure check — returns list of human-readable failure messages.
 * Empty array means the password satisfies every rule.
 */
export function checkPasswordAgainstPolicy(
  password: string,
  policy: PublicPasswordPolicy,
): string[] {
  const errors: string[] = [];
  if (!password || password.length < policy.minLength) {
    errors.push(`At least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("At least one uppercase letter");
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push("At least one number");
  }
  if (policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push("At least one special character");
  }
  return errors;
}
