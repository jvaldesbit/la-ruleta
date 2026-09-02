# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# La Ruleta — API (FastAPI, Python 3.14, gestionado con uv)
#
# Multi-stage: el stage "builder" resuelve e instala dependencias en un
# virtualenv aislado (/app/.venv); el stage final solo copia ese venv y el
# código, así la imagen de runtime no arrastra uv, compiladores ni caché.
# ---------------------------------------------------------------------------

# Binario de uv tomado de la imagen oficial: evita instalarlo con pip/curl y
# fija la misma versión en builder y en cualquier otro stage que lo necesite.
# Los nombres de imagen van totalmente cualificados para que `podman build`
# funcione igual que `docker build` (podman no asume Docker Hub).
FROM ghcr.io/astral-sh/uv:latest AS uv

# ------------------------------- builder -----------------------------------
FROM docker.io/library/python:3.14-slim AS builder

COPY --from=uv /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# Primero SOLO los manifiestos: mientras pyproject.toml y uv.lock no cambien,
# Docker reutiliza esta capa aunque cambie todo el código de la aplicación.
# uv.lock* con glob para que el build no reviente si el lock aún no existe.
COPY pyproject.toml uv.lock* ./

# --no-install-project: aquí solo queremos las dependencias de terceros; el
# paquete propio se instala más abajo, cuando ya está el código.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --no-install-project

# Ahora sí el código fuente, que es lo que cambia en cada commit.
COPY src ./src

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev

# ------------------------------- runtime -----------------------------------
FROM docker.io/library/python:3.14-slim AS runtime

# Metadatos de trazabilidad: qué versión, qué commit y cuándo se construyó.
# Se inyectan desde CI (ver .github/workflows/ci.yml).
ARG RELEASE_VERSION=0.0.0-dev
ARG GIT_REVISION=unknown
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.title="la-ruleta-api" \
      org.opencontainers.image.description="API de La Ruleta (FastAPI)" \
      org.opencontainers.image.source="https://github.com/jvaldesbit/la-ruleta" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${RELEASE_VERSION}" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.created="${BUILD_TIME}"

ENV APP_VERSION=${RELEASE_VERSION} \
    GIT_REVISION=${GIT_REVISION} \
    BUILD_TIME=${BUILD_TIME} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# curl es la única dependencia de sistema y está solo para el HEALTHCHECK.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 ruleta

WORKDIR /app

COPY --from=builder --chown=ruleta:ruleta /app/.venv /app/.venv
COPY --from=builder --chown=ruleta:ruleta /app/src /app/src

# Nunca como root: si alguien escapa del proceso, no es superusuario dentro
# del contenedor.
USER ruleta

EXPOSE 8000

# El propio contenedor se declara insano si /api/v1/health deja de responder;
# Docker Compose y Dokploy usan esto para reiniciar o retrasar el tráfico.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["uvicorn", "ruleta.main:app", "--host", "0.0.0.0", "--port", "8000"]
