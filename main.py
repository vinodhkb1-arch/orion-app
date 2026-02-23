import os
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
from google.cloud import bigquery

app = FastAPI()
bq = bigquery.Client()

SOURCE = "cwts-leiden.openalex_2025aug"
CACHE  = "dashboard-488117.orion_cache"


def run_query(sql: str, params: dict) -> list[dict]:
    """
    Run a parameterised BigQuery query.
    institution_id and funder_id are INT64 in BQ — int params sent as INT64.
    All result values cast to plain Python types for JSON serialisation.
    """
    bq_params = []
    for name, value in params.items():
        if isinstance(value, int):
            bq_params.append(bigquery.ScalarQueryParameter(name, "INT64", value))
        else:
            bq_params.append(bigquery.ScalarQueryParameter(name, "STRING", value))
    job_config = bigquery.QueryJobConfig(query_parameters=bq_params)
    job = bq.query(sql, job_config=job_config, location="EU")
    result = []
    for row in job.result():
        d = {}
        for key, value in row.items():
            if value is None:
                d[key] = None
            elif hasattr(value, 'item'):
                d[key] = value.item()
            elif type(value).__name__ == 'Decimal':
                d[key] = float(value)
            elif isinstance(value, float):
                d[key] = round(value, 4)
            elif isinstance(value, int):
                d[key] = int(value)
            else:
                d[key] = value
        result.append(d)
    return result


# ── Institutions ──────────────────────────────────────────────────────────────

