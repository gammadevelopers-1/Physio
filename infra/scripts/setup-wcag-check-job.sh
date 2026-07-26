#!/bin/bash

# ===========================================
# Create / update the wcag-check Cloud Run Job
# ===========================================
# Cloud Run Job that runs the WCAG compliance check as an ephemeral
# per-execution container instead of a permanently-running BullMQ
# worker. Triggered from THREE call sites:
#
#   - VideoTranscodeRunner (skip-captions branch — no OpenAI key or
#     autoTranscribe=false)
#   - CaptionsRunner (final chain step after captions + transcript)
#   - ProcessingService.dispatchWcagOnly (non-video materials —
#     pdf/document/image — skip straight to WCAG)
#
# For videos, the runner SKIPS the source download (WcagService only
# reads hasCaptions/hasTranscript booleans for that type). For
# pdf/document/image the file is downloaded and inspected (pdf-lib
# for PDFs, adm-zip for DOCX/PPTX).
#
# Why a Job vs the always-on worker:
#   - Cost: same rationale as the transcode + captions jobs. See
#     infra/scripts/setup-video-transcode-job.sh notes.
#   - Right-sized: no ffmpeg, no external ML APIs, checks run in
#     seconds. 1 vCPU / 512 MiB is ample.
#
# Usage:
#   bash infra/scripts/setup-wcag-check-job.sh
#
# Idempotent — safe to re-run on every deploy.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

JOB_NAME="physio-job-wcag-check"

# Resource sizing — smallest of the three processing jobs. Video path
# skips file download entirely. Non-video files cap at 50 MB (PDF /
# DOCX) or 20 MB (image), well within 512 MiB.
JOB_CPU="${JOB_CPU:-1}"
JOB_MEMORY="${JOB_MEMORY:-512Mi}"

# Timeout: real-world checks complete in <30s. 5 min gives large
# safety margin for slow storage downloads on non-video files.
JOB_TIMEOUT="${JOB_TIMEOUT:-300s}"   # 5 min

JOB_MAX_RETRIES="${JOB_MAX_RETRIES:-2}"

print_banner
log_info "Creating/updating Cloud Run Job: ${JOB_NAME}"
log_info "CPU=${JOB_CPU} MEM=${JOB_MEMORY} timeout=${JOB_TIMEOUT} maxRetries=${JOB_MAX_RETRIES}"
echo ""

check_command gcloud
check_gcp_auth
gcloud config set project ${GCP_PROJECT_ID} --quiet

IMAGE_TAG="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:latest"

# ------------------------------------------------------------------
# ENV VARS — mirror the other Cloud Run Jobs. Includes SMTP config
# because the WcagRunner fires manager-notification emails for
# warning/fail results (pending_review path).
# ------------------------------------------------------------------
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-$(get_service_url ${FRONTEND_SERVICE_NAME})}"
BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(get_service_url ${BACKEND_SERVICE_NAME})}"
STRAPI_URL_FOR_BACKEND="${PRODUCTION_STRAPI_URL:-$(get_service_url ${STRAPI_SERVICE_NAME})}"

ENV_VARS="^||^JOB_NAME=wcag.check||SKIP_CRONS=true||SKIP_BULLMQ_WORKERS=true||EXTERNALIZED_CRONS="
ENV_VARS="${ENV_VARS}||NODE_ENV=production||API_PREFIX=api||LOG_LEVEL=warn||STORAGE_DRIVER=gcp||GCP_PROJECT_ID=${GCP_PROJECT_ID}||GCP_REGION=${GCP_REGION}||STORAGE_BUCKET_PUBLIC=physioguidance-public||STORAGE_BUCKET_PRIVATE=physioguidance-private||STORAGE_BUCKET_TRAINERS=physioguidance-trainers||BACKUPS_BUCKET=physioguidance-backups||CLOUD_SQL_INSTANCE=${DB_INSTANCE_NAME}||DATABASE_NAME=physioguidance||APP_URL=${BACKEND_URL}/api||FRONTEND_URL=${FRONTEND_URL}||STRAPI_URL=${STRAPI_URL_FOR_BACKEND}"

# No ffmpeg needed; no OpenAI needed. Auto-approve flag preserved for
# consistency with the manager-notification code path.
ENV_VARS="${ENV_VARS}||AUTO_APPROVE_MATERIALS=true"

# ------------------------------------------------------------------
# SECRETS — DB + SMTP so the runner can send manager emails on
# warning/fail. No Redis, no OpenAI.
# ------------------------------------------------------------------
SECRETS="DATABASE_URL=DATABASE_URL:latest"
SECRETS="${SECRETS},PII_ENCRYPTION_KEY=PII_ENCRYPTION_KEY:latest"

# SMTP: the pending-review email uses EmailService (Nodemailer). Same
# secret names as api-web deploy. Missing SMTP creds only disable the
# email — the in-app notification still fires.
for secret in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM SMTP_REPLY_TO; do
    if gcloud secrets describe ${secret} &>/dev/null 2>&1; then
        SECRETS="${SECRETS},${secret}=${secret}:latest"
    fi
done

# ------------------------------------------------------------------
# DEPLOY
# ------------------------------------------------------------------
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

log_step "Deploying Cloud Run Job..."
gcloud run jobs deploy ${JOB_NAME} \
    --image=${IMAGE_TAG} \
    --region=${GCP_REGION} \
    --command=node \
    --args=dist/src/main-job.js \
    --memory=${JOB_MEMORY} \
    --cpu=${JOB_CPU} \
    --task-timeout=${JOB_TIMEOUT} \
    --max-retries=${JOB_MAX_RETRIES} \
    --parallelism=1 \
    --tasks=1 \
    --set-cloudsql-instances=${CONNECTION_NAME} \
    --vpc-connector=physio-vpc-connector-me \
    --vpc-egress=all-traffic \
    --set-env-vars="${ENV_VARS}" \
    --set-secrets="${SECRETS}" \
    --quiet

echo ""
log_success "==========================================="
log_success "Cloud Run Job ${JOB_NAME} deployed"
log_success "==========================================="
echo ""
log_info "Trigger via CloudRunJobsService.runJob('${JOB_NAME}', {...})"
log_info "Manual test:"
log_info "  gcloud run jobs execute ${JOB_NAME} --region=${GCP_REGION} \\"
log_info "    --update-env-vars=MATERIAL_ID=<uuid>,MATERIAL_TYPE=video,COURSE_ID=<uuid>,HAS_CAPTIONS=true,HAS_TRANSCRIPT=true,FILE_URL=<url>"
echo ""
