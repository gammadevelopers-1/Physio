#!/bin/bash

# ===========================================
# Cloud Tasks Setup — Event-Driven Scheduling Foundation
# ===========================================
# Provisions the Cloud Tasks queues that replace the polling-cron
# architecture. Each queue corresponds to a domain of deferred events
# (session lifecycle, ticket lifecycle, payment lifecycle, etc.) so
# retry policy, rate limits, and dead-letter behaviour can be tuned
# per domain independently.
#
# All queues target the same dispatch endpoint on physioguidance-api:
#
#   POST /internal/tasks/dispatch
#
# The task body carries { handler, entityId, payload, taskVersion,
# enqueuedAt } and the endpoint routes to the matching TaskHandler.
# Authentication is Google OIDC (the queue's service account signs a
# token; the endpoint verifies against Google's public keys).
#
# Idempotency: this script is safe to re-run. Existing queues get their
# rate-limit/retry config updated in place; new queues are created.
#
# Prerequisites:
#   - Cloud Tasks API enabled: gcloud services enable cloudtasks.googleapis.com
#   - physioguidance-api deployed (dispatch endpoint reachable)
#   - Service account tasks-dispatcher@<project>.iam.gserviceaccount.com
#     with roles/run.invoker on physioguidance-api (script creates this)
#
# Usage:
#   ./setup-cloud-tasks.sh
# ===========================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

TASKS_LOCATION="${GCP_REGION}"

# Service account Cloud Tasks uses when POSTing to the dispatch endpoint.
# Must have roles/run.invoker on physioguidance-api.
TASKS_SA="${TASKS_SERVICE_ACCOUNT:-tasks-dispatcher@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"

# Resolve backend URL live — the OIDC audience must match exactly.
BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE_NAME}" \
  --region "${GCP_REGION}" \
  --format="value(status.url)" 2>/dev/null)

if [ -z "$BACKEND_URL" ]; then
  log_error "Cannot resolve ${BACKEND_SERVICE_NAME} URL. Is the backend deployed?"
  exit 1
fi

log_info "Backend URL: ${BACKEND_URL}"
log_info "Tasks location: ${TASKS_LOCATION}"

# ─── Ensure Cloud Tasks API is enabled ─────────────────────────────────

log_step "Ensuring Cloud Tasks API is enabled..."
gcloud services enable cloudtasks.googleapis.com \
  --project="${GCP_PROJECT_ID}" --quiet

# ─── Ensure the dispatcher service account exists + has invoker role ──

if ! gcloud iam service-accounts describe "${TASKS_SA}" --project="${GCP_PROJECT_ID}" &>/dev/null; then
  log_info "Creating service account ${TASKS_SA}"
  gcloud iam service-accounts create tasks-dispatcher \
    --display-name="Cloud Tasks Dispatcher" \
    --description="Signs OIDC tokens for Cloud Tasks → api-web dispatch endpoint" \
    --project="${GCP_PROJECT_ID}"
fi

log_info "Granting Cloud Run invoker role to ${TASKS_SA}"
gcloud run services add-iam-policy-binding "${BACKEND_SERVICE_NAME}" \
  --region="${GCP_REGION}" \
  --member="serviceAccount:${TASKS_SA}" \
  --role="roles/run.invoker" \
  --quiet >/dev/null

# ─── Queue definitions ─────────────────────────────────────────────────
#
# One queue per business domain so retry/rate-limit tuning is domain-scoped.
# Fields:
#   name                    — queue id
#   description             — human-readable
#   max_dispatches_per_sec  — throttle (protect downstream services / gateway APIs)
#   max_concurrent          — parallel deliveries in flight
#   max_attempts            — retry ceiling before dead-letter
#   min_backoff             — first retry delay
#   max_backoff             — cap on retry delay
#   max_retry_duration      — give up after this long total
#
# All values are conservative defaults matching production Cloud Tasks
# guidance. Tune per queue as we learn traffic patterns.

declare -a QUEUES=(
  # name                        rate  conc  attempts  min_backoff  max_backoff  max_retry
  "session-events               10    20    10        30s          3600s        86400s"
  "ticket-events                10    20    10        30s          3600s        86400s"
  "payment-events               5     10    15        60s          3600s        604800s"
  "maintenance-events           5     10    10        30s          1800s        86400s"
  "points-events                5     10    10        30s          1800s        86400s"
  "backup-events                2     5     10        60s          3600s        86400s"
  "report-events                2     5     10        60s          3600s        86400s"
  "system-events                5     10    10        30s          1800s        86400s"
)

# ─── Create or update each queue ───────────────────────────────────────

for row in "${QUEUES[@]}"; do
  # Split the row into fields (whitespace-separated)
  read -r QUEUE_NAME RATE CONC ATTEMPTS MIN_BACKOFF MAX_BACKOFF MAX_RETRY <<< "${row}"

  if gcloud tasks queues describe "${QUEUE_NAME}" \
      --location="${TASKS_LOCATION}" \
      --project="${GCP_PROJECT_ID}" &>/dev/null; then
    log_info "Updating queue ${QUEUE_NAME}"
    gcloud tasks queues update "${QUEUE_NAME}" \
      --location="${TASKS_LOCATION}" \
      --project="${GCP_PROJECT_ID}" \
      --max-dispatches-per-second="${RATE}" \
      --max-concurrent-dispatches="${CONC}" \
      --max-attempts="${ATTEMPTS}" \
      --min-backoff="${MIN_BACKOFF}" \
      --max-backoff="${MAX_BACKOFF}" \
      --max-retry-duration="${MAX_RETRY}" \
      --quiet
  else
    log_info "Creating queue ${QUEUE_NAME}"
    gcloud tasks queues create "${QUEUE_NAME}" \
      --location="${TASKS_LOCATION}" \
      --project="${GCP_PROJECT_ID}" \
      --max-dispatches-per-second="${RATE}" \
      --max-concurrent-dispatches="${CONC}" \
      --max-attempts="${ATTEMPTS}" \
      --min-backoff="${MIN_BACKOFF}" \
      --max-backoff="${MAX_BACKOFF}" \
      --max-retry-duration="${MAX_RETRY}" \
      --quiet
  fi
done

log_success "All Cloud Tasks queues provisioned."

echo ""
echo "  Location:   ${TASKS_LOCATION}"
echo "  Service SA: ${TASKS_SA}"
echo "  Dispatch:   ${BACKEND_URL}/internal/tasks/dispatch"
echo ""
echo "  Queues:"
for row in "${QUEUES[@]}"; do
  read -r QUEUE_NAME _ <<< "${row}"
  echo "    - ${QUEUE_NAME}"
done
echo ""
echo "  List queues:  gcloud tasks queues list --location=${TASKS_LOCATION}"
echo "  Purge queue:  gcloud tasks queues purge <name> --location=${TASKS_LOCATION}"
