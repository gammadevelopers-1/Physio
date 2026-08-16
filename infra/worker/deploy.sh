#!/bin/bash

# ===========================================
# Worker Deployment Script
# ===========================================
# Deploys physioguidance-api-worker — a Cloud Run service running the SAME
# backend image but with:
#   - --no-cpu-throttling: CPU always allocated so BullMQ workers can poll
#     Redis continuously and ffmpeg subprocesses aren't starved between
#     HTTP requests (the api-web service runs with cpu-throttling ON,
#     which stalled the workers indefinitely — verified from Cloud Run
#     logs 2026-07-22, workers only processed while an HTTP request
#     happened to be in flight on the same instance).
#   - SKIP_CRONS=true: the in-container @Cron scheduler is off. Crons
#     run on the api-web service (which has SKIP_BULLMQ_WORKERS=true).
#     Without this both containers would double-fire every @Cron.
#   - min=1/max=1: single writer against the shared BullMQ queue keeps
#     costs down. BullMQ's per-queue concurrency handles parallelism.
#   - 1.5Gi memory + 1 vCPU (post Phase 3): the only ACTIVE processors
#     left here are WebhookProcessor + XapiProcessor — the four heavy
#     ones (transcode/captions/transcript/wcag) moved to Cloud Run
#     Jobs. However the monolithic Nest app still boots the WHOLE
#     module tree, so the resident-set-size floor is ~700-800 MiB
#     (verified from 7-day monitoring: median 816 MiB at 2 GiB). 1.5Gi
#     leaves ~700 MiB headroom for xAPI batch flushes and webhook
#     bursts without paying for the old 2Gi/2vCPU tier. Do NOT drop to
#     1 GiB — that's only 200 MiB above the median and a single spike
#     could OOM a NELC statement or a Moyasar webhook. Do NOT drop to
#     512 MiB — Nest boot alone exceeds that.
#   - --no-allow-unauthenticated: worker is internal-only; no public URL.
#     Anything that needs to reach it goes through the shared Redis queue
#     (BullMQ) or the shared Postgres DB.
#
# Reuses the SAME Docker image tag as the api-web service — do NOT rebuild
# here. Run `bash infra/backend/deploy.sh` first to publish a new image,
# then this script to roll the worker onto it.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

WORKER_SERVICE_NAME="${WORKER_SERVICE_NAME:-physioguidance-api-worker}"
WORKER_MEMORY="${WORKER_MEMORY:-1536Mi}"
WORKER_CPU="${WORKER_CPU:-1}"
WORKER_MIN_INSTANCES="${WORKER_MIN_INSTANCES:-1}"
WORKER_MAX_INSTANCES="${WORKER_MAX_INSTANCES:-1}"

# Reuse whatever image the api-web service is currently on.
IMAGE_TAG="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:latest"

print_banner
log_info "Deploying: Worker (physioguidance-api-worker)"
log_info "Image:     ${IMAGE_TAG}  (built by infra/backend/deploy.sh)"
log_info "Memory:    ${WORKER_MEMORY}"
log_info "CPU:       ${WORKER_CPU}"
log_info "Instances: min=${WORKER_MIN_INSTANCES} max=${WORKER_MAX_INSTANCES}"
echo ""

check_command gcloud
check_gcp_auth
gcloud config set project ${GCP_PROJECT_ID} --quiet

# ------------------------------------------------------------------
# ENV VARS — mirror the backend deploy.sh (Redis, DB, gateways etc.)
# so the worker has identical runtime config. Anything sensitive comes
# from Secret Manager; anything non-sensitive is inline here so the
# worker never depends on api-web being up to bootstrap.
# ------------------------------------------------------------------
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-$(get_service_url ${FRONTEND_SERVICE_NAME})}"
BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(get_service_url ${BACKEND_SERVICE_NAME})}"
STRAPI_URL_FOR_BACKEND="${PRODUCTION_STRAPI_URL:-$(get_service_url ${STRAPI_SERVICE_NAME})}"

