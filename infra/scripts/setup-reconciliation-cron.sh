#!/bin/bash

# ===========================================
# Reconciliation Cron Setup
# ===========================================
# Wires Cloud Scheduler to hit the reconciliation cron endpoints on the
# backend Cloud Run service. Two jobs:
#
#   reconciliation-daily-scan      @ 02:00 KSA daily
#     → POST /payments/reconciliation/cron/daily-scan
#     → walks all gateways, auto-escalates critical drifts, sends digest
#
#   reconciliation-stale-reminders @ 10:00 KSA daily
#     → POST /payments/reconciliation/cron/stale-reminders
#     → nags admins about pending escalations older than the threshold
#
# Both jobs use:
#   - OIDC token auth (Cloud Scheduler invoker → Cloud Run invoker)
#   - X-Cron-Token header verified server-side as a belt-and-braces check
#
# This script is idempotent — re-running it updates the existing jobs
# in place (gcloud scheduler jobs update http) rather than duplicating.
#
# Prerequisites:
#   - Cloud Scheduler API enabled on the project
#   - A service account with Cloud Run Invoker on the backend service
#   - Secret RECONCILIATION_CRON_TOKEN already in Secret Manager + mounted
#     into the backend service as the env var of the same name
#
# Usage:
#   ./setup-reconciliation-cron.sh
# ===========================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Cloud Scheduler runs in a single region per project — pick the one
# matching our Cloud Run region for lowest latency.
SCHEDULER_REGION="${GCP_REGION:-us-central1}"

# The backend Cloud Run service URL. Resolved live in case the URL has
# changed since the last deploy (Cloud Run service URLs are stable across
# revisions, but resolving makes this script work for any project).
BACKEND_URL=$(gcloud run services describe physioguidance-api \
  --region "${GCP_REGION}" \
  --format="value(status.url)" 2>/dev/null)

if [ -z "$BACKEND_URL" ]; then
  echo "[ERROR] Cannot resolve backend Cloud Run URL. Is physioguidance-api deployed?"
  exit 1
fi

# Service account that Cloud Scheduler will use as its OIDC identity.
# This SA must have roles/run.invoker on the backend service.
CRON_SA="${CRON_SERVICE_ACCOUNT:-reconciliation-cron@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"

# The shared secret token that the backend verifies in X-Cron-Token.
# Stored in Secret Manager; we fetch it here to pass as a header.
CRON_TOKEN=$(gcloud secrets versions access latest \
  --secret=RECONCILIATION_CRON_TOKEN \
  --project="${GCP_PROJECT_ID}" 2>/dev/null) || true

if [ -z "$CRON_TOKEN" ]; then
  echo "[ERROR] Secret RECONCILIATION_CRON_TOKEN not found in Secret Manager."
  echo ""
  echo "Create it first:"
  echo "  openssl rand -hex 32 | gcloud secrets create RECONCILIATION_CRON_TOKEN --data-file=-"
  echo ""
  echo "Then mount it into the backend service as an env var named"
  echo "RECONCILIATION_CRON_TOKEN, then re-run this script."
  exit 1
fi

# ─── Ensure the service account exists + has invoker role ──────────────

if ! gcloud iam service-accounts describe "${CRON_SA}" --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo "[INFO] Creating service account ${CRON_SA}"
  gcloud iam service-accounts create reconciliation-cron \
    --display-name="Reconciliation Cron Invoker" \
    --project="${GCP_PROJECT_ID}"
fi

echo "[INFO] Granting Cloud Run invoker role to ${CRON_SA}"
gcloud run services add-iam-policy-binding physioguidance-api \
  --region="${GCP_REGION}" \
  --member="serviceAccount:${CRON_SA}" \
  --role="roles/run.invoker" \
  --quiet >/dev/null

# ─── Create or update the daily scan job ───────────────────────────────

DAILY_JOB="reconciliation-daily-scan"
DAILY_URI="${BACKEND_URL}/payments/reconciliation/cron/daily-scan"

