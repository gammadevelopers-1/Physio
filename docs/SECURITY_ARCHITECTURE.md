# PhysioGuidance — Security Architecture

**Document owner:** Engineering
**Last updated:** 2026-05-22
**Audience:** Compliance reviewers, project stakeholders, technical auditors

This document describes the security controls implemented on the
PhysioGuidance platform, mapped to the requirements list provided by
the project. It is meant to be sufficient evidence for compliance
review without requiring source-code access.

---

## 1. Authentication and Session Management

| Control | Implementation |
|---|---|
| Password hashing | **Argon2** (industry standard, winner of the Password Hashing Competition). Cost factor uses library defaults (time=3, memory=64MB, parallelism=4). |
| Access tokens | **JWT**, 15-minute expiry, signed with HS256, secret stored in GCP Secret Manager |
| Refresh tokens | **HttpOnly cookie**, 7-day expiry, **rotation on every refresh** (single-use), revocable per device |
| Cookie flags | `httpOnly: true`, `secure: true` (production), `sameSite: lax/none` |
| Session revocation | Logout invalidates the refresh token. Admin can revoke all sessions for any user. |

## 2. Brute-Force Protection

| Layer | Implementation |
|---|---|
| Per-account lockout | 5 failed login attempts → 15-minute account lock |
| Per-IP rate limiting (application) | **@nestjs/throttler** — 10 logins/min/IP, 5 registrations/min/IP, 3 forgot-password requests/min/IP, 5 reset-password attempts/min/IP |
| Edge DDoS absorption | Google's Global Frontend — automatic L3/L4 protection on all Cloud Run traffic |

## 3. reCAPTCHA

reCAPTCHA v3 verification on: **register**, **login**, **forgot-password**, **reset-password**, **password-setup** (magic-link flow for instructors).

## 4. Role-Based Access Control (RBAC)

