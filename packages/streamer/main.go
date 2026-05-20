package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
)

type command struct {
	Cmd      string `json:"cmd"`
	Data     string `json:"data,omitempty"`
	InfoHash string `json:"infoHash,omitempty"`
	Type     string `json:"type,omitempty"`
	URI      string `json:"uri,omitempty"`
}

var defaultTrackers = []string{
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://tracker.leechers-paradise.org:6969/announce",
	"udp://9.rarbg.com:2710/announce",
	"udp://tracker.cyberia.is:6969/announce",
	"udp://open.demonii.com:1337/announce",
	"udp://tracker.tiny-vps.com:6969/announce",
	"http://tracker.opentrackr.org:1337/announce",
}

// Inactivity tracking
var (
	tmMu     sync.Mutex
	lastUsed = map[string]time.Time{}
	readCnt  = map[string]*int32{}
)

func touchTorrent(hash string) {
	tmMu.Lock()
	lastUsed[hash] = time.Now()
	if _, ok := readCnt[hash]; !ok {
		readCnt[hash] = new(int32)
	}
	tmMu.Unlock()
}

func addReader(hash string) {
	tmMu.Lock()
	if c, ok := readCnt[hash]; ok {
		atomic.AddInt32(c, 1)
	} else {
		c := new(int32)
		atomic.AddInt32(c, 1)
		readCnt[hash] = c
	}
	tmMu.Unlock()
}

func doneReader(hash string) {
	tmMu.Lock()
	if c, ok := readCnt[hash]; ok {
		atomic.AddInt32(c, -1)
	}
	tmMu.Unlock()
}

func hasReaders(hash string) bool {
	tmMu.Lock()
	defer tmMu.Unlock()
	if c, ok := readCnt[hash]; ok {
		return atomic.LoadInt32(c) > 0
	}
	return false
}

func main() {
	downloadDir := flag.String("dir", os.TempDir(), "download cache directory")
	flag.Parse()

	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = *downloadDir
	cfg.Debug = false
	cfg.ListenHost = func(network string) string { return "" }
	cfg.ListenPort = 0
	cfg.NoDHT = false
	cfg.Seed = false
	cfg.EstablishedConnsPerTorrent = 50
	cfg.TotalHalfOpenConns = 100
	cfg.TorrentPeersHighWater = 500

	client, err := torrent.NewClient(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, `{"type":"error","message":"new client: %v"}`+"\n", err)
		os.Exit(1)
	}
	defer client.Close()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, `{"type":"error","message":"listen: %v"}`+"\n", err)
		os.Exit(1)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/stream/", func(w http.ResponseWriter, r *http.Request) {
		handleStream(w, r, client)
	})
	mux.HandleFunc("/probe/", func(w http.ResponseWriter, r *http.Request) {
		handleProbe(w, r, client)
	})

	server := &http.Server{Handler: mux}
	go server.Serve(listener)

	// Cleanup inactive torrents
	go cleanupLoop(client)

	fmt.Printf(`{"type":"ready","port":%d}`+"\n", port)
	os.Stdout.Sync()

	// Stdin command handler
	go func() {
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			line := scanner.Text()
			var cmd command
			if err := json.Unmarshal([]byte(line), &cmd); err != nil {
				fmt.Fprintf(os.Stderr, `{"type":"error","message":"bad cmd: %v"}`+"\n", err)
				continue
			}
			switch cmd.Cmd {
			case "add_torrent":
				data, err := base64.StdEncoding.DecodeString(cmd.Data)
				if err != nil {
					fmt.Fprintf(os.Stderr, `{"type":"error","message":"base64: %v"}`+"\n", err)
					continue
				}
				mi, err := metainfo.Load(bytes.NewReader(data))
				if err != nil {
					fmt.Fprintf(os.Stderr, `{"type":"error","message":"metainfo: %v"}`+"\n", err)
					continue
				}
				t, err := client.AddTorrent(mi)
				if err != nil {
					fmt.Fprintf(os.Stderr, `{"type":"error","message":"add: %v"}`+"\n", err)
					continue
				}
				go func() {
					<-t.GotInfo()
					fmt.Fprintf(os.Stderr, `{"type":"status","message":"added %s"}`+"\n", t.InfoHash().HexString()[:12])
				}()
			case "add_magnet":
				uri := cmd.URI
				// Append default trackers if not already present
				for _, tr := range defaultTrackers {
					if !strings.Contains(uri, "&tr="+url.QueryEscape(tr)) &&
						!strings.Contains(uri, "?tr="+url.QueryEscape(tr)) {
						uri += "&tr=" + url.QueryEscape(tr)
					}
				}
				t, err := client.AddMagnet(uri)
				if err != nil {
					fmt.Fprintf(os.Stderr, `{"type":"error","message":"add magnet: %v"}`+"\n", err)
					continue
				}
				go func() {
					<-t.GotInfo()
					fmt.Fprintf(os.Stderr, `{"type":"status","message":"added magnet %s"}`+"\n", t.InfoHash().HexString()[:12])
				}()
			case "remove":
				for _, t := range client.Torrents() {
					if strings.EqualFold(t.InfoHash().HexString(), cmd.InfoHash) {
						t.Drop()
						break
					}
				}
				tmMu.Lock()
				delete(lastUsed, cmd.InfoHash)
				delete(readCnt, cmd.InfoHash)
				tmMu.Unlock()
				fmt.Fprintf(os.Stderr, `{"type":"status","message":"removed %s"}`+"\n", cmd.InfoHash[:12])
			}
		}
		os.Exit(0)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)
	<-sigCh
}

