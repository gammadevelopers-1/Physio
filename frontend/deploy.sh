#!/bin/bash

# ============================================
# PhysioGuidance Frontend Deployment Script
# ============================================
# This script deploys the Next.js frontend to GCP Cloud Run
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. Docker installed and running
#   3. GCP project created with billing enabled
#
# First-time setup (run these commands once):
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com
#   gcloud artifacts repositories create physioguidance --repository-format=docker --location=us-central1
#
# Usage:
#   ./deploy.sh                    # Deploy with defaults
#   ./deploy.sh --skip-pull        # Skip git pull
#   ./deploy.sh --project my-proj  # Use specific project
# ============================================

set -e  # Exit on error

# ============================================
# CONFIGURATION - Update these values!
# ============================================
PROJECT_ID="${GCP_PROJECT_ID:-physioguidance}"  # Client's GCP project ID
REGION="${GCP_REGION:-us-central1}"                   # GCP region
SERVICE_NAME="physioguidance-web"                     # Cloud Run service name
REPO_NAME="physioguidance"                            # Artifact Registry repo name

# ============================================
# Colors for output
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Helper functions
# ============================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# Parse arguments
# ============================================
SKIP_PULL=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-pull)
            SKIP_PULL=true
            shift
            ;;
        --project)
            PROJECT_ID="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================
# Derived values
# ============================================
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
IMAGE_TAG="${IMAGE_URL}:${TIMESTAMP}"
IMAGE_LATEST="${IMAGE_URL}:latest"

# ============================================
# Pre-flight checks
# ============================================
log_info "Starting deployment..."
log_info "Project: ${PROJECT_ID}"
log_info "Region: ${REGION}"
log_info "Service: ${SERVICE_NAME}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI is not installed. Please install it first."
    log_info "Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if authenticated
if ! gcloud auth print-access-token &> /dev/null; then
    log_error "Not authenticated with GCP. Run: gcloud auth login"
    exit 1
fi

# Set project
log_info "Setting GCP project..."
gcloud config set project ${PROJECT_ID} --quiet

# ============================================
# Step 1: Pull latest code
# ============================================
if [ "$SKIP_PULL" = false ]; then
    log_info "Pulling latest code from git..."
    git pull origin main
    log_success "Code updated"
else
    log_warning "Skipping git pull"
fi

# ============================================
# Step 2: Configure Docker for GCP
# ============================================
log_info "Configuring Docker for GCP Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
log_success "Docker configured"

# ============================================
# Step 3: Resolve production URLs
# ============================================
log_info "Resolving production URLs for Next.js build..."

BACKEND_URL="${PRODUCTION_BACKEND_URL:-$(gcloud run services describe physioguidance-api --region=${REGION} --format='value(status.url)' 2>/dev/null)}"
STRAPI_URL="${PRODUCTION_STRAPI_URL:-$(gcloud run services describe physioguidance-cms --region=${REGION} --format='value(status.url)' 2>/dev/null)}"

if [ -z "$BACKEND_URL" ]; then
    log_error "Backend URL not found. Deploy backend first or set PRODUCTION_BACKEND_URL env var."
    exit 1
fi
if [ -z "$STRAPI_URL" ]; then
    log_error "Strapi URL not found. Deploy Strapi first or set PRODUCTION_STRAPI_URL env var."
    exit 1
fi

log_info "NEXT_PUBLIC_API_URL    = ${BACKEND_URL}/api"
log_info "NEXT_PUBLIC_STRAPI_URL = ${STRAPI_URL}"

# ============================================
# Step 4: Build Docker image
# ============================================
log_info "Building Docker image..."
log_info "This may take a few minutes..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

docker build \
    --platform linux/amd64 \
    --build-arg NEXT_PUBLIC_API_URL="${BACKEND_URL}/api" \
    --build-arg NEXT_PUBLIC_STRAPI_URL="${STRAPI_URL}" \
    -t ${IMAGE_TAG} \
    -t ${IMAGE_LATEST} \
    .

log_success "Docker image built"

# ============================================
# Step 5: Push to Artifact Registry
# ============================================
log_info "Pushing image to Artifact Registry..."
docker push ${IMAGE_TAG}
docker push ${IMAGE_LATEST}
log_success "Image pushed: ${IMAGE_TAG}"

# ============================================
# Step 6: Deploy to Cloud Run
# ============================================
log_info "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE_TAG} \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --port=3000 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=3 \
    --set-env-vars="NODE_ENV=production,BACKEND_API_URL=${BACKEND_URL}/api" \
    --quiet

# ============================================
# Step 7: Get service URL
# ============================================
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --region=${REGION} \
    --format='value(status.url)')

echo ""
log_success "=========================================="
log_success "Deployment complete!"
log_success "=========================================="
echo ""
log_info "Service URL: ${SERVICE_URL}"
log_info "Image: ${IMAGE_TAG}"
echo ""
log_info "To view logs:"
echo "  gcloud run services logs read ${SERVICE_NAME} --region=${REGION}"
echo ""
log_info "To view in console:"
echo "  https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}"
echo ""
