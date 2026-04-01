package backend

// =========================================================================
// VIDEO PLAYER & ENTERTAINMENT BACKEND
// =========================================================================
// ឯកសារនេះរួមបញ្ចូល handlers ទាំងអស់ដែលពាក់ព័ន្ធនឹងប្រព័ន្ធ Entertainment:
//  - handleGetMovies       — ទាញបញ្ជី Movie/Series ពី DB
//  - handleCreateMovie     — បន្ថែម Movie ថ្មី (Admin)
//  - handleDeleteMovie     — លុប Movie (Admin)
//  - handleMigrateMovies   — Migrate Movies ពី Google Sheet (Admin)
//  - handleExtractM3U8     — Scrape M3U8 link ពី URL
//  - handleProxyM3U8       — Proxy ហើយ rewrite M3U8 playlist
//  - handleProxyTS         — Proxy video segment (.ts/.m4s/.mp4)
//  - handleProxyVideo      — Proxy direct video streaming
//  - handleFetchJSON       — Generic CORS proxy for JSON APIs
//
// Dependencies ដែល inject ពី main.go:
//  - VideoFetchSheetFunc   — wrapper for fetchSheetDataToStruct
//  - VideoGenerateIDFunc   — wrapper for generateShortID
//  - VideoExtractFileIDFunc — wrapper for extractFileIDFromURL
// =========================================================================

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ── Injectable Dependencies ───────────────────────────────────────────────
// main.go ត្រូវ set variables ទាំងនេះ ក្នុង init ឬ main() មុន Register routes

// VideoFetchSheetFunc ជា function ដែល main.go inject ដើម្បី fetch data ពី Google Sheet
var VideoFetchSheetFunc func(sheetName string, target interface{}) error

// VideoGenerateIDFunc ជា function ដែល main.go inject ដើម្បី generate short ID
var VideoGenerateIDFunc func() string

// VideoExtractFileIDFunc ជា function ដែល main.go inject ដើម្បី extract Google Drive file ID
var VideoExtractFileIDFunc func(u string) string

// ── Helper ────────────────────────────────────────────────────────────────

// resolveURL resolves a relative URL against a base URL
func resolveURL(base, ref string) string {
	baseURL, _ := url.Parse(base)
	refURL, _ := url.Parse(ref)
	return baseURL.ResolveReference(refURL).String()
}

// ── Route Registration ────────────────────────────────────────────────────

// RegisterVideoRoutes registers all video/entertainment routes.
// Call this from main.go after setting injectable dependencies.
//
//	api   — unauthenticated /api group
//	admin — authenticated /api/admin group (AdminOnly middleware already applied)
func RegisterVideoRoutes(api gin.IRouter, admin gin.IRouter) {
	// Public (no auth required)
	api.GET("/movies", HandleGetMovies)
	api.GET("/extract-m3u8", HandleExtractM3U8)
	api.GET("/proxy-m3u8", HandleProxyM3U8)
	api.GET("/proxy-ts", HandleProxyTS)
	api.GET("/proxy-video", HandleProxyVideo)
	api.Any("/fetch-json", HandleFetchJSON)

	// Admin-only
	admin.POST("/migrate-movies", HandleMigrateMovies)
	admin.POST("/movies", HandleCreateMovie)
	admin.DELETE("/movies/:id", HandleDeleteMovie)
}

// ── Handlers ──────────────────────────────────────────────────────────────

