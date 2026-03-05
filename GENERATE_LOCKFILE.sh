#!/bin/bash
# Run this once locally after cloning, then commit package-lock.json.
# Without it, Docker cannot use npm ci and falls back to the slower npm install.
set -e
cd "$(dirname "$0")/client"
npm install
echo ""
echo "✓ package-lock.json generated. Commit it with: git add client/package-lock.json"
