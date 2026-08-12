/**
 * One-shot backfill: encrypt existing plaintext refund PII in payment_receipts.
 *
 * After migration 0119 widens `refund_iban` and `refund_national_id` to TEXT
 * and the code deploy starts writing new rows through encryptPII(), legacy
 * rows still carry plaintext. decryptPII() reads them fine (it passes any
 * value without the `v1:` prefix through unchanged), but they remain
 * exposed if the DB leaks. This script rewrites them in-place.
 *
 * Idempotent — rows already starting with `v1:` are skipped. Safe to re-run.
 *
 * Run against production (via cloud-sql-proxy per the deploy runbook):
 *   PII_ENCRYPTION_KEY=<prod-key> \
 *   DATABASE_URL=postgres://.../postgres \
 *   npx tsx scripts/backfill-encrypt-refund-pii.ts
 *
 * Dry-run first:
 *   DRY_RUN=1 npx tsx scripts/backfill-encrypt-refund-pii.ts
 */

import { db } from '../src/database';
import { paymentReceipts } from '../src/database/schema/payments';
import { encryptPII } from '../src/common/crypto';
import { eq } from 'drizzle-orm';

const DRY_RUN = process.env.DRY_RUN === '1';
const ENCRYPTED_PREFIX = 'v1:';

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY) {
    console.error('PII_ENCRYPTION_KEY not set. Refusing to run — encryptPII() would pass values through unchanged.');
    process.exit(1);
  }

  console.log(`Backfill starting${DRY_RUN ? ' (DRY RUN — no writes)' : ''}...`);

  const rows = await db
    .select({
      id: paymentReceipts.id,
      refundIban: paymentReceipts.refundIban,
      refundNationalId: paymentReceipts.refundNationalId,
    })
    .from(paymentReceipts);

  let scanned = 0;
  let alreadyEncrypted = 0;
  let updated = 0;

  for (const row of rows) {
    scanned++;

    const ibanIsPlain = row.refundIban && !row.refundIban.startsWith(ENCRYPTED_PREFIX);
    const nidIsPlain =
      row.refundNationalId && !row.refundNationalId.startsWith(ENCRYPTED_PREFIX);

    if (!ibanIsPlain && !nidIsPlain) {
      alreadyEncrypted++;
      continue;
    }

    const nextIban = ibanIsPlain ? encryptPII(row.refundIban) : row.refundIban;
    const nextNid = nidIsPlain ? encryptPII(row.refundNationalId) : row.refundNationalId;

    if (DRY_RUN) {
      console.log(`  would-update ${row.id}: iban=${ibanIsPlain ? 'YES' : 'no'} nid=${nidIsPlain ? 'YES' : 'no'}`);
    } else {
      await db
        .update(paymentReceipts)
        .set({ refundIban: nextIban!, refundNationalId: nextNid })
        .where(eq(paymentReceipts.id, row.id));
    }
    updated++;
  }

  console.log('');
  console.log(`Scanned:           ${scanned}`);
  console.log(`Already encrypted: ${alreadyEncrypted}`);
  console.log(`Updated:           ${updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
