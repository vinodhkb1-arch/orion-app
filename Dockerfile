# ── Stage 1: build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app/client

# Copy manifests first so Docker can cache the npm install layer.
# This layer is only invalidated when package.json or package-lock.json changes,
# not on every source file edit.
COPY client/package.json client/package-lock.json ./
RUN npm ci --prefer-offline

COPY client/ ./
RUN npm run build

# ── Stage 2: Python runtime ───────────────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Copy requirements first so pip install is cached independently of app code.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./
COPY --from=frontend-builder /app/client/build ./client/build

EXPOSE 8080
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