ENV_VARS="^||^NODE_ENV=production||API_PREFIX=api||LOG_LEVEL=warn||STORAGE_DRIVER=gcp||GCP_PROJECT_ID=${GCP_PROJECT_ID}||GCP_REGION=${GCP_REGION}||STORAGE_BUCKET_PUBLIC=physioguidance-public||STORAGE_BUCKET_PRIVATE=physioguidance-private||STORAGE_BUCKET_TRAINERS=physioguidance-trainers||BACKUPS_BUCKET=physioguidance-backups||CLOUD_SQL_INSTANCE=${DB_INSTANCE_NAME}||DATABASE_NAME=physioguidance||APP_URL=${BACKEND_URL}/api||FRONTEND_URL=${FRONTEND_URL}||STRAPI_URL=${STRAPI_URL_FOR_BACKEND}"

# Payment callback URLs — the worker doesn't handle the callback itself,
# but the payments module references them at bootstrap for URL builders.
ENV_VARS="${ENV_VARS}||PAYMENT_CALLBACK_URL=${FRONTEND_URL}/payment/callback||PAYMENT_WEBHOOK_BASE_URL=${BACKEND_URL}/api/webhooks"

# Worker-specific gates:
#   SKIP_CRONS=true      — don't re-fire crons the api-web service already runs
#   SKIP_BULLMQ_WORKERS  — MUST NOT be set on this service; workers active here
ENV_VARS="${ENV_VARS}||SKIP_CRONS=true"

# ------------------------------------------------------------------
# SECRETS — Same as backend/deploy.sh. Kept in sync manually; if a new
# secret is added in backend/deploy.sh it needs to be added here too
# or the worker will crash at bootstrap when the code tries to read it.
# ------------------------------------------------------------------
SECRETS="DATABASE_URL=DATABASE_URL:latest"
SECRETS="${SECRETS},JWT_SECRET=JWT_SECRET:latest"
SECRETS="${SECRETS},JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest"
SECRETS="${SECRETS},PII_ENCRYPTION_KEY=PII_ENCRYPTION_KEY:latest"

# Email (worker sends "content pending review" emails after WCAG runs).
if gcloud secrets describe RESEND_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},RESEND_API_KEY=RESEND_API_KEY:latest"
fi
if gcloud secrets describe MAIL_FROM &>/dev/null 2>&1; then
    SECRETS="${SECRETS},MAIL_FROM=MAIL_FROM:latest"
fi
if gcloud secrets describe MAIL_REPLY_TO &>/dev/null 2>&1; then
    SECRETS="${SECRETS},MAIL_REPLY_TO=MAIL_REPLY_TO:latest"
fi

# Sentry (worker error monitoring — SDK no-ops if DSN missing)
if gcloud secrets describe SENTRY_DSN_BACKEND &>/dev/null 2>&1; then
    SECRETS="${SECRETS},SENTRY_DSN=SENTRY_DSN_BACKEND:latest"
fi

# Redis / Memorystore — the WHOLE point of this service. Bootstrap must
# fail loudly if the secret is missing rather than silently disable
# workers (which is what api-web does).
if gcloud secrets describe REDIS_HOST &>/dev/null 2>&1; then
    SECRETS="${SECRETS},REDIS_HOST=REDIS_HOST:latest"
    ENV_VARS="${ENV_VARS}||REDIS_PORT=6378||REDIS_TLS=true||FFMPEG_ENABLED=true||AUTO_APPROVE_MATERIALS=true"
    if gcloud secrets describe REDIS_CA_CERT &>/dev/null 2>&1; then
        SECRETS="${SECRETS},REDIS_CA_CERT=REDIS_CA_CERT:latest"
    fi
else
    log_error "REDIS_HOST secret missing — worker has nothing to consume. Aborting."
    exit 1
fi

# OpenAI (Whisper transcription) — optional; without it the transcode
# pipeline skips captions and goes straight to WCAG.
if gcloud secrets describe OPENAI_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},OPENAI_API_KEY=OPENAI_API_KEY:latest"
fi

