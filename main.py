# ORION Research Dashboard — v0.1.0
# https://github.com/jpbascur/orion-app
#
# Copyright (c) 2025 Juan Pablo Bascur Cifuentes
# Released under the MIT License — see LICENSE for details.
#
# Data: CWTS OpenAlex 2025 snapshot via the ORION initiative (https://orion-dbs.community)
# Network visualisation: VOSviewer Online (Van Eck & Waltman, CWTS Leiden)

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

    Raises HTTPException with a user-friendly message for common permission
    errors (missing BigQuery Job User role, API not enabled, etc.).
    """
    from google.api_core.exceptions import Forbidden, PermissionDenied, ServiceUnavailable
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
    try:
        job = bq.query(sql, job_config=job_config, location="EU")
        rows_iter = job.result()
    except (Forbidden, PermissionDenied) as e:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Permission denied on project '{project_id}'. "
                "Please grant the ORION service account "
                "(112226578999-compute@developer.gserviceaccount.com) "
                "the 'BigQuery Job User' role in your GCP project IAM settings, "
                "and make sure the BigQuery API is enabled. "
                f"Details: {str(e)[:200]}"
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)[:300]}")
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
    limit: int = Query(default=5000, ge=1, le=50000),
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
    limit: int = Query(default=5000, ge=1, le=50000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    if not q.strip():
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
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
    limit: int = Query(default=5000, ge=1, le=50000),
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
    limit: int = Query(default=5000, ge=1, le=50000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    session = require_auth(request)
    if not q.strip():
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
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
    limit: int = 5000

@app.post("/api/basket/institutions/works")
def basket_inst_works(req: InstBasketRequest, request: Request):
    """Total distinct works for a basket of institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"total_works": 0, "bytes_processed": 0}, CACHE_OFF)
    yf, yt, ids = req.year_from, req.year_to, req.institution_ids
    rows, bp = run_query(f"""
        SELECT COUNT(DISTINCT wai.work_id) AS total_works
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)
    return cached({"total_works": rows[0]["total_works"] if rows else 0, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/institutions/co-institutions")
def basket_inst_co_institutions(req: InstBasketRequest, request: Request):
    """Institutions that co-occur (at work level) with the basket institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.institution_ids
    rows, bp = run_query(f"""
        SELECT i.institution_id, i.institution AS name,
               i.country_iso_alpha2_code AS country,
               it.institution_type AS type,
               COUNT(DISTINCT wai2.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.work_affiliation_institution` wai2
            ON wai.work_id = wai2.work_id
           AND wai2.institution_id NOT IN UNNEST(@ids)
        JOIN `{SOURCE}.institution` i ON wai2.institution_id = i.institution_id
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        WHERE wai.institution_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/institutions/co-funders")
def basket_inst_co_funders(req: InstBasketRequest, request: Request):
    """Funders that co-occur (at work level) with the basket institutions."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.institution_ids
    rows, bp = run_query(f"""
        SELECT f.funder_id, f.funder AS name,
               f.country_iso_alpha2_code AS country,
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
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

# ── Funder Basket ─────────────────────────────────────────────────────────────

class FunderBasketRequest(BaseModel):
    funder_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 5000

@app.post("/api/basket/funders/works")
def basket_funder_works(req: FunderBasketRequest, request: Request):
    """Total distinct works funded by the basket funders."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"total_works": 0, "bytes_processed": 0}, CACHE_OFF)
    yf, yt, ids = req.year_from, req.year_to, req.funder_ids
    rows, bp = run_query(f"""
        SELECT COUNT(DISTINCT wg.work_id) AS total_works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
    """, {"ids": ids, "year_from": yf, "year_to": yt}, pid)
    return cached({"total_works": rows[0]["total_works"] if rows else 0, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/funders/co-institutions")
def basket_funder_co_institutions(req: FunderBasketRequest, request: Request):
    """Institutions that co-occur (at work level) with the basket funders."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.funder_ids
    rows, bp = run_query(f"""
        SELECT i.institution_id, i.institution AS name,
               i.country_iso_alpha2_code AS country,
               it.institution_type AS type,
               COUNT(DISTINCT wai.work_id) AS works_count
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
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

@app.post("/api/basket/funders/co-funders")
def basket_funder_co_funders(req: FunderBasketRequest, request: Request):
    """Funders that co-occur (at work level) with the basket funders."""
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        return cached({"rows": [], "bytes_processed": 0}, CACHE_OFF)
    yf, yt, lim, ids = req.year_from, req.year_to, req.limit, req.funder_ids
    rows, bp = run_query(f"""
        SELECT f.funder_id, f.funder AS name,
               f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg2.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.work_grant` wg2
            ON wg.work_id = wg2.work_id
           AND wg2.funder_id NOT IN UNNEST(@ids)
        JOIN `{SOURCE}.funder` f ON wg2.funder_id = f.funder_id
        WHERE wg.funder_id IN UNNEST(@ids)
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)
    return cached({"rows": rows, "bytes_processed": bp}, CACHE_OFF)

# ── VOSviewer network export ──────────────────────────────────────────────────
# Networks are expensive to recompute and need to be accessible by VOSviewer
# Online (an external service) without auth cookies. We generate the network
# once on demand, store it in memory under a short-lived one-time token, and
# expose it via a public /api/vos/<token> endpoint that VOSviewer can fetch.

import secrets
import threading

_vos_store: dict[str, dict] = {}
_vos_lock = threading.Lock()

def _store_vos(data: dict) -> str:
    """Store network data and return a one-time token (valid 10 min)."""
    token = secrets.token_urlsafe(24)
    with _vos_lock:
        _vos_store[token] = {"data": data, "expires": time.time() + 600}
        # Prune expired tokens while we have the lock
        expired = [k for k, v in _vos_store.items() if v["expires"] < time.time()]
        for k in expired:
            del _vos_store[k]
    return token

@app.get("/api/vos/{token}")
def vos_serve(token: str):
    """Serve a pre-built VOSviewer JSON to VOSviewer Online (no auth required)."""
    with _vos_lock:
        entry = _vos_store.pop(token, None)
    if not entry or entry["expires"] < time.time():
        raise HTTPException(status_code=404, detail="Token not found or expired")
    return JSONResponse(
        content=entry["data"],
        headers={
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "https://app.vosviewer.com",
        },
    )

class VosInstRequest(BaseModel):
    institution_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 100
    all_works: bool = False  # False = basket works only; True = all works among map nodes

@app.post("/api/vos/build/institutions")
def vos_build_institutions(req: VosInstRequest, request: Request):
    """Build a VOSviewer co-occurrence network for a basket of institutions.

    Nodes = basket institutions + their top co-occurring institutions (up to limit).
    Node size = number of works (within the selected works pool).
    Edge strength = number of shared works between each pair (within the selected works pool).

    Works pool:
      all_works=False (default): only works involving at least one basket institution.
      all_works=True: all works involving any institution in the node set, regardless of basket.
    """
    session = require_auth(request)
    pid = session["project_id"]
    if not req.institution_ids:
        raise HTTPException(status_code=400, detail="No institution IDs provided")

    ids = req.institution_ids
    yf, yt, lim = req.year_from, req.year_to, req.limit

    # Step 1: Identify node set — always based on basket works (determines who's in the map).
    node_rows, _ = run_query(f"""
        SELECT i.institution_id AS id, i.institution AS label,
               i.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.institution` i ON wai.institution_id = i.institution_id
        WHERE w.work_id IN (
            SELECT DISTINCT work_id
            FROM `{SOURCE}.work_affiliation_institution`
            WHERE institution_id IN UNNEST(@ids)
        )
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code
        ORDER BY works_count DESC
        LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)

    node_ids = [r["id"] for r in node_rows]
    if len(node_ids) < 2:
        raise HTTPException(status_code=400, detail="Not enough co-occurring institutions to build a network")

    # Step 2: If all_works=True, recalculate node sizes using the full works pool
    # (all works of the map institutions, not just basket works).
    if req.all_works:
        size_rows, _ = run_query(f"""
            SELECT wai.institution_id AS id,
                   COUNT(DISTINCT wai.work_id) AS works_count
            FROM `{SOURCE}.work_affiliation_institution` wai
            JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
            WHERE wai.institution_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY wai.institution_id
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
        size_map = {r["id"]: r["works_count"] for r in size_rows}
        for r in node_rows:
            r["works_count"] = size_map.get(r["id"], r["works_count"])

    # Step 3: Compute edge weights within the selected works pool.
    if req.all_works:
        # All works shared between any two map institutions.
        edge_rows, _ = run_query(f"""
            SELECT wai1.institution_id AS source_id,
                   wai2.institution_id AS target_id,
                   COUNT(DISTINCT wai1.work_id) AS strength
            FROM `{SOURCE}.work_affiliation_institution` wai1
            JOIN `{SOURCE}.work_affiliation_institution` wai2
                ON wai1.work_id = wai2.work_id
               AND wai1.institution_id < wai2.institution_id
            JOIN `{SOURCE}.work` w ON wai1.work_id = w.work_id
            WHERE wai1.institution_id IN UNNEST(@node_ids)
              AND wai2.institution_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
    else:
        # Only works that involve at least one basket institution.
        edge_rows, _ = run_query(f"""
            SELECT wai1.institution_id AS source_id,
                   wai2.institution_id AS target_id,
                   COUNT(DISTINCT wai1.work_id) AS strength
            FROM `{SOURCE}.work_affiliation_institution` wai1
            JOIN `{SOURCE}.work_affiliation_institution` wai2
                ON wai1.work_id = wai2.work_id
               AND wai1.institution_id < wai2.institution_id
            JOIN `{SOURCE}.work` w ON wai1.work_id = w.work_id
            WHERE wai1.institution_id IN UNNEST(@node_ids)
              AND wai2.institution_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
              AND w.work_id IN (
                  SELECT DISTINCT work_id
                  FROM `{SOURCE}.work_affiliation_institution`
                  WHERE institution_id IN UNNEST(@ids)
              )
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "ids": ids, "year_from": yf, "year_to": yt}, pid)

    works_label = "all works among map institutions" if req.all_works else "works involving basket institutions"
    basket_set = set(ids)
    items = [
        {
            "id": r["id"],
            "label": r["label"],
            "description": r.get("country") or "",
            "weights": {"Works": r["works_count"]},
            **({"cluster": 1} if r["id"] in basket_set else {"cluster": 2}),
        }
        for r in node_rows
    ]
    links = [
        {"source_id": r["source_id"], "target_id": r["target_id"], "strength": r["strength"]}
        for r in edge_rows
    ]
    vos_json = {
        "network": {"items": items, "links": links},
        "config": {
            "terminology": {"item": "institution", "items": "institutions", "link_strength": "co-occurring works"},
            "parameters": {"item_size": 2, "largest_component": True},
        },
        "info": {
            "title": f"Institution co-occurrence network ({yf}–{yt})",
            "description": (
                f"Nodes: basket institutions (cluster 1, {len(ids)}) + top co-occurring institutions (cluster 2). "
                f"Node size and edge strength based on {works_label}. "
                f"Year range: {yf}–{yt}."
            ),
        },
    }
    token = _store_vos(vos_json)
    return JSONResponse({"token": token})


class VosFunderRequest(BaseModel):
    funder_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 100
    all_works: bool = False  # False = basket works only; True = all works among map nodes

@app.post("/api/vos/build/funders")
def vos_build_funders(req: VosFunderRequest, request: Request):
    """Build a VOSviewer co-occurrence network for a basket of funders.

    Nodes = basket funders + their top co-occurring funders (up to limit).
    Node size = number of works (within the selected works pool).
    Edge strength = number of shared works between each pair (within the selected works pool).

    Works pool:
      all_works=False (default): only works involving at least one basket funder.
      all_works=True: all works involving any funder in the node set, regardless of basket.
    """
    session = require_auth(request)
    pid = session["project_id"]
    if not req.funder_ids:
        raise HTTPException(status_code=400, detail="No funder IDs provided")

    ids = req.funder_ids
    yf, yt, lim = req.year_from, req.year_to, req.limit

    # Step 1: Identify node set — always based on basket works.
    node_rows, _ = run_query(f"""
        SELECT f.funder_id AS id, f.funder AS label,
               f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.funder` f ON wg.funder_id = f.funder_id
        WHERE w.work_id IN (
            SELECT DISTINCT work_id FROM `{SOURCE}.work_grant`
            WHERE funder_id IN UNNEST(@ids)
        )
          AND w.pub_year BETWEEN @year_from AND @year_to
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC
        LIMIT @limit
    """, {"ids": ids, "year_from": yf, "year_to": yt, "limit": lim}, pid)

    node_ids = [r["id"] for r in node_rows]
    if len(node_ids) < 2:
        raise HTTPException(status_code=400, detail="Not enough co-occurring funders to build a network")

    # Step 2: If all_works=True, recalculate node sizes using the full works pool.
    if req.all_works:
        size_rows, _ = run_query(f"""
            SELECT wg.funder_id AS id,
                   COUNT(DISTINCT wg.work_id) AS works_count
            FROM `{SOURCE}.work_grant` wg
            JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
            WHERE wg.funder_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY wg.funder_id
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
        size_map = {r["id"]: r["works_count"] for r in size_rows}
        for r in node_rows:
            r["works_count"] = size_map.get(r["id"], r["works_count"])

    # Step 3: Compute edge weights within the selected works pool.
    if req.all_works:
        edge_rows, _ = run_query(f"""
            SELECT wg1.funder_id AS source_id,
                   wg2.funder_id AS target_id,
                   COUNT(DISTINCT wg1.work_id) AS strength
            FROM `{SOURCE}.work_grant` wg1
            JOIN `{SOURCE}.work_grant` wg2
                ON wg1.work_id = wg2.work_id
               AND wg1.funder_id < wg2.funder_id
            JOIN `{SOURCE}.work` w ON wg1.work_id = w.work_id
            WHERE wg1.funder_id IN UNNEST(@node_ids)
              AND wg2.funder_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "year_from": yf, "year_to": yt}, pid)
    else:
        edge_rows, _ = run_query(f"""
            SELECT wg1.funder_id AS source_id,
                   wg2.funder_id AS target_id,
                   COUNT(DISTINCT wg1.work_id) AS strength
            FROM `{SOURCE}.work_grant` wg1
            JOIN `{SOURCE}.work_grant` wg2
                ON wg1.work_id = wg2.work_id
               AND wg1.funder_id < wg2.funder_id
            JOIN `{SOURCE}.work` w ON wg1.work_id = w.work_id
            WHERE wg1.funder_id IN UNNEST(@node_ids)
              AND wg2.funder_id IN UNNEST(@node_ids)
              AND w.pub_year BETWEEN @year_from AND @year_to
              AND w.work_id IN (
                  SELECT DISTINCT work_id FROM `{SOURCE}.work_grant`
                  WHERE funder_id IN UNNEST(@ids)
              )
            GROUP BY source_id, target_id
            HAVING strength > 0
        """, {"node_ids": node_ids, "ids": ids, "year_from": yf, "year_to": yt}, pid)

    works_label = "all works among map funders" if req.all_works else "works involving basket funders"
    basket_set = set(ids)
    items = [
        {
            "id": r["id"],
            "label": r["label"],
            "description": r.get("country") or "",
            "weights": {"Works": r["works_count"]},
            **({"cluster": 1} if r["id"] in basket_set else {"cluster": 2}),
        }
        for r in node_rows
    ]
    links = [
        {"source_id": r["source_id"], "target_id": r["target_id"], "strength": r["strength"]}
        for r in edge_rows
    ]
    vos_json = {
        "network": {"items": items, "links": links},
        "config": {
            "terminology": {"item": "funder", "items": "funders", "link_strength": "co-funded works"},
            "parameters": {"item_size": 2, "largest_component": True},
        },
        "info": {
            "title": f"Funder co-occurrence network ({yf}–{yt})",
            "description": (
                f"Nodes: basket funders (cluster 1, {len(ids)}) + top co-occurring funders (cluster 2). "
                f"Node size and edge strength based on {works_label}. "
                f"Year range: {yf}–{yt}."
            ),
        },
    }
    token = _store_vos(vos_json)
    return JSONResponse({"token": token})


# ── Frontend ──────────────────────────────────────────────────────────────────

BUILD_DIR = os.path.join(os.path.dirname(__file__), "client", "build")
if os.path.exists(BUILD_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "static")), name="static")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
