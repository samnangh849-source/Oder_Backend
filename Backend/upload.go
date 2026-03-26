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
	cleanB64 := strings.ReplaceAll(b64, " ", "+")
	cleanB64 = strings.ReplaceAll(cleanB64, "\n", "")
	cleanB64 = strings.ReplaceAll(cleanB64, "\r", "")
	return base64.StdEncoding.DecodeString(cleanB64)
}

func ExtractFileIDFromURL(url string) string {
	if strings.Contains(url, "id=") {
		parts := strings.Split(url, "id=")
		if len(parts) > 1 {
			return strings.Split(parts[1], "&")[0]
		}
	}
	return ""
}

func ExtractDriveFolderID(idOrURL string) string {
	idOrURL = strings.TrimSpace(idOrURL)
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
	targetFolder := ""
	if envFolderID := os.Getenv("UPLOAD_FOLDER_ID"); envFolderID != "" {
		targetFolder = ExtractDriveFolderID(envFolderID)
		log.Printf("📁 [Drive Upload] Folder from UPLOAD_FOLDER_ID env: %q", targetFolder)
	} else if UploadFolderID != "" {
		targetFolder = ExtractDriveFolderID(UploadFolderID)
		log.Printf("📁 [Drive Upload] Folder from DB setting: %q", targetFolder)
	} else {
		log.Println("⚠️ [Drive Upload] No UPLOAD_FOLDER_ID set — uploading to Drive root")
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
		log.Printf("❌ [Drive Upload] Apps Script call error: %v", err)
		return "", "", fmt.Errorf("apps script upload error: %v", err)
	}
	if resp.Status != "success" || resp.URL == "" {
		log.Printf("❌ [Drive Upload] Apps Script returned error: %s", resp.Message)
		return "", "", fmt.Errorf("apps script upload failed: %s", resp.Message)
	}

	log.Printf("✅ [Drive Upload] SUCCESS via Apps Script: fileID=%s url=%s", resp.FileID, resp.URL)
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
			return
		}
		log.Printf("✅ [Background Upload] SUCCESS tempID=%s fileID=%s driveURL=%s", tid, fileID, driveURL)

		// Save the resolved DriveURL in TempImage for later retrieval (if needed by CreateMovie)
		DB.Model(&TempImage{}).Where("id = ?", tid).UpdateColumn("drive_url", driveURL)

		// 1. Specialized Order Update (Needs Team for Telegram)
		if r.OrderID != "" && r.TargetColumn != "" {
			log.Printf("📦 [Background Update] Specialized Order update: orderId=%s col=%s", r.OrderID, r.TargetColumn)
			dbCol := UploadMapToDBColumnFunc(r.TargetColumn)
			if UploadIsValidOrderColumnFunc(dbCol) {
				var order Order
				team := ""
				if err := DB.Where("order_id = ?", r.OrderID).First(&order).Error; err == nil {
					team = order.Team
					DB.Model(&order).UpdateColumn(dbCol, driveURL)
				} else {
					DB.Model(&Order{}).Where("order_id = ?", r.OrderID).UpdateColumn(dbCol, driveURL)
				}

				event, _ := json.Marshal(map[string]interface{}{
					"type":    "update_order",
					"orderId": r.OrderID,
					"newData": map[string]interface{}{r.TargetColumn: driveURL},
				})
				HubGlobal.Broadcast <- event

				EnqueueSync("updateOrderTelegram", map[string]interface{}{
					"orderId":       r.OrderID,
					"team":          team,
					"updatedFields": map[string]interface{}{r.TargetColumn: driveURL},
				}, "", nil)
			}
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
