# Ocean Curse container image

The Dockerfile builds the single Linux/amd64 application image used by both
staging and production. Deployment-specific Compose files, paths, secrets,
state, and Ansible automation belong to the `homelab-severus` repository.

The image intentionally excludes credentials, runtime state, diagnostic logs,
and the Sherpa model. It runs as the unprivileged `node` user with a read-only
root filesystem when deployed by the homelab Compose project. Application
events go to stdout/stderr, and Docker health is derived from the heartbeat
written only while the Discord client is ready.

Build from the repository root:

```bash
version="$(git rev-parse --short=12 HEAD)"
docker build \
  --platform linux/amd64 \
  --build-arg "VCS_REF=$version" \
  --tag "oceancurse:$version" \
  .
```

The runtime expects:

- `DISCORD_TOKEN_FILE` to name a mounted file containing only the Discord
  token.
- `SHERPA_MODEL_DIR` to identify the mounted Sherpa model directory.
- `STATE_PATH` to identify the writable production state file. Staging mode
  intentionally does not persist curse state.
- `HEALTH_FILE` to identify the writable heartbeat path inspected by the image
  health check.

The Python zipapp release of `yt-dlp` 2026.06.09 is downloaded and SHA-256
verified during the build. It uses the image's Python runtime instead
of extracting a bundled interpreter into the constrained `/tmp` tmpfs on every
playback. The version and checksum are explicit Docker build arguments so an
update is a reviewable image change.