// HandleGetMovies returns all movies/series from the database.
// Injects sample series data if no series exist yet.
func HandleGetMovies(c *gin.Context) {
	var movies []Movie
	DB.Order("added_at desc").Find(&movies)

	// Inject sample series data for testing UX
	sampleSeries := []Movie{
		{ID: "series-1-ep1", Title: "Squid Game - Ep 1", Description: "Red Light, Green Light.", Thumbnail: "https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "Korean", Country: "South Korea", Category: "Thriller", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-1-ep2", Title: "Squid Game - Ep 2", Description: "Hell.", Thumbnail: "https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "Korean", Country: "South Korea", Category: "Thriller", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-1-ep3", Title: "Squid Game - Ep 3", Description: "The Man with the Umbrella.", Thumbnail: "https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "Korean", Country: "South Korea", Category: "Thriller", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-2-ep1", Title: "Stranger Things - Ep 1", Description: "The Vanishing of Will Byers.", Thumbnail: "https://image.tmdb.org/t/p/original/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "English", Country: "USA", Category: "Sci-Fi", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-2-ep2", Title: "Stranger Things - Ep 2", Description: "The Weirdo on Maple Street.", Thumbnail: "https://image.tmdb.org/t/p/original/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "English", Country: "USA", Category: "Sci-Fi", AddedAt: time.Now().Format(time.RFC3339)},
	}

	hasSeries := false
	for _, m := range movies {
		if m.Type == "series" {
			hasSeries = true
			break
		}
	}
	if !hasSeries {
		movies = append(sampleSeries, movies...)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": movies})
}

// HandleCreateMovie creates a new Movie record (Admin only).
func HandleCreateMovie(c *gin.Context) {
	var movie Movie
	if err := c.ShouldBindJSON(&movie); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ: " + err.Error()})
		return
	}

	if movie.ID == "" && VideoGenerateIDFunc != nil {
		movie.ID = VideoGenerateIDFunc()
	}
	if movie.AddedAt == "" {
		movie.AddedAt = time.Now().Format(time.RFC3339)
	}

	if err := DB.Create(&movie).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការរក្សាទុកភាពយន្តបរាជ័យ: " + err.Error()})
		return
	}

	// Sync to Google Sheets and rename Drive file in background
	go func(m Movie) {
		EnqueueSync("addRow", map[string]interface{}{
			"ID":          m.ID,
			"Title":       m.Title,
			"Description": m.Description,
			"Thumbnail":   m.Thumbnail,
			"VideoURL":    m.VideoURL,
			"Type":        m.Type,
			"Language":    m.Language,
			"Country":     m.Country,
			"Category":    m.Category,
			"SeriesKey":   m.SeriesKey,
			"AddedAt":     m.AddedAt,
		}, "Movies", nil)

		if VideoExtractFileIDFunc != nil {
			fileID := VideoExtractFileIDFunc(m.Thumbnail)
			if fileID != "" {
				log.Printf("📂 [Background] Renaming Drive file %s to %q", fileID, m.Title)
				EnqueueSync("renameFile", map[string]interface{}{
					"fileID":  fileID,
					"newName": m.Title,
				}, "", nil)
			}
		}
	}(movie)

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": movie})
}

// HandleDeleteMovie deletes a Movie by ID (Admin only).
func HandleDeleteMovie(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ID មិនអាចទទេរបានទេ"})
		return
	}

	if err := DB.Where("id = ?", id).Delete(&Movie{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការលុបភាពយន្តបរាជ័យ: " + err.Error()})
		return
	}

	go func(movieID string) {
		EnqueueSync("deleteRow", nil, "Movies", map[string]string{"ID": movieID})
	}(id)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "បានលុបភាពយន្តដោយជោគជ័យ"})
}

