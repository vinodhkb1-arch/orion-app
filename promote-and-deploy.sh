#!/bin/bash
set -e

# ── ORION Dashboard — Promote dev to main and deploy to production ────────────
# Usage (from Cloud Shell):
#
#   bash promote-and-deploy.sh
#
# What this does:
#   1. Resets main to exactly match origin/dev (no merges, no leftover files)
#   2. Force-pushes main to GitHub so it reflects what's in production
#   3. Deploys to the production Cloud Run service (orion-app)
# ──────────────────────────────────────────────────────────────────────────────

echo "🔄 Fetching latest from GitHub..."
git fetch

echo "📌 Resetting main to match origin/dev..."
git checkout main
git reset --hard origin/dev
git push --force origin main

echo ""
echo "🚀 Deploying to production..."
bash DEPLOY.sh