# 02:00 Asia/Riyadh daily. Quiet hours minimise gateway-API contention.
DAILY_SCHEDULE="0 2 * * *"
DAILY_TZ="Asia/Riyadh"

if gcloud scheduler jobs describe "${DAILY_JOB}" \
    --location="${SCHEDULER_REGION}" \
    --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo "[INFO] Updating existing scheduler job ${DAILY_JOB}"
  gcloud scheduler jobs update http "${DAILY_JOB}" \
    --location="${SCHEDULER_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --schedule="${DAILY_SCHEDULE}" \
    --time-zone="${DAILY_TZ}" \
    --uri="${DAILY_URI}" \
    --http-method=POST \
    --headers="X-Cron-Token=${CRON_TOKEN}" \
    --oidc-service-account-email="${CRON_SA}" \
    --oidc-token-audience="${BACKEND_URL}" \
    --attempt-deadline=300s
else
  echo "[INFO] Creating scheduler job ${DAILY_JOB}"
  gcloud scheduler jobs create http "${DAILY_JOB}" \
    --location="${SCHEDULER_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --schedule="${DAILY_SCHEDULE}" \
    --time-zone="${DAILY_TZ}" \
    --uri="${DAILY_URI}" \
    --http-method=POST \
    --headers="X-Cron-Token=${CRON_TOKEN}" \
    --oidc-service-account-email="${CRON_SA}" \
    --oidc-token-audience="${BACKEND_URL}" \
    --attempt-deadline=300s \
    --description="Daily reconciliation scan + auto-escalate + digest"
fi

# ─── Create or update the stale-reminder job ───────────────────────────

STALE_JOB="reconciliation-stale-reminders"
STALE_URI="${BACKEND_URL}/payments/reconciliation/cron/stale-reminders"

# 10:00 Asia/Riyadh daily. Office hours so admins see the reminder while
# they're at their desk.
STALE_SCHEDULE="0 10 * * *"

if gcloud scheduler jobs describe "${STALE_JOB}" \
    --location="${SCHEDULER_REGION}" \
    --project="${GCP_PROJECT_ID}" &>/dev/null; then
  echo "[INFO] Updating existing scheduler job ${STALE_JOB}"
  gcloud scheduler jobs update http "${STALE_JOB}" \
    --location="${SCHEDULER_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --schedule="${STALE_SCHEDULE}" \
    --time-zone="${DAILY_TZ}" \
    --uri="${STALE_URI}" \
    --http-method=POST \
    --headers="X-Cron-Token=${CRON_TOKEN}" \
    --oidc-service-account-email="${CRON_SA}" \
    --oidc-token-audience="${BACKEND_URL}" \
    --attempt-deadline=60s
else
  echo "[INFO] Creating scheduler job ${STALE_JOB}"
  gcloud scheduler jobs create http "${STALE_JOB}" \
    --location="${SCHEDULER_REGION}" \
    --project="${GCP_PROJECT_ID}" \
    --schedule="${STALE_SCHEDULE}" \
    --time-zone="${DAILY_TZ}" \
    --uri="${STALE_URI}" \
    --http-method=POST \
    --headers="X-Cron-Token=${CRON_TOKEN}" \
    --oidc-service-account-email="${CRON_SA}" \
    --oidc-token-audience="${BACKEND_URL}" \
    --attempt-deadline=60s \
    --description="Daily nag for stale reconciliation escalations"
fi

echo ""
echo "[DONE] Reconciliation cron jobs configured."
echo ""
echo "  Daily scan       : ${DAILY_SCHEDULE} (${DAILY_TZ}) → ${DAILY_URI}"
echo "  Stale reminders  : ${STALE_SCHEDULE} (${DAILY_TZ}) → ${STALE_URI}"
echo ""
echo "Manual trigger:"
echo "  gcloud scheduler jobs run ${DAILY_JOB} --location=${SCHEDULER_REGION}"
echo "  gcloud scheduler jobs run ${STALE_JOB} --location=${SCHEDULER_REGION}"