@app.get("/api/institutions/top")
def institutions_top(
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    sql = f"""
        SELECT
            i.institution_id, i.institution AS name,
            i.country_iso_alpha2_code AS country,
            i.thumbnail_url, i.openalex_id,
            it.institution_type AS type,
            COALESCE(SUM(wc.works_count), 0)      AS works_count,
            COALESCE(SUM(fc.fractional_count), 0) AS fractional_count
        FROM `{SOURCE}.institution` i
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        LEFT JOIN `{CACHE}.orion_works_counts` wc
            ON i.institution_id = wc.institution_id AND wc.pub_year BETWEEN @year_from AND @year_to
        LEFT JOIN `{CACHE}.orion_fractional_counts` fc
            ON i.institution_id = fc.institution_id AND fc.pub_year BETWEEN @year_from AND @year_to
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    return run_query(sql, {"limit": limit, "year_from": year_from, "year_to": year_to})


@app.get("/api/institutions/search")
def institutions_search(
    q: str = Query(default=""),
    field: str = Query(default="name"),
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    if not q.strip():
        return []
    field_map = {"name": "i.institution", "country": "i.country_iso_alpha2_code", "type": "it.institution_type"}
    col = field_map.get(field, "i.institution")
    sql = f"""
        SELECT
            i.institution_id, i.institution AS name,
            i.country_iso_alpha2_code AS country,
            i.thumbnail_url, i.openalex_id,
            it.institution_type AS type,
            COALESCE(SUM(wc.works_count), 0)      AS works_count,
            COALESCE(SUM(fc.fractional_count), 0) AS fractional_count
        FROM `{SOURCE}.institution` i
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        LEFT JOIN `{CACHE}.orion_works_counts` wc
            ON i.institution_id = wc.institution_id AND wc.pub_year BETWEEN @year_from AND @year_to
        LEFT JOIN `{CACHE}.orion_fractional_counts` fc
            ON i.institution_id = fc.institution_id AND fc.pub_year BETWEEN @year_from AND @year_to
        WHERE LOWER({col}) LIKE @pattern
        GROUP BY 1,2,3,4,5,6
        ORDER BY works_count DESC
        LIMIT @limit
    """
    return run_query(sql, {"pattern": f"%{q.lower()}%", "limit": limit, "year_from": year_from, "year_to": year_to})


@app.get("/api/institutions/{institution_id}/trends")
def institution_trends(institution_id: int):
    sql = f"""
        SELECT wc.pub_year AS year, wc.works_count,
               COALESCE(fc.fractional_count, 0) AS fractional_count
        FROM `{CACHE}.orion_works_counts` wc
        LEFT JOIN `{CACHE}.orion_fractional_counts` fc
            ON wc.institution_id = fc.institution_id AND wc.pub_year = fc.pub_year
        WHERE wc.institution_id = @id
        ORDER BY year
    """
    return run_query(sql, {"id": institution_id})


# ── Funders ───────────────────────────────────────────────────────────────────

@app.get("/api/funders/top")
def funders_top(
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
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
    return run_query(sql, {"limit": limit, "year_from": year_from, "year_to": year_to})


@app.get("/api/funders/search")
def funders_search(
    q: str = Query(default=""),
    field: str = Query(default="name"),
    limit: int = Query(default=1000, ge=1, le=5000),
    year_from: int = Query(default=2000),
    year_to: int = Query(default=2025),
):
    if not q.strip():
        return []
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
    return run_query(sql, {"pattern": f"%{q.lower()}%", "limit": limit, "year_from": year_from, "year_to": year_to})


@app.get("/api/funders/{funder_id}/trends")
def funder_trends(funder_id: int):
    sql = f"""
        SELECT w.pub_year AS year, COUNT(DISTINCT wg.work_id) AS works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id = @id
        GROUP BY year ORDER BY year
    """
    return run_query(sql, {"id": funder_id})


# ── Institution Basket ────────────────────────────────────────────────────────

class InstBasketRequest(BaseModel):
    institution_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 50


@app.post("/api/basket/institutions/analyze")
def basket_institutions_analyze(req: InstBasketRequest):
    if not req.institution_ids:
        return {"total_works": 0, "total_fractional": 0.0, "funders": [], "collaborators": []}
    ids = ", ".join(str(i) for i in req.institution_ids)
    yf, yt, lim = req.year_from, req.year_to, req.limit

    total_works = run_query(f"""
        SELECT COUNT(DISTINCT wai.work_id) AS total_works
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        WHERE wai.institution_id IN ({ids}) AND w.pub_year BETWEEN {yf} AND {yt}
    """, {})

    total_frac = run_query(f"""
        SELECT COALESCE(SUM(fractional_count), 0) AS total_fractional
        FROM `{CACHE}.orion_fractional_counts`
        WHERE institution_id IN ({ids}) AND pub_year BETWEEN {yf} AND {yt}
    """, {})

    funders = run_query(f"""
        SELECT f.funder_id, f.funder AS name, f.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wg.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.work_grant` wg ON w.work_id = wg.work_id
        JOIN `{SOURCE}.funder` f ON wg.funder_id = f.funder_id
        WHERE wai.institution_id IN ({ids}) AND w.pub_year BETWEEN {yf} AND {yt}
        GROUP BY f.funder_id, f.funder, f.country_iso_alpha2_code
        ORDER BY works_count DESC LIMIT {lim}
    """, {})

    collaborators = run_query(f"""
        SELECT i.institution_id, i.institution AS name, i.country_iso_alpha2_code AS country,
               COUNT(DISTINCT wai2.work_id) AS works_count
        FROM `{SOURCE}.work_affiliation_institution` wai
        JOIN `{SOURCE}.work` w ON wai.work_id = w.work_id
        JOIN `{SOURCE}.work_affiliation_institution` wai2
            ON wai.work_id = wai2.work_id AND wai2.institution_id NOT IN ({ids})
        JOIN `{SOURCE}.institution` i ON wai2.institution_id = i.institution_id
        WHERE wai.institution_id IN ({ids}) AND w.pub_year BETWEEN {yf} AND {yt}
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code
        ORDER BY works_count DESC LIMIT {lim}
    """, {})

    return {
        "total_works": total_works[0]["total_works"] if total_works else 0,
        "total_fractional": round(float(total_frac[0]["total_fractional"]) if total_frac else 0, 1),
        "funders": funders,
        "collaborators": collaborators,
    }


# ── Funder Basket ─────────────────────────────────────────────────────────────

class FunderBasketRequest(BaseModel):
    funder_ids: List[int]
    year_from: int = 2000
    year_to: int = 2025
    limit: int = 50


@app.post("/api/basket/funders/analyze")
def basket_funders_analyze(req: FunderBasketRequest):
    if not req.funder_ids:
        return {"total_works": 0, "institutions": []}
    ids = ", ".join(str(i) for i in req.funder_ids)
    yf, yt, lim = req.year_from, req.year_to, req.limit

    total_works = run_query(f"""
        SELECT COUNT(DISTINCT wg.work_id) AS total_works
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        WHERE wg.funder_id IN ({ids}) AND w.pub_year BETWEEN {yf} AND {yt}
    """, {})

    institutions = run_query(f"""
        SELECT i.institution_id, i.institution AS name, i.country_iso_alpha2_code AS country,
               it.institution_type AS type, COUNT(DISTINCT wai.work_id) AS works_count
        FROM `{SOURCE}.work_grant` wg
        JOIN `{SOURCE}.work` w ON wg.work_id = w.work_id
        JOIN `{SOURCE}.work_affiliation_institution` wai ON w.work_id = wai.work_id
        JOIN `{SOURCE}.institution` i ON wai.institution_id = i.institution_id
        LEFT JOIN `{SOURCE}.institution_type` it ON i.institution_type_id = it.institution_type_id
        WHERE wg.funder_id IN ({ids}) AND w.pub_year BETWEEN {yf} AND {yt}
        GROUP BY i.institution_id, i.institution, i.country_iso_alpha2_code, it.institution_type
        ORDER BY works_count DESC LIMIT {lim}
    """, {})

    return {
        "total_works": total_works[0]["total_works"] if total_works else 0,
        "institutions": institutions,
    }


# ── Frontend ──────────────────────────────────────────────────────────────────

BUILD_DIR = os.path.join(os.path.dirname(__file__), "client", "build")
if os.path.exists(BUILD_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "static")), name="static")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(os.path.join(BUILD_DIR, "index.html"))
