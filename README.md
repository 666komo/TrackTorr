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
- **EAC3 transcode** — detects unsupported audio codecs with ffprobe, transcodes to AAC on the fly via ffmpeg
- **Dual engine** — WebTorrent (management) + Go anacrolix/torrent (streaming) for reliable piece prioritization

## Dependencies

- **Go** 1.26+ (build only)
- **Node.js** 22+
- **ffmpeg + ffprobe** (runtime — EAC3 transcoding)
- **npm** (build only)
- Prowlarr

## Quick Start

### Bare Metal (Arch Linux)

```bash
# Install dependencies
sudo pacman -S ffmpeg nodejs npm go

# Build
git clone git@github.com:666komo/TrackTorr.git && cd TrackTorr
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

# 2. Deploy
kubectl apply -k k8s/

# 3. Access via port-forward or the ingress hostname
kubectl port-forward -n tracktorr svc/tracktorr 3030:3030
```

The ingress rules are in `k8s/ingress.yaml` (default host: `tracktorr.local`). Adjust for your domain.

## Configuration

Copy `config/config.example.json` to `config/config.json` and edit:

| Field | Description |
|---|---|
| `port` | Server port (default: 3030) |
| `host` | Bind address (default: 0.0.0.0) |
| `indexerUrl` | Prowlarr or Jackett URL (omit to disable search) |
| `indexerApiKey` | Your indexer API key |
| `downloadDir` | Torrent cache directory |

## Project Structure

```
TrackTorr/
├── packages/
│   ├── server/          # Node.js + Express backend
│   │   └── src/
│   │       ├── api/     # REST routes
│   │       ├── torrent/ # WebTorrent engine + Go process manager
│   │       └── indexer/ # Prowlarr/Jackett client
│   ├── client/          # React + Vite frontend
│   │   └── src/
│   │       ├── components/  # Player, Search, Settings, etc.
│   │       └── api/        # HTTP client
│   └── streamer/        # Go streaming engine (anacrolix/torrent)
│       └── main.go
├── k8s/                 # Kubernetes manifests
├── Dockerfile
├── docker-compose.yml
└── config/              # Runtime config (gitignored)
```

## How It Works

1. **Search** — queries your Prowlarr/Jackett instance, returns results in the UI
2. **Add** — torrent is added to both WebTorrent (status/management) and Go engine (streaming) simultaneously
3. **Stream** — browser requests the file, Go serves it via `http.ServeContent` with `SetResponsive()` piece prioritization
4. **Transcode** — if ffprobe detects EAC3 audio (unsupported by browsers), ffmpeg transcodes to AAC 2ch 128kbps on the fly

The Go binary runs as a subprocess of Node.js, communicating via stdin/stdout JSON commands.

## Inspiration

- [torrserver](https://github.com/YouROK/TorrServer) — the original Go + anacrolix/torrent approach that proved this architecture works
- [WebTorrent](https://webtorrent.io) — made browser torrenting possible
