package backend

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
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
	MimeType       string                 `json:"mimeType,omitempty"`
	UserName       string                 `json:"userName,omitempty"`
	OrderData      interface{}            `json:"orderData,omitempty"`
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
	} `json:"messageIds,omitempty"`
}

// SyncTask represents a synchronization task for the background worker
type SyncTask struct {
	Request    AppsScriptRequest
	RetryCount int
	MaxRetries int
}

var (
	SyncQueue  = make(chan SyncTask, 1000)
	HTTPClient = &http.Client{
		Timeout: 45 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			IdleConnTimeout:     90 * time.Second,
			MaxIdleConnsPerHost: 20,
		},
	}
)

func CallAppsScriptPOST(requestData AppsScriptRequest) (AppsScriptResponse, error) {
	requestData.Secret = AppsScriptSecret
	if strings.TrimSpace(AppsScriptURL) == "" {
		return AppsScriptResponse{}, fmt.Errorf("apps script URL is not configured")
	}
	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return AppsScriptResponse{}, fmt.Errorf("failed to marshal request: %w", err)
	}
	resp, err := HTTPClient.Post(AppsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return AppsScriptResponse{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return AppsScriptResponse{}, fmt.Errorf("failed to read response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyPreview := string(body)
		if len(bodyPreview) > 500 {
			bodyPreview = bodyPreview[:500]
		}
		return AppsScriptResponse{}, fmt.Errorf("apps script returned HTTP %d: %s", resp.StatusCode, bodyPreview)
	}
	var scriptResponse AppsScriptResponse
	if err := json.Unmarshal(body, &scriptResponse); err != nil {
		return AppsScriptResponse{}, fmt.Errorf("invalid response from apps script")
	}
	return scriptResponse, nil
}

// EnqueueSync adds a task to the background synchronization queue
func EnqueueSync(action string, data map[string]interface{}, sheetName string, pk map[string]string) {
	req := AppsScriptRequest{
		Action:     action,
		SheetName:  sheetName,
		PrimaryKey: pk,
		NewData:    data,
	}
	task := SyncTask{Request: req, MaxRetries: 5}
	select {
	case SyncQueue <- task:
	default:
		log.Printf("⚠️ SyncQueue is full. Dropping task action=%s sheet=%s", action, sheetName)
	}
}

// StartSyncManager runs background workers for Google Sheets synchronization
func StartSyncManager(workerCount int) {
	for i := 0; i < workerCount; i++ {
		go func(workerID int) {
			log.Printf("🔄 SyncManager: Worker %d started", workerID)
			for task := range SyncQueue {
				resp, err := CallAppsScriptPOST(task.Request)
				if err != nil || resp.Status == "error" {
					errorMessage := "Unknown error"
					if err != nil {
						errorMessage = err.Error()
					} else {
						errorMessage = resp.Message
					}

					log.Printf("❌ SyncManager [Worker %d]: Task %s failed: %v", workerID, task.Request.Action, errorMessage)

					if task.RetryCount < task.MaxRetries {
						task.RetryCount++
						backoff := time.Duration(task.RetryCount*task.RetryCount) * time.Second
						log.Printf("⏳ SyncManager: Retrying task %s in %v (Attempt %d/%d)", task.Request.Action, backoff, task.RetryCount, task.MaxRetries)
						go func(t SyncTask, d time.Duration) {
							time.Sleep(d)
							SyncQueue <- t
						}(task, backoff)
					} else {
						log.Printf("🔥 SyncManager: Task %s reached max retries. Dropping.", task.Request.Action)
					}
				} else {
					log.Printf("✅ SyncManager [Worker %d]: Task %s success on %s", workerID, task.Request.Action, task.Request.SheetName)
				}
			}
		}(i)
	}
}
