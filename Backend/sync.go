package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

var (
	AppsScriptURL    string
	AppsScriptSecret string
)

type AppsScriptRequest struct {
	Action         string                 `json:"action"`
	Secret         string                 `json:"secret"`
	UploadFolderID string                 `json:"uploadFolderID,omitempty"`
	FileData       string                 `json:"fileData,omitempty"`
	Image          string                 `json:"image,omitempty"` // Alias for fileData
	FileName       string                 `json:"fileName,omitempty"`
	FileID         string                 `json:"fileID,omitempty"`  // Added for renameFile compatibility
	NewName        string                 `json:"newName,omitempty"` // Added for renameFile compatibility
	MimeType       string                 `json:"mimeType,omitempty"`
	UserName       string                 `json:"userName,omitempty"`
	OrderData      interface{}            `json:"orderData"`
	OrderID        string                 `json:"orderId,omitempty"`
	MovieID        string                 `json:"movieId,omitempty"`
	TargetColumn   string                 `json:"targetColumn,omitempty"`
	SheetName      string                 `json:"sheetName,omitempty"`
	PrimaryKey     map[string]string      `json:"primaryKey,omitempty"`
	NewData        map[string]interface{} `json:"newData,omitempty"`
}

type AppsScriptResponse struct {
	Status     string `json:"status"`
	URL        string `json:"url,omitempty"`
	FileID     string `json:"fileID,omitempty"`
	Message    string `json:"message,omitempty"`
	MessageIds struct {
		ID1 string `json:"id1"`
		ID2 string `json:"id2"`
		ID3 string `json:"id3"`
	} `json:"messageIds,omitempty"`
}

// SyncTask represents a synchronization task for the background worker
type SyncTask struct {
	Request    AppsScriptRequest
	RetryCount int
	MaxRetries int
	EnqueuedAt time.Time
}

var (
	SyncQueue = make(chan *SyncTask, 1000)
	DB        *gorm.DB

	// Deduplication map for updateSheet actions
	// Key: sheetName + primaryKey values
	pendingUpdates = make(map[string]*SyncTask)
	updateMutex    sync.Mutex

	HTTPClient = &http.Client{
		Timeout: 120 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			IdleConnTimeout:     90 * time.Second,
			MaxIdleConnsPerHost: 20,
		},
	}

	// For graceful shutdown
	workerWG sync.WaitGroup
	stopChan = make(chan struct{})
)

// ReconcileMissingPhotoLinks looks for orders that have a photo URL in DB but might be missing in Sheets.
// This is a self-healing mechanism to ensure data consistency.
func ReconcileMissingPhotoLinks(db *gorm.DB) {
	log.Println("🔍 [Self-Healing] Starting photo link reconciliation...")

	var orders []struct {
		OrderID         string `gorm:"column:order_id"`
		Team            string `gorm:"column:team"`
		PackagePhotoURL string `gorm:"column:package_photo_url"`
	}

	// Look for orders from the last 24 hours that have a permanent Drive link in DB
	yesterday := time.Now().Add(-24 * time.Hour).Format(time.RFC3339)
	err := db.Table("orders").
		Select("order_id, team, package_photo_url").
		Where("package_photo_url LIKE ? AND timestamp > ?", "%drive.google.com%", yesterday).
		Find(&orders).Error

	if err != nil {
		log.Printf("❌ [Self-Healing] Database query failed: %v", err)
		return
	}

	if len(orders) == 0 {
		log.Println("✅ [Self-Healing] No orders need reconciliation.")
		return
	}

	log.Printf("📦 [Self-Healing] Found %d orders to verify in Sheets", len(orders))

	for _, o := range orders {
		// Enqueue a specialized sync task
		EnqueueSync("updateOrderTelegram", map[string]interface{}{
			"orderId": o.OrderID,
			"team":    o.Team,
			"updatedFields": map[string]interface{}{
				"Package Photo URL": o.PackagePhotoURL,
			},
			"healingMode": true,
		}, "", nil)
	}
}

