package backend

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var JwtSecret []byte

type Claims struct {
	UserName      string `json:"userName"`
	Team          string `json:"team"`
	Role          string `json:"role"`
	IsSystemAdmin bool   `json:"isSystemAdmin"`
	jwt.RegisteredClaims
}

func GenerateJWT(user User) (string, error) {
	// Add exactly one month (handles 28, 29, 30, or 31 days based on the current month)
	expirationTime := time.Now().AddDate(0, 1, 0)
	claims := &Claims{
		UserName:      user.UserName,
		Team:          user.Team,
		Role:          user.Role,
		IsSystemAdmin: user.IsSystemAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JwtSecret)
}

func HandleLogin(c *gin.Context) {
	var credentials struct {
		UserName string `json:"userName"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&credentials); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ព័ត៌មានមិនត្រឹមត្រូវ"})
		return
	}

	var user User
	err := DB.Where("user_name = ?", credentials.UserName).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "អ្នកប្រើប្រាស់មិនត្រឹមត្រូវ"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ប្រព័ន្ធមានបញ្ហា សូមព្យាយាមម្តងទៀត"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(credentials.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "លេខសម្ងាត់មិនត្រឹមត្រូវ"})
		return
	}

	tokenString, err := GenerateJWT(user)
	if err != nil {
		c.Error(err)
		return
	}

	user.Password = ""

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  tokenString,
		"user":   user,
	})
}

func DBMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if DB == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":  "error",
				"message": "សេវាកម្មកំពុងចាប់ផ្តើម (Database is initializing...)",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// 1. Try to get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		// 2. Fallback to 'token' query parameter (used for WebSockets)
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "មិនមានសិទ្ធិចូលប្រើប្រាស់ (Missing Token)"})
			c.Abort()
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, errors.New("unexpected signing method")
			}
			return JwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Token អស់សុពលភាព ឬមិនត្រឹមត្រូវ"})
			c.Abort()
			return
		}

		c.Set("userName", claims.UserName)
		c.Set("team", claims.Team)
		c.Set("role", claims.Role)
		c.Set("isSystemAdmin", claims.IsSystemAdmin)

		c.Next()
	}
}

func AdminOnlyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSystemAdmin, exists := c.Get("isSystemAdmin")
		role, roleExists := c.Get("role")
		isAdminBool, okAdmin := isSystemAdmin.(bool)
		roleString, okRole := role.(string)

		// Check IsSystemAdmin flag
		if exists && okAdmin && isAdminBool {
			c.Next()
			return
		}

		// Check if any comma-separated role is "Admin"
		if roleExists && okRole && roleString != "" {
			for _, r := range strings.Split(roleString, ",") {
				if strings.EqualFold(strings.TrimSpace(r), "Admin") {
					c.Next()
					return
				}
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "គ្មានសិទ្ធិអនុញ្ញាត (Forbidden)"})
		c.Abort()
	}
}

func RequirePermission(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		isSystemAdmin, _ := c.Get("isSystemAdmin")
		role, _ := c.Get("role")
		isAdminBool, okAdmin := isSystemAdmin.(bool)
		roleString, okRole := role.(string)

		if okAdmin && isAdminBool {
			c.Next()
			return
		}

		if !okRole || roleString == "" {
			c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "អ្នកមិនមានសិទ្ធិសម្រាប់មុខងារនេះទេ (" + feature + ")"})
			c.Abort()
			return
		}

		// Split comma-separated roles and check each individually
		roles := strings.Split(roleString, ",")
		for _, r := range roles {
			r = strings.TrimSpace(r)
			if strings.EqualFold(r, "Admin") {
				c.Next()
				return
			}
		}

		// Query permission for each role until a match is found
		featureLower := strings.ToLower(feature)
		for _, r := range roles {
			r = strings.TrimSpace(r)
			var perm RolePermission
			result := DB.Where("LOWER(role) = ? AND LOWER(feature) = ?", strings.ToLower(r), featureLower).First(&perm)
			if result.Error == nil && perm.IsEnabled {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "អ្នកមិនមានសិទ្ធិសម្រាប់មុខងារនេះទេ (" + feature + ")"})
		c.Abort()
	}
}

func HasPermissionInternal(role string, isSystemAdmin bool, feature string) bool {
	if isSystemAdmin {
		return true
	}

	roles := strings.Split(role, ",")
	featureLower := strings.ToLower(feature)

	for _, r := range roles {
		r = strings.TrimSpace(r)
		if strings.EqualFold(r, "Admin") {
			return true
		}
		var perm RolePermission
		result := DB.Where("LOWER(role) = ? AND LOWER(feature) = ?", strings.ToLower(r), featureLower).First(&perm)
		if result.Error == nil && perm.IsEnabled {
			return true
		}
	}
	return false
}
