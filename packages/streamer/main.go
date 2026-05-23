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
	"path/filepath"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
)

type command struct {
	Cmd         string   `json:"cmd"`
	Data        string   `json:"data,omitempty"`
	InfoHash    string   `json:"infoHash,omitempty"`
	Type        string   `json:"type,omitempty"`
	URI         string   `json:"uri,omitempty"`
	FileIndices []int    `json:"fileIndices,omitempty"`
}

var transcodeCacheDir string
var maxCacheSize int64 // bytes, 0 = unlimited
var stateFile string   // persistence state file path

type torrentState struct {
	InfoHash       string `json:"infoHash"`
	MagnetURI      string `json:"magnetUri,omitempty"`
	TorrentDataBase64 string `json:"torrentData,omitempty"`
	SelectedFiles  []int  `json:"selectedFiles,omitempty"`
	PlaybackPos    int64  `json:"playbackPos,omitempty"` // seconds
}

type persistedState struct {
	Torrents []torrentState `json:"torrents"`
}

func loadState(client *torrent.Client) {
	data, err := os.ReadFile(stateFile)
	if err != nil {
		log.Printf("[go] no state file: %v", err)
		return
	}
	var state persistedState
	if err := json.Unmarshal(data, &state); err != nil {
		log.Printf("[go] state parse error: %v", err)
		return
	}
	for _, t := range state.Torrents {
		go func(ts torrentState) {
			if ts.TorrentDataBase64 != "" {
				data, err := base64.StdEncoding.DecodeString(ts.TorrentDataBase64)
				if err != nil {
					log.Printf("[go] restore base64 error: %v", err)
					return
				}
				mi, err := metainfo.Load(bytes.NewReader(data))
				if err != nil {
					log.Printf("[go] restore metainfo error: %v", err)
					return
				}
				t, err := client.AddTorrent(mi)
				if err != nil {
					log.Printf("[go] restore add error: %v", err)
					return
				}
				<-t.GotInfo()
				files := t.Files()
				for _, f := range files {
					f.SetPriority(torrent.PiecePriorityNone)
				}
				for _, idx := range ts.SelectedFiles {
					if idx >= 0 && idx < len(files) {
						files[idx].SetPriority(torrent.PiecePriorityNormal)
					}
				}
				log.Printf("[go] restored torrent %s", ts.InfoHash[:12])
			} else if ts.MagnetURI != "" {
				t, err := client.AddMagnet(ts.MagnetURI)
				if err != nil {
					log.Printf("[go] restore magnet error: %v", err)
					return
				}
				<-t.GotInfo()
				files := t.Files()
				for _, f := range files {
					f.SetPriority(torrent.PiecePriorityNone)
				}
				for _, idx := range ts.SelectedFiles {
					if idx >= 0 && idx < len(files) {
						files[idx].SetPriority(torrent.PiecePriorityNormal)
					}
				}
				log.Printf("[go] restored magnet %s", ts.InfoHash[:12])
			}
		}(t)
	}
}

