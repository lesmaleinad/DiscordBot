# Windows service operations

Ocean Curse writes one JSON object per application event to the WinSW stdout or
stderr log. WinSW rolls each service log at 10 MB and retains a small number of
previous files.

Production logs:

```text
C:\ProgramData\OceanCurse\logs\OceanCurseService.out.log
C:\ProgramData\OceanCurse\logs\OceanCurseService.err.log
```

Staging uses the corresponding `OceanCurseStagingService` filenames.

Useful events include:

- `app.starting`, `app.stopping`, and `app.start_failed`
- `discord.ready`, `discord.shard_disconnected`, and `discord.shard_resumed`
- `health.started`
- `listener.deploying`, `listener.started`, `listener.stopped`, and listener errors
- `keyword.detected`
- `curse.queried`, `curse.transferred`, `curse.released`, `curse.claimed`, and
  rejected or failed transfers
- `playback.requested`, `playback.started`, and `playback.finished`

Routine heartbeats, ordinary messages, every voice-state update, and audio frames
are intentionally not logged.

`CURSE_TTL_MINUTES` controls how long one member can hold the curse. Production
uses 10,080 minutes (seven days), while staging uses 10 minutes. A released curse
is silently claimed by the first human member who joins a standard voice
channel. If it is still unclaimed, a member already in voice can claim it by
sending `ocean curse` in the configured text channel. Daniel can force the same
release path with `ocean release`.

Tail production events from the operator workstation:

```powershell
severus {
    Get-Content C:\ProgramData\OceanCurse\logs\OceanCurseService.out.log -Tail 50
}
```
