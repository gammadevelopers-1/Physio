/**
 * Validate a Saudi National ID (citizen) or Iqama (resident) number.
 *
 * Mirrors the backend implementation in
 * `backends/src/common/validators/saudi-national-id.validator.ts`.
 *
 * Rules:
 *   - exactly 10 digits
 *   - first digit is 1 (citizen) or 2 (resident)
 *   - Luhn-style checksum: even-indexed digits doubled (with digit-sum
 *     reduction if > 9), summed with odd-indexed digits, total must be
 *     divisible by 10.
 */
export function isValidSaudiNationalId(input: string | null | undefined): boolean {
  if (typeof input !== 'string') return false;
  const id = input.trim();
  if (!/^[12]\d{9}$/.test(id)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = id.charCodeAt(i) - 48;
    if (i % 2 === 0) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }
  return sum % 10 === 0;
}
