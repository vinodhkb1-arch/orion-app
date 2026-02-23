# Setting up Google OAuth for ORION

Users will log in with their own Google account and provide their GCP Project ID.
BigQuery queries will be billed to **their** project, not yours.

---

## 1. Create OAuth 2.0 credentials in Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `ORION Dashboard`
5. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR-APP-URL.run.app/auth/callback
   ```
   (Use `http://localhost:8000/auth/callback` for local dev too)
6. Click **Create** — copy the **Client ID** and **Client Secret**

---

## 2. Enable the BigQuery API on YOUR project (the one hosting the data)

Users query your datasets (`cwts-leiden.openalex_2025aug`, `dashboard-488117.orion_cache`)
using their own credentials, but those datasets live in your project.
Make sure the datasets have appropriate IAM permissions — users need at minimum:

- `roles/bigquery.dataViewer` on both datasets
- `roles/bigquery.jobUser` on **their own project** (this is automatic for GCP account holders)

To grant access to all authenticated Google users on your datasets:
```
bq add-iam-policy-binding --member=allAuthenticatedUsers \
  --role=roles/bigquery.dataViewer \
  dashboard-488117:orion_cache
```
Repeat for `cwts-leiden:openalex_2025aug` if you control that project.

---

## 3. Set environment variables in Cloud Run

In Cloud Shell:
```bash
gcloud run services update orion-app \
  --region europe-west1 \
  --set-env-vars \
    OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com",\
    OAUTH_CLIENT_SECRET="your-client-secret",\
    OAUTH_REDIRECT_URI="https://YOUR-APP-URL.run.app/auth/callback",\
    SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
```

Or store them in **Secret Manager** (recommended):
```bash
echo -n "your-client-secret" | gcloud secrets create orion-oauth-secret --data-file=-
gcloud run services update orion-app --region europe-west1 \
  --set-secrets OAUTH_CLIENT_SECRET=orion-oauth-secret:latest
```

---

## 4. OAuth consent screen

1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Set User Type to **External** (or Internal if this is a Workspace org)
3. Fill in App name (`ORION`), support email, developer email
4. Under **Scopes**, add:
   - `https://www.googleapis.com/auth/bigquery`
   - `openid`, `email`, `profile`
5. Add test users while in development; publish when ready

---

## 5. Local development

Copy `.env.example` to `.env` and fill in your values.
Use `http://localhost:8000/auth/callback` as the redirect URI in both
the `.env` file and the Google Console.

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## What users see

1. They visit the app and see a login screen
2. They enter their **GCP Project ID** (e.g. `my-lab-project-123`)
3. They click **Sign in with Google** and go through Google's consent screen
4. They're redirected back to the dashboard
5. All queries run against their project — they get billed, not you
6. Their session lasts 8 hours; after that they log in again
