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

# Step 4: Build Docker image
if [ "$SKIP_BUILD" = false ]; then
    log_step "Building Docker image..."
    cd "${FRONTEND_DIR}"

    docker build \
        --platform linux/amd64 \
        --build-arg NEXT_PUBLIC_API_URL="${BACKEND_URL}/api" \
        --build-arg NEXT_PUBLIC_STRAPI_URL="${STRAPI_URL}" \
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
    --set-env-vars="NODE_ENV=production" \
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
