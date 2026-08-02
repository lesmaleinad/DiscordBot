# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22.14.0-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b

FROM ${NODE_IMAGE} AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY config ./config
RUN npm run build \
    && npm prune --omit=dev

FROM ${NODE_IMAGE} AS yt-dlp

ARG YT_DLP_VERSION=2026.06.09
ARG YT_DLP_SHA256=e5d57466682cfa9d61e9cf7c8a4f09b00f4a62af37d3bbdc4bcffdf63615feac

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && curl --fail --location --silent --show-error \
        "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
        --output /usr/local/bin/yt-dlp \
    && echo "${YT_DLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum --check --strict \
    && chmod 0755 /usr/local/bin/yt-dlp

FROM ${NODE_IMAGE} AS sherpa-model

ARG SHERPA_MODEL_NAME=sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20
ARG SHERPA_MODEL_URL=https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20.tar.bz2
ARG SHERPA_MODEL_SHA256=68447f4fbc67e70eee3a93961f36e81e98f47aef73ce7e7ca00885c6cd3616a6

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl bzip2 \
    && curl --fail --location --silent --show-error \
        "${SHERPA_MODEL_URL}" \
        --output /tmp/sherpa-model.tar.bz2 \
    && echo "${SHERPA_MODEL_SHA256}  /tmp/sherpa-model.tar.bz2" | sha256sum --check --strict \
    && mkdir -p /models \
    && tar --extract --bzip2 --file /tmp/sherpa-model.tar.bz2 --directory /models \
    && test -f "/models/${SHERPA_MODEL_NAME}/tokens.txt" \
    && rm -rf /var/lib/apt/lists/* /tmp/sherpa-model.tar.bz2

FROM ${NODE_IMAGE} AS runtime

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
    && mkdir -p /app /var/lib/oceancurse \
    && chown -R node:node /app /var/lib/oceancurse

WORKDIR /app

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node config ./config
COPY --chown=node:node scripts/docker-healthcheck.js ./scripts/docker-healthcheck.js
COPY --from=yt-dlp /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp
COPY --from=sherpa-model --chown=node:node /models ./models

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "scripts/docker-healthcheck.js"]

CMD ["node", "dist/index.js"]
