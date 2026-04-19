package backend

// =========================================================================
// UPLOAD / SAVE PHOTO & AUDIO MODULE
// =========================================================================
// ឯកសារនេះរួមបញ្ចូល logic ដែលពាក់ព័ន្ធនឹងការ Upload រូបភាព និងសម្លេង
// ដោយប្រើប្រាស់ Google Apps Script ជាអ្នក Upload ទៅកាន់ Google Drive ដោយផ្ទាល់។
// Upload ដោយ synchronous — រង់ចាំ Drive URL រួចទើប save DB និង return។
// =========================================================================

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ── Injectable Dependencies ───────────────────────────────────────────────
// These functions are implemented in main.go and injected here upon startup.

var (
	UploadGenerateIDFunc         func() string
	UploadMapToDBColumnFunc      func(string) string
	UploadGetTableNameFunc       func(string) string
	UploadIsValidOrderColumnFunc func(string) bool
)

// ── Helper Functions ──────────────────────────────────────────────────────

func ParseBase64(b64 string) ([]byte, error) {
	// 1. Remove data URI prefix if present (e.g. "data:image/jpeg;base64,")
	if strings.Contains(b64, ",") {
		parts := strings.Split(b64, ",")
		if len(parts) > 1 {
			b64 = parts[1]
		}
	}

	// 2. Clean whitespace/newlines
	cleanB64 := strings.ReplaceAll(b64, " ", "+")
	cleanB64 = strings.ReplaceAll(cleanB64, "\n", "")
	cleanB64 = strings.ReplaceAll(cleanB64, "\r", "")
	cleanB64 = strings.TrimSpace(cleanB64)

	return base64.StdEncoding.DecodeString(cleanB64)
}

func ExtractFileIDFromURL(url string) string {
	if strings.Contains(url, "id=") {
		parts := strings.Split(url, "id=")
		if len(parts) > 1 {
			return strings.Split(parts[1], "&")[0]
		}
	}
	// Also handle /d/ format
	if strings.Contains(url, "/d/") {
		parts := strings.Split(url, "/d/")
		if len(parts) > 1 {
			return strings.Split(parts[1], "/")[0]
		}
	}
	return ""
}

func ExtractDriveFolderID(idOrURL string) string {
	idOrURL = strings.TrimSpace(idOrURL)
	if idOrURL == "" {
		return "root"
	}
	if strings.Contains(idOrURL, "drive.google.com") {
		if strings.Contains(idOrURL, "folders/") {
			parts := strings.Split(idOrURL, "folders/")
			if len(parts) > 1 {
				return strings.Split(strings.Split(parts[1], "?")[0], "/")[0]
			}
		}
		if strings.Contains(idOrURL, "id=") {
			parts := strings.Split(idOrURL, "id=")
			if len(parts) > 1 {
				return strings.Split(parts[1], "&")[0]
			}
		}
	}
	// If it's a raw ID (usually ~33 chars), return as is
	return idOrURL
}

// ── Core Upload Function ──────────────────────────────────────────────────

// UploadToGoogleDriveDirectly sends base64 data to Google Apps Script which uploads it to Drive.
func UploadToGoogleDriveDirectly(base64Data string, fileName string, mimeType string, originalReq *AppsScriptRequest) (string, string, error) {
	log.Printf("📤 [Drive Upload via AppsScript] file=%q mime=%q dataLen=%d", fileName, mimeType, len(base64Data))

	if fileName == "" {
		fileName = "upload_" + time.Now().Format("20060102_150405")
	}

	// Resolve target folder ID (env > DB setting exported from migration.go)
	targetFolder := "root"
	if envFolderID := os.Getenv("UPLOAD_FOLDER_ID"); envFolderID != "" {
		targetFolder = ExtractDriveFolderID(envFolderID)
		log.Printf("📁 [Drive Upload] Using folder from UPLOAD_FOLDER_ID env: %q", targetFolder)
	} else if UploadFolderID != "" && !strings.Contains(UploadFolderID, "Folder_Google_Drive") {
		targetFolder = ExtractDriveFolderID(UploadFolderID)
		log.Printf("📁 [Drive Upload] Using folder from DB setting: %q", targetFolder)
	} else {
		log.Println("⚠️ [Drive Upload] No valid UPLOAD_FOLDER_ID set — uploading to Drive root")
	}

	// Call Apps Script to upload via Google user quota (not Service Account quota)
	req := AppsScriptRequest{
		Action:         "uploadImage",
		FileData:       base64Data,
		FileName:       fileName,
		MimeType:       mimeType,
		UploadFolderID: targetFolder,
	}

	// Pass caller metadata so Apps Script can route non-order uploads
	// (generic table, user profile, movies). For orders, Apps Script only
	// uploads to Drive — Sheet sync is handled by the Go backend via EnqueueSync.
	if originalReq != nil {
		req.OrderID = originalReq.OrderID
		req.Team = originalReq.Team
		req.SheetName = originalReq.SheetName
		req.PrimaryKey = originalReq.PrimaryKey
		req.TargetColumn = originalReq.TargetColumn
		req.NewData = originalReq.NewData
		req.UserName = originalReq.UserName
		req.MovieID = originalReq.MovieID
	}

	log.Printf("🚀 [Drive Upload] Calling Apps Script uploadImage action...")
	resp, err := CallAppsScriptPOST(req)
	if err != nil {
		log.Printf("❌ [Drive Upload] Apps Script HTTP call error: %v", err)
		return "", "", fmt.Errorf("apps script upload error: %v", err)
	}
	if resp.Status != "success" || resp.URL == "" {
		log.Printf("❌ [Drive Upload] Apps Script returned failure: %s", resp.Message)
		return "", "", fmt.Errorf("apps script upload failed: %s", resp.Message)
	}

	log.Printf("✅ [Drive Upload] SUCCESS: fileID=%s url=%s", resp.FileID, resp.URL)
	return resp.URL, resp.FileID, nil
}