# Zoom (used by session lifecycle events fired from queues).
if gcloud secrets describe ZOOM_ACCOUNT_ID &>/dev/null 2>&1; then
    SECRETS="${SECRETS},ZOOM_ACCOUNT_ID=ZOOM_ACCOUNT_ID:latest"
    SECRETS="${SECRETS},ZOOM_CLIENT_ID=ZOOM_CLIENT_ID:latest"
    SECRETS="${SECRETS},ZOOM_CLIENT_SECRET=ZOOM_CLIENT_SECRET:latest"
    SECRETS="${SECRETS},ZOOM_WEBHOOK_SECRET_TOKEN=ZOOM_WEBHOOK_SECRET_TOKEN:latest"
    ENV_VARS="${ENV_VARS}||ZOOM_MOCK=false"
else
    ENV_VARS="${ENV_VARS}||ZOOM_MOCK=true"
fi

# Payment gateway secrets — worker doesn't process payments directly,
# but shared services (invoice generation, reconciliation from queues)
# construct gateway URLs and need the mode/keys at bootstrap.
for _MS in MOYASAR_SECRET_KEY_TEST MOYASAR_PUBLISHABLE_KEY_TEST MOYASAR_WEBHOOK_SECRET_TEST \
           MOYASAR_SECRET_KEY_LIVE MOYASAR_PUBLISHABLE_KEY_LIVE MOYASAR_WEBHOOK_SECRET_LIVE; do
    if gcloud secrets describe "$_MS" &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${_MS}=${_MS}:latest"
    fi
done
# Preserve MOYASAR_MODE across worker deploys (same pattern as api-web).
if [ -z "${MOYASAR_MODE:-}" ]; then
    MOYASAR_MODE=$(gcloud run services describe ${WORKER_SERVICE_NAME} --region=${GCP_REGION} \
        --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null \
        | grep -A1 "name: MOYASAR_MODE\$" | grep 'value:' | head -1 | awk '{print $2}')
    MOYASAR_MODE="${MOYASAR_MODE:-test}"
fi
ENV_VARS="${ENV_VARS}||MOYASAR_MODE=${MOYASAR_MODE}"

for _TM in TAMARA_API_TOKEN TAMARA_NOTIFICATION_TOKEN TAMARA_PUBLIC_KEY; do
    if gcloud secrets describe "$_TM" &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${_TM}=${_TM}:latest"
    fi
done
TAMARA_API_URL="${TAMARA_API_URL:-https://api-sandbox.tamara.co}"
ENV_VARS="${ENV_VARS}||TAMARA_API_URL=${TAMARA_API_URL}"

for _TB in TABBY_SECRET_KEY TABBY_WEBHOOK_SECRET; do
    if gcloud secrets describe "$_TB" &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${_TB}=${_TB}:latest"
    fi
done
TABBY_API_URL="${TABBY_API_URL:-https://api.tabby.ai/api/v2}"
TABBY_MERCHANT_CODE="${TABBY_MERCHANT_CODE:-PHYS}"
TABBY_PUBLIC_KEY="${TABBY_PUBLIC_KEY:-pk_test_019e2e71-0358-6bb2-e50b-73334f9ec199}"
ENV_VARS="${ENV_VARS}||TABBY_API_URL=${TABBY_API_URL}||TABBY_MERCHANT_CODE=${TABBY_MERCHANT_CODE}||TABBY_PUBLIC_KEY=${TABBY_PUBLIC_KEY}"

# NELC LRS — worker fires xAPI statements from queues too.
if gcloud secrets describe NELC_LRS_PASSWORD &>/dev/null 2>&1; then
    SECRETS="${SECRETS},NELC_LRS_PASSWORD=NELC_LRS_PASSWORD:latest"
fi
if gcloud secrets describe NELC_LRS_PASSWORD_PROD &>/dev/null 2>&1; then
    SECRETS="${SECRETS},NELC_LRS_PASSWORD_PROD=NELC_LRS_PASSWORD_PROD:latest"
