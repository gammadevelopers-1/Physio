# NELC Evidence Screenshots

Live evidence captures from PhysioGuidance production admin dashboard, taken 2026-08-16. Companion to `../nelc-evidence-matrix.csv`.

## File index

| Filename | What it shows | Matrix rows |
|----------|---------------|-------------|
| `certificates-verification.png` | Public certificate verification page (`/en/verify/:id`) — VERIFIED status, cert ID `PG-8571A2BB176549A1`, "Certificate of Attendance – Iliyas Ghulam", 2 CME Hours, SCFHS accreditation `ACA-409998457` | NELC-47 |
| `lrs-connection.png` | Admin > NELC Integration — HTTP 200 Test Connection success, Send Joined/Left trigger dropdown, LRS Environment = **PRODUCTION**, live prod endpoint `lrs.nelc.gov.sa/lrs-nelc/xapi/statements` | NELC-50 + LRS Mode |
| `nelc-user-journey.png` | Live xAPI statements list — Registered, Logged in, Progressed, Completed, Initialized verbs all marked "Sent" to production LRS | xAPI verb rows (NELC-01–10) |
| `user-journey-nelc.png` | Additional xAPI statement history across dates — proves continuous statement delivery | xAPI verb rows (NELC-01–10) |
| `audit-logs.png` | Admin > Audit Trail — 60 entries visible, filters (entity type, action, date range), Export CSV button, sample events: `auth.login_success`, `payment_failed`, `payment_initiated`, `collaborator_added`, `ticket_created` | NELC-14–22 (audit logging) |
| `audit-logs-evidence.png` | Audit trail expanded row — `session.started` event with Entity ID, Performer ID, IP address, and metadata JSON (`courseId`) fully visible | NELC-14–22 (audit logging) |
| `alerts-nelc-audit.png` | Notifications / alerts feed — proves NELC audit events surface as admin-visible notifications | NELC-46 (course change notifications) |
| `public-nelc.png` | Public `/en/nelc` info page — no auth required, shows License Number (Al Madinah Al Munawwarah), License Type (eLearning Training Facility), Status Active | NELC-58 |

## What's intentionally NOT screenshotted

**NELC-57 (GCP Secret Manager)** — Amna is the GCP Project Owner and can self-verify the NELC secrets directly in the console:

```
Console > Secret Manager > filter "NELC"
```

Or via CLI:
```bash
gcloud secrets list --filter='name~NELC' --project=nelc-elearning-platform-479319
```

Expected result: `NELC_LRS_PASSWORD` and `NELC_LRS_PASSWORD_PROD` visible as separate secrets.

## Live URLs (for auditor re-verification)

- Public NELC page: https://physioguidance.org/en/nelc
- Sample cert verification: https://physioguidance.org/en/verify/8571a2bb-1765-49a1-b543-b3e512b5eb5e
- xAPI test connection endpoint: `POST https://api.physioguidance.org/api/xapi/test-connection`
- Production LRS target: https://lrs.nelc.gov.sa/lrs-nelc/xapi/statements
