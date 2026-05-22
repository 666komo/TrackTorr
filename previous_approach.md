# Previous Approach (HEAD 60f36f9 — before audio/subtitle/file-selection changes)

## ffmpeg Command

```go
exec.Command("ffmpeg",
    "-fflags", "nobuffer",
    "-i", "pipe:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-ac", "2",
    "-ar", "48000",
    "-b:a", "128k",
    "-sn",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-flush_packets", "1",
    "-f", "mp4",
    "pipe:1",
)
```

- No `-map` flags — ffmpeg picked default streams (first video, first audio)
- No subtitle support — `-sn` stripped all subtitles
- `-flush_packets 1` flushed every packet (later removed)

## Probe (Go)

```go
type probeStream struct {
    Index     int    `json:"index"`
    CodecType string `json:"codec_type"`
    CodecName string `json:"codec_name"`
}

type probeResult struct {
    Streams   []probeStream `json:"streams"`
    HasEac3   bool          `json:"has_eac3"`
    Supported bool          `json:"supported"`
    Error     string        `json:"error,omitempty"`
}
```

- Flat `streams[]` array — no categorization by type
- Only checked for EAC3/AC3/DTS/DTS-HD/TrueHD (`has_eac3`)
- No language, no title, no audio/subtitle index distinction
- Frontend decision: `supported ? native stream : transcode`

## Stream Flow (Node.js Proxy)

- Simple HTTP proxy to Go streamer
- If `supported`, stream directly (native URL)
- If unsupported audio, transcode URL
- No query params forwarded — no audio/subtitle selection

## Frontend Player

- Single `ProbeResult` interface with `has_eac3`, `supported`, `error?`
- No audio selector dropdown
- No subtitle selector dropdown
- No `<track>` element
- Play/pause, volume, seek, fullscreen only

## What Was Missing

- **Audio track selection** — no way to pick a language track
- **Subtitle rendering** — all subtitles stripped by `-sn`
- **Per-file management** — no `select_files`/`deselect` commands in Go, no UI for per-file selection
- **Categorized probe** — frontend couldn't enumerate available audio/subtitle streams
- **No `-ss` / `-output_ts_offset`** — stream started at PTS 0 which caused browser HEVC decoder to pause ~5s waiting for the first valid keyframe when the source had corrupted RPS frames at the beginning

## What Existed

- Transcode cache (atomic write on completion, served on repeat)
- Dual engine (WebTorrent for management, Go anacrolix/torrent for streaming)
- Prowlarr/Jackett search
- Basic player controls
- Docker/K3s deployment