fi
NELC_LRS_ENABLED="${NELC_LRS_ENABLED:-true}"
NELC_LRS_MODE="${NELC_LRS_MODE:-staging}"
NELC_LRS_ENDPOINT_STAGING="${NELC_LRS_ENDPOINT_STAGING:-https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements}"
NELC_LRS_ENDPOINT_PROD="${NELC_LRS_ENDPOINT_PROD:-https://lrs.nelc.gov.sa/lrs-nelc/xapi/statements}"
NELC_LRS_USERNAME="${NELC_LRS_USERNAME:-physioguidance_org}"
NELC_PLATFORM_IDENTIFIER="${NELC_PLATFORM_IDENTIFIER:-https://physioguidance.org/}"
NELC_PLATFORM_NAME_EN="${NELC_PLATFORM_NAME_EN:-PhysioGuidance}"
NELC_PLATFORM_NAME_AR="${NELC_PLATFORM_NAME_AR:-فيزيو جايدنس}"
NELC_LMS_URL="${NELC_LMS_URL:-https://physioguidance.org}"
ENV_VARS="${ENV_VARS}||NELC_LRS_ENABLED=${NELC_LRS_ENABLED}||NELC_LRS_MODE=${NELC_LRS_MODE}||NELC_LRS_ENDPOINT_STAGING=${NELC_LRS_ENDPOINT_STAGING}||NELC_LRS_ENDPOINT_PROD=${NELC_LRS_ENDPOINT_PROD}||NELC_LRS_USERNAME=${NELC_LRS_USERNAME}||NELC_PLATFORM_IDENTIFIER=${NELC_PLATFORM_IDENTIFIER}||NELC_PLATFORM_NAME_EN=${NELC_PLATFORM_NAME_EN}||NELC_PLATFORM_NAME_AR=${NELC_PLATFORM_NAME_AR}||NELC_LMS_URL=${NELC_LMS_URL}"

# Sentry
SENTRY_ORG_BE="${SENTRY_ORG:-physioguidance}"
SENTRY_PROJECT_BE="${SENTRY_PROJECT:-physioguidance-web}"
SENTRY_API_HOST_BE="${SENTRY_API_HOST:-de.sentry.io}"
ENV_VARS="${ENV_VARS}||SENTRY_ORG=${SENTRY_ORG_BE}||SENTRY_PROJECT=${SENTRY_PROJECT_BE}||SENTRY_API_HOST=${SENTRY_API_HOST_BE}"
if gcloud secrets describe SENTRY_API_TOKEN &>/dev/null 2>&1; then
    SECRETS="${SECRETS},SENTRY_API_TOKEN=SENTRY_API_TOKEN:latest"
fi

# ------------------------------------------------------------------
# DEPLOY
# ------------------------------------------------------------------
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

# Per-service runtime SA (least-privilege). Same shape as api-runtime
# because the worker executes the same code path (BullMQ consumers +
# scheduled crons that read/write DB, Redis, storage buckets).
WORKER_RUNTIME_SA="worker-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

log_step "Deploying worker to Cloud Run..."
gcloud run deploy ${WORKER_SERVICE_NAME} \
    --image=${IMAGE_TAG} \
    --region=${GCP_REGION} \
    --platform=managed \
    --service-account=${WORKER_RUNTIME_SA} \
    --port=${BACKEND_PORT} \
    --memory=${WORKER_MEMORY} \
    --cpu=${WORKER_CPU} \
    --no-cpu-throttling \
    --min-instances=${WORKER_MIN_INSTANCES} \
    --max-instances=${WORKER_MAX_INSTANCES} \
    --no-allow-unauthenticated \
    --add-cloudsql-instances=${CONNECTION_NAME} \
    --vpc-connector=physio-vpc-connector-me \
    --vpc-egress=all-traffic \
    --set-env-vars="${ENV_VARS}" \
    --set-secrets="${SECRETS}" \
    --quiet

# Pin traffic to the just-deployed revision — same reason as api-web.
gcloud run services update-traffic ${WORKER_SERVICE_NAME} \
    --region=${GCP_REGION} \
    --to-latest \
    --quiet

SERVICE_URL=$(gcloud run services describe ${WORKER_SERVICE_NAME} \
    --region=${GCP_REGION} \
    --format='value(status.url)')

echo ""
log_success "==========================================="
log_success "Worker deployed successfully!"
log_success "==========================================="
echo ""
log_info "URL (internal): ${SERVICE_URL}"
log_info "Verify: gcloud logging read 'resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${WORKER_SERVICE_NAME}\"' --limit=10 --freshness=5m"
echo ""
