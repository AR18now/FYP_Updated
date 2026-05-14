# Multi-stage Dockerfile for FYP_Module-01
# Builds both frontend and backend in a single container

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend: default empty so production uses same-origin /api (set build-arg if API is on another host)
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Stage 2: Python Backend
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (cairo/pkg-config: pycairo/xhtml2pdf; plantuml+graphviz: use case diagram PNG)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    pkg-config \
    libcairo2-dev \
    plantuml \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements files
COPY requirements.txt requirements_api.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements_api.txt

# Copy backend source code (root) and Python packages imported by api_server.py
COPY *.py ./
COPY main_orchestrator.py ./
COPY srs_generator.py ./
COPY srs_model_generator.py ./
COPY json_to_srs_pdf.py ./
COPY module1_large_scale.py ./
COPY config_large_scale.json ./
COPY generation/ ./generation/
COPY input_processing/ ./input_processing/
COPY evaluation/ ./evaluation/
COPY rag/ ./rag/

# Copy data directory (if needed)
COPY data/ ./data/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create directory for serving static files
RUN mkdir -p /app/static

# EXPOSE is informational; Render and other hosts inject PORT (often not 8000).
EXPOSE 8000

# Set environment variables
ENV FLASK_APP=api_server.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1
# Render / Docker must listen on all interfaces; Render injects PORT at runtime.
ENV API_BIND_HOST=0.0.0.0

# Health check must use the same PORT the app binds (Render sets PORT dynamically).
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD python -c "import os,urllib.request; p=os.environ.get('PORT','8000'); urllib.request.urlopen('http://127.0.0.1:'+p+'/api/health', timeout=5)" || exit 1

# Production WSGI server — binds 0.0.0.0:$PORT (Render requirement). Local: docker run -p 8000:8000 -e PORT=8000 ...
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8000} --worker-class gthread --workers 1 --threads 4 --timeout 600 --graceful-timeout 120 --access-logfile - --error-logfile - api_server:app"]

