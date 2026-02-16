#!/bin/bash

# ===========================================
# Backend Deployment Script
# ===========================================
# Deploys NestJS backend to Cloud Run

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
IMAGE_TAG="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:${TIMESTAMP}"
IMAGE_LATEST="${DOCKER_REGISTRY}/${BACKEND_SERVICE_NAME}:latest"
BACKEND_DIR="${SCRIPT_DIR}/../../backends"

print_banner
log_info "Deploying: Backend (NestJS)"
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

# Step 3: Build Docker image
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building Docker image..."
    cd "${BACKEND_DIR}"

    docker build \
        --platform linux/amd64 \
        -f ../infra/backend/production/Dockerfile \
        -t ${IMAGE_TAG} \
        -t ${IMAGE_LATEST} \
        .

    log_success "Image built: ${IMAGE_TAG}"
fi

# Step 4: Push to Artifact Registry
log_step "Pushing to Artifact Registry..."
docker push ${IMAGE_TAG}
docker push ${IMAGE_LATEST}
log_success "Image pushed"

# Step 5: Resolve production URLs for CORS
log_step "Resolving production URLs..."
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-$(get_service_url ${FRONTEND_SERVICE_NAME})}"
if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="https://physioguidance-web-*.run.app"
    log_warning "Frontend URL not found, using wildcard. Update CORS_ORIGIN after first frontend deploy."
fi
log_info "CORS_ORIGIN will be set to: ${FRONTEND_URL}"

# Step 6: Deploy to Cloud Run
log_step "Deploying to Cloud Run..."

# Check if Cloud SQL instance exists
DB_INSTANCE_NAME="physioguidance-db"
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

# Common env vars for all backend deployments
# NOTE: PORT is reserved by Cloud Run (set via --port flag), do not include it here
ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS},CORS_ORIGIN=${FRONTEND_URL}"
ENV_VARS="${ENV_VARS},API_PREFIX=api"
ENV_VARS="${ENV_VARS},LOG_LEVEL=warn"

# Secrets from GCP Secret Manager (required)
SECRETS="DATABASE_URL=DATABASE_URL:latest"
SECRETS="${SECRETS},JWT_SECRET=JWT_SECRET:latest"
SECRETS="${SECRETS},JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest"

# Email (Resend API)
if gcloud secrets describe RESEND_API_KEY &>/dev/null 2>&1; then
    SECRETS="${SECRETS},RESEND_API_KEY=RESEND_API_KEY:latest"
    log_info "Resend API key found - email will be configured"
else
    log_warning "RESEND_API_KEY secret not found - email/2FA will not work"
fi

# Mail from address
if gcloud secrets describe MAIL_FROM &>/dev/null 2>&1; then
    SECRETS="${SECRETS},MAIL_FROM=MAIL_FROM:latest"
fi

if gcloud sql instances describe ${DB_INSTANCE_NAME} &>/dev/null; then
    log_info "Connecting to Cloud SQL: ${DB_INSTANCE_NAME}"
    gcloud run deploy ${BACKEND_SERVICE_NAME} \
        --image=${IMAGE_TAG} \
        --region=${GCP_REGION} \
        --platform=managed \
        --allow-unauthenticated \
        --port=${BACKEND_PORT} \
        --memory=${BACKEND_MEMORY} \
        --cpu=${BACKEND_CPU} \
        --min-instances=${BACKEND_MIN_INSTANCES} \
        --max-instances=${BACKEND_MAX_INSTANCES} \
        --add-cloudsql-instances=${CONNECTION_NAME} \
        --set-env-vars="${ENV_VARS}" \
        --set-secrets="${SECRETS}" \
        --quiet
else
    log_warning "No Cloud SQL instance found. Deploying without Cloud SQL proxy."
    gcloud run deploy ${BACKEND_SERVICE_NAME} \
        --image=${IMAGE_TAG} \
        --region=${GCP_REGION} \
        --platform=managed \
        --allow-unauthenticated \
        --port=${BACKEND_PORT} \
        --memory=${BACKEND_MEMORY} \
        --cpu=${BACKEND_CPU} \
        --min-instances=${BACKEND_MIN_INSTANCES} \
        --max-instances=${BACKEND_MAX_INSTANCES} \
        --set-env-vars="${ENV_VARS}" \
        --set-secrets="${SECRETS}" \
        --quiet
fi

# Get service URL
SERVICE_URL=$(gcloud run services describe ${BACKEND_SERVICE_NAME} \
    --region=${GCP_REGION} \
    --format='value(status.url)')

echo ""
log_success "==========================================="
log_success "Backend deployed successfully!"
log_success "==========================================="
echo ""
log_info "URL: ${SERVICE_URL}"
log_info "Health: ${SERVICE_URL}/api/health"
echo ""
