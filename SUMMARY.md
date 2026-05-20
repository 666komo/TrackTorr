# TrackTorr - Progress Summary

## Goal
Build a torrent streaming client with web UI and Prowlarr/Jackett indexer integration.

## Constraints & Preferences
- First-launch interactive setup saves to `config/config.json` at project root via `import.meta.url`-relative path resolution.
- Backend: Node.js + Express + WebTorrent (v2.8.5, ESM). Frontend: React + Vite + TypeScript (monorepo with npm workspaces).
- Streaming engine is now **Go binary** (`packages/streamer/`) using `anacrolix/torrent` (same lib as torrserver), spawned as a persistent HTTP server from Node.js.

## Progress

### Done
- Project scaffolding, monorepo structure, package configs, dependency installation.
- Backend: Express server, WebTorrent engine wrapper (addMagnet, addInfoHash, addTorrentFile, remove).
- Backend: Stream endpoint with HTTP range-request support, correct MIME types, client-disconnect cleanup.
- Backend: Indexer client with Prowlarr-first + Jackett fallback search.
- Backend: Config API (GET/PUT `/api/config`), first-launch interactive setup.
- Backend: Torrent API detects Prowlarr download URLs, fetches `.torrent` file, adds to WebTorrent.
- Frontend: Search bar, search results, active torrent list, video/audio player overlay with `MediaError.code` display.
- Frontend: Settings modal with config form fields.
- **Go streamer binary** (`packages/streamer/main.go`): persistent HTTP server on random port, `anacrolix/torrent` client, stdin JSON commands (`add_torrent`, `add_magnet`, `remove`), stream endpoint at `/stream/:infoHash/:fileIndex` with `file.NewReader().SetResponsive()` + `http.ServeContent`.
- **engine.ts**: spawns Go binary at startup, tracks `goPort`, sends add/remove commands to Go stdin. Stores torrent sources in `torrentSources` map for re-sending. Sends Go commands **immediately** (before WebTorrent `ready` event) so Go starts resolving magnets in parallel.
- **stream.ts**: proxies stream requests to Go HTTP server. When Go returns 404, re-sends the Go `add_torrent`/`add_magnet` command and retries with HEAD probes (up to 5 attempts, 1s apart). Falls back to WebTorrent progressive stream only after all retries fail.
- **Go binary fix**: stdin handler no longer blocks on `<-t.GotInfo()` — uses a goroutine so subsequent commands can be processed while magnets resolve.
- **Build integration**: Go binary compiled via `build:streamer` npm script, included in dev/build lifecycle.
- **Go perf improvements (2026-05-20)**:
  - **Dual-reader preload** — `handleStream` spawns a background goroutine that reads the last 8 MB of the file concurrently, forcing the engine to download end-of-file metadata (cues, moov atom) before the browser's Range request arrives.
  - **16 MB readahead** — `reader.SetReadahead(16 << 20)` for smoother streaming.
  - **Torrent engine tuning** — `EstablishedConnsPerTorrent=50`, `TotalHalfOpenConns=100`, `TorrentPeersHighWater=500` for faster peer utilization.
  - **Default trackers** — 7 known-good trackers appended to magnet URIs for faster peer discovery.
  - **Torrent timeout** — background `cleanupLoop` drops torrents idle >60s with no active readers.
  - **`debug.FreeOSMemory()`** — called each cleanup cycle (15s) to reduce RSS bloat.
  - **ETag + Cache-Control** headers on stream responses.
   - **HTTP keep-alive agent** in Node.js proxy (`keepAlive: true`, `maxSockets: 10`) — reuses TCP connections to Go.
- **ffprobe codec detection (2026-05-20)**:
  - **Go `/probe/:infoHash/:fileIndex` endpoint** — runs `ffprobe -show_streams` via stdin pipe on the torrent reader with 10s timeout, returns JSON with stream codec info + `has_eac3` + `supported` booleans.
  - **Node.js `/api/stream/probe/:infoHash/:fileIndex`** — proxies to Go's probe endpoint.
   - **Frontend Player** — calls probe endpoint on mount, detects unsupported codecs. If EAC3 found, switches to transcoded stream URL automatically.
