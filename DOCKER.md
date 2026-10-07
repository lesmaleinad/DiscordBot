# Ocean Curse container image

The Dockerfile builds the Linux/amd64 image used by staging and production.
It embeds the pinned Sherpa speech model. Credentials, state and songs live
outside the image. Deployment configuration belongs to `homelab-severus`.

## Local songs

Install `yt-dlp` separately on the machine used to prepare songs. From this
repository run:

```powershell
npm run download-songs
npm run download-songs -- C:\OceanCurse\songs
```

The script contains the original 32 YouTube URLs and downloads Opus audio in
WebM containers. `YT_DLP_PATH` selects the downloader executable; `SONG_DIR`
sets the default output directory (otherwise `./songs`). An explicit command
argument overrides that directory. Reruns skip completed, nonempty files and
continue after individual failures, exiting nonzero if any song fails.
YouTube errors occur during preparation rather than during voice playback.

The bot selects a random nonempty `.webm`, `.ogg`, or `.opus` file from
`SONG_DIR` (otherwise `./songs`). These files must contain Opus audio;
MP3/AAC files are not supported. Temporary `.part` files are ignored. An empty
or missing directory fails before joining voice. There is no online fallback.
Downloaded audio is excluded from Git and Docker build contexts.

For Docker, copy the prepared files onto the host and mount their directory
read-only at `/songs`. Files and directories must be readable by UID 1000.
Staging and production can share this directory. The downloader is not part
of the bot image and is never run by the bot.

## Build and runtime

```bash
docker build --platform linux/amd64 --tag oceancurse:local .
```

Runtime configuration:

- `DISCORD_TOKEN_FILE`: mounted Discord token file.
- `SHERPA_MODEL_DIR`: embedded model directory, set by the image.
- `SONG_DIR`: read-only song directory, `/songs` in the image.
- `STATE_PATH`: writable curse state file.
- `HEALTH_FILE`: writable Discord readiness heartbeat. This checks connection
  readiness; it does not verify the song library or audio playback.
