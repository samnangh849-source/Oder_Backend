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
	UploadGenerateTokenFunc      func(string) string // (orderId) -> token
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

	// Resolve target folder ID
	// Return photos go to a dedicated folder (if configured), other uploads use the standard folder
	isReturnPhoto := originalReq != nil && (originalReq.TargetColumn == "Return Photo" || originalReq.TargetColumn == "return_photo_url")

	targetFolder := "root"
	if isReturnPhoto {
		returnFolder := ReturnUploadFolderID
		if envVal := os.Getenv("RETURN_UPLOAD_FOLDER_ID"); envVal != "" {
			returnFolder = envVal
		}
		if returnFolder != "" && !strings.Contains(returnFolder, "Folder_Google_Drive") {
			targetFolder = ExtractDriveFolderID(returnFolder)
			log.Printf("📁 [Drive Upload] Return photo → using dedicated return folder: %q", targetFolder)
		} else {
			// Fallback to main upload folder
			if envFolderID := os.Getenv("UPLOAD_FOLDER_ID"); envFolderID != "" {
				targetFolder = ExtractDriveFolderID(envFolderID)
			} else if UploadFolderID != "" && !strings.Contains(UploadFolderID, "Folder_Google_Drive") {
				targetFolder = ExtractDriveFolderID(UploadFolderID)
			}
			log.Printf("📁 [Drive Upload] Return photo — no dedicated folder set, using main upload folder")
		}
	} else if envFolderID := os.Getenv("UPLOAD_FOLDER_ID"); envFolderID != "" {
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

	// 1. If the original request already had a token (from Frontend), use it
	if originalReq != nil && originalReq.Token != "" {
		req.Token = originalReq.Token
		log.Printf("🔑 [Drive Upload] Using existing token from request: %s", req.Token)
	} else if UploadGenerateTokenFunc != nil {
		// 2. Otherwise generate a new one-time token
		id := ""
		if originalReq != nil {
			id = originalReq.OrderID
		}
		req.Token = UploadGenerateTokenFunc(id)
		log.Printf("🔑 [Drive Upload] Generated new one-time token: %s (OrderID: %s)", req.Token, id)
	} else {
		log.Println("⚠️ [Drive Upload] No token provided and UploadGenerateTokenFunc is NIL")
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
		req.BackendURL = originalReq.BackendURL
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

	// SECURITY FIX: Restrict target columns to prevent arbitrary DB writes
	if req.TargetColumn != "" {
		dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
		isValidCol := UploadIsValidOrderColumnFunc(dbCol) || 
			dbCol == "profile_picture_url" ||
			dbCol == "image_url" ||
			dbCol == "logo_url" ||
			dbCol == "page_logo_url" ||
			dbCol == "carrier_logo_url" ||
			dbCol == "thumbnail"

		if !isValidCol {
			log.Printf("⚠️ Invalid target column requested: %s (mapped: %s)", req.TargetColumn, dbCol)
			c.JSON(400, gin.H{"status": "error", "message": "គោលដៅរូបភាពមិនត្រឹមត្រូវ (Invalid target column)"})
			return
		}
	}

	// Dynamically resolve BackendURL from incoming request if not provided
	if req.BackendURL == "" {
		scheme := "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
		if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
			scheme = proto
		}
		req.BackendURL = fmt.Sprintf("%s://%s", scheme, c.Request.Host)
		log.Printf("🔗 [Upload Proxy] Dynamically resolved BackendURL: %s", req.BackendURL)
	}


	data := req.FileData
	if data == "" {
		data = req.Image
	}
	if data == "" {
		c.JSON(400, gin.H{"status": "error", "message": "មិនមានទិន្នន័យឯកសារ"})
		return
	}

	// ── Parse and Re-encode Base64 for maximum compatibility ──
	decoded, err := ParseBase64(data)
	if err != nil {
		log.Printf("❌ [Upload] Base64 parse failed: %v", err)
		c.JSON(400, gin.H{"status": "error", "message": "ទិន្នន័យរូបភាពមិនត្រឹមត្រូវ (Invalid Base64)"})
		return
	}
	data = base64.StdEncoding.EncodeToString(decoded)

	// ── Background Processing Logic ──────────────────────────────────────
	if req.IsAsync {
		log.Printf("🛰️ [Upload] Starting background processing for file=%q order=%q", req.FileName, req.OrderID)
		
		// Return immediate 202 Accepted
		c.JSON(202, gin.H{
			"status": "accepted",
			"message": "កំពុងដំណើរការនៅផ្ទៃខាងក្រោយ (Background Processing)",
			"orderId": req.OrderID,
		})

		// Run the actual upload and DB logic in a goroutine
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🔥 [Upload Goroutine Panic Recovery]: %v", r)
				}
			}()
			// We don't need c.Copy() here because we are not using the context inside the goroutine anymore
			// All data needed is already in 'req' and 'data'
			processImageUploadInternal(req, data)
		}()
		return
	}

	// ── Synchronous Processing (Original Logic) ──────────────────────────
	driveURL, fileID, err := processImageUploadInternal(req, data)
	if err != nil {
		log.Printf("❌ [Upload] Processing failed: %v", err)
		c.JSON(500, gin.H{"status": "error", "message": fmt.Sprintf("បរាជ័យក្នុងការ Upload: %v", err)})
		return
	}

	log.Printf("✅ [Upload] Complete: driveURL=%s fileID=%s", driveURL, fileID)
	c.JSON(200, gin.H{
		"status": "success",
		"url":    driveURL,
		"fileID": fileID,
	})
}

