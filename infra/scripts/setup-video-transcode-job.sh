#!/bin/bash

# ===========================================
# Create / update the video-transcode Cloud Run Job
# ===========================================
# Cloud Run Job that runs the video transcoding pipeline as an ephemeral
# per-execution container instead of a permanently-running BullMQ worker.
# api-web triggers this via `CloudRunJobsService.runJob(
#   'physio-job-video-transcode', { MATERIAL_ID, FILE_URL, COURSE_ID,
#   ORIGINAL_MIME_TYPE, AUTO_TRANSCRIBE }
# )` after an instructor uploads a video.
#
# Why a Job vs a service:
#   - Cost: idle worker service cost $190/mo (verified). Cloud Run Jobs
#     only bill during actual execution. At ~10 videos/month uploads
#     the effective cost is <$5/mo.
#   - Right-sized per invocation: 2 vCPU / 2 GiB is enough headroom for
#     ffmpeg on 500 MB / 30 min HD source (the shrunk worker was
#     OOM'ing at 512 MiB).
#   - Idempotent: VideoTranscodeRunner.markFailed on any exception, so
#     Cloud Run's built-in retry (--max-retries=2) is safe.
#
# Usage:
#   bash infra/scripts/setup-video-transcode-job.sh
#
# The script is idempotent — safe to re-run on every deploy. Reuses the
# CURRENT api-web image tag so the Job runs the same code the api-web
# service is on.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

JOB_NAME="physio-job-video-transcode"

# Resource sizing — match what the shrunk worker service USED to have,
# because the ffmpeg pipeline is CPU + memory bound. Bump if instructors
# start uploading longer / higher-bitrate videos and OOMs return.
JOB_CPU="${JOB_CPU:-2}"
JOB_MEMORY="${JOB_MEMORY:-2Gi}"

# Timeout: max time a single job execution can run. 30 min HD source
# transcoding to 360p + 720p + 1080p sequentially = ~50-60 min on 2
# vCPU. Set 90 min to leave headroom + download + upload variants.
JOB_TIMEOUT="${JOB_TIMEOUT:-5400s}"   # 90 min

# Cloud Run's built-in retry — matches BullMQ's `attempts: 2` config.
JOB_MAX_RETRIES="${JOB_MAX_RETRIES:-2}"

print_banner
log_info "Creating/updating Cloud Run Job: ${JOB_NAME}"
log_info "CPU=${JOB_CPU} MEM=${JOB_MEMORY} timeout=${JOB_TIMEOUT} maxRetries=${JOB_MAX_RETRIES}"
echo ""

check_command gcloud
check_gcp_auth
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Pull the latest api-web image tag so the Job runs current code.
# `physioguidance-api:latest` is what infra/backend/deploy.sh always
# tags — reuse it so the two stay in lockstep with no extra build.
IMAGE_TAG="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:latest"

# ------------------------------------------------------------------
# ENV VARS — same runtime config the api-web service uses, minus a few
# that only make sense for the HTTP process. Kept in sync manually
# with infra/backend/deploy.sh — if you add a secret / env var there,
# add it here too.
# ------------------------------------------------------------------
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-$(get_service_url ${FRONTEND_SERVICE_NAME})}"
BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(get_service_url ${BACKEND_SERVICE_NAME})}"
STRAPI_URL_FOR_BACKEND="${PRODUCTION_STRAPI_URL:-$(get_service_url ${STRAPI_SERVICE_NAME})}"

# Every Cloud Run Job process sets these at startup (see main-job.ts):
#   JOB_NAME             — resolves this handler in JobRegistry
#   SKIP_CRONS=true      — no in-process @Cron scheduler
#   SKIP_BULLMQ_WORKERS=true — no BullMQ workers spun up
#   EXTERNALIZED_CRONS   — cleared inside main-job.ts before bootstrap
ENV_VARS="^||^JOB_NAME=video.transcode||SKIP_CRONS=true||SKIP_BULLMQ_WORKERS=true||EXTERNALIZED_CRONS="
ENV_VARS="${ENV_VARS}||NODE_ENV=production||API_PREFIX=api||LOG_LEVEL=warn||STORAGE_DRIVER=gcp||GCP_PROJECT_ID=${GCP_PROJECT_ID}||GCP_REGION=${GCP_REGION}||STORAGE_BUCKET_PUBLIC=physioguidance-public||STORAGE_BUCKET_PRIVATE=physioguidance-private||STORAGE_BUCKET_TRAINERS=physioguidance-trainers||BACKUPS_BUCKET=physioguidance-backups||CLOUD_SQL_INSTANCE=${DB_INSTANCE_NAME}||DATABASE_NAME=physioguidance||APP_URL=${BACKEND_URL}/api||FRONTEND_URL=${FRONTEND_URL}||STRAPI_URL=${STRAPI_URL_FOR_BACKEND}"

# ffmpeg must be on
ENV_VARS="${ENV_VARS}||FFMPEG_ENABLED=true||AUTO_APPROVE_MATERIALS=true"

# Redis — the runner enqueues the CHAINED captions/WCAG steps into
# BullMQ after transcoding, so it needs Redis client config to reach
# the same Memorystore instance the api-worker uses. Once Phase 2/3
# migrate captions + WCAG to Jobs too, this can be dropped.
ENV_VARS="${ENV_VARS}||REDIS_PORT=6378||REDIS_TLS=true"

# ------------------------------------------------------------------
# SECRETS — mirror what api-web uses. Only include what the runner
# actually needs at runtime (DB, Redis, OpenAI for captions chain).
# ------------------------------------------------------------------
SECRETS="DATABASE_URL=DATABASE_URL:latest"
SECRETS="${SECRETS},PII_ENCRYPTION_KEY=PII_ENCRYPTION_KEY:latest"

if gcloud secrets describe REDIS_HOST &>/dev/null 2>&1; then
    SECRETS="${SECRETS},REDIS_HOST=REDIS_HOST:latest"
    if gcloud secrets describe REDIS_CA_CERT &>/dev/null 2>&1; then
        SECRETS="${SECRETS},REDIS_CA_CERT=REDIS_CA_CERT:latest"
    fi
else
    log_warning "REDIS_HOST secret not found — the captions/WCAG chain after transcoding will fail (they still use BullMQ in Phase 1)"
fi

if gcloud secrets describe OPENAI_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},OPENAI_API_KEY=OPENAI_API_KEY:latest"
fi

# ------------------------------------------------------------------
# DEPLOY — create if new, update if exists. Cloud Run supports either
# via `gcloud run jobs deploy`. Cloud SQL connector + VPC connector
# mirror api-web so the Job can reach the DB + Memorystore in the VPC.
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
log_info "Trigger from api-web via CloudRunJobsService.runJob('${JOB_NAME}', {...})"
log_info "Manual test:"
log_info "  gcloud run jobs execute ${JOB_NAME} --region=${GCP_REGION} \\"
log_info "    --update-env-vars=MATERIAL_ID=<uuid>,FILE_URL=<url>,COURSE_ID=<uuid>,ORIGINAL_MIME_TYPE=video/mp4"
echo ""
