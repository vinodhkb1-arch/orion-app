import os
import json
import time
import hashlib
import hmac
import base64

from fastapi import FastAPI, Query, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List

import httpx

from google.cloud import bigquery
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

OAUTH_CLIENT_ID     = os.environ["OAUTH_CLIENT_ID"]
OAUTH_CLIENT_SECRET = os.environ["OAUTH_CLIENT_SECRET"]
OAUTH_REDIRECT_URI  = os.environ["OAUTH_REDIRECT_URI"]
SESSION_SECRET      = os.environ["SESSION_SECRET"]

SOURCE   = "cwts-leiden.openalex_2025aug"

# Identity only — no BigQuery scope needed from the user
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

CACHE_1H  = "public, max-age=3600"
CACHE_OFF = "no-store"

app = FastAPI()

# ── Session helpers ───────────────────────────────────────────────────────────

def _sign(data: str) -> str:
    sig = hmac.new(SESSION_SECRET.encode(), data.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode()

def encode_session(payload: dict) -> str:
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"{body}.{_sign(body)}"

def decode_session(cookie: str) -> dict | None:
    try:
        body, sig = cookie.rsplit(".", 1)
        if not hmac.compare_digest(sig, _sign(body)):
            return None
        return json.loads(base64.urlsafe_b64decode(body).decode())
    except Exception:
        return None

def get_session(request: Request) -> dict:
    raw = request.cookies.get("orion_session")
    if not raw:
        return {}
    return decode_session(raw) or {}

def set_session(response, payload: dict):
    response.set_cookie(
        "orion_session",
        encode_session(payload),
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 8,
    )

# ── OAuth ─────────────────────────────────────────────────────────────────────

def make_flow(state: str | None = None) -> Flow:
    client_config = {
        "web": {
            "client_id": OAUTH_CLIENT_ID,
            "client_secret": OAUTH_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [OAUTH_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = OAUTH_REDIRECT_URI
    return flow

def require_auth(request: Request) -> dict:
    """Returns session or raises 401."""
    session = get_session(request)
    if not session.get("email"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not session.get("project_id"):
        raise HTTPException(status_code=401, detail="No GCP project configured")
    return session

# ── BigQuery ──────────────────────────────────────────────────────────────────
# Queries use the Cloud Run service account to READ the (public) data,
# but are billed to the user's own GCP project_id stored in their session.

def get_bq(project_id: str) -> bigquery.Client:
    """Return a BQ client that bills jobs to the user's project."""
    return bigquery.Client(project=project_id)

def run_query(sql: str, params: dict, project_id: str) -> tuple[list[dict], int]:
    """Execute a parameterised BigQuery query.

    Returns a tuple of (rows, bytes_processed) where bytes_processed is the
    total bytes billed for the job (useful for surfacing cost info to users).
    """
    bq = get_bq(project_id)
    bq_params = []
    for name, value in params.items():
        if isinstance(value, list):
            bq_params.append(bigquery.ArrayQueryParameter(name, "INT64", value))
        elif isinstance(value, int):
            bq_params.append(bigquery.ScalarQueryParameter(name, "INT64", value))
        else:
            bq_params.append(bigquery.ScalarQueryParameter(name, "STRING", value))
    job_config = bigquery.QueryJobConfig(query_parameters=bq_params)
    job = bq.query(sql, job_config=job_config, location="EU")
    rows_iter = job.result()
    result = []
    for row in rows_iter:
        d = {}
        for key, value in row.items():
            if value is None:
                d[key] = None
            elif hasattr(value, "item"):
                d[key] = value.item()
            elif type(value).__name__ == "Decimal":
                d[key] = float(value)
            elif isinstance(value, float):
                d[key] = round(value, 4)
            elif isinstance(value, int):
                d[key] = int(value)
            else:
                d[key] = value
        result.append(d)
    bytes_processed = job.total_bytes_processed or 0
    return result, bytes_processed

def cached(data, max_age: str = CACHE_1H):
    return JSONResponse(content=data, headers={"Cache-Control": max_age})

# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.get("/auth/login")
def auth_login(project_id: str = Query(...)):
    # Encode project_id into the state parameter so no extra cookie is needed.
    # state = base64(project_id) + "." + hmac_signature
    state_payload = encode_session({"project_id": project_id})
    flow = make_flow(state=state_payload)
    auth_url, _ = flow.authorization_url(
        access_type="online",
        include_granted_scopes="true",
    )
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
def auth_callback(request: Request, code: str = Query(...), state: str = Query(...)):
    # Decode and verify project_id from state
    payload = decode_session(state)
    if not payload or "project_id" not in payload:
        return RedirectResponse("/?error=oauth_failed")

    flow = make_flow(state=state)
    try:
        flow.fetch_token(code=code)
    except Exception:
        return RedirectResponse("/?error=token_exchange_failed")

    try:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {flow.credentials.token}"},
        )
        resp.raise_for_status()
        user = resp.json()
    except Exception:
        return RedirectResponse("/?error=userinfo_failed")

    session = {
        "email":      user.get("email", ""),
        "name":       user.get("name", ""),
        "project_id": payload["project_id"],
    }

    response = RedirectResponse("/")
    set_session(response, session)
    return response

@app.get("/auth/logout")
def auth_logout():
    response = RedirectResponse("/")
    response.delete_cookie("orion_session")
    return response

@app.get("/auth/me")
def auth_me(request: Request):
    session = get_session(request)
    if not session.get("email"):
        return JSONResponse({"authenticated": False})
    return JSONResponse({
        "authenticated": True,
        "email":      session.get("email"),
        "name":       session.get("name"),
        "project_id": session.get("project_id"),
    })

# ── Institutions ──────────────────────────────────────────────────────────────

@app.get("/api/institutions/top")
def institutions_top(
    request: Request,
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    sql = f"""
        SELECT
            i.institution_id, i.institution AS name,
            i.country_iso_alpha2_code AS country,
            i.thumbnail_url, i.openalex_id,
            it.institution_type AS type,
            COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.institution` i
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        LEFT JOIN `{SOURCE}.work_affiliation_institution` wai ON i.institution_id = wai.institution_id
        LEFT JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/institutions/search")
def institutions_search(
    request: Request,
    q: str = Query(default=""),
    field: str = Query(default="name"),
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    if not q.strip():
        return cached({"rows": [], "bytes_processed": 0})
    field_map = {"name": "i.institution", "country": "i.country_iso_alpha2_code", "type": "it.institution_type"}
    col = field_map.get(field, "i.institution")
    sql = f"""
        SELECT
            i.institution_id, i.institution AS name,
            i.country_iso_alpha2_code AS country,
            i.thumbnail_url, i.openalex_id,
            it.institution_type AS type,
            COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.institution` i
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        LEFT JOIN `{SOURCE}.work_affiliation_institution` wai ON i.institution_id = wai.institution_id
        LEFT JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        WHERE LOWER({col}) LIKE @pattern
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"pattern": f"%{q.lower()}%", "limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/institutions/{institution_id}/trends")
def institution_trends(request: Request, institution_id: int):
    """Return year-by-year works count for one institution."""
    session = require_auth(request)
    sql = f"""
        SELECT w.pub_year AS year, COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        -- To re-enable fractional counts, join orion_fractional_counts here
        WHERE wai.institution_id = @id
        GROUP BY year
        ORDER BY year
    """
    rows, bp = run_query(sql, {"id": institution_id}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

# ── Funders ───────────────────────────────────────────────────────────────────

@app.get("/api/funders/top")
def funders_top(
    request: Request,
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    sql = f"""
        SELECT f.funder_id, f.funder AS name, f.country_iso_alpha2_code AS country,
               f.description, f.thumbnail_url, f.openalex_id,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.funder` f
        LEFT JOIN `{SOURCE}.work_grant` wg ON f.funder_id = wg.funder_id
        LEFT JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/funders/search")
def funders_search(
    request: Request,
    q: str = Query(default=""),
    field: str = Query(default="name"),
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    if not q.strip():
        return cached({"rows": [], "bytes_processed": 0})
    field_map = {"name": "f.funder", "country": "f.country_iso_alpha2_code", "description": "f.description"}
    col = field_map.get(field, "f.funder")
    sql = f"""
        SELECT f.funder_id, f.funder AS name, f.country_iso_alpha2_code AS country,
               f.description, f.thumbnail_url, f.openalex_id,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.funder` f
        LEFT JOIN `{SOURCE}.work_grant` wg ON f.funder_id = wg.funder_id
        LEFT JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            AND w.pub_year BETWEEN @year_from AND @year_to
        WHERE LOWER({col}) LIKE @pattern
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    rows, bp = run_query(sql, {"pattern": f"%{q.lower()}%", "limit": limit, "year_from": year_from, "year_to": year_to}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

@app.get("/api/funders/{funder_id}/trends")
def funder_trends(request: Request, funder_id: int):
    """Return year-by-year funded work counts for one funder."""
    session = require_auth(request)
    sql = f"""
        SELECT w.pub_year AS year, COUNT(DISTINCT wg.work_id) AS works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id = @id
        GROUP BY year ORDER BY year
    """
    rows, bp = run_query(sql, {"id": funder_id}, session["project_id"])
    return cached({"rows": rows, "bytes_processed": bp})

# ── Institution Basket ────────────────────────────────────────────────────────

class InstBasketRequest(BaseModel):
    institution_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 50

@app.post("/api/basket/institutions/analyze")
def basket_institutions_analyze(req: InstBasketRequest, request: Request):
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"total_works": 0, "funders": []}, CACHE_OFF)

    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.institution_ids

    total_works_rows, bp1 = run_query(f"""
        SELECT COUNT(DISTINCT wai.work_id) AS total_works
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)

    funders, bp2 = run_query(f"""
        SELECT f.funder_id, f.funder AS name, f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.work_grant` wg ON w.work_id = wg.work_id
        JOIN `{SOURCE}.funder` f ON wg.funder_id = f.funder_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)

    return cached({
        "total_works": total_works_rows[0]["total_works"] if total_works_rows else 0,
        "funders": funders,
        "bytes_processed": bp1 + bp2,
    }, CACHE_OFF)

# ── Funder Basket ─────────────────────────────────────────────────────────────

class FunderBasketRequest(BaseModel):
    funder_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 50

@app.post("/api/basket/funders/analyze")
def basket_funders_analyze(req: FunderBasketRequest, request: Request):
    """Analyze a basket of funders: total funded works and top institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"total_works": 0, "institutions": [], "bytes_processed": 0}, CACHE_OFF)

    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.funder_ids

    total_works_rows, bp1 = run_query(f"""
        SELECT COUNT(DISTINCT wg.work_id) AS total_works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)

    institutions, bp2 = run_query(f"""
        SELECT i.institution_id, i.institution AS name, i.country_iso_alpha2_code AS country,
               it.institution_type AS type, COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.work_affiliation_institution` wai ON w.work_id = wai.work_id
        JOIN `{SOURCE}.institution` i ON wai.institution_id = i.institution_id
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)

    return cached({
        "total_works": total_works_rows[0]["total_works"] if total_works_rows else 0,
        "institutions": institutions,
        "bytes_processed": bp1 + bp2,
    }, CACHE_OFF)

# ── Frontend ──────────────────────────────────────────────────────────────────

BUILD_DIR = os.path.join(os.path.dirname(__file__), "client", "build")
if os.path.exists(BUILD_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "static")), name="static")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