- **Live ffmpeg transcode (2026-05-20)**:
  - **Go `handleTranscode()`** — when `?transcode=1` is set, pipes torrent reader through `ffmpeg -c:v copy -c:a aac -movflags frag_keyframe+empty_moov -f mp4`. No Range support, but fragmented MP4 allows seeking within buffered window.
  - **Node.js `/api/stream/transcode/:infoHash/:fileIndex`** — direct proxy to Go's transcode endpoint (no HEAD probe, no fallback).
  - **Frontend Player** — waits for probe result before loading. If EAC3 detected, uses transcode URL instead of native stream URL. Shows warning banner: *"EAC3 audio detected — transcoding audio to AAC for browser playback."*

### In Progress
- None

### Blocked
- None

## Key Decisions
- **Switched from WebTorrent to anacrolix/torrent for streaming** — WebTorrent's `critical()` doesn't preempt already-full wire request slots (maxConcurrent=5). Go's `SetResponsive()` directly controls piece prioritization at the engine level, matching torrserver's approach.
- **Persistent Go process** (HTTP server on random port) instead of spawning per-request — shares torrent client across range requests.
- **torrserver-like architecture**: serve raw files via `http.ServeContent` + torrent `Reader` + `SetResponsive()`, let browser handle codec support. Fall back to live ffmpeg transcode for unsupported codecs (EAC3 → AAC via `-c:v copy -c:a aac`).
- **Go commands sent immediately** — no longer wait for WebTorrent `ready` event before sending `add_magnet`/`add_torrent` to Go. Both engines resolve in parallel.
- **Stream retry logic** — when Go returns 404 (torrent not yet added), stream.ts re-sends the Go add command and retries with HEAD probes up to 5 times, instead of immediately falling back to WebTorrent.
- **Go stdin non-blocking** — `add_torrent`/`add_magnet` use goroutines for `<-t.GotInfo()` so the stdin command loop processes subsequent commands without blocking on magnet resolution.
- Node.js keeps all non-streaming roles (Express API, Prowlarr integration, config, frontend). Go binary is purely the streaming engine.

## Current Architecture

```
[Browser] <--> [Node.js :5173/3001] <--> [Go :random_port]
                  |                           |
             WebTorrent                  anacrolix/torrent
          (add/remove/status)            (streaming only)
                  |                           |
             [Download Dir] <---------> [Download Dir]
```

- Node.js sends `add_torrent`/`add_magnet`/`remove` commands to Go stdin **immediately** when torrents are added/removed.
- Stream requests probe Go with HEAD, then proxy a full GET on success. Retries with re-send if Go returns 404.
- Both clients write to the same download directory. Go verifies pieces from disk on add via hash checking.

## Debug Notes

### Root cause of buffering failure (2026-05-20)
From the log:
```
[progressive] waiting for piece 1060 block 246 (missing=4038683/4038683)
[progressive] TIMEOUT on piece 1060 block 246 (missing=4038683/4038683)
```
Three problems chained:
1. **Go add sent too late** — `addMagnet` waited for WebTorrent `ready` event (seconds). By then the browser made both requests.
2. **Stream fell back too eagerly** — Go 404 → immediate WebTorrent progressive stream fallback.
3. **WebTorrent `critical()` can't download end pieces** — piece 1060 had `missing=4038683/4038683` even after 60s. `critical()` just marks bits in an array, it doesn't preempt already-full wire request slots.

### Fixes applied
- Send Go `add_magnet`/`add_torrent` command immediately (before WebTorrent ready).
- Stream.ts retries up to 5× with 1s gaps when Go returns 404, re-sending the Go add command each time.
- Go stdin handler uses goroutines for `<-t.GotInfo()` so it doesn't block the command loop.

## Relevant Files
- `packages/streamer/main.go`: Persistent Go HTTP server with anacrolix/torrent client. Handles `/stream/` (with preload + readahead + engine tuning) and `/probe/` (ffprobe codec detection).
- `packages/server/src/torrent/engine.ts`: WebTorrent engine + Go process manager + torrent source store.
- `packages/server/src/api/stream.ts`: Stream endpoint — Go proxy with retry + WebTorrent fallback. Also `/probe/` proxy.
- `packages/server/src/api/torrents.ts`: Torrent management API.
- `packages/client/src/components/Player.tsx`: Video/audio player with ffprobe codec warning banner.
- `packages/client/src/App.tsx`: Root app — passes `infoHash` + `fileIndex` to Player.
- `packages/client/src/api/client.ts`: API client — `probeUrl()` helper.
- `packages/server/src/webtorrent.d.ts`: Type declarations.
- `config/config.json`: User configuration (Prowlarr URL, API key, download dir).
