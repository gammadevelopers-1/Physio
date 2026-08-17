#!/bin/bash
# ==============================================================
# PhysioGuidance — Least-Privilege Service Accounts Setup
# ==============================================================
# For Amna to run in Google Cloud Shell (browser).
#
# What this does:
#   Replaces the default Compute Engine SA (which has roles/editor —
#   too broad) with 5 dedicated per-service SAs, each granted only
#   the minimum IAM roles that service actually uses at runtime.
#
# Services covered:
#   1. api-runtime      → backend (physioguidance-api)
#   2. worker-runtime   → worker (physioguidance-api-worker) + all 25 Cloud Run Jobs
#   3. strapi-runtime   → Strapi CMS (physioguidance-cms)
#   4. web-runtime      → Next.js frontend (physioguidance-web)
#   5. malware-runtime  → malware scanner (physioguidance-malware-scanner)
#
# Time: ~5 min
# Impact on platform: NONE (this only CREATES SAs and grants roles;
#   nothing switches to using them until Ghulam updates deploy scripts)
# Cost: $0
#
# Safe to re-run: every step is idempotent (checks existence first).
# ==============================================================

set -e

PROJECT="nelc-elearning-platform-479319"
gcloud config set project $PROJECT
echo ""
echo "=============================================================="
echo "  Creating 5 least-privilege service accounts"
echo "=============================================================="
echo ""

# ---------- Step 1: Create the 5 service accounts ----------
for SA_ID in api-runtime worker-runtime strapi-runtime web-runtime malware-runtime; do
  if gcloud iam service-accounts describe ${SA_ID}@${PROJECT}.iam.gserviceaccount.com &>/dev/null; then
    echo "  [SKIP] $SA_ID already exists"
  else
    gcloud iam service-accounts create $SA_ID \
      --display-name="Physio ${SA_ID}" \
      --project=$PROJECT
    echo "  [OK]   Created $SA_ID"
  fi
done

# SA email variables
BACKEND_SA="api-runtime@${PROJECT}.iam.gserviceaccount.com"
WORKER_SA="worker-runtime@${PROJECT}.iam.gserviceaccount.com"
STRAPI_SA="strapi-runtime@${PROJECT}.iam.gserviceaccount.com"
WEB_SA="web-runtime@${PROJECT}.iam.gserviceaccount.com"
MALWARE_SA="malware-runtime@${PROJECT}.iam.gserviceaccount.com"
TASKS_DISPATCHER_SA="tasks-dispatcher@${PROJECT}.iam.gserviceaccount.com"

# ---------- Helper: grant project-level role ----------
grant_project() {
  local SA=$1
  local ROLE=$2
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role="$ROLE" \
    --condition=None \
    --quiet > /dev/null
  echo "    [OK] $ROLE"
}

# ---------- Helper: grant bucket-scoped role ----------
grant_bucket() {
  local SA=$1
  local BUCKET=$2
  local ROLE=$3
  gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
    --member="serviceAccount:$SA" \
    --role="$ROLE" \
    > /dev/null
  echo "    [OK] $ROLE on $BUCKET"
}

# ==============================================================
# BACKEND (physioguidance-api)
# ==============================================================
echo ""
echo "  --- BACKEND ($BACKEND_SA) ---"
grant_project $BACKEND_SA roles/cloudsql.client
grant_project $BACKEND_SA roles/cloudsql.admin
grant_project $BACKEND_SA roles/cloudtasks.enqueuer
grant_project $BACKEND_SA roles/run.developer
grant_project $BACKEND_SA roles/secretmanager.secretAccessor

# Storage buckets
grant_bucket $BACKEND_SA physioguidance-public   roles/storage.objectUser
grant_bucket $BACKEND_SA physioguidance-private  roles/storage.objectUser
grant_bucket $BACKEND_SA physioguidance-trainers roles/storage.objectUser
grant_bucket $BACKEND_SA physioguidance-backups  roles/storage.objectUser

# Sign its own tokens (needed for bucket.file().getSignedUrl() under ADC)
gcloud iam service-accounts add-iam-policy-binding $BACKEND_SA \
  --member="serviceAccount:$BACKEND_SA" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=$PROJECT --quiet > /dev/null
echo "    [OK] serviceAccountTokenCreator (self)"

