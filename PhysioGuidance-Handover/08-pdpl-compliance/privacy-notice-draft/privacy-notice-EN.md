# Privacy Notice

**Effective date:** 12 August 2026
**Version:** 2026-08-12

PhysioGuidance ("we", "us", "our") respects your privacy and is committed to
protecting your personal data. This Privacy Notice explains what personal data
we collect about you, how we use it, who we share it with, how long we keep it,
and the rights you have under the Kingdom of Saudi Arabia's Personal Data
Protection Law (PDPL) and its implementing regulations issued by the Saudi
Data & Artificial Intelligence Authority (SDAIA).

---

## 1. Who we are

**PhysioGuidance** — an online learning platform for licensed physiotherapy
professionals in the Kingdom of Saudi Arabia. We deliver accredited continuing
medical education (CME) courses aligned with the National eLearning Center
(NELC) and the Saudi Commission for Health Specialties (SCFHS).

**Data controller:** PhysioGuidance
**Contact for privacy matters:** privacy@physioguidance.org
**Data Protection Coordinator:** [To be named by the platform operator]

---

## 2. Personal data we collect

We collect the following categories of personal data, only where necessary
for the purposes described in Section 3.

### 2.1 Data you provide directly

| Category | Fields | When collected |
|---|---|---|
| **Identity** | First name, last name, Saudi National ID or Iqama number | At sign-up |
| **Contact** | Email address, phone number (optional) | At sign-up / profile |
| **Professional** | SCFHS registration number, professional bio | Optional at profile |
| **Account security** | Password (stored hashed with argon2), two-factor codes | At sign-up / login |
| **Payment** | Bank account holder name, IBAN, national ID for refund verification | At bank-transfer refund request |

### 2.2 Data collected automatically

| Category | Fields |
|---|---|
| **Technical** | IP address, browser, device identifier, language preference |
| **Learning activity** | Course progress, quiz results, video watch time, attendance timestamps |
| **Audit** | Login events, admin actions, consent timestamps |

### 2.3 Sensitive data

We do **not** intentionally collect data that PDPL classifies as sensitive
(health data, biometric data, religious beliefs, etc.). Any content that a
user chooses to include in support tickets or profile bios is their voluntary
disclosure.

---

## 3. Purposes for which we use your data

| Purpose | Legal basis (PDPL) |
|---|---|
| Provide the learning platform (accounts, enrollments, progress tracking) | Performance of contract |
| Process payments and issue invoices | Performance of contract + legal obligation (tax records) |
| Issue CME certificates and submit records to NELC | Legal obligation (NELC accreditation) |
| Enforce security (fraud detection, login lockout, audit logging) | Legitimate interest |
| Comply with financial-record laws (payment retention) | Legal obligation (Saudi accounting law) |
| Send transactional emails (payment confirmations, certificates, OTP) | Performance of contract |
| Send marketing communications | Consent (opt-in only, revocable at any time) |

We do **not** use your data for automated decision-making with legal effects
on you, nor do we sell your data to third parties.

---

## 4. Who we share your data with

We share your personal data only where necessary to provide the service, and
each recipient is bound by a data-processing agreement or equivalent contract.

### 4.1 Recipients inside the Kingdom of Saudi Arabia

| Recipient | Purpose | Data shared |
|---|---|---|
| **Moyasar** (payment processor) | Card and Apple Pay processing | Payment amount and reference (no card data touches us) |
| **Tamara** (BNPL provider) | Buy-now-pay-later instalments | Name, email, phone, national ID (SIMAH-mandated), date of birth |
| **Tabby** (BNPL provider) | Buy-now-pay-later instalments | Name, email, phone, date of birth (optional) |
| **NELC** (regulator) | xAPI learning-activity records | Learner ID, email, national ID, course/module IDs, scores, timestamps |

### 4.2 Recipients outside the Kingdom (cross-border transfers)

Some of our processors operate outside KSA. We transfer only what is strictly
necessary and rely on the processor's contractual undertakings and, where
applicable, PDPL cross-border-transfer safeguards.

