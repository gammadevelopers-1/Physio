#!/bin/bash

# ===========================================
# Bank Transfer Receipt Retention Setup
# ===========================================
# Applies a 10-year retention lifecycle rule to the
# `bank-transfer-receipts/` prefix inside the existing
# physioguidance-private bucket. Saudi accounting law requires retaining
# financial supporting documents for 10 years.
#
# Why a prefix-scoped lifecycle rule (not a separate bucket):
#   - the malware scanner already watches physioguidance-private
#   - keeps IAM + bucket-level access logging consolidated
#   - GCS lifecycle rules support matchesPrefix natively
#
# This script is idempotent — running it multiple times produces the
# same result. The existing lifecycle (if any) on the bucket is MERGED
# with the new rule, not replaced, by reading current rules first.
#
# Usage:
#   ./setup-bank-receipt-retention.sh
# ===========================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${SCRIPT_DIR}/../config.sh"

BUCKET="${GCP_PROJECT_ID}-private"

# Marker key inside the rule so we can find + replace just ours on re-run
# instead of accidentally duplicating it.
RULE_ID="bank-transfer-receipts-10yr-retention"

# Saudi accounting law: 10 years. Computed in days because GCS lifecycle
# `age` is in days, not years (365 * 10 = 3650).
RETENTION_DAYS=3650

log_info()    { echo "[INFO]  $*"; }
log_step()    { echo ""; echo "[STEP]  $*"; }
log_success() { echo "[OK]    $*"; }
log_warn()    { echo "[WARN]  $*"; }
log_error()   { echo "[ERROR] $*" >&2; }

log_info "Project: ${GCP_PROJECT_ID}"
log_info "Bucket:  gs://${BUCKET}"
log_info "Prefix:  bank-transfer-receipts/"
log_info "Retain:  ${RETENTION_DAYS} days (~10 years, Saudi accounting law)"

# Confirm the bucket exists before we touch its lifecycle.
if ! gcloud storage buckets describe "gs://${BUCKET}" --format='value(name)' &>/dev/null; then
    log_error "Bucket gs://${BUCKET} not found. Run setup-storage.sh first."
    exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

CURRENT_FILE="${WORK_DIR}/current-lifecycle.json"
NEW_FILE="${WORK_DIR}/new-lifecycle.json"

# Step 1: read the current lifecycle config (may be empty / missing).
log_step "Reading current lifecycle config..."
gcloud storage buckets describe "gs://${BUCKET}" \
    --format='json(lifecycle)' > "${CURRENT_FILE}" || echo '{}' > "${CURRENT_FILE}"

# Step 2: build the new rule. The Delete action runs `age` days after the
# object's creation time. matchesPrefix scopes it to only our receipts.
NEW_RULE=$(cat <<EOF
{
  "action": { "type": "Delete" },
  "condition": {
    "age": ${RETENTION_DAYS},
    "matchesPrefix": ["bank-transfer-receipts/"]
  }
}
EOF
)

# Step 3: merge — drop any previous version of our rule (matched by the
# prefix marker), append the new one. Result goes to a fresh JSON file
# that gcloud accepts via --lifecycle-file.
#
# Uses python instead of jq because Cloud Shell may not have jq, but
# python3 is guaranteed on Linux/macOS/WSL.
log_step "Merging rule into existing lifecycle..."
python3 - "${CURRENT_FILE}" "${NEW_FILE}" <<PYEOF
import json, sys
current_path, out_path = sys.argv[1], sys.argv[2]
with open(current_path) as f:
    raw = json.load(f) or {}
lifecycle = (raw.get("lifecycle") or {})
rules = lifecycle.get("rule", []) or []
# Drop any prior version of OUR rule (same matchesPrefix) so re-runs replace it.
def is_ours(r):
    cond = r.get("condition", {}) or {}
    prefixes = cond.get("matchesPrefix") or []
    return "bank-transfer-receipts/" in prefixes
kept = [r for r in rules if not is_ours(r)]
kept.append(${NEW_RULE})
out = {"lifecycle": {"rule": kept}}
with open(out_path, "w") as f:
    json.dump(out, f, indent=2)
print(f"Merged. Total rules now: {len(kept)}", file=sys.stderr)
PYEOF

# Step 4: apply.
log_step "Applying lifecycle to gs://${BUCKET}..."
gcloud storage buckets update "gs://${BUCKET}" \
    --lifecycle-file="${NEW_FILE}" \
    --quiet
log_success "Lifecycle rule applied"

# Step 5: verify by re-reading and dumping the relevant slice.
log_step "Verifying..."
gcloud storage buckets describe "gs://${BUCKET}" \
    --format='json(lifecycle)' | python3 -c "
import json, sys
data = json.load(sys.stdin) or {}
rules = (data.get('lifecycle') or {}).get('rule', []) or []
found = [r for r in rules if 'bank-transfer-receipts/' in (r.get('condition', {}).get('matchesPrefix') or [])]
if not found:
    print('[ERROR] Rule did not stick.', file=sys.stderr)
    sys.exit(1)
print('[OK]    Bank-transfer-receipts retention rule is active:')
print(json.dumps(found[0], indent=2))
"

log_success "Done. Bank transfer receipts will be auto-deleted after ${RETENTION_DAYS} days."
