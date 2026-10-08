#!/usr/bin/env bash
# One-time, explicitly approved Google Cloud connection. Run in Google Cloud Shell.
set -euo pipefail
SYNC_PROJECT='eighth-server-511008-r7'
SYNC_ACCOUNT="zay-finds-sync@${SYNC_PROJECT}.iam.gserviceaccount.com"
SYNC_NUMBER=$(gcloud projects describe "$SYNC_PROJECT" --format='value(projectNumber)')
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project="$SYNC_PROJECT"
if ! gcloud iam workload-identity-pools describe zay-sheet-sync --location=global --project="$SYNC_PROJECT" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create zay-sheet-sync --location=global --project="$SYNC_PROJECT" --display-name='Zay Finds spreadsheet sync'
fi
if ! gcloud iam workload-identity-pools providers describe github --workload-identity-pool=zay-sheet-sync --location=global --project="$SYNC_PROJECT" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc github --workload-identity-pool=zay-sheet-sync --location=global --project="$SYNC_PROJECT" --issuer-uri='https://token.actions.githubusercontent.com' --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' --attribute-condition="assertion.repository_id == '1391557342' && assertion.repository_owner_id == '334737051' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '123isfrancis-ux/Zay-Finds-Website/.github/workflows/sync-sheet.yml@refs/heads/main' && assertion.event_name in ['schedule', 'workflow_dispatch']"
fi
SYNC_CONDITION="assertion.repository_id == '1391557342' && assertion.repository_owner_id == '334737051' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '123isfrancis-ux/Zay-Finds-Website/.github/workflows/sync-sheet.yml@refs/heads/main' && assertion.event_name in ['schedule', 'workflow_dispatch']"
SYNC_ACTUAL=$(gcloud iam workload-identity-pools providers describe github --workload-identity-pool=zay-sheet-sync --location=global --project="$SYNC_PROJECT" --format='value(attributeCondition)')
if [ "$SYNC_ACTUAL" != "$SYNC_CONDITION" ]; then
  echo 'Existing identity provider has unexpected permissions; stopped without granting access.' >&2
  exit 1
fi
gcloud iam service-accounts add-iam-policy-binding "$SYNC_ACCOUNT" --project="$SYNC_PROJECT" --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/${SYNC_NUMBER}/locations/global/workloadIdentityPools/zay-sheet-sync/attribute.repository_id/1391557342"
gcloud iam workload-identity-pools providers describe github --workload-identity-pool=zay-sheet-sync --location=global --project="$SYNC_PROJECT" --format='yaml(name,attributeCondition,attributeMapping)'
gcloud iam service-accounts get-iam-policy "$SYNC_ACCOUNT" --project="$SYNC_PROJECT" --format=json
