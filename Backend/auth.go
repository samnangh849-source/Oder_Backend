package backend

import (
	"errors"
	"log"
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
	// Add 30 days validity
	expirationTime := time.Now().AddDate(0, 0, 30)
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

	credentials.UserName = strings.TrimSpace(credentials.UserName)
	credentials.Password = strings.TrimSpace(credentials.Password)

	var user User
	err := DB.Where("user_name = ?", credentials.UserName).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("⚠️ Login failed: User %q not found", credentials.UserName)
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "អ្នកប្រើប្រាស់មិនត្រឹមត្រូវ"})
		return
	}
	if err != nil {
		log.Printf("❌ Login error for user %q: %v", credentials.UserName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ប្រព័ន្ធមានបញ្ហា សូមព្យាយាមម្តងទៀត"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(credentials.Password)); err != nil {
		log.Printf("⚠️ Login failed: Invalid password for user %q", credentials.UserName)
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
		isSystemAdmin, _ := c.Get("isSystemAdmin")
		role, _ := c.Get("role")
		
		isAdminBool, _ := isSystemAdmin.(bool)
		roleString, _ := role.(string)

		if isAdminBool {
			c.Next()
			return
		}

		if roleString != "" {
			for _, r := range strings.Split(roleString, ",") {
				if strings.EqualFold(strings.TrimSpace(r), "Admin") {
					c.Next()
					return
				}
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "មុខងារនេះសម្រាប់តែ Admin ប៉ុណ្ណោះ"})
		c.Abort()
	}
}

func RefreshToken(c *gin.Context) {
	userName, _ := c.Get("userName")
	team, _ := c.Get("team")
	role, _ := c.Get("role")
	isSystemAdmin, _ := c.Get("isSystemAdmin")

	user := User{
		UserName:      userName.(string),
		Team:          team.(string),
		Role:          role.(string),
		IsSystemAdmin: isSystemAdmin.(bool),
	}

	newToken, err := GenerateJWT(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to refresh token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  newToken,
	})
}

func checkPermission(role string, isSystemAdmin bool, feature string) bool {
	if isSystemAdmin {
		return true
	}

	roles := strings.Split(role, ",")
	featureLower := strings.ToLower(strings.TrimSpace(feature))

	for _, r := range roles {
		r = strings.TrimSpace(r)
		if strings.EqualFold(r, "Admin") {
			return true
		}

		rLower := strings.ToLower(r)
		
		// Map common aliases to their canonical versions to be more resilient
		checkRoles := []string{rLower}
		if rLower == "seller" {
			checkRoles = append(checkRoles, "sale", "sales")
		} else if rLower == "sale" || rLower == "sales" {
			checkRoles = append(checkRoles, "seller")
		} else if rLower == "dispatcher" {
			checkRoles = append(checkRoles, "fulfillment")
		} else if rLower == "fulfillment" {
			checkRoles = append(checkRoles, "dispatcher")
		}

		for _, cr := range checkRoles {
			var perm RolePermission
			// We use LOWER(TRIM(role)) for DB compatibility, though we've normalized input cr
			err := DB.Where("LOWER(TRIM(role)) = ? AND LOWER(TRIM(feature)) = ? AND is_enabled = true", cr, featureLower).First(&perm).Error
			if err == nil {
				return true
			}
		}
		
		log.Printf("🔍 [checkPermission] No match: JWT_role=%q (aliases=%v) feature=%q", r, checkRoles, featureLower)
	}

	return false
}

func RequirePermission(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userName, _ := c.Get("userName")
		role, _ := c.Get("role")
		isSystemAdmin, _ := c.Get("isSystemAdmin")

		roleString, _ := role.(string)
		isAdminBool, _ := isSystemAdmin.(bool)

		if checkPermission(roleString, isAdminBool, feature) {
			c.Next()
			return
		}

		log.Printf("⛔ [Auth] Permission Denied: User=%v, Role=%v, Feature=%s", userName, role, feature)
		c.JSON(http.StatusForbidden, gin.H{
			"status":  "error",
			"message": "អ្នកមិនមានសិទ្ធិសម្រាប់មុខងារនេះទេ (" + feature + ")",
		})
		c.Abort()
	}
}

func HasPermissionInternal(role string, isSystemAdmin bool, feature string) bool {
	return checkPermission(role, isSystemAdmin, feature)
}
