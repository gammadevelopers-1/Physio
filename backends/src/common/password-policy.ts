/**
 * Shared password policy validator. The admin configures these
 * thresholds in Settings → Authentication. The auth service loads
 * the live policy on every signup / change-password / password-setup
 * call and runs validatePassword before persisting.
 *
 * The DTO-level @MinLength stays at 8 as a defensive floor — admin
 * can raise but never lower below 6.
 */

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

const SPECIAL_CHAR_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
const UPPERCASE_RE = /[A-Z]/;
const NUMBER_RE = /[0-9]/;

/**
 * Validate a password against the admin-configured policy. Returns an
 * array of human-readable failure reasons (empty array = passes).
 * Callers should throw BadRequestException with the joined messages.
 */
export function validatePasswordPolicy(
  password: string,
  policy: PasswordPolicy,
): string[] {
  const errors: string[] = [];
  if (!password || password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !UPPERCASE_RE.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (policy.requireNumber && !NUMBER_RE.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (policy.requireSpecial && !SPECIAL_CHAR_RE.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  return errors;
}
