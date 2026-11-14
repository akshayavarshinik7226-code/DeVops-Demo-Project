FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# dependencies first, so code changes don't reinstall them (layer caching)
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# never run as root
RUN useradd --system --uid 10001 --no-create-home appuser
USER appuser

ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=local
ENV APP_VERSION=${APP_VERSION} GIT_COMMIT=${GIT_COMMIT}
LABEL org.opencontainers.image.source="https://github.com/YOUR-USER/forgeops" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.version="${APP_VERSION}"

EXPOSE 8000
# /health returns 503 until PostgreSQL and Redis are reachable: that is correct behaviour
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--no-access-log", "--proxy-headers"]
