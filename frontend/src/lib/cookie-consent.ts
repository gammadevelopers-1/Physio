// PDPL-compliant cookie-consent state.
//
// Strict opt-in: no third-party trackers fire until the user actively grants
// consent for the relevant category. Essential (session cookie for auth) is
// always on and never toggleable.
//
// Storage: localStorage under a versioned key so a policy change forces a
// fresh consent prompt. Do NOT drop the version bump when copy/categories
// change — that's the mechanism that re-shows the banner.

export const COOKIE_CONSENT_STORAGE_KEY = "physioguidance_cookie_consent_v1";
export const COOKIE_CONSENT_VERSION = 1;

export const COOKIE_CONSENT_CHANGE_EVENT = "physioguidance:cookie-consent-changed";

export type CookieConsentState = {
  version: number;
  timestamp: string;
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

export type CookieConsentChoice = {
  analytics: boolean;
  marketing: boolean;
};

export function readConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(choice: CookieConsentChoice): CookieConsentState {
  const state: CookieConsentState = {
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    essential: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(
        new CustomEvent<CookieConsentState>(COOKIE_CONSENT_CHANGE_EVENT, { detail: state }),
      );
    } catch {
      // localStorage may be unavailable in private mode / storage quota;
      // silently ignore — the banner just re-shows on next visit.
    }
  }
  return state;
}

export function acceptAll(): CookieConsentState {
  return writeConsent({ analytics: true, marketing: true });
}

export function rejectAll(): CookieConsentState {
  return writeConsent({ analytics: false, marketing: false });
}

export function isAllowed(category: keyof CookieConsentChoice): boolean {
  const state = readConsent();
  return !!state && state[category] === true;
}
