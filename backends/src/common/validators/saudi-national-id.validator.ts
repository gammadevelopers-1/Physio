import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validate a Saudi National ID (citizen) or Iqama (resident) number.
 *
 * Format rules:
 *   - exactly 10 digits
 *   - first digit must be 1 (citizen), 2 (resident), or 4 (extended
 *     identifier category accepted by NELC's validation checklist)
 *
 * Checksum: Saudi IDs use a Luhn-style algorithm. The 10th digit is a
 * check digit derived from the first 9. Valid IDs satisfy:
 *   sum % 10 === 0
 * where, for each digit d at position i (0-indexed):
 *   - even i (0,2,4,6,8): doubled, with digit-sum reduction if > 9
 *   - odd  i (1,3,5,7,9): used as-is
 *
 * Returns true only when both format and checksum pass.
 */
export function isValidSaudiNationalId(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const id = input.trim();
  // Prefix 4 added per NELC's Auto Validation Checklist (Section 4 —
  // Learner Identity): "10 digits, starts with 1, 2, or 4."
  if (!/^[124]\d{9}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = id.charCodeAt(i) - 48; // '0' → 0
    if (i % 2 === 0) {
      // double; reduce if > 9 (max doubled is 18 → 1+8=9)
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }
  return sum % 10 === 0;
}

@ValidatorConstraint({ name: 'IsSaudiNationalId', async: false })
class IsSaudiNationalIdConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isValidSaudiNationalId(value);
  }

  defaultMessage(): string {
    return 'Invalid Saudi National ID / Iqama number';
  }
}

/**
 * class-validator decorator. Use on DTO fields that must be a valid
 * Saudi National ID or Iqama (10 digits, starts 1 or 2, valid checksum).
 */
export function IsSaudiNationalId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSaudiNationalIdConstraint,
    });
  };
}