func handleStream(w http.ResponseWriter, r *http.Request, client *torrent.Client) {
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/stream/"), "/", 2)
	if len(parts) != 2 {
		http.Error(w, "bad path", http.StatusBadRequest)
		return
	}
	infoHash := parts[0]
	fileIndex, err := strconv.Atoi(parts[1])
	if err != nil {
		http.Error(w, "bad file index", http.StatusBadRequest)
		return
	}

	var t *torrent.Torrent
	for _, tt := range client.Torrents() {
		if strings.EqualFold(tt.InfoHash().HexString(), infoHash) {
			t = tt
			break
		}
	}
	if t == nil {
		http.Error(w, "torrent not found", http.StatusNotFound)
		return
	}
	<-t.GotInfo()

	files := t.Files()
	if fileIndex < 0 || fileIndex >= len(files) {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	file := files[fileIndex]

	// Transcode path: pipe torrent reader through ffmpeg for browser-unsupported codecs
	if r.URL.Query().Has("transcode") {
		handleTranscode(w, r, file, infoHash, fileIndex)
		return
	}

	mime := detectMime(file.DisplayPath())
	log.Printf("[go] stream %s/%d mime=%s range=%s", infoHash[:12], fileIndex, mime, r.Header.Get("Range"))

	touchTorrent(infoHash)
	addReader(infoHash)
	defer doneReader(infoHash)

	// Preload end of file in background so metadata pieces download early
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	startPreload(ctx, file)

	// Main reader with responsive mode and 16 MB readahead
	reader := file.NewReader()
	reader.SetResponsive()
	reader.SetReadahead(16 << 20)
	defer reader.Close()

	etag := fmt.Sprintf(`"%s/%d"`, infoHash, fileIndex)
	w.Header().Set("ETag", etag)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "no-transform")
	http.ServeContent(w, r, file.DisplayPath(), time.Time{}, reader)
	log.Printf("[go] done %s/%d", infoHash[:12], fileIndex)
}

func handleTranscode(w http.ResponseWriter, r *http.Request, file *torrent.File, infoHash string, fileIndex int) {
	log.Printf("[go] transcode %s/%d", infoHash[:12], fileIndex)

	touchTorrent(infoHash)
	addReader(infoHash)
	defer doneReader(infoHash)

	reader := file.NewReader()
	reader.SetResponsive()
	reader.SetReadahead(32 << 20)
	defer reader.Close()

	cmd := exec.Command("ffmpeg",
		"-fflags", "nobuffer",
		"-i", "pipe:0",
		"-c:v", "copy",
		"-c:a", "aac",
		"-ac", "2",
		"-b:a", "128k",
		"-sn",
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"-frag_duration", "10000000",
		"-flush_packets", "1",
		"-f", "mp4",
		"pipe:1",
	)
	cmd.Stdin = reader

	stderr, err := cmd.StderrPipe()
	if err != nil {
		http.Error(w, "ffmpeg stderr pipe failed", http.StatusInternalServerError)
		return
	}
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "frame=") || strings.Contains(line, "error") || strings.Contains(line, "Error") {
				log.Printf("[go] ffmpeg[%s/%d] %s", infoHash[:12], fileIndex, line)
			}
		}
	}()

	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)

	pipeR, pipeW := io.Pipe()
	cmd.Stdout = pipeW

	go func() {
		flusher, canFlush := w.(http.Flusher)
		buf := make([]byte, 65536)
		for {
			n, err := pipeR.Read(buf)
			if n > 0 {
				w.Write(buf[:n])
				if canFlush {
					flusher.Flush()
				}
			}
			if err != nil {
				break
			}
		}
	}()

	if err := cmd.Start(); err != nil {
		if r.Context().Err() == nil {
			log.Printf("[go] ffmpeg start error %s/%d: %v", infoHash[:12], fileIndex, err)
		}
		return
	}

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case <-done:
	case <-r.Context().Done():
		cmd.Process.Kill()
		<-done
	}
	pipeR.Close()
	pipeW.Close()

	log.Printf("[go] transcode done %s/%d", infoHash[:12], fileIndex)
}

