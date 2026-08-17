# §6 — Payment Gateway Production Configuration

The gateway configuration answer lives in two docs that already cover it in depth. This folder is a signpost, not a duplicate.

**Runtime + workflow detail** → [../05-user-guides/finance-guide.pdf](../05-user-guides/finance-guide.pdf)
- Section 5 — Bank Transfer full flow (submit → scan → approve/reject with malware gate)
- Section 12 — Settings → Gateways (enable/disable, test mode, webhook secrets, refund config)

**Actual deployed environment variables + secret names** → [../14-env-config-and-secrets/environment-configuration-CONFIDENTIAL.pdf](../14-env-config-and-secrets/environment-configuration-CONFIDENTIAL.pdf)

## Current production state

| Gateway | Backend mode | Frontend key | Webhook | Callback URL | Refund |
|---|---|---|---|---|---|
| **Tabby** | Production | Live public key | Signed webhook wired | `/en/payment/callback` | Enabled |
| **Tamara** | Production | Live public key | Signed webhook wired | `/en/payment/callback` | Enabled |
| **Moyasar** | Test | Test public key | Test webhook wired | `/en/payment/callback` | Enabled (test) |
| **Bank Transfer** | Production / manual | (n/a — server-side) | Malware-gated approval flow | `/en/payment/bank-transfer/{id}` | Enabled |

Moyasar flips to Production once SCFHS license is issued and Moyasar activates the merchant account. See [../18-ownership-confirmation/ownership-confirmation.pdf](../18-ownership-confirmation/ownership-confirmation.pdf) item D and [../09-security-hardening/secrets-rotation-plan.pdf](../09-security-hardening/secrets-rotation-plan.pdf) §8 for the `MOYASAR_WEBHOOK_SECRET_LIVE` filing step.
