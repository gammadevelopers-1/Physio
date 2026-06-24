import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validate + normalize a Saudi Arabian mobile-phone number.
 *
 * Mirrors `frontend/src/lib/saudi-phone.ts`.
 *
 * KSA mobile rules:
 *   - Number is 9 digits, must start with `5` (i.e. `+9665XXXXXXXX`)
 *   - Local notation prepends a zero: `05XXXXXXXX`
 *
 * Accepted input shapes (after stripping whitespace / dashes / parens):
 *   - `5XXXXXXXX`           (9 digits)
 *   - `05XXXXXXXX`          (10 digits, local)
 *   - `9665XXXXXXXX`        (12 digits)
 *   - `+9665XXXXXXXX`       (canonical E.164)
 *   - `009665XXXXXXXX`      (14 digits, 00-prefixed international dial)
 *
 * Canonical storage form: `+9665XXXXXXXX` (E.164). Use `normalizeSaudiPhone`
 * in services before persisting / encrypting.
 */

const E164_REGEX = /^\+9665\d{8}$/;

function stripFormatting(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D+/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalize any accepted Saudi mobile representation to canonical E.164.
 * Returns null if the value isn't a valid KSA mobile.
 */
export function normalizeSaudiPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (input.trim() === '') return null;
  const cleaned = stripFormatting(input);

  if (E164_REGEX.test(cleaned)) return cleaned;

  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^009665\d{8}$/.test(digits)) return `+${digits.slice(2)}`;

  return null;
}

/** True if the value is (or normalizes to) a valid KSA mobile number. */
export function isValidSaudiPhone(input: unknown): boolean {
  return normalizeSaudiPhone(input) !== null;
}

@ValidatorConstraint({ name: 'IsSaudiPhone', async: false })
class IsSaudiPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    // Optional fields are handled by @IsOptional() on the DTO; if a value
    // arrives here, it must validate as a KSA mobile.
    return isValidSaudiPhone(value);
  }

  defaultMessage(): string {
    return 'Phone must be a valid Saudi mobile number (e.g. +9665XXXXXXXX)';
  }
}

/**
 * class-validator decorator. Use on DTO phone fields that must be a valid
 * Saudi mobile number. Combine with `@IsOptional()` if the field is not
 * required. Services should call `normalizeSaudiPhone()` to convert to the
 * canonical E.164 form before persisting.
 */
export function IsSaudiPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSaudiPhoneConstraint,
    });
  };
}
