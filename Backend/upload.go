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
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
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

	// ✅ Pass metadata for immediate Google Sheet sync
	if originalReq != nil {
		req.OrderID = originalReq.OrderID
		req.SheetName = originalReq.SheetName
		req.PrimaryKey = originalReq.PrimaryKey
		req.TargetColumn = originalReq.TargetColumn
		req.NewData = originalReq.NewData
		req.UserName = originalReq.UserName
		req.MovieID = originalReq.MovieID

		// For orders, we need the team to update the correct sheet
		if originalReq.OrderID != "" {
			teamVal := ""
			var teamOrder Order
			if err := DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", originalReq.OrderID).Select("team").First(&teamOrder).Error; err == nil {
				teamVal = teamOrder.Team
			} else {
				log.Printf("⚠️ [Drive Upload] Cannot find team for order %s: %v", originalReq.OrderID, err)
			}
			// Always set OrderData so Apps Script receives team context (even if empty)
			req.OrderData = map[string]interface{}{"team": teamVal}
		}
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

	// ── Validate state machine transitions for orders ─────────────────────
	if req.OrderID != "" && req.NewData != nil {
		if newStatusRaw, hasStatus := req.NewData["Fulfillment Status"]; hasStatus {
			newStatus := strings.TrimSpace(fmt.Sprintf("%v", newStatusRaw))

			var currentOrder Order
			if err := DB.Where("order_id = ?", req.OrderID).Select("fulfillment_status").First(&currentOrder).Error; err != nil {
				log.Printf("⚠️ [Upload] Cannot find order %s for validation: %v", req.OrderID, err)
				c.JSON(404, gin.H{"status": "error", "message": "រកមិនឃើញការកម្មង់"})
				return
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
			if ok {
				transitionValid := false
				for _, s := range allowed {
					if s == newStatus {
						transitionValid = true
						break
					}
				}
				if !transitionValid {
					log.Printf("⛔ [Upload] Invalid transition: %s → %s for order %s", currentStatus, newStatus, req.OrderID)
					c.JSON(400, gin.H{"status": "error", "message": fmt.Sprintf("មិនអាចផ្លាស់ប្តូរពី '%s' ទៅ '%s' បានទេ", currentStatus, newStatus)})
					return
				}
			}
		}
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
				}
			}
		}

		// 1.2 Process the uploaded image URL
		if req.TargetColumn != "" {
			dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
			if UploadIsValidOrderColumnFunc(dbCol) {
				dbUpdateMap[dbCol] = driveURL
				broadcastMap[req.TargetColumn] = driveURL
			}
		}

		if len(dbUpdateMap) > 0 {
			// Update Database
			res := DB.Model(&Order{}).Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", req.OrderID).UpdateColumns(dbUpdateMap)
			if res.Error != nil {
				log.Printf("❌ [Upload] DB update failed for order %s: %v", req.OrderID, res.Error)
			} else {
				log.Printf("✅ [Upload] DB update SUCCESS: orderId=%s rowsAffected=%d fields=%v", req.OrderID, res.RowsAffected, broadcastMap)
			}

			// Sync to Google Sheets & Telegram
			go func(orderId string, bMap map[string]interface{}) {
				var order Order
				if err := DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", orderId).First(&order).Error; err == nil {
					// Prepare data for Sheet sync
					sheetData := make(map[string]interface{})
					for k, v := range bMap {
						sheetData[k] = v
					}
					
					// Ensure we have current packer info and photo URL from DB
					if sheetData["Packed By"] == nil && order.PackedBy != "" {
						sheetData["Packed By"] = order.PackedBy
					}
					if sheetData["Packed Time"] == nil && order.PackedTime != "" {
						sheetData["Packed Time"] = order.PackedTime
					}
					if order.PackagePhotoURL != "" {
						sheetData["Package Photo"] = order.PackagePhotoURL
					}
					if order.DeliveryPhotoURL != "" {
						sheetData["Delivery Photo URL"] = order.DeliveryPhotoURL
					}

					// 1.3 Full Update including Sheet Sync & Telegram Notification
					// This single call handles everything robustly.
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
