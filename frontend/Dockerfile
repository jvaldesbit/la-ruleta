# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# La Ruleta — Web (React 19 + Vite + TypeScript, empaquetado con pnpm)
#
# El resultado de Vite es HTML/JS/CSS estático: no hace falta Node en runtime,
# solo un nginx que sirva `dist` y haga de proxy hacia la API.
# ---------------------------------------------------------------------------

# Nombres de imagen totalmente cualificados: así `podman build` no tiene que
# adivinar el registry.

# -------------------------------- build ------------------------------------
FROM docker.io/library/node:22-alpine AS build

# corepack viene con Node 22 y activa la versión de pnpm declarada en el campo
# "packageManager" de package.json, sin instalar nada global a mano.
RUN corepack enable

WORKDIR /app

# Manifiestos primero: la instalación de dependencias solo se rehace cuando
# cambian package.json o el lockfile, no en cada cambio de código.
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile: el build falla si el lock no cuadra con package.json, en
# lugar de resolver versiones distintas a las que se probaron en CI.
RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store \
    && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# ------------------------------- runtime -----------------------------------
FROM docker.io/library/nginx:1.27-alpine AS runtime

ARG RELEASE_VERSION=0.0.0-dev
ARG GIT_REVISION=unknown
ARG BUILD_TIME=unknown

LABEL org.opencontainers.image.title="la-ruleta-web" \
      org.opencontainers.image.description="Frontend de La Ruleta (React + Vite)" \
      org.opencontainers.image.source="https://github.com/jvaldesbit/la-ruleta" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${RELEASE_VERSION}" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.created="${BUILD_TIME}"

ENV APP_VERSION=${RELEASE_VERSION} \
    GIT_REVISION=${GIT_REVISION} \
    BUILD_TIME=${BUILD_TIME}

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