func saveState(client *torrent.Client) {
	var state persistedState
	for _, t := range client.Torrents() {
		ts := torrentState{
			InfoHash:      t.InfoHash().HexString(),
			SelectedFiles: []int{},
		}
		// Check if we have the metainfo
		if t.Info() != nil {
			// Save torrent file as base64
			mi := t.Metainfo()
			var buf bytes.Buffer
			mi.Write(&buf)
			ts.TorrentDataBase64 = base64.StdEncoding.EncodeToString(buf.Bytes())
			// Track selected files
			for i, f := range t.Files() {
				if f.Priority() != torrent.PiecePriorityNone {
					ts.SelectedFiles = append(ts.SelectedFiles, i)
				}
			}
		}
		state.Torrents = append(state.Torrents, ts)
	}
	data, _ := json.MarshalIndent(state, "", "  ")
	os.WriteFile(stateFile, data, 0644)
	log.Printf("[go] state saved: %d torrents", len(state.Torrents))
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
	maxCacheGB := flag.Int64("max-cache-gb", 10, "max transcode cache size in GB (0 = unlimited)")
	flag.Parse()

	maxCacheSize = *maxCacheGB * 1024 * 1024 * 1024

	transcodeCacheDir = filepath.Join(*downloadDir, "_transcode_cache")
	os.MkdirAll(transcodeCacheDir, 0755)

	stateFile = filepath.Join(*downloadDir, "state.json")

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

	// Restore state from previous session
	loadState(client)

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
	mux.HandleFunc("/subtitle/", func(w http.ResponseWriter, r *http.Request) {
		handleSubtitle(w, r, client)
	})
	mux.HandleFunc("/playback/", func(w http.ResponseWriter, r *http.Request) {
		handlePlayback(w, r, client)
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
		scanner.Buffer(make([]byte, 0, 4<<20), 4<<20)
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
					for _, f := range t.Files() {
						f.SetPriority(torrent.PiecePriorityNone)
					}
					saveState(client)
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
					for _, f := range t.Files() {
						f.SetPriority(torrent.PiecePriorityNone)
					}
					saveState(client)
					fmt.Fprintf(os.Stderr, `{"type":"status","message":"added magnet %s"}`+"\n", t.InfoHash().HexString()[:12])
				}()
		case "select_files":
			for _, t := range client.Torrents() {
				if strings.EqualFold(t.InfoHash().HexString(), cmd.InfoHash) {
					<-t.GotInfo()
					files := t.Files()
					for _, f := range files {
						f.SetPriority(torrent.PiecePriorityNone)
					}
					selected := map[int]bool{}
					for _, idx := range cmd.FileIndices {
						if idx >= 0 && idx < len(files) {
							selected[idx] = true
						}
					}
					for idx := range selected {
						files[idx].SetPriority(torrent.PiecePriorityNormal)
					}
					saveState(client)
					fmt.Fprintf(os.Stderr, `{"type":"status","message":"selected %d files for %s"}`+"\n", len(cmd.FileIndices), cmd.InfoHash[:12])
					break
				}
			}
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
			saveState(client)
			fmt.Fprintf(os.Stderr, `{"type":"status","message":"removed %s"}`+"\n", cmd.InfoHash[:12])
			default:
				fmt.Fprintf(os.Stderr, `{"type":"error","message":"unknown cmd: %s"}`+"\n", cmd.Cmd)
			}
		}
		if err := scanner.Err(); err != nil {
			fmt.Fprintf(os.Stderr, `{"type":"error","message":"stdin scanner: %v"}`+"\n", err)
		}
		fmt.Fprintf(os.Stderr, `{"type":"status","message":"stdin done"}`+"\n")
	}()

	// Periodic state save
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			saveState(client)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)
	<-sigCh
	saveState(client)
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

	audioIdx := -1
	subIdx := -1
	if a := r.URL.Query().Get("audio_index"); a != "" {
		if v, err := strconv.Atoi(a); err == nil {
			audioIdx = v
		}
	}
	if s := r.URL.Query().Get("subtitle_index"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			subIdx = v
		}
	}

	touchTorrent(infoHash)
	addReader(infoHash)
	defer doneReader(infoHash)

	cacheKey := fmt.Sprintf("%s_%d", infoHash, fileIndex)
	if audioIdx >= 0 {
		cacheKey += fmt.Sprintf("_a%d", audioIdx)
	}
	if subIdx >= 0 {
		cacheKey += fmt.Sprintf("_s%d", subIdx)
	}
	cacheKey += ".mp4"
	cachePath := filepath.Join(transcodeCacheDir, cacheKey)
	cacheTmp := cachePath + ".tmp"

	// Serve from cache if available
	if cached, err := os.Open(cachePath); err == nil {
		defer cached.Close()
		fi, _ := cached.Stat()
		if fi != nil && fi.Size() > 0 {
			log.Printf("[go] transcode cache hit %s/%d (%d bytes)", infoHash[:12], fileIndex, fi.Size())
			w.Header().Set("Content-Type", "video/mp4")
			w.Header().Set("Cache-Control", "no-transform")
			http.ServeContent(w, r, "", fi.ModTime(), cached)
			return
		}
	}

	reader := file.NewReader()
	reader.SetResponsive()
	reader.SetReadahead(32 << 20)
	defer reader.Close()

	ffArgs := []string{
		"-fflags", "nobuffer",
		"-i", "pipe:0",
		"-map", "0:v:0",
	}
	if audioIdx >= 0 {
		ffArgs = append(ffArgs, "-map", fmt.Sprintf("0:%d", audioIdx))
	} else {
		ffArgs = append(ffArgs, "-map", "0:a:0")
	}
	if subIdx >= 0 {
		ffArgs = append(ffArgs, "-map", fmt.Sprintf("0:%d", subIdx))
	}
	ffArgs = append(ffArgs,
		"-c:v", "copy",
		"-c:a", "aac",
		"-ac", "2",
		"-ar", "48000",
		"-b:a", "128k",
	)
	if subIdx >= 0 {
		ffArgs = append(ffArgs, "-c:s", "mov_text")
	} else {
		ffArgs = append(ffArgs, "-sn")
	}
	ffArgs = append(ffArgs,
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"-f", "mp4",
		"pipe:1",
	)

	cmd := exec.Command("ffmpeg", ffArgs...)
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

	// Tee ffmpeg stdout to both HTTP response and a temp cache file.
	// On success the temp file is renamed to the final path (atomic commit).
	cacheFile, err := os.Create(cacheTmp)
	if err != nil {
		log.Printf("[go] cache write error %s/%d: %v", infoHash[:12], fileIndex, err)
	}
	if cacheFile != nil {
		defer cacheFile.Close()
	}

	pipeR, pipeW := io.Pipe()

	var stdout io.Writer = pipeW
	if cacheFile != nil {
		stdout = io.MultiWriter(pipeW, cacheFile)
	}
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)

	cmd.Stdout = stdout

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

	completed := false
	select {
	case <-done:
		completed = true
	case <-r.Context().Done():
		cmd.Process.Kill()
		<-done
	}

	if completed && cacheFile != nil {
		cacheFile.Sync()
		cacheFile.Close()
		cacheFile = nil
		if err := os.Rename(cacheTmp, cachePath); err != nil {
			log.Printf("[go] cache rename error %s/%d: %v", infoHash[:12], fileIndex, err)
		} else {
			log.Printf("[go] transcode cached %s/%d", infoHash[:12], fileIndex)
			evictCacheIfNeeded()
		}
	} else {
		os.Remove(cacheTmp)
	}

	pipeR.Close()
	pipeW.Close()
	log.Printf("[go] transcode done %s/%d", infoHash[:12], fileIndex)
}

