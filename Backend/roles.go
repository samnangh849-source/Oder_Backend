package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func HandleGetRoles(c *gin.Context) {
	roles := []Role{}
	if err := DB.Find(&roles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	if len(roles) == 0 {
		// Auto-seed if empty
		EnsureSeedData()
		DB.Find(&roles)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": roles})
}

func HandleCreateRole(c *gin.Context) {
	var req Role
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ: " + err.Error()})
		return
	}

	if req.RoleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ឈ្មោះតួនាទី (Role) មិនអាចទទេរបានទេ"})
		return
	}
	req.RoleName = strings.TrimSpace(req.RoleName)

	var count int64
	DB.Model(&Role{}).Where("role_name = ?", req.RoleName).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ឈ្មោះតួនាទីនេះមានរួចហើយ សូមជ្រើសរើសឈ្មោះផ្សេង!"})
		return
	}

	// Let database auto-increment handle role IDs safely under concurrency.
	req.ID = 0

	if err := DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការបង្កើត Role បរាជ័យ: " + err.Error()})
		return
	}

	sheetData := map[string]interface{}{
		"ID":          req.ID,
		"RoleName":    req.RoleName,
		"Description": req.Description,
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type":      "add_row",
		"sheetName": "Roles",
		"newData":   req,
	})
	if HubGlobal != nil {
		HubGlobal.Broadcast <- eventBytes
	}

	go func() {
		EnqueueSync("addRow", sheetData, "Roles", nil)
	}()

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": req})
}

func HandleGetAllPermissions(c *gin.Context) {
	permissions := []RolePermission{}
	if err := DB.Find(&permissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": permissions})
}

func HandleGetUserPermissions(c *gin.Context) {
	role, _ := c.Get("role")
	permissions := []RolePermission{}

	roleStr := fmt.Sprintf("%v", role)
	// Split comma-separated roles and query permissions for all of them
	roleParts := strings.Split(roleStr, ",")
	var trimmedRoles []string
	for _, r := range roleParts {
		r = strings.TrimSpace(strings.ToLower(r))
		if r != "" {
			trimmedRoles = append(trimmedRoles, r)
		}
	}

	if len(trimmedRoles) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "success", "data": permissions})
		return
	}

	if err := DB.Where("LOWER(TRIM(role)) IN ?", trimmedRoles).Find(&permissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": permissions})
}

func HandleUpdatePermission(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "មិនអាចអានទិន្នន័យបានទេ"})
		return
	}

	var reqs []RolePermission
	var singleReq RolePermission

	if err := json.Unmarshal(body, &reqs); err != nil {
		if err := json.Unmarshal(body, &singleReq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទម្រង់ទិន្នន័យមិនត្រឹមត្រូវ: " + err.Error()})
			return
		}
		reqs = []RolePermission{singleReq}
	}
	updateErrors := make([]string, 0)

	for _, req := range reqs {
		if req.Role == "" || req.Feature == "" {
			updateErrors = append(updateErrors, "role/feature cannot be empty")
			continue
		}

		roleLower := strings.ToLower(strings.TrimSpace(req.Role))
		featureLower := strings.ToLower(strings.TrimSpace(req.Feature))

		var existing RolePermission
		// Use LOWER(TRIM(...)) to be consistent with checkPermission and handle any whitespace from sheet imports
		result := DB.Where("LOWER(TRIM(role)) = ? AND LOWER(TRIM(feature)) = ?", roleLower, featureLower).First(&existing)

		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			req.ID = 0
			req.Role = roleLower
			req.Feature = featureLower

			if err := DB.Create(&req).Error; err != nil {
				log.Printf("❌ Failed to create permission [%s:%s]: %v", req.Role, req.Feature, err)
				updateErrors = append(updateErrors, fmt.Sprintf("create failed [%s:%s]", req.Role, req.Feature))
				continue
			}

			go func(r RolePermission) {
				EnqueueSync("addRow", map[string]interface{}{
					"ID":        r.ID,
					"Role":      r.Role,
					"Feature":   r.Feature,
					"IsEnabled": r.IsEnabled,
				}, "RolePermissions", nil)
			}(req)

		} else if result.Error == nil {
			// Normalize role/feature to lowercase in case an older row was stored with mixed case.
			if err := DB.Model(&existing).Updates(map[string]interface{}{
				"is_enabled": req.IsEnabled,
				"role":       roleLower,
				"feature":    featureLower,
			}).Error; err != nil {
				log.Printf("❌ Failed to update permission ID %d [%s:%s]: %v", existing.ID, existing.Role, existing.Feature, err)
				updateErrors = append(updateErrors, fmt.Sprintf("update failed [%s:%s]", existing.Role, existing.Feature))
				continue
			}
			req.ID = existing.ID
			req.Role = roleLower
			req.Feature = featureLower

			go func(r RolePermission) {
				EnqueueSync("updateSheet", map[string]interface{}{
					"IsEnabled": r.IsEnabled,
					"Role":      r.Role,
					"Feature":   r.Feature,
				}, "RolePermissions", map[string]string{
					"ID": fmt.Sprintf("%d", r.ID),
				})
			}(req)
		} else {
			log.Printf("❌ Failed to query permission [%s:%s]: %v", roleLower, featureLower, result.Error)
			updateErrors = append(updateErrors, fmt.Sprintf("query failed [%s:%s]", roleLower, featureLower))
			continue
		}

		eventBytes, _ := json.Marshal(map[string]interface{}{
			"type":      "update_permission",
			"role":      req.Role,
			"feature":   req.Feature,
			"isEnabled": req.IsEnabled,
		})
		if HubGlobal != nil {
			HubGlobal.Broadcast <- eventBytes
		}
	}

	if len(updateErrors) > 0 {
		c.JSON(http.StatusMultiStatus, gin.H{
			"status":  "partial_success",
			"message": "បានរក្សាទុកសិទ្ធិខ្លះៗ ប៉ុន្តែមានកំហុសខ្លះ",
			"errors":  updateErrors,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "បានរក្សាទុកសិទ្ធិដោយជោគជ័យ"})
}

