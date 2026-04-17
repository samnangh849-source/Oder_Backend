package backend

import (
	"encoding/json"
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

		if result.Error != nil && result.Error == gorm.ErrRecordNotFound {
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
			if err := DB.Model(&existing).Update("is_enabled", req.IsEnabled).Error; err != nil {
				log.Printf("❌ Failed to update permission ID %d [%s:%s]: %v", existing.ID, existing.Role, existing.Feature, err)
				updateErrors = append(updateErrors, fmt.Sprintf("update failed [%s:%s]", existing.Role, existing.Feature))
				continue
			}
			req.ID = existing.ID
			req.Role = existing.Role
			req.Feature = existing.Feature

			go func(r RolePermission) {
				EnqueueSync("updateSheet", map[string]interface{}{"IsEnabled": r.IsEnabled}, "RolePermissions", map[string]string{
					"ID":      fmt.Sprintf("%d", r.ID),
					"Role":    r.Role,
					"Feature": r.Feature,
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