- Roles: `STUDENT`, `INSTRUCTOR`, `TEACHING_ASSISTANT`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`, `FINANCE`, `SUPPORT`
- Enforced via NestJS `@Roles()` decorator on every protected controller
- Per-role permission matrix stored in the DB (admin can edit via UI without redeploy)
- STUDENT and INSTRUCTOR are mutually exclusive (compliance-driven separation)
- Role change immediately revokes all active sessions for that user

## 5. Two-Factor Authentication (OTP)

- Email-delivered 6-digit codes (cryptographically random)
- Codes stored as SHA-256 hashes, never plaintext
- 10-minute expiry, 3-attempt limit per challenge
- 60-second cooldown between OTP requests
- Trusted device mechanism for "remember this device for 30 days"

## 6. HTTPS / TLS

- All traffic terminates at Google's Global Frontend with TLS 1.2+ (Cloud Run default)
- **HSTS** header: `Strict-Transport-Security: max-age=31536000; includeSubDomains` — browsers refuse HTTP for 1 year
- Additional response headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

## 7. API Protection and Rate Limiting

- **@nestjs/throttler** registered as a global guard, runs before authentication
- Three named buckets: `default` (120 req/min/IP), `auth` (10 req/min/IP for sensitive endpoints), `cert-verify` (30 req/min/IP for the public certificate verification endpoint)
- Per-endpoint overrides applied via `@Throttle()` decorator

## 8. SQL Injection Protection

- Drizzle ORM used exclusively for database access
- All queries are parameterized; no string interpolation in WHERE clauses
- No raw SQL with user input anywhere in production code paths

## 9. XSS / CSRF Protection

### XSS
- React's JSX auto-escapes all output
- Rich-text content (course overviews, student essay answers) sanitized with **DOMPurify** both on storage (backend) and rendering (frontend) — defense-in-depth, ensuring stored data is always safe regardless of which surface renders it
- Allowed HTML tags: formatting only (`<p>`, `<strong>`, `<em>`, lists, headings, etc.). Stripped: `<script>`, `<iframe>`, `<object>`, event handlers, `javascript:` URLs

### CSRF
- **SameSite=Lax** cookie attribute on the refresh token cookie (first line of defense)
- **Bearer JWT** used for the vast majority of API mutations (CORS-protected — attacker can't add Authorization header from another origin)
- **Custom CSRF middleware** with double-submit cookie pattern for the small surface that uses cookie auth (refresh endpoint). Webhook endpoints bypass via path allow-list

## 10. File Upload Validation

- MIME type allowlist enforced server-side: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- Max file size: 10MB (documents), 5MB (avatars)
- Filenames sanitized via `randomUUID()` to prevent directory traversal
- Files stored in GCP Cloud Storage with private/signed-URL access policy

**Planned enhancement:** automated malware scanning via Cloud Function triggered on object creation. Not yet deployed (requires `cloudfunctions.admin` IAM grant from project owner).

## 11. Secure Data Storage

### What's NOT stored
- Payment card numbers (PANs) — delegated entirely to payment provider (Tap/Moyasar/Tamara when integrated)
- CVVs — never touched by our servers

### Encryption
- **At rest (disk-level):** GCP Cloud SQL uses Google-managed AES-256 encryption for all data on disk
- **At rest (field-level):** Sensitive PII fields (`national_id`, `phone`, `scfhs_number`) on the `users` table are encrypted at the application layer using **AES-256-GCM** with a random IV per write. Decryption key stored in GCP Secret Manager. Even a leaked database backup exposes only ciphertext for these fields
- **In transit:** TLS 1.2+ on all client connections, mutual TLS for internal GCP service-to-service traffic

## 12. Audit Logging for Sensitive Admin Actions

All security- and compliance-relevant events written to an immutable `audit_logs` table:
- Login: success, failure, account-lockout (with IP + attempt count)
- 2FA: enable, disable
- User CRUD: create, update, suspend, delete (admin actions)
- Role changes: assign, remove (with actor, target, role)
- Course mutations: activate, archive, complete, delete, request-changes, toggle-featured
- Certificate actions: approve, reject, revoke (with actor, reason)
- Session mutations: create, start, end, finalize, cancel
- Material reviews: approve, reject, request changes
- Report generation
- Processing events (transcript/caption generation success/failure)

Admin can browse, filter, and CSV-export the full audit trail via the admin Logs page.

## 13. Firewall and Security Monitoring

### Network-layer protection
- **Google Global Frontend** absorbs L3/L4 DDoS attacks automatically (same edge protection Google uses for Gmail/YouTube)
- **VPC default firewall rules** in place; Cloud Run is reachable only via Google-managed ingress

### Application-layer protection
- **Per-IP rate limiting** via @nestjs/throttler
- **Brute-force account lockout**
- **IAM-based service-to-service authentication**

### Monitoring (in progress)
- Audit logs already captured for all sensitive actions
- **Cloud Logging alerts** for failed-login bursts, error rate spikes, suspicious patterns — pending IAM grants from project owner

## 14. Backup and Recovery

- **Automated daily backups** of Cloud SQL — runs at 22:00 UTC (01:00 Asia/Riyadh)
- **Point-in-Time Recovery (PITR)** enabled — restore to any minute in the last 7 days
- **Retention:** 30 daily backups kept
- Backups stored in Cloud Storage (separate physical location from the live database disk)
- Restore tested via cloning into a parallel instance (live system untouched)

## 15. Server-Side Validation

- **Global ValidationPipe** applied to every controller — strips unknown properties and rejects extra fields by default
- **class-validator** decorators on every DTO: email format, password strength, type coercion, length limits, custom validators (e.g., Saudi National ID checksum)
- Validation runs before any business logic executes

## 16. Protection of Certificate Generation and Access

- Certificate request requires meeting eligibility criteria (attendance ≥ 75%, assessments passed, modules completed)
- Manager/admin approval required before PDF generation
- Issued PDF stored in private Cloud Storage bucket with signed-URL access
- Public verification page accessible only with the full certificate code (16-char hex, ~1.8 quintillion combinations — practically un-enumerable)
- Verification endpoint rate-limited to 30 requests/min/IP
- Revocation logged in audit trail; revoked certificates cannot be re-issued

## 17. Zoom and Payment Integration Security

### Zoom
- All webhook payloads verified via HMAC-SHA256 with a shared secret
- Constant-time comparison to prevent timing attacks
- URL validation challenge handled correctly for endpoint configuration

### Payments
- Provider integration delegated to PCI-compliant gateways (Tap, Moyasar, Tamara — pending integration)
- Webhook signatures will be verified (planned, same pattern as Zoom)
- No PAN/CVV data ever touches our servers

---

## Compliance Mapping

| Client Requirement | Status | Reference |
|---|---|---|
| Secure authentication and session management | ✅ Implemented | §1 |
| Protection against brute-force login attacks | ✅ Implemented | §2 |
| reCAPTCHA protection | ✅ Implemented | §3 |
| Role-based access control (RBAC) | ✅ Implemented | §4 |
| Secure password hashing | ✅ Implemented (Argon2) | §1 |
| OTP/email verification | ✅ Implemented | §5 |
| HTTPS/SSL enforcement | ✅ Implemented + HSTS | §6 |
| API protection and rate limiting | ✅ Implemented | §7 |
| SQL Injection protection | ✅ Implemented (ORM-only) | §8 |
| XSS/CSRF protection | ✅ Implemented | §9 |
| File upload validation and malware scanning | ⚠️ Validation done; malware scanning pending IAM grant | §10 |
| Secure storage of payment and user data | ✅ Implemented (no PANs + field-level PII encryption) | §11 |
| Audit logs for sensitive admin actions | ✅ Implemented | §12 |
| Firewall/security monitoring | ✅ Firewall (Google edge + app-layer); ⚠️ active alerts pending IAM grant | §13 |
| Backup and recovery system | ✅ Implemented | §14 |
| Server-side validation for all forms | ✅ Implemented | §15 |
| Protection against unauthorized certificate generation/access | ✅ Implemented | §16 |
| Security best practices for Zoom and payment integrations | ✅ Zoom done; Payment pending provider integration | §17 |

---

## Pending Items (Awaiting Project Owner)

1. **Cloud Logging alerts** — Requires `monitoring.editor` + `logging.configWriter` IAM grants on the runtime account
2. **Malware scanning Cloud Function** — Requires `cloudfunctions.admin` IAM grant
3. **DNSSEC** on the registered domain — Configure at the DNS provider (Cloud DNS if hosted in GCP, otherwise at the registrar/external DNS)

These do not block the core security posture but represent the final "defense in depth" enhancements.

---

## Verification

Auditors can verify the controls described above by:
- **Code:** reviewing the source repository (NestJS backend in `backends/`, Next.js frontend in `frontend/`)
- **Runtime:** observing security headers on any response (e.g. `curl -I https://api.physioguidance.org`)
- **Backups:** `gcloud sql instances describe physioguidance-db --format="value(settings.backupConfiguration)"` shows `enabled=True`, PITR on, 30-day retention
- **Audit logs:** Admin can browse the `audit_logs` table via the admin Logs page
- **Encryption key:** `gcloud secrets list` shows `PII_ENCRYPTION_KEY` exists; the runtime service account has `secretmanager.secretAccessor` on it
- **Rate limiting:** Exceeding any throttle bucket returns HTTP 429 with `Retry-After` header

---

*End of document.*
