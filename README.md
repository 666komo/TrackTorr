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

### Bare Metal

```bash
# Install dependencies
sudo apt install ffmpeg nodejs npm golang-go

# Build
git clone https://github.com/666komo/TrackTorr && cd TrackTorr
npm install
npm run build

# Configure (first-launch interactive setup)
npm start
# OR use env vars:
export INDEXER_URL=http://prowlarr:9696
export INDEXER_API_KEY=your_key
npm start
```

Open `http://localhost:3030`.

### Docker

```bash
# Build and run
docker compose up -d

# Or build manually:
docker build -t tracktorr .
docker run -d \
  --name tracktorr \
  -p 3030:3030 \
  -e INDEXER_URL=http://192.168.0.184:30096 \
  -e INDEXER_API_KEY=your_key \
  -v tracktorr-data:/data \
  tracktorr
```

### K3s / Kubernetes

```bash
# Edit your API key first
vim k8s/secret.yaml

# Deploy
kubectl apply -k k8s/

# Access via port-forward or the ingress hostname
kubectl port-forward -n tracktorr svc/tracktorr 3030:3030
```

The ingress rules are in `k8s/ingress.yaml` (default host: `tracktorr.local`). Adjust for your domain.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3030` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `INDEXER_URL` | — | Prowlarr/Jackett URL |
| `INDEXER_API_KEY` | — | Prowlarr/Jackett API key |
| `DOWNLOAD_DIR` | `/data/downloads` | Torrent cache directory |

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
