# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.14.0

FROM node:${NODE_VERSION}-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY config ./config
RUN npm run build \
    && npm prune --omit=dev

FROM node:${NODE_VERSION}-bookworm-slim AS yt-dlp

ARG YT_DLP_VERSION=2026.06.09
ARG YT_DLP_SHA256=e5d57466682cfa9d61e9cf7c8a4f09b00f4a62af37d3bbdc4bcffdf63615feac

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && curl --fail --location --silent --show-error \
        "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
        --output /usr/local/bin/yt-dlp \
    && echo "${YT_DLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum --check --strict \
    && chmod 0755 /usr/local/bin/yt-dlp

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ARG VCS_REF=unknown

LABEL org.opencontainers.image.title="Ocean Curse" \
      org.opencontainers.image.source="https://github.com/lesmaleinad/DiscordBot" \
      org.opencontainers.image.revision="${VCS_REF}"

ENV NODE_ENV=production \
    HEALTH_FILE=/tmp/oceancurse-ready \
    HEALTH_MAX_AGE_SECONDS=90 \
    SHERPA_MODEL_DIR=/app/models/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20 \
    SHERPA_KEYWORDS_FILE=/app/config/keywords.txt \
    STATE_PATH=/var/lib/oceancurse/state.json \
    YT_DLP_PATH=/usr/local/bin/yt-dlp

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates libgomp1 python3 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/models /var/lib/oceancurse \
    && chown -R node:node /app /var/lib/oceancurse

WORKDIR /app

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node config ./config
COPY --chown=node:node scripts/docker-healthcheck.js ./scripts/docker-healthcheck.js
COPY --from=yt-dlp /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "scripts/docker-healthcheck.js"]

CMD ["node", "dist/index.js"]