// HandleExtractM3U8 scrapes an M3U8/HLS link from a given webpage URL.
func HandleExtractM3U8(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 PANIC in HandleExtractM3U8: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error during extraction"})
		}
	}()

	targetURL := c.Query("url")
	referer := c.Query("referer")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing url parameter"})
		return
	}

	log.Printf("🔍 Extracting M3U8 from: %s", targetURL)

	u, err := url.Parse(targetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid URL"})
		return
	}

	fetchReferer := referer
	if fetchReferer == "" {
		fetchReferer = u.Scheme + "://" + u.Host
	}

	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", targetURL, nil)
	req.Header.Set("Referer", fetchReferer)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	html := string(body)

	var m3u8URL string

	// 1. Site-specific: khfullhd.co
	if strings.Contains(targetURL, "khfullhd.co") {
		iframeRe := regexp.MustCompile(`(?i)<iframe.*?src=["']([^"']+)["']`)
		iframes := iframeRe.FindAllStringSubmatch(html, -1)
		for _, iframe := range iframes {
			src := iframe[1]
			if strings.Contains(src, "player.php") || strings.Contains(src, "v.php") {
				playerURL := resolveURL(targetURL, src)
				pReq, _ := http.NewRequest("GET", playerURL, nil)
				pReq.Header.Set("Referer", targetURL)
				pReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
				pResp, pErr := client.Do(pReq)
				if pErr == nil && pResp != nil {
					pBody, _ := io.ReadAll(pResp.Body)
					pResp.Body.Close()
					if len(pBody) > 0 {
						html = string(pBody)
						targetURL = playerURL
					}
				}
				break
			}
		}
	}

	// 2. Playlist variable scraping
	if m3u8URL == "" {
		playlistRe := regexp.MustCompile(`var playlist = (\[.*?\]);`)
		playlistMatch := playlistRe.FindStringSubmatch(html)
		if len(playlistMatch) > 1 {
			fileRe := regexp.MustCompile(`file:\s*["']([^"']+(\\.m3u8|\\.mp4|/hlsplaylist/|/hls/)[^"']*)["']`)
			fileMatch := fileRe.FindStringSubmatch(playlistMatch[1])
			if len(fileMatch) > 1 {
				m3u8URL = fileMatch[1]
			}
		}
	}

	// 3. Dooplay Player Option Extraction
	if m3u8URL == "" && strings.Contains(html, "dooplay_player_option") {
		dtAjaxRe := regexp.MustCompile(`var dtAjax = (\{.*?\});`)
		dtAjaxMatch := dtAjaxRe.FindStringSubmatch(html)
		if len(dtAjaxMatch) > 1 {
			var dtAjax struct {
				PlayerAPI string `json:"player_api"`
				URL       string `json:"url"`
			}
			json.Unmarshal([]byte(dtAjaxMatch[1]), &dtAjax)

			optionRe := regexp.MustCompile(`class=['"]dooplay_player_option['"].*?data-post=['"](\d+)['"].*?data-nume=['"](\w+)['"].*?data-type=['"](\w+)['"]`)
			options := optionRe.FindAllStringSubmatch(html, -1)

			for _, opt := range options {
				if opt[2] == "trailer" {
					continue
				}
				postID, nume, dtype := opt[1], opt[2], opt[3]
				var apiURL string
				isAjax := false

				if dtAjax.PlayerAPI != "" {
					apiURL = dtAjax.PlayerAPI + postID + "/" + dtype + "/" + nume
				} else if dtAjax.URL != "" {
					apiURL = dtAjax.URL + "?action=doo_player_ajax&post=" + postID + "&nume=" + nume + "&type=" + dtype
					isAjax = true
				}

				if apiURL != "" {
					if strings.HasPrefix(apiURL, "/") {
						apiURL = u.Scheme + "://" + u.Host + apiURL
					}
					var apiReq *http.Request
					if isAjax {
						apiReq, _ = http.NewRequest("POST", apiURL, nil)
					} else {
						apiReq, _ = http.NewRequest("GET", apiURL, nil)
					}
					apiReq.Header.Set("Referer", targetURL)
					apiReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
					apiReq.Header.Set("X-Requested-With", "XMLHttpRequest")

					apiResp, err := client.Do(apiReq)
					if err == nil {
						apiBody, _ := io.ReadAll(apiResp.Body)
						apiResp.Body.Close()
						var result struct {
							EmbedURL string `json:"embed_url"`
						}
						json.Unmarshal(apiBody, &result)
						if result.EmbedURL != "" {
							iframeSrcRe := regexp.MustCompile(`src=['"]([^'"]+)['"]`)
							iframeSrcMatch := iframeSrcRe.FindStringSubmatch(result.EmbedURL)
							if len(iframeSrcMatch) > 1 {
								m3u8URL = iframeSrcMatch[1]
							} else {
								m3u8URL = result.EmbedURL
							}
							break
						}
					}
				}
			}
		}
	}

	// 4. Iframe deep extraction
	if m3u8URL == "" {
		iframeRe := regexp.MustCompile(`(?i)<iframe.*?src=["']([^"']+)["']`)
		iframes := iframeRe.FindAllStringSubmatch(html, -1)
		for _, iframe := range iframes {
			src := iframe[1]
			if strings.Contains(src, "googletagmanager") || strings.Contains(src, "facebook") || strings.Contains(src, "plugins") {
				continue
			}
			if strings.Contains(src, ".m3u8") || strings.Contains(src, "/hlsplaylist/") || strings.Contains(src, "/hls/") {
				m3u8URL = src
				break
			}

			if strings.HasPrefix(src, "//") {
				src = "https:" + src
			} else if !strings.HasPrefix(src, "http") {
				src = resolveURL(targetURL, src)
			}

			iframeReq, errReq := http.NewRequest("GET", src, nil)
			if errReq != nil || iframeReq == nil {
				continue
			}
			iframeReq.Header.Set("Referer", targetURL)
			iframeReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

			iframeResp, err := client.Do(iframeReq)
			if err == nil {
				iframeBody, _ := io.ReadAll(iframeResp.Body)
				iframeResp.Body.Close()
				iframeHtml := string(iframeBody)

				re := regexp.MustCompile(`(["'])(https?://[^"']+(\\.m3u8|\\.mp4|/hlsplaylist/|/hls/)[^"']*)\1`)
				matches := re.FindAllStringSubmatch(iframeHtml, -1)
				for _, match := range matches {
					found := strings.ReplaceAll(match[2], "\\/", "/")
					if !strings.Contains(found, "ads") && !strings.Contains(found, "videoAd") {
						m3u8URL = found
						targetURL = src
						break
					}
				}

				if m3u8URL == "" {
					fileRe := regexp.MustCompile(`file:\s*["']([^"']+(\\.m3u8|\\.mp4)[^"']*)["']`)
					fileMatch := fileRe.FindStringSubmatch(iframeHtml)
					if len(fileMatch) > 1 {
						m3u8URL = strings.ReplaceAll(fileMatch[1], "\\/", "/")
						targetURL = src
					}
				}

				if m3u8URL == "" {
					sourceRe := regexp.MustCompile(`(?i)<source.*?src=["']([^"']+(\\.m3u8|\\.mp4)[^"']*)["']`)
					sourceMatch := sourceRe.FindStringSubmatch(iframeHtml)
					if len(sourceMatch) > 1 {
						m3u8URL = strings.ReplaceAll(sourceMatch[1], "\\/", "/")
						targetURL = src
					}
				}
			}

			if m3u8URL != "" {
				if !strings.HasPrefix(m3u8URL, "http") {
					m3u8URL = resolveURL(src, m3u8URL)
				}
				break
			}

			m3u8URL = src
			break
		}
	}

	// 5. Final regex search
	if m3u8URL == "" {
		re := regexp.MustCompile(`(["'])(https?://[^"']+(\\.m3u8|\\.mp4|/hlsplaylist/|/hls/)[^"']*)\1`)
		matches := re.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			found := match[2]
			if !strings.Contains(found, "ads") && !strings.Contains(found, "videoAd") {
				m3u8URL = found
				break
			}
		}
	}

	if m3u8URL == "" {
		reSimple := regexp.MustCompile(`https?://[^\s"'<>]+?(\\.m3u8|\\.mp4|/hlsplaylist/|/hls/)[^\s"'<>]*`)
		matches := reSimple.FindAllString(html, -1)
		for _, found := range matches {
			if !strings.Contains(found, "ads") && !strings.Contains(found, "videoAd") {
				m3u8URL = found
				break
			}
		}
	}

	if m3u8URL != "" {
		if strings.HasPrefix(m3u8URL, "//") {
			m3u8URL = "https:" + m3u8URL
		} else if !strings.HasPrefix(m3u8URL, "http") {
			m3u8URL = resolveURL(targetURL, m3u8URL)
		}
		c.JSON(http.StatusOK, gin.H{
			"m3u8Url": m3u8URL,
			"referer": targetURL,
		})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Could not extract HLS link from the page."})
}

