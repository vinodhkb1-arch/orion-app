#!/bin/bash
set -e

# ── ORION Dashboard — Deploy ──────────────────────────────────────────────────
# Run from Cloud Shell inside the orion-app directory:
#   git pull && bash DEPLOY.sh
# ──────────────────────────────────────────────────────────────────────────────

PROJECT_ID="dashboard-488117"
REGION="europe-west1"

gcloud config set project $PROJECT_ID

echo "=== Building and deploying from current directory ==="
gcloud builds submit . \
  --config=cloudbuild.yaml \
  --project=$PROJECT_ID

echo ""
echo "🚀 Deployed URL:"
gcloud run services describe orion-app --region $REGION --format 'value(status.url)'
