package backend

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestAuthMiddlewareRejectsUnexpectedSigningMethod(t *testing.T) {
	gin.SetMode(gin.TestMode)
	JwtSecret = []byte("test-secret")

	claims := &Claims{
		UserName:      "alice",
		Team:          "ops",
		Role:          "Admin",
		IsSystemAdmin: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS512, claims)
	tokenString, err := token.SignedString(JwtSecret)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestAdminOnlyMiddlewareHandlesInvalidContextType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("isSystemAdmin", "true")
		c.Set("role", 123)
		c.Next()
	})
	r.Use(AdminOnlyMiddleware())
	r.GET("/admin", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestRequirePermissionRejectsMissingRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequirePermission("view_order_list"))
	r.GET("/orders", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestServeWsReturns503WhenHubUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	HubGlobal = nil
	r := gin.New()
	r.GET("/ws", ServeWs)

	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestUpgraderCheckOriginAllowlist(t *testing.T) {
	_ = os.Setenv("ALLOWED_WS_ORIGINS", "https://example.com,app.example.com")
	defer os.Unsetenv("ALLOWED_WS_ORIGINS")

	reqAllowed := httptest.NewRequest(http.MethodGet, "/ws", nil)
	reqAllowed.Host = "api.example.com"
	reqAllowed.Header.Set("Origin", "https://example.com")
	if !Upgrader.CheckOrigin(reqAllowed) {
		t.Fatal("expected allowlisted origin to be accepted")
	}

	reqBlocked := httptest.NewRequest(http.MethodGet, "/ws", nil)
	reqBlocked.Host = "api.example.com"
	reqBlocked.Header.Set("Origin", "https://evil.com")
	if Upgrader.CheckOrigin(reqBlocked) {
		t.Fatal("expected non-allowlisted origin to be rejected")
	}
}

func TestEnqueueSyncDoesNotBlockWhenQueueFull(t *testing.T) {
	originalQueue := SyncQueue
	defer func() { SyncQueue = originalQueue }()

	SyncQueue = make(chan SyncTask, 1)
	SyncQueue <- SyncTask{}

	done := make(chan struct{})
	go func() {
		EnqueueSync("updateSheet", map[string]interface{}{"x": 1}, "RolePermissions", map[string]string{"ID": "1"})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("EnqueueSync blocked when queue was full")
	}
}

func TestCallAppsScriptPOSTFailsWhenURLMissing(t *testing.T) {
	originalURL := AppsScriptURL
	defer func() { AppsScriptURL = originalURL }()
	AppsScriptURL = "   "

	_, err := CallAppsScriptPOST(AppsScriptRequest{Action: "ping"})
	if err == nil || !strings.Contains(err.Error(), "URL is not configured") {
		t.Fatalf("expected missing URL error, got: %v", err)
	}
}