// HandleProxyM3U8 fetches and rewrites an M3U8 playlist so all segment
// URLs are proxied through this backend (solves CORS issues).
func HandleProxyM3U8(c *gin.Context) {
	m3u8URL := c.Query("url")
	if m3u8URL == "" {
		c.String(http.StatusBadRequest, "Missing url parameter")
		return
	}

	u, err := url.Parse(m3u8URL)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid URL")
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("GET", m3u8URL, nil)

	targetReferer := c.Query("referer")
	if targetReferer != "" {
		req.Header.Set("Referer", targetReferer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.String(resp.StatusCode, "Failed to fetch m3u8")
		return
	}

	var rewrittenLines []string
	var lines []string
	isMasterPlaylist := false

	scanner := bufio.NewScanner(resp.Body)
	buf := make([]byte, 0, 1024*1024) // 1MB buffer
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			rewrittenLines = append(rewrittenLines, "")
			continue
		}
		if strings.Contains(line, "#EXT-X-STREAM-INF") {
			isMasterPlaylist = true
		}
		lines = append(lines, line)
	}

	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	backendBaseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	for _, line := range lines {
		if line == "" {
			rewrittenLines = append(rewrittenLines, "")
			continue
		}

		if strings.HasPrefix(line, "#") {
			if strings.Contains(line, "URI=") {
				re := regexp.MustCompile(`URI="([^"]+)"`)
				newLine := re.ReplaceAllStringFunc(line, func(match string) string {
					subMatch := re.FindStringSubmatch(match)
					if len(subMatch) > 1 {
						uri := subMatch[1]
						absURL := resolveURL(m3u8URL, uri)
						lowerAbsURL := strings.ToLower(absURL)
						isImageOrSegment := strings.HasSuffix(lowerAbsURL, ".ts") || strings.HasSuffix(lowerAbsURL, ".jpg") || strings.HasSuffix(lowerAbsURL, ".jpeg") || strings.HasSuffix(lowerAbsURL, ".vtt") || strings.HasSuffix(lowerAbsURL, ".mp4") || strings.HasSuffix(lowerAbsURL, ".m4s")
						isPlaylist := strings.Contains(lowerAbsURL, ".m3u8") || (!isImageOrSegment && (strings.Contains(lowerAbsURL, "/hlsplaylist/") || strings.Contains(lowerAbsURL, "/hls/")))
						endpoint := backendBaseURL + "/api/proxy-ts"
						if isPlaylist {
							endpoint = backendBaseURL + "/api/proxy-m3u8"
						}
						refererParam := ""
						if targetReferer != "" {
							refererParam = fmt.Sprintf("&referer=%s", url.QueryEscape(targetReferer))
						}
						return fmt.Sprintf(`URI="%s?url=%s%s"`, endpoint, url.QueryEscape(absURL), refererParam)
					}
					return match
				})
				rewrittenLines = append(rewrittenLines, newLine)
			} else {
				rewrittenLines = append(rewrittenLines, line)
			}
			continue
		}

		absURL := resolveURL(m3u8URL, line)
		refererParam := ""
		if targetReferer != "" {
			refererParam = fmt.Sprintf("&referer=%s", url.QueryEscape(targetReferer))
		}
		lowerAbsURL := strings.ToLower(absURL)
		isImageOrSegment := strings.HasSuffix(lowerAbsURL, ".ts") || strings.HasSuffix(lowerAbsURL, ".jpg") || strings.HasSuffix(lowerAbsURL, ".jpeg") || strings.HasSuffix(lowerAbsURL, ".vtt") || strings.HasSuffix(lowerAbsURL, ".mp4") || strings.HasSuffix(lowerAbsURL, ".m4s")

		if isMasterPlaylist || strings.Contains(lowerAbsURL, ".m3u8") || (!isImageOrSegment && (strings.Contains(lowerAbsURL, "/hlsplaylist/") || strings.Contains(lowerAbsURL, "/hls/"))) {
			rewrittenLines = append(rewrittenLines, fmt.Sprintf("%s/api/proxy-m3u8?url=%s%s", backendBaseURL, url.QueryEscape(absURL), refererParam))
		} else {
			rewrittenLines = append(rewrittenLines, fmt.Sprintf("%s/api/proxy-ts?url=%s%s", backendBaseURL, url.QueryEscape(absURL), refererParam))
		}
	}

	c.Header("Content-Type", "application/vnd.apple.mpegurl")
	c.Header("Access-Control-Allow-Origin", "*")
	c.String(http.StatusOK, strings.Join(rewrittenLines, "\n"))
}

