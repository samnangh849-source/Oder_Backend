package backend

// =========================================================================
// UPLOAD / SAVE PHOTO & AUDIO MODULE
// =========================================================================
// ឯកសារនេះរួមបញ្ចូល logic ដែលពាក់ព័ន្ធនឹងការ Upload រូបភាព និងសម្លេង
// ដោយប្រើប្រាស់ Google Apps Script ជាអ្នក Upload ទៅកាន់ Google Drive ដោយផ្ទាល់។
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
func UploadToGoogleDriveDirectly(base64Data string, fileName string, mimeType string) (string, string, error) {
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

func HandleServeTempImage(c *gin.Context) {
	id := c.Param("id")
	var temp TempImage
	if err := DB.Where("id = ?", id).First(&temp).Error; err != nil {
		c.JSON(404, gin.H{"error": "រកមិនឃើញរូបភាព ឬផុតកំណត់"})
		return
	}
	decodedBytes, _ := ParseBase64(temp.ImageData)
	c.Data(200, temp.MimeType, decodedBytes)
}

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

	tempID := UploadGenerateIDFunc() + UploadGenerateIDFunc()
	DB.Create(&TempImage{
		ID:        tempID,
		MimeType:  req.MimeType,
		ImageData: data,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	})

	protocol := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		protocol = "https"
	}
	tempUrl := fmt.Sprintf("%s://%s/api/images/temp/%s", protocol, c.Request.Host, tempID)

	// ── Immediate DB write for non-photo fields ───────────────────────────────
	// Apply NewData fields (Fulfillment Status, Packed By, Packed Time, etc.) to
	// the DB and broadcast NOW — before Drive upload starts. This ensures all
	// other users see the status change immediately rather than waiting 10-60s
	// for the background Drive upload to complete.
	if req.OrderID != "" && req.NewData != nil {
		// ✅ Validate state machine transitions (same rules as handleAdminUpdateOrder)
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
				"Pending":       {"Ready to Ship"},
				"Ready to Ship": {"Shipped", "Pending"},
				"Shipped":       {"Delivered", "Ready to Ship"},
				"Delivered":     {},
				"Cancelled":     {},
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

		immediateMap := map[string]interface{}{}
		immediateBroadcast := map[string]interface{}{}
		for k, v := range req.NewData {
			dbCol := UploadMapToDBColumnFunc(k)
			if UploadIsValidOrderColumnFunc(dbCol) {
				immediateMap[dbCol] = v
				immediateBroadcast[k] = v
			}
		}

		// Also update the photo column with the temp URL immediately in the DB
		// so it shows up for all users right away.
		if req.TargetColumn != "" {
			dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
			immediateMap[dbCol] = tempUrl
			immediateBroadcast[req.TargetColumn] = tempUrl
		}

		if len(immediateMap) > 0 {
			// Use UpdateColumns (plural) to skip GORM hooks and update only these columns immediately
			if res := DB.Model(&Order{}).Where("order_id = ?", req.OrderID).UpdateColumns(immediateMap); res.Error != nil {
				log.Printf("❌ [Upload] Immediate DB update failed for order %s: %v", req.OrderID, res.Error)
				c.JSON(500, gin.H{"status": "error", "message": fmt.Sprintf("មិនអាចធ្វើបច្ចុប្បន្នភាពការកម្មង់បានទេ: %v", res.Error)})
				return
			} else {
				log.Printf("✅ [Upload] Immediate DB update SUCCESS: orderId=%s fields=%v", req.OrderID, immediateBroadcast)
			}
			
			// Broadcast update so all clients see the status change immediately
			event, _ := json.Marshal(map[string]interface{}{
				"type":    "update_order",
				"orderId": req.OrderID,
				"newData": immediateBroadcast,
			})
			HubGlobal.Broadcast <- event

			// Sync with Google Sheets IMMEDIATELY for status and packer info
			// We exclude the temp URL from the sheet to prevent broken links later,
			// the background worker will update the permanent Drive URL once ready.
			go func(oid string, data map[string]interface{}) {
				var order Order
				team := ""
				if res := DB.Where("order_id = ?", oid).Select("team").First(&order); res.Error == nil {
					team = order.Team
				}

				sheetFields := make(map[string]interface{})
				for k, v := range data {
					// Skip temp URLs for Google Sheets
					if str, ok := v.(string); ok && strings.Contains(str, "/api/images/temp/") {
						continue
					}
					sheetFields[k] = v
				}

				if len(sheetFields) > 0 {
					log.Printf("📋 [Immediate Sync] orderId=%s updatedFields=%v", oid, sheetFields)
					EnqueueSync("updateOrderTelegram", map[string]interface{}{
						"orderId":       oid,
						"team":          team,
						"updatedFields": sheetFields,
					}, "", nil)
				}
			}(req.OrderID, immediateBroadcast)
		}
	}

	c.JSON(200, gin.H{
		"status":  "success",
		"message": "Processing upload...",
		"tempUrl": tempUrl,
		"url":     tempUrl,
	})

	go func(r AppsScriptRequest, rawData string, tid string) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("🔥 PANIC in background upload: %v", rec)
			}
		}()

		log.Printf("⏳ [Background Upload] Starting for tempID=%s file=%q mime=%q", tid, r.FileName, r.MimeType)
		driveURL, fileID, err := UploadToGoogleDriveDirectly(rawData, r.FileName, r.MimeType)

		if err != nil {
			log.Printf("❌ [Background Upload] FAILED for tempID=%s: %v", tid, err)
			// Do not return yet if it's an Order update; we still need to sync the status (NewData).
		} else {
			log.Printf("✅ [Background Upload] SUCCESS tempID=%s fileID=%s driveURL=%s", tid, fileID, driveURL)
			// Save the resolved DriveURL in TempImage for later retrieval (if needed by CreateMovie)
			DB.Model(&TempImage{}).Where("id = ?", tid).UpdateColumn("drive_url", driveURL)
		}

		// 1. Specialized Order Update (Needs Team for Telegram)
		if r.OrderID != "" {
			log.Printf("📦 [Background Update] Specialized Order update: orderId=%s", r.OrderID)

			// Prepare combined update data for final sync
			broadcastData := map[string]interface{}{}
			dbUpdateMap := map[string]interface{}{}

			// 1a. Include NewData if provided (e.g. Fulfillment Status, Packed By)
			if r.NewData != nil {
				for k, v := range r.NewData {
					broadcastData[k] = v
					dbUpdateMap[UploadMapToDBColumnFunc(k)] = v
				}
			}

			// 1b. Include Drive URL if upload succeeded
			if err == nil && r.TargetColumn != "" {
				broadcastData[r.TargetColumn] = driveURL
				dbUpdateMap[UploadMapToDBColumnFunc(r.TargetColumn)] = driveURL
			}

			// Update PostgreSQL first
			if res := DB.Model(&Order{}).Where("order_id = ?", r.OrderID).Updates(dbUpdateMap); res.Error != nil {
				log.Printf("⚠️ [Background Update] DB update failed for order %s: %v", r.OrderID, res.Error)
			}

			// Now fetch the latest state to ensure we have everything (including team)
			var order Order
			team := ""
			if res := DB.Where("order_id = ?", r.OrderID).First(&order); res.Error == nil {
				team = order.Team
			}

			// Build comprehensive sheet data: start from broadcastData then fill
			// missing fulfillment fields from the freshly updated DB record.
			sheetData := make(map[string]interface{})
			for k, v := range broadcastData {
				sheetData[k] = v
			}
			if order.OrderID != "" {
				fill := func(key, val string) {
					if val != "" {
						if _, exists := sheetData[key]; !exists {
							sheetData[key] = val
						}
					}
				}
				fill("Packed By", order.PackedBy)
				fill("Packed Time", order.PackedTime)
				fill("Package Photo URL", order.PackagePhotoURL)
				fill("Driver Name", order.DriverName)
				fill("Tracking Number", order.TrackingNumber)
				fill("Dispatched Time", order.DispatchedTime)
				fill("Dispatched By", order.DispatchedBy)
				fill("Delivered Time", order.DeliveredTime)
				fill("Delivery Photo URL", order.DeliveryPhotoURL)
			}

			log.Printf("📋 [Background Sync] orderId=%s updatedFields=%v", r.OrderID, sheetData)

			// SINGLE Sync call to Google Sheets and Telegram.
			// Apps Script's updateOrderTelegram already handles updating all relevant sheets.
			EnqueueSync("updateOrderTelegram", map[string]interface{}{
				"orderId":       r.OrderID,
				"team":          team,
				"updatedFields": sheetData,
			}, "", nil)

			return // Finished order processing
		}

		// For other types, stop if upload failed
		if err != nil {
			return
		}

		// 2. Specialized User Profile Update
		if r.UserName != "" {
			log.Printf("👤 [Background Update] Specialized User update: userName=%s", r.UserName)
			DB.Model(&User{}).Where("user_name = ?", r.UserName).UpdateColumn("profile_picture_url", driveURL)

			notify, _ := json.Marshal(map[string]interface{}{
				"type":     "profile_image_ready",
				"userName": r.UserName,
				"url":      driveURL,
			})
			HubGlobal.Broadcast <- notify

			// Also sync with Google Sheets
			EnqueueSync("updateSheet", map[string]interface{}{"ProfilePictureURL": driveURL}, "Users", map[string]string{"UserName": r.UserName})
		}

		// 3. Specialized Movie Update
		if r.MovieID != "" && r.TargetColumn != "" {
			log.Printf("🎬 [Background Update] Specialized Movie update: movieId=%s col=%s", r.MovieID, r.TargetColumn)
			dbCol := UploadMapToDBColumnFunc(r.TargetColumn)

			// Retry updating the database for up to 1 minute (for new records being created)
			for i := 0; i < 12; i++ {
				res := DB.Model(&Movie{}).Where("id = ?", r.MovieID).UpdateColumn(dbCol, driveURL)
				if res.Error == nil && res.RowsAffected > 0 {
					log.Printf("✅ [Background Update] SUCCESS: Updated movie %s column %s", r.MovieID, dbCol)
					break
				}
				log.Printf("⏳ [Background Update] Waiting for movie record %s... (attempt %d)", r.MovieID, i+1)
				time.Sleep(5 * time.Second)
			}

			// Also sync with Google Sheets if updated or if it's a known record
			EnqueueSync("updateSheet", map[string]interface{}{r.TargetColumn: driveURL}, "Movies", map[string]string{"ID": r.MovieID})

			// If we have a movie title, rename the file in Drive to match
			fID := ExtractFileIDFromURL(driveURL)
			if fID != "" {
				var mv Movie
				if err := DB.Where("id = ?", r.MovieID).First(&mv).Error; err == nil && mv.Title != "" {
					log.Printf("📂 [Background Update] Renaming Drive file %s to %q", fID, mv.Title)
					EnqueueSync("renameFile", map[string]interface{}{
						"fileID":  fID,
						"newName": mv.Title,
					}, "", nil)
				}
			}

			// Broadcast update
			notify, _ := json.Marshal(map[string]interface{}{
				"type":    "movie_thumbnail_ready",
				"movieId": r.MovieID,
				"url":     driveURL,
			})
			HubGlobal.Broadcast <- notify
		}

		// 4. Generic Table/Sheet Update (Handles other tables)
		if r.SheetName != "" && r.PrimaryKey != nil && r.TargetColumn != "" && r.SheetName != "Movies" {
			log.Printf("📝 [Background Update] Generic update for sheet=%s PK=%v col=%s", r.SheetName, r.PrimaryKey, r.TargetColumn)

			// Sync with Google Sheets via managed queue
			EnqueueSync("updateSheet", map[string]interface{}{r.TargetColumn: driveURL}, r.SheetName, r.PrimaryKey)

			// Update PostgreSQL
			tableName := UploadGetTableNameFunc(r.SheetName)
			if tableName != "" {
				dbCol := UploadMapToDBColumnFunc(r.TargetColumn)
				query := DB.Table(tableName)
				for k, v := range r.PrimaryKey {
					query = query.Where(UploadMapToDBColumnFunc(k)+" = ?", v)
				}
				res := query.UpdateColumn(dbCol, driveURL)
				if res.Error != nil {
					log.Printf("❌ [Background Update] DB update failed for %s: %v", tableName, res.Error)
				} else if res.RowsAffected == 0 {
					log.Printf("⚠️ [Background Update] No rows affected for %s (PK: %v)", tableName, r.PrimaryKey)
				} else {
					log.Printf("✅ [Background Update] DB updated for %s (%s)", tableName, r.TargetColumn)
				}
			}
		}

		log.Printf("✅ Background upload complete: %s", driveURL)
	}(req, data, tempID)
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