// --- ffprobe ---

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

func handleProbe(w http.ResponseWriter, r *http.Request, client *torrent.Client) {
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/probe/"), "/", 2)
	if len(parts) != 2 {
		http.Error(w, `{"error":"bad path"}`, http.StatusBadRequest)
		return
	}
	infoHash := parts[0]
	fileIndex, err := strconv.Atoi(parts[1])
	if err != nil {
		http.Error(w, `{"error":"bad file index"}`, http.StatusBadRequest)
		return
	}

	var t *torrent.Torrent
	for _, tt := range client.Torrents() {
		if strings.EqualFold(tt.InfoHash().HexString(), infoHash) {
			t = tt
			break
		}
	}
	if t == nil {
		http.Error(w, `{"error":"torrent not found"}`, http.StatusNotFound)
		return
	}
	<-t.GotInfo()

	files := t.Files()
	if fileIndex < 0 || fileIndex >= len(files) {
		http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
		return
	}
	file := files[fileIndex]

	log.Printf("[go] probe %s/%d", infoHash[:12], fileIndex)
	result := runProbe(file)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func runProbe(file *torrent.File) probeResult {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reader := file.NewReader()
	reader.SetResponsive()
	defer reader.Close()

	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_streams",
		"pipe:0",
	)
	cmd.Stdin = reader

	output, err := cmd.Output()
	if err != nil {
		return probeResult{Error: fmt.Sprintf("ffprobe: %v", err)}
	}

	var raw struct {
		Streams []probeStream `json:"streams"`
	}
	if err := json.Unmarshal(output, &raw); err != nil {
		return probeResult{Error: fmt.Sprintf("parse: %v", err)}
	}

	hasEac3 := false
	for _, s := range raw.Streams {
		if s.CodecType == "audio" && s.CodecName == "eac3" {
			hasEac3 = true
			break
		}
	}

	return probeResult{
		Streams:   raw.Streams,
		HasEac3:   hasEac3,
		Supported: !hasEac3,
	}
}

func startPreload(ctx context.Context, file *torrent.File) {
	preloadSize := int64(8 << 20) // 8 MB from end
	if preloadSize >= file.Length() {
		return
	}
	endStart := file.Length() - preloadSize

	go func() {
		pr := file.NewReader()
		defer pr.Close()
		pr.SetResponsive()
		pr.SetReadahead(0)
		if _, err := pr.Seek(endStart, io.SeekStart); err != nil {
			return
		}
		tmp := make([]byte, 32<<10) // 32 KB
		total := int64(0)
		for total < preloadSize {
			select {
			case <-ctx.Done():
				return
			default:
			}
			n, err := pr.Read(tmp)
			if err != nil {
				return
			}
			total += int64(n)
		}
		log.Printf("[go] preloaded %d bytes from end", total)
	}()
}

func cleanupLoop(client *torrent.Client) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		// Collect expired under lock
		tmMu.Lock()
		now := time.Now()
		expired := []string{}
		for hash, last := range lastUsed {
			if c, ok := readCnt[hash]; ok && atomic.LoadInt32(c) > 0 {
				continue
			}
			if now.Sub(last) <= 60*time.Second {
				continue
			}
			expired = append(expired, hash)
		}
		tmMu.Unlock()

		// Drop without lock
		for _, hash := range expired {
			for _, t := range client.Torrents() {
				if strings.EqualFold(t.InfoHash().HexString(), hash) {
					t.Drop()
					log.Printf("[go] dropped inactive %s", hash[:12])
					break
				}
			}
		}

		// Clean maps under lock
		if len(expired) > 0 {
			tmMu.Lock()
			for _, hash := range expired {
				delete(lastUsed, hash)
				delete(readCnt, hash)
			}
			tmMu.Unlock()
		}

		debug.FreeOSMemory()
	}
}

func detectMime(name string) string {
	idx := strings.LastIndex(name, ".")
	if idx == -1 {
		return "application/octet-stream"
	}
	ext := strings.ToLower(name[idx:])
	switch ext {
	case ".mp4", ".m4v", ".m4a":
		return "video/mp4"
	case ".mkv":
		return "video/x-matroska"
	case ".webm":
		return "video/webm"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".mp3":
		return "audio/mpeg"
	case ".flac":
		return "audio/flac"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".aac":
		return "audio/aac"
	default:
		return "application/octet-stream"
	}
}