// HandleProxyTS proxies a video segment (.ts, .m4s, .mp4, etc.) through the backend.
func HandleProxyTS(c *gin.Context) {
	tsURL := c.Query("url")
	if tsURL == "" {
		c.String(http.StatusBadRequest, "Missing url parameter")
		return
	}

	u, err := url.Parse(tsURL)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid URL")
		return
	}

	client := &http.Client{Timeout: 60 * time.Second}
	req, _ := http.NewRequest("GET", tsURL, nil)

	if rangeHeader := c.Request.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	targetReferer := c.Query("referer")
	if targetReferer != "" {
		req.Header.Set("Referer", targetReferer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		c.String(resp.StatusCode, "Failed to fetch segment")
		return
	}

	for k, v := range resp.Header {
		if k == "Content-Length" || k == "Content-Range" || k == "Accept-Ranges" {
			c.Header(k, v[0])
		}
	}

	ext := strings.ToLower(filepath.Ext(tsURL))
	if ext == ".m4s" || ext == ".mp4" || strings.Contains(tsURL, ".m4s") || strings.Contains(tsURL, ".mp4") {
		c.Header("Content-Type", "video/mp4")
	} else if ext == ".m3u8" || strings.Contains(tsURL, ".m3u8") {
		c.Header("Content-Type", "application/vnd.apple.mpegurl")
	} else if ext == ".jpg" || ext == ".jpeg" || strings.Contains(tsURL, "thumbnails") {
		c.Header("Content-Type", "image/jpeg")
	} else if ext == ".vtt" || strings.Contains(tsURL, ".vtt") {
		c.Header("Content-Type", "text/vtt")
	} else {
		c.Header("Content-Type", "video/MP2T")
	}

	c.Header("Access-Control-Allow-Origin", "*")
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

// HandleFetchJSON is a generic CORS proxy for JSON/AJAX requests from the video player.
func HandleFetchJSON(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing url parameter"})
		return
	}

	u, err := url.Parse(targetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid URL"})
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	var req *http.Request

	if c.Request.Method == "POST" || (u.RawQuery != "" && strings.Contains(targetURL, "admin-ajax.php")) {
		var bodyReader io.Reader
		contentType := "application/x-www-form-urlencoded"

		if u.RawQuery != "" && strings.Contains(targetURL, "admin-ajax.php") {
			form := url.Values{}
			for k, v := range u.Query() {
				form.Set(k, v[0])
			}
			bodyReader = strings.NewReader(form.Encode())
			u.RawQuery = ""
			targetURL = u.String()
		} else {
			body, _ := io.ReadAll(c.Request.Body)
			bodyReader = bytes.NewBuffer(body)
			if ct := c.Request.Header.Get("Content-Type"); ct != "" {
				contentType = ct
			}
		}

		req, _ = http.NewRequest("POST", targetURL, bodyReader)
		req.Header.Set("Content-Type", contentType)
	} else {
		req, _ = http.NewRequest("GET", targetURL, nil)
	}

	referer := c.Query("referer")
	if referer != "" {
		req.Header.Set("Referer", referer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

// HandleProxyVideo proxies a direct video stream (MP4, etc.) through the backend.
func HandleProxyVideo(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.String(http.StatusBadRequest, "Missing url parameter")
		return
	}

	u, err := url.Parse(targetURL)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid URL")
		return
	}

	client := &http.Client{
		Timeout: 300 * time.Second, // Longer timeout for video streaming
	}
	req, _ := http.NewRequest("GET", targetURL, nil)

	for k, v := range c.Request.Header {
		if k == "Range" || k == "User-Agent" || k == "Accept" {
			req.Header.Set(k, v[0])
		}
	}

	referer := c.Query("referer")
	if referer != "" {
		req.Header.Set("Referer", referer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}

	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	for k, v := range resp.Header {
		if k == "Content-Type" || k == "Content-Length" || k == "Accept-Ranges" || k == "Content-Range" || k == "Last-Modified" || k == "ETag" {
			c.Header(k, v[0])
		}
	}
	c.Header("Access-Control-Allow-Origin", "*")

	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}