# Act as tasks-dispatcher SA (for OIDC-signed task tokens)
gcloud iam service-accounts add-iam-policy-binding $TASKS_DISPATCHER_SA \
  --member="serviceAccount:$BACKEND_SA" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT --quiet > /dev/null
echo "    [OK] serviceAccountUser on tasks-dispatcher"

# ==============================================================
# WORKER (physioguidance-api-worker + 25 Cloud Run Jobs)
# ==============================================================
echo ""
echo "  --- WORKER ($WORKER_SA) ---"
grant_project $WORKER_SA roles/cloudsql.client
grant_project $WORKER_SA roles/cloudtasks.enqueuer
grant_project $WORKER_SA roles/run.developer
grant_project $WORKER_SA roles/secretmanager.secretAccessor

grant_bucket $WORKER_SA physioguidance-public   roles/storage.objectUser
grant_bucket $WORKER_SA physioguidance-private  roles/storage.objectUser
grant_bucket $WORKER_SA physioguidance-trainers roles/storage.objectUser

gcloud iam service-accounts add-iam-policy-binding $WORKER_SA \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=$PROJECT --quiet > /dev/null
echo "    [OK] serviceAccountTokenCreator (self)"

gcloud iam service-accounts add-iam-policy-binding $TASKS_DISPATCHER_SA \
  --member="serviceAccount:$WORKER_SA" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT --quiet > /dev/null
echo "    [OK] serviceAccountUser on tasks-dispatcher"

# ==============================================================
# STRAPI (physioguidance-cms)
# ==============================================================
echo ""
echo "  --- STRAPI ($STRAPI_SA) ---"
grant_project $STRAPI_SA roles/cloudsql.client
grant_project $STRAPI_SA roles/secretmanager.secretAccessor

grant_bucket $STRAPI_SA physioguidance-cms roles/storage.objectUser

gcloud iam service-accounts add-iam-policy-binding $STRAPI_SA \
  --member="serviceAccount:$STRAPI_SA" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=$PROJECT --quiet > /dev/null
echo "    [OK] serviceAccountTokenCreator (self)"

# ==============================================================
# FRONTEND (physioguidance-web)
# ==============================================================
echo ""
echo "  --- FRONTEND ($WEB_SA) ---"
grant_project $WEB_SA roles/secretmanager.secretAccessor

# Frontend has no other GCP runtime dependencies — verified in audit.
# It's a Next.js SSR app that calls the backend API only.

# ==============================================================
# MALWARE SCANNER (physioguidance-malware-scanner)
# ==============================================================
echo ""
echo "  --- MALWARE SCANNER ($MALWARE_SA) ---"
grant_project $MALWARE_SA roles/eventarc.eventReceiver

grant_bucket $MALWARE_SA physioguidance-private  roles/storage.objectUser
grant_bucket $MALWARE_SA physioguidance-public   roles/storage.objectUser
grant_bucket $MALWARE_SA physioguidance-trainers roles/storage.objectUser

# Quarantine bucket may not exist yet — this is idempotent
if gcloud storage buckets describe gs://physioguidance-quarantine &>/dev/null; then
  grant_bucket $MALWARE_SA physioguidance-quarantine roles/storage.objectUser
else
  echo "    [SKIP] physioguidance-quarantine bucket doesn't exist yet"
fi

# ==============================================================
# DONE — Print summary values for Ghulam
# ==============================================================
echo ""
echo "=============================================================="
echo "  DONE — 5 service accounts created + roles granted"
echo "=============================================================="
echo ""
echo "SEND THESE TO GHULAM:"
echo ""
echo "  Backend:  $BACKEND_SA"
echo "  Worker:   $WORKER_SA"
echo "  Strapi:   $STRAPI_SA"
echo "  Frontend: $WEB_SA"
echo "  Malware:  $MALWARE_SA"
echo ""
echo "He'll update the deploy scripts to reference these SAs and"
echo "redeploy each service (~30 min). Current services continue to"
echo "run on the compute SA until then — nothing is switched yet."
echo ""
echo "To view the granted roles:"
echo "  gcloud projects get-iam-policy $PROJECT --flatten='bindings[].members' \\"
echo "    --filter='bindings.members ~ runtime@' \\"
echo "    --format='table(bindings.members,bindings.role)'"
echo ""