func CallAppsScriptPOST(requestData AppsScriptRequest) (AppsScriptResponse, error) {
	requestData.Secret = AppsScriptSecret
	if strings.TrimSpace(AppsScriptURL) == "" {
		return AppsScriptResponse{}, fmt.Errorf("apps script URL is not configured")
	}
	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return AppsScriptResponse{}, fmt.Errorf("failed to marshal request: %w", err)
	}
	log.Printf("📡 [AppsScript] POST to %s action=%s", AppsScriptURL, requestData.Action)
	resp, err := HTTPClient.Post(AppsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ [AppsScript] HTTP error: %v", err)
		return AppsScriptResponse{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return AppsScriptResponse{}, fmt.Errorf("failed to read response: %w", err)
	}

	bodyStr := string(body)
	log.Printf("📥 [AppsScript] Raw response (HTTP %d, len=%d): %.800s", resp.StatusCode, len(bodyStr), bodyStr)

	// Detect HTML response (common when Apps Script needs reauthorization or deployment is broken)
	trimmed := strings.TrimSpace(bodyStr)
	if strings.HasPrefix(trimmed, "<!") || strings.HasPrefix(trimmed, "<HTML") || strings.HasPrefix(trimmed, "<html") {
		log.Printf("🚨 [AppsScript] Response is HTML, not JSON! This usually means:")
		log.Printf("   1. Apps Script needs REAUTHORIZATION — open the script editor and run doPost manually")
		log.Printf("   2. Deployment URL is wrong or expired — create a new deployment")
		log.Printf("   3. Apps Script has a runtime error — check Executions log in script editor")
		preview := trimmed
		if len(preview) > 1000 {
			preview = preview[:1000]
		}
		return AppsScriptResponse{}, fmt.Errorf("apps script returned HTML instead of JSON (HTTP %d). Check deployment. Body: %.300s", resp.StatusCode, preview)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyPreview := bodyStr
		if len(bodyPreview) > 500 {
			bodyPreview = bodyPreview[:500]
		}
		return AppsScriptResponse{}, fmt.Errorf("apps script returned HTTP %d: %s", resp.StatusCode, bodyPreview)
	}
	var scriptResponse AppsScriptResponse
	if err := json.Unmarshal(body, &scriptResponse); err != nil {
		log.Printf("❌ [AppsScript] JSON parse error: %v, body: %.500s", err, bodyStr)
		return AppsScriptResponse{}, fmt.Errorf("invalid response from apps script (not valid JSON): %v", err)
	}
	log.Printf("✅ [AppsScript] Parsed: status=%s url=%s fileID=%s", scriptResponse.Status, scriptResponse.URL, scriptResponse.FileID)
	return scriptResponse, nil
}

// getDedupeKey generates a unique key for a task to see if it can be merged
func getDedupeKey(action, sheetName string, pk map[string]string) string {
	if action != "updateSheet" || sheetName == "" || len(pk) == 0 {
		return ""
	}
	// Sort or just concatenate for consistency
	// Since PK is usually just one field like {"Order ID": "123"}
	return fmt.Sprintf("%s:%s:%v", action, sheetName, pk)
}

// EnqueueSync adds a task to the background synchronization queue
func EnqueueSync(action string, data map[string]interface{}, sheetName string, pk map[string]string) {
	req := AppsScriptRequest{
		Action:     action,
		SheetName:  sheetName,
		PrimaryKey: pk,
		NewData:    data,
		OrderData:  data, // Set OrderData for compatibility
	}

	// Handle special fields if present in data
	if data != nil {
		if val, ok := data["fileID"].(string); ok {
			req.FileID = val
		}
		if val, ok := data["newName"].(string); ok {
			req.NewName = val
		}
		// Correctly extract orderId from data map
		if val, ok := data["orderId"].(string); ok {
			req.OrderID = val
		} else if val, ok := data["OrderID"].(string); ok {
			req.OrderID = val
		}
	}

	// If OrderID is set but OrderData is not, ensure backend has context
	if req.OrderID != "" && (req.OrderData == nil || len(req.OrderData.(map[string]interface{})) == 0) {
		req.OrderData = data
	}

	task := &SyncTask{
		Request:    req,
		MaxRetries: 5,
		EnqueuedAt: time.Now(),
	}

	// Deduplication Logic
	dedupeKey := getDedupeKey(action, sheetName, pk)
	if dedupeKey != "" {
		updateMutex.Lock()
		if existing, exists := pendingUpdates[dedupeKey]; exists {
			// Merge NewData: newer fields overwrite older ones
			if existing.Request.NewData == nil {
				existing.Request.NewData = make(map[string]interface{})
			}
			for k, v := range data {
				existing.Request.NewData[k] = v
			}
			// Update OrderData as well for compatibility
			existing.Request.OrderData = existing.Request.NewData
			updateMutex.Unlock()
			// log.Printf("🔄 SyncManager: Merged update for %s", dedupeKey)
			return
		}
		pendingUpdates[dedupeKey] = task
		updateMutex.Unlock()
	}

	select {
	case SyncQueue <- task:
	case <-time.After(2 * time.Second):
		log.Printf("⚠️ SyncQueue is full. Dropping task action=%s sheet=%s after timeout", action, sheetName)
		if dedupeKey != "" {
			updateMutex.Lock()
			delete(pendingUpdates, dedupeKey)
			updateMutex.Unlock()
		}
	}
}