| Recipient | Location | Purpose | Data shared |
|---|---|---|---|
| **Zoom Video Communications** | United States | Live class hosting | Meeting title, learner name, email, join / leave timestamps |
| **OpenAI (Whisper API)** | United States | Auto-generate captions for instructor course videos | Raw audio of course material |
| **Sentry** | European Union (Frankfurt) | Error monitoring | Redacted stack traces (PII scrubbed before transmission) |
| **Resend** | United States | Transactional email delivery | Recipient email, message content |

If you wish to opt out of any specific cross-border processor, contact us and
we will explain the impact on your account and, where feasible, offer an
alternative.

---

## 5. How long we keep your data

| Data category | Retention period |
|---|---|
| Active account data | Duration of the account + as required for legal obligations |
| Financial records (invoices, payments, refunds) | 10 years (Saudi accounting law) |
| Bank-transfer receipts | 10 years (Saudi accounting law) |
| NELC learning records (xAPI statements) | 5 years (NELC accreditation) |
| Audit logs (security events) | Until reviewed for material incidents |
| Backups | 30 days rolling |
| Marketing consent | Until you withdraw it |

When you request account deletion, we anonymise your personal identifiers
(email, name, phone, national ID). Records that must be retained by law
(financial records, NELC transmissions already submitted) are kept in
de-identified form.

---

## 6. Your rights under PDPL

Under Articles 4 and following of the PDPL, you have the right to:

1. **Be informed** about the processing of your personal data (this notice).
2. **Access** the personal data we hold about you.
3. **Request rectification** of inaccurate or incomplete data.
4. **Request erasure** of your data (subject to legal-retention exceptions in Section 5).
5. **Restrict** or **object to** certain processing activities.
6. **Withdraw consent** at any time, where processing is based on consent
   (e.g., marketing emails).
7. **Portability** — receive a copy of the data you have provided to us in a
   structured, machine-readable format.
8. **Lodge a complaint** with SDAIA (see Section 10).

**To exercise any of these rights**, email privacy@physioguidance.org from
the email address associated with your account. We will respond within 30
days. For security reasons, we may ask you to verify your identity before
acting on your request.

---

## 7. Security of your data

We apply technical and organisational measures appropriate to the risk,
including:

- **Encryption at rest** — sensitive personal data (national ID, phone,
  SCFHS number, bank details) is encrypted with AES-256-GCM before storage.
- **Encryption in transit** — all traffic to and from the platform is over
  HTTPS with TLS 1.2 or higher.
- **Access controls** — role-based access, least privilege, audit logging of
  administrative actions.
- **Malware scanning** — all uploaded files are scanned before they are made
  accessible to users.
- **Continuous monitoring** — automated alerting on suspicious login and
  authorization patterns.
- **Regional data residency** — all primary infrastructure is hosted in the
  KSA data region (Dammam) with Google Cloud, in compliance with SDAIA
  guidance for regulated workloads.

No system is perfectly secure. If we experience a personal-data breach that
is likely to result in risk to your rights, we will notify you and SDAIA in
accordance with PDPL Article 20.

---

## 8. Cookies and tracking

We use only cookies that are strictly necessary for the platform to function
(session, language, device identifier). We do not use marketing or third-party
analytics cookies. If this changes in the future, we will update this notice
and, where required, request your consent through a cookie banner.

---

## 9. Age restriction

The PhysioGuidance platform is intended for licensed physiotherapy
professionals aged 18 or over. We do not knowingly collect personal data from
individuals under 18. If we become aware that a minor has created an account,
we will delete it.

---

## 10. How to complain

If you believe your rights under PDPL have been infringed, you may complain
to us at privacy@physioguidance.org, or directly to the regulator:

**Saudi Data & Artificial Intelligence Authority (SDAIA)**
Website: https://sdaia.gov.sa
Complaints portal: https://sdaia.gov.sa/en/SDAIA/services

---

## 11. Changes to this Privacy Notice

We may update this notice to reflect changes to our services or to legal
requirements. The "Effective date" and "Version" at the top will change with
each update. If a change is substantive, we will notify you by email and — for
consent-based processing — request re-acceptance at your next login.

The previous version(s) of this notice are archived in our records under the
version identifier shown at the top of this page.

---

**Version 2026-08-12 — Effective 12 August 2026**
