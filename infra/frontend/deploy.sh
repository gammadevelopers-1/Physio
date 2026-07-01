#!/bin/bash

# ===========================================
# Frontend Deployment Script
# ===========================================
# Deploys Next.js frontend to Cloud Run

set -e

# Get script directory and load config
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

# Parse arguments
SKIP_PULL=false
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-pull) SKIP_PULL=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        *) shift ;;
    esac
done

# Variables
IMAGE_TAG="${DOCKER_REGISTRY}/${FRONTEND_SERVICE_NAME}:${TIMESTAMP}"
IMAGE_LATEST="${DOCKER_REGISTRY}/${FRONTEND_SERVICE_NAME}:latest"
FRONTEND_DIR="${SCRIPT_DIR}/../../frontend"

print_banner
log_info "Deploying: Frontend (Next.js)"
echo ""

# Pre-flight checks
check_command gcloud
check_command docker
check_docker
check_gcp_auth

# Set project
gcloud config set project ${GCP_PROJECT_ID} --quiet

# Step 1: Pull latest code
if [ "$SKIP_PULL" = false ]; then
    log_step "Pulling latest code..."
    cd "${SCRIPT_DIR}/../.."
    git pull origin main 2>/dev/null || log_warning "Git pull skipped"
fi

# Step 2: Configure Docker for GCP
log_step "Configuring Docker for GCP..."
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev --quiet

# Step 3: Resolve production URLs for build args
log_step "Resolving production URLs for Next.js build..."
BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(get_service_url ${BACKEND_SERVICE_NAME})}"
STRAPI_URL="${PRODUCTION_STRAPI_URL:-$(get_service_url ${STRAPI_SERVICE_NAME})}"

if [ -z "$BACKEND_URL" ]; then
    log_error "Backend URL not found. Deploy backend first, or set PRODUCTION_BACKEND_URL."
    exit 1
fi
if [ -z "$STRAPI_URL" ]; then
    log_error "Strapi URL not found. Deploy Strapi first, or set PRODUCTION_STRAPI_URL."
    exit 1
fi

log_info "NEXT_PUBLIC_API_URL  = ${BACKEND_URL}/api"
log_info "NEXT_PUBLIC_STRAPI_URL = ${STRAPI_URL}"

# Resolve reCAPTCHA site key from Secret Manager (optional — widget hides if unset)
RECAPTCHA_SITE_KEY=""
if gcloud secrets describe NEXT_PUBLIC_RECAPTCHA_SITE_KEY &>/dev/null 2>&1; then
    RECAPTCHA_SITE_KEY=$(gcloud secrets versions access latest --secret=NEXT_PUBLIC_RECAPTCHA_SITE_KEY)
    log_info "NEXT_PUBLIC_RECAPTCHA_SITE_KEY = (loaded from Secret Manager)"
else
    log_warning "NEXT_PUBLIC_RECAPTCHA_SITE_KEY not in Secret Manager — captcha widget will not render"
fi

# BNPL promo widget public keys — non-sensitive, baked into the JS bundle
# at build time (Next.js NEXT_PUBLIC_*). Override per env if going live.
TABBY_PUBLIC_KEY_FE="${NEXT_PUBLIC_TABBY_PUBLIC_KEY:-pk_test_019e2e71-0358-6bb2-e50b-73334f9ec199}"
TABBY_MERCHANT_CODE_FE="${NEXT_PUBLIC_TABBY_MERCHANT_CODE:-PHYS}"
TAMARA_PUBLIC_KEY_FE="${NEXT_PUBLIC_TAMARA_PUBLIC_KEY:-b810ee56-42c0-48a3-a247-f96b98588535}"
log_info "NEXT_PUBLIC_TABBY_PUBLIC_KEY  = ${TABBY_PUBLIC_KEY_FE:0:18}…"
log_info "NEXT_PUBLIC_TABBY_MERCHANT_CODE = ${TABBY_MERCHANT_CODE_FE}"
log_info "NEXT_PUBLIC_TAMARA_PUBLIC_KEY = ${TAMARA_PUBLIC_KEY_FE:0:8}…"

# Sentry frontend monitoring — DSN is public, the build token is sensitive
# but only used at build time (source-map upload). Both come from Secret
# Manager so they survive every deploy without rebaking the script.
SENTRY_DSN_FE=""
SENTRY_AUTH_TOKEN_FE=""
SENTRY_ORG_FE="${SENTRY_ORG:-physioguidance}"
SENTRY_PROJECT_FE="${SENTRY_PROJECT:-physioguidance-web}"
SENTRY_APP_ENV_FE="${SENTRY_APP_ENV:-production}"
if gcloud secrets describe NEXT_PUBLIC_SENTRY_DSN &>/dev/null 2>&1; then
    SENTRY_DSN_FE=$(gcloud secrets versions access latest --secret=NEXT_PUBLIC_SENTRY_DSN)
    log_info "NEXT_PUBLIC_SENTRY_DSN = (loaded from Secret Manager)"