// StartSyncManager runs background workers for Google Sheets synchronization
func StartSyncManager(workerCount int) {
	for i := 0; i < workerCount; i++ {
		workerWG.Add(1)
		go func(workerID int) {
			defer workerWG.Done()
			log.Printf("🔄 SyncManager: Worker %d started", workerID)

			for {
				select {
				case <-stopChan:
					log.Printf("🛑 SyncManager [Worker %d]: Stopping...", workerID)
					return
				case task, ok := <-SyncQueue:
					if !ok {
						return
					}

					// Remove from dedupe map if it was there
					dedupeKey := getDedupeKey(task.Request.Action, task.Request.SheetName, task.Request.PrimaryKey)
					if dedupeKey != "" {
						updateMutex.Lock()
						delete(pendingUpdates, dedupeKey)
						updateMutex.Unlock()
					}

					processTask(workerID, *task)
				}
			}
		}(i)
	}
}

// StopSyncManager gracefully stops all workers
func StopSyncManager() {
	close(stopChan)
	workerWG.Wait()
	log.Println("✅ SyncManager: All workers stopped gracefully")
}

func processTask(workerID int, task SyncTask) {
	log.Printf("🔄 SyncManager [Worker %d]: Processing task action=%s sheet=%s pk=%v", workerID, task.Request.Action, task.Request.SheetName, task.Request.PrimaryKey)

	resp, err := CallAppsScriptPOST(task.Request)

	if err != nil || resp.Status != "success" {
		errorMessage := "Unknown error"
		if err != nil {
			errorMessage = err.Error()
		} else if resp.Message != "" {
			errorMessage = fmt.Sprintf("status=%s: %s", resp.Status, resp.Message)
		} else {
			errorMessage = fmt.Sprintf("unexpected status: %s", resp.Status)
		}

		log.Printf("❌ SyncManager [Worker %d]: Task %s failed: %v", workerID, task.Request.Action, errorMessage)

		if task.RetryCount < task.MaxRetries {
			task.RetryCount++
			// Exponential backoff with jitter: 2^retry + 0-1000ms jitter
			delay := time.Duration(1<<uint(task.RetryCount)) * time.Second
			jitter := time.Duration(rand.Intn(1000)) * time.Millisecond
			backoff := delay + jitter

			log.Printf("⏳ SyncManager: Retrying task %s in %v (Attempt %d/%d)", task.Request.Action, backoff, task.RetryCount, task.MaxRetries)

			go func(t SyncTask, d time.Duration) {
				select {
				case <-time.After(d):
					select {
					case SyncQueue <- &t:
					case <-stopChan:
					}
				case <-stopChan:
				}
			}(task, backoff)
		} else {
			log.Printf("🔥 SyncManager: Task %s reached max retries. Dropping. Sheet=%s PK=%v",
				task.Request.Action, task.Request.SheetName, task.Request.PrimaryKey)
		}
	} else {
		log.Printf("✅ SyncManager [Worker %d]: Task %s SUCCESS on sheet=%s pk=%v", workerID, task.Request.Action, task.Request.SheetName, task.Request.PrimaryKey)

		// ✅ Update local DB with Telegram Message IDs if returned
		if (resp.MessageIds.ID1 != "" || resp.MessageIds.ID2 != "" || resp.MessageIds.ID3 != "") && task.Request.OrderID != "" && DB != nil {
			updates := make(map[string]interface{})
			if resp.MessageIds.ID1 != "" {
				updates["telegram_message_id1"] = resp.MessageIds.ID1
			}
			if resp.MessageIds.ID2 != "" {
				updates["telegram_message_id2"] = resp.MessageIds.ID2
			}
			if resp.MessageIds.ID3 != "" {
				updates["telegram_message_id3"] = resp.MessageIds.ID3
			}

			if err := DB.Table("orders").Where("order_id = ?", task.Request.OrderID).Updates(updates).Error; err != nil {
				log.Printf("❌ [SyncManager] Failed to update local DB with Message IDs for Order %s: %v", task.Request.OrderID, err)
			} else {
				log.Printf("📝 [SyncManager] Updated local DB with Message IDs for Order %s: ID1=%s, ID2=%s, ID3=%s", task.Request.OrderID, resp.MessageIds.ID1, resp.MessageIds.ID2, resp.MessageIds.ID3)
			}
		}
	}
}
