# TrackTorr

Torrent streaming server with web UI and Prowlarr/Jackett indexer integration. Search, add, and stream torrents directly in your browser — no download required.

![Architecture](https://img.shields.io/badge/Node.js-Express-green?logo=nodedotjs)
![Streaming](https://img.shields.io/badge/Go-anacrolix%2Ftorrent-blue?logo=go)
![Frontend](https://img.shields.io/badge/React-Vite-646cff?logo=react)
![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker)
![K8s](https://img.shields.io/badge/K3s-ready-326ce5?logo=kubernetes)

## Features

- **Search** via Prowlarr or Jackett (any public/private indexer)
- **Stream** MKV/MP4/AVI/MOV directly in browser via `<video>` element
- **Codec detection** — detects unsupported audio codecs (EAC3, AC3, DTS, DTS-HD, TrueHD) with ffprobe, transcodes to AAC 2ch 128kbps on the fly via ffmpeg
- **Dual engine** — WebTorrent (management) + Go anacrolix/torrent (streaming) for reliable piece prioritization
- **Audio & subtitle selection** — select language tracks from any detected audio/subtitle streams before playback
- **Per-file management** — add torrents once, then select/deselect individual files from the torrent list; deselected files are not downloaded
- **Transcode cache** — once transcoded, output is saved atomically to disk and served directly on repeat requests — no re-encode

## Dependencies

- **Go** 1.26+ (build only)
- **Node.js** 22+
- **ffmpeg + ffprobe** (runtime — unsupported audio transcoding)
- **npm** (build only)
- **Build tools** — `python3`, `make`, `g++`, `gcc` (build only — native addon compilation)
- **Prowlarr** or **Jackett** (indexer — optional, search still works without)

## How It Works

1. **Search** — queries your Prowlarr/Jackett instance, returns results in the UI
2. **Add** — torrent is added to both WebTorrent (status/management) and Go engine (streaming) simultaneously via stdin JSON commands
3. **Probe** — when you click play, the browser calls a probe endpoint that runs `ffprobe` against the torrent file via a pipe. Returns detected video codecs, audio streams (index/codec/language/title), and subtitle streams (index/codec/language/title)
4. **Stream** — always transcodes via ffmpeg:
   - Video: HEVC passthrough (`-c:v copy`) — browsers with native HEVC decode play it directly
   - Audio: re-encodes unsupported codecs to AAC 2ch 128kbps; supported codecs also pass through
   - Subtitle: optional stream selection embeds `mov_text` in the MP4 output, or serves a separate WebVTT endpoint
   - Always serves fragmented MP4 with `frag_keyframe+empty_moov+default_base_moof` for instant playback
5. **Transcode cache** — output is written atomically to disk on the first transcode; repeat requests serve the cached file directly
6. **Audio/subtitle switching** — changing tracks on the player triggers a new transcode with different `-map` indices; the video reloads with the new selection
7. **Cleanup** — torrents idle for 60 seconds are dropped; the Go process emits a `dropped` message on stdout, and Node.js removes the torrent from the WebTorrent UI

The Go binary runs as a persistent HTTP subprocess of Node.js. They communicate via newline-delimited JSON on stdin (commands) and stdout (status/dropped events). Logs and errors go to stderr.

## Quick Start

### Bare Metal (Arch Linux)

```bash
# Install dependencies
sudo pacman -S ffmpeg nodejs npm go

# Build
git clone https://github.com/666komo/TrackTorr.git && cd TrackTorr
npm install
npm run build

# Configure
cp config/config.example.json config/config.json
# Edit config/config.json with your settings

# Run
npm start
```

Open `http://localhost:3030`.

### Docker

```bash
# 1. Create config file
cp config/config.example.json config/config.json
# Edit config/config.json with your settings

# 2. Build and run
docker compose up -d

# Or build manually:
docker build -t tracktorr .
docker run -d \
  --name tracktorr \
  -p 3030:3030 \
  -v ./config/config.json:/app/config/config.json:ro \
  -v tracktorr-data:/data \
  tracktorr
```

### K3s / Kubernetes

```bash
# 1. Edit the API key in the config map
vim k8s/configmap.yaml

# 2. Build Docker image
docker build -t tracktorr:latest .

# 3. Import into k3s containerd (single-node)
#    (Skip this if using a registry — just push and set image in deployment.yaml)
docker save tracktorr:latest | sudo k3s ctr images import -

# 4. Deploy
kubectl apply -k k8s/

# 5. Access via port-forward or the ingress hostname
kubectl port-forward -n tracktorr svc/tracktorr 3030:3030
```

The ingress rules are in `k8s/ingress.yaml` (default host: `tracktorr.local`). Adjust for your domain.

## Configuration

Copy `config/config.example.json` to `config/config.json` and edit:

| Field | Description |
|---|---|
| `port` | Server port (required) |
| `host` | Bind address (required — e.g. `0.0.0.0`) |
| `indexerUrl` | Prowlarr or Jackett URL (omit to disable search) |
| `indexerApiKey` | API key (required when `indexerUrl` is set) |
| `downloadDir` | Torrent download and transcode cache directory |

## Project Structure

```
TrackTorr/
├── config/                  # Runtime config (gitignored)
│   ├── config.example.json
│   └── config.json
├── k8s/                     # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── pvc.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
├── packages/
│   ├── server/              # Node.js + Express backend
│   │   └── src/
│   │       ├── index.ts     # Entry point
│   │       ├── server.ts    # Express app factory
│   │       ├── config.ts    # Config file loader
│   │       ├── setup.ts     # Config path resolution
│   │       ├── api/         # REST routes
│   │       │   ├── torrents.ts
│   │       │   ├── search.ts
│   │       │   ├── stream.ts
│   │       │   └── config.ts
│   │       ├── torrent/
│   │       │   └── engine.ts    # WebTorrent + Go process manager
│   │       ├── indexer/
│   │       │   └── client.ts    # Prowlarr/Jackett client
│   │       └── types/
│   │           └── index.ts
│   ├── client/              # React + Vite frontend
│   │   ├── index.html
│   │   ├── public/
│   │   │   └── trackIcon.svg
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── api/
│   │       │   └── client.ts    # HTTP client
│   │       ├── components/
│   │       │   ├── SearchBar.tsx
│   │       │   ├── SearchResults.tsx
│   │       │   ├── TorrentList.tsx
│   │       │   ├── Player.tsx
│   │       │   └── SettingsModal.tsx
│   │       └── types/
│   │           └── index.ts
│   └── streamer/            # Go streaming engine (anacrolix/torrent)
│       └── main.go
├── dist/                    # Go binary output (build artifact)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Known Issues

- **HEVC source corruption / A/V sync** — many HEVC encodes have corrupted frames in the first ~5 seconds (`[hevc @ ...] Error constructing the frame RPS`). The current workaround skips the first 5s of the source with `-ss 5` and shifts timestamps back with `-output_ts_offset -5`, at the cost of losing the first 5s of content. This issue will remain in future releases too. This solution prevents heavy resource usage while re-encoding whole file, which would be basically pointless and timeconsuming.

## Inspiration

- [torrserver](https://github.com/YouROK/TorrServer) — the original Go + anacrolix/torrent approach that proved this architecture works
- [WebTorrent](https://webtorrent.io) — made browser torrenting possible