else
    log_warning "NEXT_PUBLIC_SENTRY_DSN not in Secret Manager — frontend error capture disabled"
fi
if gcloud secrets describe SENTRY_AUTH_TOKEN &>/dev/null 2>&1; then
    SENTRY_AUTH_TOKEN_FE=$(gcloud secrets versions access latest --secret=SENTRY_AUTH_TOKEN)
    log_info "SENTRY_AUTH_TOKEN = (loaded — source maps will upload)"
else
    log_warning "SENTRY_AUTH_TOKEN not in Secret Manager — source maps won't upload (prod stack traces will be minified)"
fi
# Release tag pins each deploy to its source-map bundle in Sentry.
SENTRY_RELEASE_FE="${TIMESTAMP}"

# Step 4: Build Docker image
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building Docker image..."
    cd "${FRONTEND_DIR}"

    docker build \
        --platform linux/amd64 \
        --build-arg NEXT_PUBLIC_API_URL="${BACKEND_URL}/api" \
        --build-arg NEXT_PUBLIC_STRAPI_URL="${STRAPI_URL}" \
        --build-arg NEXT_PUBLIC_RECAPTCHA_SITE_KEY="${RECAPTCHA_SITE_KEY}" \
        --build-arg NEXT_PUBLIC_TABBY_PUBLIC_KEY="${TABBY_PUBLIC_KEY_FE}" \
        --build-arg NEXT_PUBLIC_TABBY_MERCHANT_CODE="${TABBY_MERCHANT_CODE_FE}" \
        --build-arg NEXT_PUBLIC_TAMARA_PUBLIC_KEY="${TAMARA_PUBLIC_KEY_FE}" \
        --build-arg NEXT_PUBLIC_SENTRY_DSN="${SENTRY_DSN_FE}" \
        --build-arg NEXT_PUBLIC_APP_ENV="${SENTRY_APP_ENV_FE}" \
        --build-arg NEXT_PUBLIC_SENTRY_RELEASE="${SENTRY_RELEASE_FE}" \
        --build-arg SENTRY_ORG="${SENTRY_ORG_FE}" \
        --build-arg SENTRY_PROJECT="${SENTRY_PROJECT_FE}" \
        --build-arg SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN_FE}" \
        -t ${IMAGE_TAG} \
        -t ${IMAGE_LATEST} \
        .

    log_success "Image built: ${IMAGE_TAG}"
fi

# Step 5: Push to Artifact Registry
log_step "Pushing to Artifact Registry..."
docker push ${IMAGE_TAG}
docker push ${IMAGE_LATEST}
log_success "Image pushed"

# Step 6: Deploy to Cloud Run
log_step "Deploying to Cloud Run..."
gcloud run deploy ${FRONTEND_SERVICE_NAME} \
    --image=${IMAGE_TAG} \
    --region=${GCP_REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --port=${FRONTEND_PORT} \
    --memory=${FRONTEND_MEMORY} \
    --cpu=${FRONTEND_CPU} \
    --min-instances=${FRONTEND_MIN_INSTANCES} \
    --max-instances=${FRONTEND_MAX_INSTANCES} \
    --set-env-vars="NODE_ENV=production,BACKEND_API_URL=${BACKEND_URL}/api" \
    --quiet

# Force traffic to the just-deployed (latest) revision. Without this, if
# traffic was previously pinned to a specific named revision (e.g. by the
# admin "Rollback" button in the Backups tab, which calls update-traffic
# with an explicit revision name), the next deploy would create a new
# revision but leave traffic on the pinned old one — the new code would
# silently never serve. --to-latest makes the deploy authoritative.
log_step "Routing traffic to the new revision..."
gcloud run services update-traffic ${FRONTEND_SERVICE_NAME} \
    --to-latest \
    --region=${GCP_REGION} \
    --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe ${FRONTEND_SERVICE_NAME} \
    --region=${GCP_REGION} \
    --format='value(status.url)')

echo ""
log_success "==========================================="
log_success "Frontend deployed successfully!"
log_success "==========================================="
echo ""
log_info "URL: ${SERVICE_URL}"
echo ""