// --- ffprobe ---

type ffprobeTags struct {
	Language string `json:"language"`
	Title    string `json:"title"`
}

type probeStream struct {
	Index     int        `json:"index"`
	CodecType string     `json:"codec_type"`
	CodecName string     `json:"codec_name"`
	Tags      ffprobeTags `json:"tags,omitempty"`
}

type probeAudioStream struct {
	Index    int    `json:"index"`
	Codec    string `json:"codec"`
	Language string `json:"language"`
	Title    string `json:"title,omitempty"`
}

type probeSubtitleStream struct {
	Index    int    `json:"index"`
	Codec    string `json:"codec"`
	Language string `json:"language"`
	Title    string `json:"title,omitempty"`
}

type probeResult struct {
	Streams   []probeStream       `json:"streams"`
	Audio     []probeAudioStream  `json:"audio"`
	Subtitles []probeSubtitleStream `json:"subtitles"`
	HasEac3   bool                `json:"has_eac3"`
	Supported bool                `json:"supported"`
	Error     string              `json:"error,omitempty"`
}

func handleSubtitle(w http.ResponseWriter, r *http.Request, client *torrent.Client) {
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/subtitle/"), "/", 2)
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

	subIdxStr := r.URL.Query().Get("subtitle_index")
	if subIdxStr == "" {
		http.Error(w, "missing subtitle_index", http.StatusBadRequest)
		return
	}
	subIdx, err := strconv.Atoi(subIdxStr)
	if err != nil {
		http.Error(w, "bad subtitle_index", http.StatusBadRequest)
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

	touchTorrent(infoHash)
	addReader(infoHash)
	defer doneReader(infoHash)

	reader := file.NewReader()
	reader.SetResponsive()
	reader.SetReadahead(1 << 20)
	defer reader.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-fflags", "nobuffer",
		"-i", "pipe:0",
		"-map", fmt.Sprintf("0:%d", subIdx),
		"-f", "webvtt",
		"pipe:1",
	)
	cmd.Stdin = reader
	cmd.Stdout = w
	cmd.Stderr = os.Stderr

	w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)

	if err := cmd.Run(); err != nil {
		if !strings.Contains(err.Error(), "signal: killed") {
			log.Printf("[go] subtitle ffmpeg error: %v", err)
		}
	}
}