// SyncAllPermissionsToSheet re-syncs every RolePermission row from DB to Google Sheets,
// filling any rows that are missing Role/Feature data.
func SyncAllPermissionsToSheet() {
	if DB == nil {
		return
	}
	var permissions []RolePermission
	if err := DB.Find(&permissions).Error; err != nil {
		log.Printf("❌ SyncAllPermissionsToSheet: %v", err)
		return
	}
	for _, p := range permissions {
		p := p
		EnqueueSync("updateSheet", map[string]interface{}{
			"IsEnabled": p.IsEnabled,
			"Role":      p.Role,
			"Feature":   p.Feature,
		}, "RolePermissions", map[string]string{
			"ID": fmt.Sprintf("%d", p.ID),
		})
	}
	log.Printf("✅ SyncAllPermissionsToSheet: enqueued %d permission syncs", len(permissions))
}

func HandleSyncPermissionsToSheet(c *gin.Context) {
	go SyncAllPermissionsToSheet()
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Syncing permissions to sheet in background"})
}

// HandleResetPermissions wipes all RolePermission rows in the DB, re-inserts
// the canonical defaults, broadcasts the change via WebSocket, then clears the
// RolePermissions Google Sheet and re-syncs every row so both stores agree.
func HandleResetPermissions(c *gin.Context) {
	// 1. Wipe existing permissions
	if err := DB.Where("id > 0").Delete(&RolePermission{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to clear permissions: " + err.Error()})
		return
	}

	// 2. Re-insert defaults
	defaults := DefaultPermissions()
	for i := range defaults {
		defaults[i].ID = 0
		if err := DB.Create(&defaults[i]).Error; err != nil {
			log.Printf("❌ Reset: failed to create permission [%s:%s]: %v", defaults[i].Role, defaults[i].Feature, err)
		}
	}
	log.Printf("✅ HandleResetPermissions: inserted %d default permissions", len(defaults))

	// 3. Notify all connected clients so UI refreshes immediately
	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "permissions_reset"})
	if HubGlobal != nil {
		HubGlobal.Broadcast <- eventBytes
	}

	// 4. Clear the Sheet then re-sync every permission row (background)
	go func() {
		// Clear the RolePermissions sheet first
		EnqueueSync("clearSheet", map[string]interface{}{}, "RolePermissions", nil)
		// Re-sync all DB permissions to the now-empty sheet
		SyncAllPermissionsToSheet()
	}()

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": fmt.Sprintf("Reset %d permissions. Syncing to Sheet in background.", len(defaults)),
		"count":   len(defaults),
	})
}
