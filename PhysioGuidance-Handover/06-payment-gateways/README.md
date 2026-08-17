# §6 — Payment Gateway Production Configuration

## Current production state

| Gateway | Backend mode | Frontend key | Webhook | Callback URL | Refund |
|---|---|---|---|---|---|
| **Tabby** | Production | Live public key | Signed webhook wired | `/en/payment/callback` | Enabled |
| **Tamara** | Production | Live public key | Signed webhook wired | `/en/payment/callback` | Enabled |
| **Moyasar** | Test (owner-controlled — flip to Live from admin dashboard when ready) | Test key today | Test webhook wired | `/en/payment/callback` | Enabled (test) |
| **Bank Transfer** | Production / manual | (n/a — server-side) | Malware-gated approval flow | `/en/payment/bank-transfer/{id}` | Enabled |

## Moyasar self-serve activation

Once the SCFHS license is issued, the platform owner can activate Moyasar production **entirely from the admin dashboard** — no gcloud command, no GitHub Actions redeploy, no developer involvement.

**Complete step-by-step procedure** → **[moyasar-activation-self-serve.pdf](moyasar-activation-self-serve.pdf)**

The guide covers:
- Uploading the SCFHS license to Moyasar dashboard
- Configuring the webhook URL + secret in Moyasar
- Entering live credentials in PhysioGuidance admin → Settings → System → Payments
- The new Moyasar Mode dropdown (Auto / Test / Live) — DB-stored, overrides env var
- Verifying live payments end-to-end
- Rolling back to Test if needed
- Rotating credentials in the future
- Alternative Secret Manager path for devops-heavy teams

## Runtime + workflow detail

- **General gateway workflow** → [../05-user-guides/finance-guide.pdf](../05-user-guides/finance-guide.pdf)
  - Section 5 — Bank Transfer full flow (submit → scan → approve/reject with malware gate)
  - Section 12 — Settings → Gateways (enable/disable, mode, webhook secrets, refund config)
- **Actual deployed environment variables + secret names (for the alternative Secret Manager path)** → [../14-env-config-and-secrets/environment-configuration-CONFIDENTIAL.pdf](../14-env-config-and-secrets/environment-configuration-CONFIDENTIAL.pdf)