func handlePlayback(w http.ResponseWriter, r *http.Request, client *torrent.Client) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	_, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"read body"}`, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Trigger state save
	saveState(client)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"ok":true}`))
}

var unsupportedAudio = map[string]string{
	"eac3":   "EAC3",
	"ac3":    "AC3",
	"dts":    "DTS",
	"dts-hd": "DTS-HD",
	"truehd": "TrueHD",
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
	var audio []probeAudioStream
	var subs []probeSubtitleStream
	for _, s := range raw.Streams {
		if s.CodecType == "audio" {
			if _, ok := unsupportedAudio[s.CodecName]; ok {
				hasEac3 = true
			}
			audio = append(audio, probeAudioStream{
				Index:    s.Index,
				Codec:    s.CodecName,
				Language: s.Tags.Language,
				Title:    s.Tags.Title,
			})
		} else if s.CodecType == "subtitle" {
			subs = append(subs, probeSubtitleStream{
				Index:    s.Index,
				Codec:    s.CodecName,
				Language: s.Tags.Language,
				Title:    s.Tags.Title,
			})
		}
	}

	return probeResult{
		Streams:   raw.Streams,
		Audio:     audio,
		Subtitles: subs,
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

// Preload the beginning of a file so ffmpeg has data immediately.
func startPreloadStart(ctx context.Context, file *torrent.File) {
	preloadSize := int64(8 << 20) // 8 MB from start
	if preloadSize > file.Length() {
		preloadSize = file.Length()
	}
	go func() {
		pr := file.NewReader()
		defer pr.Close()
		pr.SetResponsive()
		pr.SetReadahead(0)
		tmp := make([]byte, 32<<10)
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
		log.Printf("[go] preloaded %d bytes from start", total)
	}()
}

// waitForData blocks until at least one byte is readable from the file, up to the given timeout.
func waitForData(ctx context.Context, file *torrent.File, timeout time.Duration) bool {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	pr := file.NewReader()
	defer pr.Close()
	pr.SetResponsive()
	pr.SetReadahead(0)
	one := make([]byte, 1)
	for {
		select {
		case <-ctx.Done():
			return false
		default:
		}
		n, err := pr.Read(one)
		if n > 0 {
			return true
		}
		if err != nil {
			return false
		}
	}
}

func evictCacheIfNeeded() {
	if maxCacheSize <= 0 {
		return
	}

	// Calculate current cache size
	var totalSize int64
	entries := []struct {
		path    string
		modTime time.Time
		size    int64
	}{}

	_ = filepath.Walk(transcodeCacheDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(path), ".mp4") {
			totalSize += info.Size()
			entries = append(entries, struct {
				path    string
				modTime time.Time
				size    int64
			}{path, info.ModTime(), info.Size()})
		}
		return nil
	})

	if totalSize <= maxCacheSize {
		return
	}

	// Sort by mod time (oldest first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].modTime.Before(entries[j].modTime)
	})

	// Evict oldest until under limit
	for _, e := range entries {
		if totalSize <= maxCacheSize {
			break
		}
		if err := os.Remove(e.path); err == nil {
			log.Printf("[go] evicted cache %s (%d bytes)", filepath.Base(e.path), e.size)
			totalSize -= e.size
		}
	}
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
					fmt.Printf(`{"type":"dropped","infoHash":"%s"}`+"\n", hash)
					os.Stdout.Sync()
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
