# Instructions for Claude

## How this project works

This is the ORION Research Dashboard — a React + Python (FastAPI) app deployed on Google Cloud Run via Cloud Build.

**Repo:** https://github.com/jpbascur/orion-app  
**Owner:** Juan Pablo Bascur

---

## ⚠️ Golden rules — read before doing anything

### 1. Always deliver a full `app.zip`
The user's workflow is:
1. Upload `app.zip` to Claude
2. Claude makes changes
3. Claude returns a new `app.zip` with the **full project structure intact**

**Never** deliver individual files. **Never** deliver a zip of only the changed files.  
The zip must always contain the full `app/` directory, structured exactly as received.

The correct zip command is:
```bash
cd /home/claude && zip -r /mnt/user-data/outputs/app.zip app \
  --exclude "app/.cache/*" \
  --exclude "app/.git/*" \
  --exclude "app/client/node_modules/*"
```

### 2. Never suggest workflow changes mid-task
Don't suggest committing files manually, uploading via Cloud Shell, or any other approach that deviates from the zip-in / zip-out workflow. If there's a problem with a file (e.g. missing `package-lock.json`), fix it within the zip — don't ask the user to do extra steps.

### 3. `package-lock.json` does not currently exist in this repo
To add it: run `npm install` locally in `client/`, then commit `package-lock.json` to the repo. Only after it is committed should the Dockerfile be updated to copy it and use `npm ci`. Do not ask the user to generate it in Cloud Shell or any remote environment.

---

## Project structure

```
app/
├── main.py                  # FastAPI backend
├── requirements.txt
├── Dockerfile
├── cloudbuild.yaml          # Production Cloud Build config
├── cloudbuild.dev.yaml      # Dev Cloud Build config
├── DEPLOY.sh                # Deploy script (bash DEPLOY.sh --dev)
├── GENERATE_LOCKFILE.sh
└── client/                  # React frontend
    ├── package.json
    ├── public/
    └── src/
        ├── App.js
        ├── api.js
        ├── index.css
        └── pages/
            ├── Overview.js
            ├── Institutions.js
            ├── Funders.js
            ├── EntityList.js      # Shared search/list component
            ├── BasketPage.js      # Shared basket component
            ├── InstBasket.js
            ├── FunderBasket.js
            ├── BasketShared.js    # Shared basket utilities + SQL builders
            ├── useBasket.js       # Basket state hook
            ├── useTable.js        # Table sort/pagination hook
            ├── Guide.js
            ├── LoginGate.js
            ├── ErrorPage.js
            └── queryBuilders.js
```

## Deployment

The user deploys from Google Cloud Shell:
```bash
git checkout dev && git pull && bash DEPLOY.sh --dev
```

Cloud Build uses Kaniko for layer caching. The `cloudbuild.yaml` uses a pinned Kaniko version and explicit `--cache-repo` for reliable caching between builds.
