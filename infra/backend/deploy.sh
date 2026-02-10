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

# Step 5: Deploy to Cloud Run
log_step "Deploying to Cloud Run..."

# Check if Cloud SQL instance exists
DB_INSTANCE_NAME="physioguidance-db"
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

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
        --set-env-vars="NODE_ENV=production" \
        --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
        --quiet
else
    log_warning "No Cloud SQL instance found. Deploying without database."
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
        --set-env-vars="NODE_ENV=production" \
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
