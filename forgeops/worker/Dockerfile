FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt
COPY worker.py .

RUN useradd --system --uid 10001 --no-create-home appuser
USER appuser

ARG APP_VERSION=0.0.0-dev
ARG GIT_COMMIT=local
LABEL org.opencontainers.image.source="https://github.com/YOUR-USER/forgeops" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.version="${APP_VERSION}"

# healthy when the worker has written its heartbeat to Redis in the last 30 seconds
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,redis,sys; sys.exit(0 if redis.Redis.from_url(os.environ.get('REDIS_URL','redis://redis:6379/0')).exists('worker:heartbeat') else 1)"

CMD ["python", "worker.py"]
