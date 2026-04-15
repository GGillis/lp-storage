# ── Stage 1: build the React frontend ─────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime ────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy compiled frontend into the place main.py looks for it
COPY --from=frontend /build/dist ./static

# All persistent data (SQLite DB + cover images) lives under /data,
# which should be a named volume so it survives container updates.
ENV DATABASE_URL=sqlite:////data/records.db
ENV COVERS_DIR=/data/covers

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
