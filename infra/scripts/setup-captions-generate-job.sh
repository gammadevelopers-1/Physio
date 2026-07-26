#!/bin/bash

# ===========================================
# Create / update the captions-generate Cloud Run Job
# ===========================================
# Cloud Run Job that runs the merged captions + transcript pipeline as
# an ephemeral per-execution container instead of a permanently-running
# BullMQ worker. Triggered by VideoTranscodeRunner as the chain step
# after transcoding completes.
#
# The Job downloads the source video, extracts audio via ffmpeg,
# sends it to OpenAI Whisper, uploads the VTT captions file, uploads
# the plaintext transcript, updates the material row, and enqueues a
# BullMQ WCAG job (WCAG moves to a Job in Phase 3).
#
# Why a Job vs the always-on worker:
#   - Cost: same rationale as the transcode job — pay only for the
#     ~1-5 min this actually runs, not 24/7. See notes in
#     infra/scripts/setup-video-transcode-job.sh.
#   - Right-sized: ffmpeg audio-extract is far cheaper than transcode
#     (single pass, small mp3), so we use 1 vCPU / 1 GiB instead of
#     the transcode job's 2/2Gi.
#
# Usage:
#   bash infra/scripts/setup-captions-generate-job.sh
#
# Idempotent — safe to re-run on every deploy. Reuses the CURRENT
# api-web `:latest` image tag so the Job runs the same code as api-web.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

JOB_NAME="physio-job-captions-generate"

# Resource sizing — captions/transcript is ffmpeg audio-extract +
# Whisper API call (remote) + two small storage uploads. Very
# different profile from the transcode job.
JOB_CPU="${JOB_CPU:-1}"
JOB_MEMORY="${JOB_MEMORY:-1Gi}"

# Timeout: Whisper API can take a few minutes on a long file, plus
# download + audio-extract time. 30 min gives ample headroom for a
# ~30 min HD source video.
JOB_TIMEOUT="${JOB_TIMEOUT:-1800s}"   # 30 min

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
# ENV VARS — same shape as the transcode job.
# JOB_NAME=captions.generate is what main-job.ts uses to resolve
# CaptionsJob from JobRegistry.
# ------------------------------------------------------------------
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-$(get_service_url ${FRONTEND_SERVICE_NAME})}"
BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(get_service_url ${BACKEND_SERVICE_NAME})}"
STRAPI_URL_FOR_BACKEND="${PRODUCTION_STRAPI_URL:-$(get_service_url ${STRAPI_SERVICE_NAME})}"

ENV_VARS="^||^JOB_NAME=captions.generate||SKIP_CRONS=true||SKIP_BULLMQ_WORKERS=true||EXTERNALIZED_CRONS="
ENV_VARS="${ENV_VARS}||NODE_ENV=production||API_PREFIX=api||LOG_LEVEL=warn||STORAGE_DRIVER=gcp||GCP_PROJECT_ID=${GCP_PROJECT_ID}||GCP_REGION=${GCP_REGION}||STORAGE_BUCKET_PUBLIC=physioguidance-public||STORAGE_BUCKET_PRIVATE=physioguidance-private||STORAGE_BUCKET_TRAINERS=physioguidance-trainers||BACKUPS_BUCKET=physioguidance-backups||CLOUD_SQL_INSTANCE=${DB_INSTANCE_NAME}||DATABASE_NAME=physioguidance||APP_URL=${BACKEND_URL}/api||FRONTEND_URL=${FRONTEND_URL}||STRAPI_URL=${STRAPI_URL_FOR_BACKEND}"

# ffmpeg needed for audio-extract; Whisper needs an OpenAI key.
ENV_VARS="${ENV_VARS}||FFMPEG_ENABLED=true||AUTO_APPROVE_MATERIALS=true"

# Redis — the runner enqueues a WCAG job into BullMQ at the end
# (Phase 3 will move WCAG to a Job too and this can be dropped).
ENV_VARS="${ENV_VARS}||REDIS_PORT=6378||REDIS_TLS=true"

# ------------------------------------------------------------------
# SECRETS — mirror api-web + the transcode job. OpenAI key is
# non-optional here (Whisper won't run without it), so log a hard
# warning if missing.
# ------------------------------------------------------------------
SECRETS="DATABASE_URL=DATABASE_URL:latest"
SECRETS="${SECRETS},PII_ENCRYPTION_KEY=PII_ENCRYPTION_KEY:latest"

if gcloud secrets describe REDIS_HOST &>/dev/null 2>&1; then
    SECRETS="${SECRETS},REDIS_HOST=REDIS_HOST:latest"
    if gcloud secrets describe REDIS_CA_CERT &>/dev/null 2>&1; then
        SECRETS="${SECRETS},REDIS_CA_CERT=REDIS_CA_CERT:latest"
    fi
else
    log_warning "REDIS_HOST secret not found — the WCAG chain step after captions will fail (WCAG still uses BullMQ in Phase 2)"
fi

if gcloud secrets describe OPENAI_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},OPENAI_API_KEY=OPENAI_API_KEY:latest"
else
    log_warning "OPENAI_API_KEY secret not found — captions generation will fail (Whisper is required)"
fi

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
log_info "Trigger from VideoTranscodeRunner via CloudRunJobsService.runJob('${JOB_NAME}', {...})"
log_info "Manual test:"
log_info "  gcloud run jobs execute ${JOB_NAME} --region=${GCP_REGION} \\"
log_info "    --update-env-vars=MATERIAL_ID=<uuid>,FILE_URL=<url>,COURSE_ID=<uuid>,AUTO_TRANSCRIBE=true"
echo ""