// processImageUploadInternal encapsulates the core logic of uploading and updating DB.
// Returns driveURL, fileID, and error.
func processImageUploadInternal(req AppsScriptRequest, data string) (string, string, error) {
	var driveURL, fileID string
	var err error

	// ── 0. Route Upload (R2 for Promotions, Drive for others) ──────────
	if strings.EqualFold(req.SheetName, "Promotions") {
		log.Printf("☁️ [Upload Internal] Routing to Cloudflare R2 (Promotions section)")
		decoded, decodeErr := ParseBase64(data)
		if decodeErr == nil {
			r2URL, r2Err := UploadToR2(decoded, req.FileName, req.MimeType)
			if r2Err == nil {
				driveURL = r2URL
				fileID = "r2_" + req.FileName
				log.Printf("✅ [Upload Internal] R2 Upload SUCCESS: %s", driveURL)
			} else {
				log.Printf("⚠️ [Upload Internal] R2 Upload failed, falling back to Drive: %v", r2Err)
				driveURL, fileID, err = UploadToGoogleDriveDirectly(data, req.FileName, req.MimeType, &req)
			}
		} else {
			log.Printf("⚠️ [Upload Internal] Base64 decode failed for R2, falling back to Drive: %v", decodeErr)
			driveURL, fileID, err = UploadToGoogleDriveDirectly(data, req.FileName, req.MimeType, &req)
		}
	} else {
		log.Printf("📤 [Upload Internal] Uploading to Drive for file=%q", req.FileName)
		driveURL, fileID, err = UploadToGoogleDriveDirectly(data, req.FileName, req.MimeType, &req)
	}

	if err != nil {
		return "", "", err
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
			log.Printf("🛠️ [Upload Internal] Applying DB Update for %s: %v", req.OrderID, dbUpdateMap)

			// ── Atomic: validate state machine transition + apply update in one transaction ──
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
						First(&currentOrder).Error; err != nil {
						return fmt.Errorf("រកមិនឃើញការកម្មង់ %s: %w", req.OrderID, err)
					}

					currentStatus := strings.TrimSpace(currentOrder.FulfillmentStatus)
					if currentStatus == "" {
						currentStatus = "Pending"
					}

					validTransitions := map[string][]string{
						"Scheduled":     {"Pending", "Processing", "Ready to Ship", "Cancelled"},
						"Pending":       {"Processing", "Ready to Ship", "Cancelled"},
						"Processing":    {"Ready to Ship", "Pending", "Cancelled"},
						"Ready to Ship": {"Shipped", "Pending", "Cancelled"},
						"Shipped":       {"Delivered", "Ready to Ship", "Returned", "Cancelled"},
						"Delivered":     {"Returned"},
						"Returned":      {"Delivered", "Shipped", "Ready to Ship", "Pending", "Cancelled"},
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

				if newStatus, ok := dbUpdateMap["fulfillment_status"].(string); ok {
					if newStatus == "Returned" {
						var fullOrder Order
						if err := tx.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", req.OrderID).First(&fullOrder).Error; err == nil {
							var products []map[string]interface{}
							if err := json.Unmarshal([]byte(fullOrder.ProductsJSON), &products); err == nil {
								for _, p := range products {
									name, _ := p["name"].(string)
									qty, _ := p["quantity"].(float64)
									if name != "" && qty > 0 {
										reason := fullOrder.ReturnReason
										if r, ok := dbUpdateMap["return_reason"].(string); ok && r != "" {
											reason = r
										}

										barcode := ""
										if b, ok := p["barcode"].(string); ok {
											barcode = b
										}

										returnItem := ReturnItem{
											Timestamp:   time.Now().Format("2006-01-02 15:04:05"),
											OrderID:     fullOrder.OrderID,
											StoreName:   fullOrder.FulfillmentStore,
											Barcode:     barcode,
											ProductName: name,
											Quantity:    qty,
											Reason:      reason,
											HandledBy:   req.UserName,
											Status:      "Pending Receipt",
										}

										if _, hasReceivedBy := dbUpdateMap["return_received_by"]; hasReceivedBy {
											returnItem.Status = "Received"
										}

										var count int64
										tx.Table("returns").Where("order_id = ? AND product_name = ?", fullOrder.OrderID, name).Count(&count)
									if count == 0 {
										if err := tx.Table("returns").Create(&returnItem).Error; err == nil {
											go EnqueueSync("addRow", map[string]interface{}{
												"ReturnID":    returnItem.ID,
												"Timestamp":   returnItem.Timestamp,
												"OrderID":     returnItem.OrderID,
												"StoreName":   returnItem.StoreName,
												"Barcode":     returnItem.Barcode,
												"ProductName": returnItem.ProductName,
												"Quantity":    returnItem.Quantity,
												"Reason":      returnItem.Reason,
												"HandledBy":   returnItem.HandledBy,
												"Status":      returnItem.Status,
											}, "Returns", nil)
										}
									} else if returnItem.Status == "Received" {
										if err := tx.Table("returns").Where("order_id = ? AND product_name = ?", fullOrder.OrderID, name).Update("status", "Received").Error; err == nil {
											go EnqueueSync("updateSheet", map[string]interface{}{"Status": "Received"}, "Returns", map[string]interface{}{"OrderID": fullOrder.OrderID, "ProductName": name})
										}
									}
								}
							}
						}
					}
				}
			}

				return nil
			})

			if txErr == nil {
				log.Printf("✅ [Upload Internal] DB update SUCCESS: orderId=%s rowsAffected=%d", req.OrderID, rowsAffected)

				// Sync to Google Sheets & Telegram
				go func(orderId string, bMap map[string]interface{}) {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("🔥 [Sync Goroutine Panic Recovery]: %v", r)
						}
					}()
					var order Order
					if err := DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", orderId).First(&order).Error; err == nil {
						sheetData := make(map[string]interface{})
						for k, v := range bMap {
							headerName := k 
							switch k {
							case "package_photo_url", "Package Photo URL": headerName = "Package Photo"
							case "delivery_photo_url", "Delivery Photo URL": headerName = "Delivery Photo URL"
							case "fulfillment_status", "FulfillmentStatus": headerName = "Fulfillment Status"
							case "packed_by": headerName = "Packed By"
							case "packed_time": headerName = "Packed Time"
							case "dispatched_by": headerName = "Dispatched By"
							case "dispatched_time": headerName = "Dispatched Time"
							case "delivered_time": headerName = "Delivered Time"
							case "driver_name": headerName = "Driver Name"
							case "tracking_number": headerName = "Tracking Number"
							}
							sheetData[headerName] = v
						}
						if sheetData["Fulfillment Status"] == nil { sheetData["Fulfillment Status"] = order.FulfillmentStatus }
						if sheetData["Team"] == nil { sheetData["Team"] = order.Team }

						EnqueueSync("updateOrderTelegram", map[string]interface{}{
							"orderId":       orderId,
							"team":          order.Team,
							"updatedFields": sheetData,
						}, "", nil)
					}
				}(req.OrderID, broadcastMap)

				// Broadcast to all connected clients
				SafeBroadcastJSON(map[string]interface{}{
					"type":    "update_order",
					"orderId": req.OrderID,
					"newData": broadcastMap,
				})
			} else {
				log.Printf("❌ [Upload Internal] DB transaction failed: %v", txErr)
			}
		}
	}

	// ── 1.5 Return Photo URL — save separately in returns table ─────────
	// When a Return Photo is uploaded for an order, also persist the photo URL
	// in the `returns` table rows for that order (so each ReturnItem has its own photo record).
	if req.OrderID != "" && req.TargetColumn == "Return Photo" && driveURL != "" {
		go func(orderId, photoURL string) {
			var returnItems []ReturnItem
			if err := DB.Table("returns").Where("order_id = ?", orderId).Find(&returnItems).Error; err == nil {
				for _, item := range returnItems {
					// Update photo_url in DB
					DB.Table("returns").Where("id = ?", item.ID).Update("photo_url", photoURL)
					
					// Sync to Google Sheets — update PhotoURL column in Returns sheet by ReturnID
					EnqueueSync("updateSheet", map[string]interface{}{"PhotoURL": photoURL}, "Returns", map[string]interface{}{"ReturnID": item.ID})
				}
				log.Printf("📷 [Upload Internal] Saved return photo URL to returns table and enqueued sync for order %s", orderId)
			} else {
				log.Printf("⚠️ [Upload Internal] Failed to find returns for order %s: %v", orderId, err)
			}
		}(req.OrderID, driveURL)
	}

	// ── 2. User Profile Update ───────────────────────────────────────────
	// Resolve userName: prefer explicit req.UserName, fallback to primaryKey["UserName"]
	// (Admin Edit User modal sends primaryKey but not top-level userName)
	resolvedUserName := req.UserName
	if resolvedUserName == "" && req.PrimaryKey != nil && (req.SheetName == "" || req.SheetName == "Users") {
		if pkVal, ok := req.PrimaryKey["UserName"]; ok {
			resolvedUserName = fmt.Sprintf("%v", pkVal)
		}
	}

	if resolvedUserName != "" && (req.TargetColumn == "ProfilePictureURL" || req.TargetColumn == "profile_picture_url") && req.OrderID == "" && req.MovieID == "" {
		log.Printf("👤 [Upload Internal] Updating profile picture for user=%q", resolvedUserName)
		DB.Model(&User{}).Where("user_name = ?", resolvedUserName).UpdateColumn("profile_picture_url", driveURL)
		SafeBroadcastJSON(map[string]interface{}{
			"type": "profile_image_ready", "userName": resolvedUserName, "url": driveURL,
		})
		EnqueueSync("updateSheet", map[string]interface{}{"Profile Picture URL": driveURL}, "Users", map[string]string{"UserName": resolvedUserName})
	}

	// ── 3. Movie Update ──────────────────────────────────────────────────
	if req.MovieID != "" && req.TargetColumn != "" {
		dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
		DB.Model(&Movie{}).Where("id = ?", req.MovieID).UpdateColumn(dbCol, driveURL)
		EnqueueSync("updateSheet", map[string]interface{}{req.TargetColumn: driveURL}, "Movies", map[string]string{"ID": req.MovieID})
		fID := ExtractFileIDFromURL(driveURL)
		if fID != "" {
			var mv Movie
			if err := DB.Where("id = ?", req.MovieID).First(&mv).Error; err == nil && mv.Title != "" {
				EnqueueSync("renameFile", map[string]interface{}{ "fileID": fID, "newName": mv.Title }, "", nil)
			}
		}
		SafeBroadcastJSON(map[string]interface{}{
			"type": "movie_thumbnail_ready", "movieId": req.MovieID, "url": driveURL,
		})
	}

	// ── 4. Generic Table/Sheet Update ────────────────────────────────────
	// Skip Users sheet EnqueueSync here if Section 2 already handled it (avoids duplicate Sheets writes).
	if req.SheetName != "" && req.PrimaryKey != nil && req.TargetColumn != "" && req.SheetName != "Movies" {
		if !(req.SheetName == "Users" && resolvedUserName != "") {
			EnqueueSync("updateSheet", map[string]interface{}{req.TargetColumn: driveURL}, req.SheetName, req.PrimaryKey)
		}
		tableName := UploadGetTableNameFunc(req.SheetName)
		if tableName != "" {
			dbCol := UploadMapToDBColumnFunc(req.TargetColumn)
			query := DB.Table(tableName)
			for k, v := range req.PrimaryKey { query = query.Where(UploadMapToDBColumnFunc(k)+" = ?", v) }
			query.UpdateColumn(dbCol, driveURL)
		}
	}

	return driveURL, fileID, nil
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
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Cache-Control", "public, max-age=3600")
	io.Copy(c.Writer, resp.Body)
}
