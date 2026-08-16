#!/bin/bash

# ===========================================
# Strapi CMS Deployment Script
# ===========================================
# Deploys Strapi to Cloud Run

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
IMAGE_TAG="${DOCKER_REGISTRY}/${STRAPI_SERVICE_NAME}:${TIMESTAMP}"
IMAGE_LATEST="${DOCKER_REGISTRY}/${STRAPI_SERVICE_NAME}:latest"
STRAPI_DIR="${SCRIPT_DIR}/../../strapi"

print_banner
log_info "Deploying: Strapi CMS"
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
    cd "${STRAPI_DIR}"

    docker build \
        --platform linux/amd64 \
        -f ../infra/strapi/Dockerfile \
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
CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${DB_INSTANCE_NAME}"

# Strapi DB connects via Cloud Run's built-in Cloud SQL socket
# (mounted at /cloudsql/PROJECT:REGION:INSTANCE via --add-cloudsql-instances
# below). No SSL needed — traffic is local IPC inside the container.
STRAPI_DB_HOST="${STRAPI_DB_HOST:-/cloudsql/${CONNECTION_NAME}}"
STRAPI_DB_PORT="${STRAPI_DB_PORT:-5432}"
STRAPI_DB_NAME="${STRAPI_DB_NAME:-strapi}"
STRAPI_DB_USER="${STRAPI_DB_USER:-apiuser}"

# Env vars (non-sensitive)
ENV_VARS="NODE_ENV=production"
ENV_VARS="${ENV_VARS},DATABASE_CLIENT=postgres"
ENV_VARS="${ENV_VARS},DATABASE_HOST=${STRAPI_DB_HOST}"
ENV_VARS="${ENV_VARS},DATABASE_PORT=${STRAPI_DB_PORT}"
ENV_VARS="${ENV_VARS},DATABASE_NAME=${STRAPI_DB_NAME}"
ENV_VARS="${ENV_VARS},DATABASE_USERNAME=${STRAPI_DB_USER}"
ENV_VARS="${ENV_VARS},DATABASE_SSL=false"

# Upload provider — Google Cloud Storage (ephemeral local disk would lose every upload on restart)
ENV_VARS="${ENV_VARS},GCS_BUCKET_NAME=physioguidance-cms"
ENV_VARS="${ENV_VARS},GCS_BASE_PATH="
ENV_VARS="${ENV_VARS},GCS_PUBLIC_FILES=true"
ENV_VARS="${ENV_VARS},GCS_UNIFORM_ACCESS=true"

# Secrets from GCP Secret Manager
SECRETS="APP_KEYS=STRAPI_APP_KEYS:latest"
SECRETS="${SECRETS},API_TOKEN_SALT=STRAPI_API_TOKEN_SALT:latest"
SECRETS="${SECRETS},ADMIN_JWT_SECRET=STRAPI_ADMIN_JWT_SECRET:latest"
SECRETS="${SECRETS},TRANSFER_TOKEN_SALT=STRAPI_TRANSFER_TOKEN_SALT:latest"
SECRETS="${SECRETS},JWT_SECRET=STRAPI_JWT_SECRET:latest"

# Check if DB password is in Secret Manager, otherwise use env var
if gcloud secrets describe STRAPI_DATABASE_PASSWORD &>/dev/null 2>&1; then
    SECRETS="${SECRETS},DATABASE_PASSWORD=STRAPI_DATABASE_PASSWORD:latest"
else
    log_warning "STRAPI_DATABASE_PASSWORD not in Secret Manager. Set STRAPI_DB_PASSWORD env var."
    ENV_VARS="${ENV_VARS},DATABASE_PASSWORD=${STRAPI_DB_PASSWORD:-}"
fi

gcloud run deploy ${STRAPI_SERVICE_NAME} \
    --image=${IMAGE_TAG} \
    --region=${GCP_REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --port=${STRAPI_PORT} \
    --memory=${STRAPI_MEMORY} \
    --cpu=${STRAPI_CPU} \
    --min-instances=${STRAPI_MIN_INSTANCES} \
    --max-instances=${STRAPI_MAX_INSTANCES} \
    --add-cloudsql-instances=${CONNECTION_NAME} \
    --vpc-connector=physio-vpc-connector-me \
    --vpc-egress=all-traffic \
    --set-env-vars="${ENV_VARS}" \
    --set-secrets="${SECRETS}" \
    --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe ${STRAPI_SERVICE_NAME} \
    --region=${GCP_REGION} \
    --format='value(status.url)')

echo ""
log_success "==========================================="
log_success "Strapi CMS deployed successfully!"
log_success "==========================================="
echo ""
log_info "URL: ${SERVICE_URL}"
log_info "Admin: ${SERVICE_URL}/admin"
echo ""
