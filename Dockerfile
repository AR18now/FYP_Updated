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

# Build frontend (use environment variable for API URL if provided)
ARG REACT_APP_API_URL=http://localhost:8000
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Stage 2: Python Backend
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (cairo/pkg-config: required for pycairo via xhtml2pdf/svglib PDF stack)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    pkg-config \
    libcairo2-dev \
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

# Expose port
EXPOSE 8000

# Set environment variables
ENV FLASK_APP=api_server.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/health')" || exit 1

# Run the application
CMD ["python", "api_server.py"]