// ── Request Handlers ──────────────────────────────────────────────────────

func HandleImageUploadProxy(c *gin.Context) {
	var req AppsScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	data := req.FileData
	if data == "" {
		data = req.Image
	}
	if data == "" {
		c.Error(fmt.Errorf("មិនមានទិន្នន័យឯកសារ"))
		return
	}

	// ── Upload to Google Drive synchronously ──────────────────────────────
	log.Printf("📤 [Upload] Uploading to Drive synchronously for file=%q", req.FileName)
	driveURL, fileID, err := UploadToGoogleDriveDirectly(data, req.FileName, req.MimeType, &req)
	if err != nil {
		log.Printf("❌ [Upload] Drive upload failed: %v", err)
		c.JSON(500, gin.H{"status": "error", "message": fmt.Sprintf("បរាជ័យក្នុងការ Upload: %v", err)})
		return
	}

	// ── 1. Order Update ──────────────────────────────────────────────────
	if req.OrderID != "" {
		dbUpdateMap := map[string]interface{}{}
		broadcastMap := map[string]interface{}{}

		// 1.1 Process NewData from request (e.g. status, packer info)
		if req.NewData != nil {
			for k, v := range req.NewData {
				dbCol := UploadMapToDBColumnFunc(k)
				if UploadIsValidOrderColumnFunc(dbCol) {
					dbUpdateMap[dbCol] = v
					broadcastMap[k] = v
					
					// Ensure consistency between different naming conventions
					if dbCol == "fulfillment_status" {
						broadcastMap["Fulfillment Status"] = v
						broadcastMap["FulfillmentStatus"] = v
					}
				}
			}
		}

		// 1.2 Process the uploaded image URL
		if req.TargetColumn != "" {
			dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
			if UploadIsValidOrderColumnFunc(dbCol) {
				dbUpdateMap[dbCol] = driveURL
				broadcastMap[req.TargetColumn] = driveURL
				
				// Standardize field names for frontend/sync
				if dbCol == "package_photo_url" {
					broadcastMap["Package Photo"] = driveURL
					broadcastMap["package_photo_url"] = driveURL
				}
			}
		}

		if len(dbUpdateMap) > 0 {
			log.Printf("🛠️ [Upload] Applying DB Update for %s: %v", req.OrderID, dbUpdateMap)

			// ── Atomic: validate state machine transition + apply update in one transaction ──
			// This prevents TOCTOU: another request cannot change the status between our check and update.
			var hasStatus bool
			var newStatusRaw interface{}
			if req.NewData != nil {
				newStatusRaw, hasStatus = req.NewData["Fulfillment Status"]
			}
			var rowsAffected int64
			txErr := DB.Transaction(func(tx *gorm.DB) error {
				if hasStatus && req.NewData != nil {
					newStatus := strings.TrimSpace(fmt.Sprintf("%v", newStatusRaw))

					var currentOrder Order
					if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
						Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", req.OrderID).
						Select("fulfillment_status").
						First(&currentOrder).Error; err != nil {
						return fmt.Errorf("រកមិនឃើញការកម្មង់ %s: %w", req.OrderID, err)
					}

					currentStatus := strings.TrimSpace(currentOrder.FulfillmentStatus)
					if currentStatus == "" {
						currentStatus = "Pending"
					}

					validTransitions := map[string][]string{
						"Scheduled":     {"Pending", "Cancelled"},
						"Pending":       {"Processing", "Ready to Ship", "Cancelled"},
						"Processing":    {"Ready to Ship", "Pending", "Cancelled"},
						"Ready to Ship": {"Shipped", "Pending", "Cancelled"},
						"Shipped":       {"Delivered", "Ready to Ship", "Cancelled"},
						"Delivered":     {},
						"Cancelled":     {"Pending", "Scheduled"},
					}

					allowed, ok := validTransitions[currentStatus]
					if ok && newStatus != currentStatus {
						transitionValid := false
						for _, s := range allowed {
							if s == newStatus {
								transitionValid = true
								break
							}
						}
						if !transitionValid {
							log.Printf("⛔ [Upload] Invalid transition: %s → %s for order %s", currentStatus, newStatus, req.OrderID)
							return fmt.Errorf("INVALID_TRANSITION:%s→%s", currentStatus, newStatus)
						}
					}
				}

				res := tx.Table("orders").Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", req.OrderID).Updates(dbUpdateMap)
				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected == 0 {
					return fmt.Errorf("NOT_FOUND:%s", req.OrderID)
				}
				rowsAffected = res.RowsAffected
				return nil
			})

			if txErr != nil {
				errStr := txErr.Error()
				if strings.HasPrefix(errStr, "INVALID_TRANSITION:") {
					parts := strings.SplitN(strings.TrimPrefix(errStr, "INVALID_TRANSITION:"), "→", 2)
					from, to := parts[0], parts[1]
					c.JSON(400, gin.H{"status": "error", "message": fmt.Sprintf("មិនអាចផ្លាស់ប្តូរពី '%s' ទៅ '%s' បានទេ", from, to)})
				} else if strings.HasPrefix(errStr, "NOT_FOUND:") {
					log.Printf("⚠️ [Upload] No rows updated for order %s", req.OrderID)
					c.JSON(404, gin.H{"status": "error", "message": "មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ៖ រកមិនឃើញការកម្មង់ " + req.OrderID})
				} else if strings.Contains(errStr, "រកមិនឃើញការកម្មង់") {
					log.Printf("⚠️ [Upload] Cannot find order %s for validation: %v", req.OrderID, txErr)
					c.JSON(404, gin.H{"status": "error", "message": txErr.Error()})
				} else {
					log.Printf("❌ [Upload] DB transaction failed for order %s: %v", req.OrderID, txErr)
					c.JSON(500, gin.H{"status": "error", "message": "ការធ្វើបច្ចុប្បន្នភាពមូលដ្ឋានទិន្នន័យបរាជ័យ: " + txErr.Error()})
				}
				return
			}

			log.Printf("✅ [Upload] DB update SUCCESS: orderId=%s rowsAffected=%d fields=%v", req.OrderID, rowsAffected, broadcastMap)

			// Sync to Google Sheets & Telegram
			go func(orderId string, bMap map[string]interface{}) {
				var order Order
				if err := DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", orderId).First(&order).Error; err == nil {
					sheetData := make(map[string]interface{})
					
					// IMPORTANT: Map database column names back to Spreadsheet Header names
					for k, v := range bMap {
						headerName := k 
						switch k {
						case "package_photo_url", "Package Photo URL":
							headerName = "Package Photo"
						case "delivery_photo_url", "Delivery Photo URL":
							headerName = "Delivery Photo URL"
						case "fulfillment_status", "FulfillmentStatus":
							headerName = "Fulfillment Status"
						case "packed_by":
							headerName = "Packed By"
						case "packed_time":
							headerName = "Packed Time"
						case "dispatched_by":
							headerName = "Dispatched By"
						case "dispatched_time":
							headerName = "Dispatched Time"
						case "delivered_time":
							headerName = "Delivered Time"
						case "driver_name":
							headerName = "Driver Name"
						case "tracking_number":
							headerName = "Tracking Number"
						}
						sheetData[headerName] = v
					}
					
					// Fill in required context for Apps Script
					if sheetData["Fulfillment Status"] == nil {
						sheetData["Fulfillment Status"] = order.FulfillmentStatus
					}
					if sheetData["Team"] == nil {
						sheetData["Team"] = order.Team
					}

					// 1.3 Full Update including Sheet Sync & Telegram Notification
					EnqueueSync("updateOrderTelegram", map[string]interface{}{
						"orderId":       orderId,
						"team":          order.Team,
						"updatedFields": sheetData,
					}, "", nil)
				}
			}(req.OrderID, broadcastMap)

			// Broadcast to all connected clients
			event, _ := json.Marshal(map[string]interface{}{
				"type":    "update_order",
				"orderId": req.OrderID,
				"newData": broadcastMap,
			})
			HubGlobal.Broadcast <- event
		}
	}

	// ── 2. User Profile Update ───────────────────────────────────────────
	if req.UserName != "" {
		DB.Model(&User{}).Where("user_name = ?", req.UserName).UpdateColumn("profile_picture_url", driveURL)

		notify, _ := json.Marshal(map[string]interface{}{
			"type":     "profile_image_ready",
			"userName": req.UserName,
			"url":      driveURL,
		})
		HubGlobal.Broadcast <- notify

		// Use space-friendly key for Google Sheets sync to match typical headers
		EnqueueSync("updateSheet", map[string]interface{}{"Profile Picture URL": driveURL}, "Users", map[string]string{"UserName": req.UserName})
	}

	// ── 3. Movie Update ──────────────────────────────────────────────────
	if req.MovieID != "" && req.TargetColumn != "" {
		dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
		DB.Model(&Movie{}).Where("id = ?", req.MovieID).UpdateColumn(dbCol, driveURL)

		EnqueueSync("updateSheet", map[string]interface{}{req.TargetColumn: driveURL}, "Movies", map[string]string{"ID": req.MovieID})

		// Rename file in Drive to match movie title
		fID := ExtractFileIDFromURL(driveURL)
		if fID != "" {
			var mv Movie
			if err := DB.Where("id = ?", req.MovieID).First(&mv).Error; err == nil && mv.Title != "" {
				log.Printf("📂 [Upload] Renaming Drive file %s to %q", fID, mv.Title)
				EnqueueSync("renameFile", map[string]interface{}{
					"fileID":  fID,
					"newName": mv.Title,
				}, "", nil)
			}
		}

		notify, _ := json.Marshal(map[string]interface{}{
			"type":    "movie_thumbnail_ready",
			"movieId": req.MovieID,
			"url":     driveURL,
		})
		HubGlobal.Broadcast <- notify
	}

	// ── 4. Generic Table/Sheet Update ────────────────────────────────────
	if req.SheetName != "" && req.PrimaryKey != nil && req.TargetColumn != "" && req.SheetName != "Movies" {
		EnqueueSync("updateSheet", map[string]interface{}{req.TargetColumn: driveURL}, req.SheetName, req.PrimaryKey)

		tableName := UploadGetTableNameFunc(req.SheetName)
		if tableName != "" {
			dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
			query := DB.Table(tableName)
			for k, v := range req.PrimaryKey {
				query = query.Where(UploadMapToDBColumnFunc(k)+" = ?", v)
			}
			res := query.UpdateColumn(dbCol, driveURL)
			if res.Error != nil {
				log.Printf("❌ [Upload] DB update failed for %s: %v", tableName, res.Error)
			}
		}
	}

	log.Printf("✅ [Upload] Complete: driveURL=%s fileID=%s", driveURL, fileID)
	c.JSON(200, gin.H{
		"status": "success",
		"url":    driveURL,
		"fileID": fileID,
	})
}

func HandleGetAudioProxy(c *gin.Context) {
	fileID := c.Param("fileID")
	resp, err := http.Get(fmt.Sprintf("https://drive.google.com/uc?id=%s&export=download", fileID))
	if err != nil || resp.StatusCode != 200 {
		c.Error(fmt.Errorf("failed to fetch audio"))
		return
	}
	defer resp.Body.Close()
	c.Writer.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	io.Copy(c.Writer, resp.Body)
}

// HandleProxyImage fetches an external image server-side and returns it to the browser.
// This bypasses browser CORS restrictions that prevent canvas.toDataURL() on cross-origin
// images — the server has no such restriction.
//
// GET /api/proxy-image?url=<encoded-image-url>
func HandleProxyImage(c *gin.Context) {
	rawURL := c.Query("url")
	if rawURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url parameter required"})
		return
	}

	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid url"})
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "fetch failed"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("upstream %d", resp.StatusCode)})
		return
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/png"
	}
	c.Header("Content-Type", ct)
	c.Header("Cache-Control", "public, max-age=3600")
	io.Copy(c.Writer, resp.Body)
}
