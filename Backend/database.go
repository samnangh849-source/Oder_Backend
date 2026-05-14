package backend

import (
	"encoding/base64"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"golang.org/x/crypto/bcrypt"
)

var DB *gorm.DB

// GetEnvInt returns an integer from environment or a default value
func GetEnvInt(key string, defaultVal int) int {
	if val, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}

func InitDB() {
	log.Println("🔌 Initializing PostgreSQL database connection...")
	rawDSN := os.Getenv("DATABASE_URL")
	if rawDSN == "" {
		log.Fatal("❌ DATABASE_URL is not set!")
	}

	// Smart DSN parsing and parameter injection
	isURL := strings.HasPrefix(rawDSN, "postgres://") || strings.HasPrefix(rawDSN, "postgresql://")
	dsn := rawDSN
	
	appendParam := func(d, key, val string) string {
		if strings.Contains(d, key+"=") {
			return d
		}
		if isURL {
			if strings.Contains(d, "?") {
				return d + "&" + key + "=" + val
			}
			return d + "?" + key + "=" + val
		}
		// Key=Value format (fallback)
		return d + " " + key + "=" + val
	}

	dsn = appendParam(dsn, "connect_timeout", "15")
	dsn = appendParam(dsn, "application_name", "order-system")

	// --- SSL/TLS Check & Configuration (Aiven.io/DigitalOcean) ---
	caCertEnv := os.Getenv("DB_CA_CERT")
	if caCertEnv != "" {
		caPath := "ca.pem"
		certData, err := base64.StdEncoding.DecodeString(caCertEnv)
		if err != nil {
			certData = []byte(caCertEnv) // Assume raw PEM
		}

		if err := os.WriteFile(caPath, certData, 0600); err != nil {
			log.Printf("⚠️ Failed to write SSL CA file: %v", err)
		} else {
			log.Println("🔒 SSL CA Certificate configured (verify-full)")
			dsn = appendParam(dsn, "sslrootcert", caPath)
			
			// Replace any existing sslmode with verify-full for security when CA is provided
			if strings.Contains(dsn, "sslmode=") {
				for _, mode := range []string{"disable", "require", "prefer", "allow", "verify-ca"} {
					target := "sslmode=" + mode
					if strings.Contains(dsn, target) {
						dsn = strings.Replace(dsn, target, "sslmode=verify-full", 1)
						break
					}
				}
			} else {
				dsn = appendParam(dsn, "sslmode", "verify-full")
			}
		}
	} else {
		// Default to require for security if not specified
		dsn = appendParam(dsn, "sslmode", "require")
	}

	var db *gorm.DB
	var err error
	maxRetries := GetEnvInt("DB_MAX_RETRIES", 10)

	for i := 0; i < maxRetries; i++ {
		newLogger := logger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			logger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  logger.Error,
				IgnoreRecordNotFoundError: true,
				Colorful:                  true,
			},
		)

		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger:      newLogger,
			PrepareStmt: true,
		})
		if err == nil {
			break
		}
		log.Printf("⚠️ Database connection failed (Attempt %d/%d): %v", i+1, maxRetries, err)
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Fatal("❌ Database connection failed permanently:", err)
	}

	sqlDB, err := db.DB()
	if err == nil {
		// 📉 Optimized limits for Aiven/Render small plans
		// We set a slightly higher limit now that we've fixed the concurrent queries in StaticData
		maxIdle := GetEnvInt("DB_MAX_IDLE_CONNS", 2)
		maxOpen := GetEnvInt("DB_MAX_OPEN_CONNS", 4)
		sqlDB.SetMaxIdleConns(maxIdle)
		sqlDB.SetMaxOpenConns(maxOpen)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
		sqlDB.SetConnMaxIdleTime(2 * time.Minute)
		log.Printf("⚡ Database Pool Optimized: MaxOpen=%d, MaxIdle=%d", maxOpen, maxIdle)
	}

	log.Println("✅ Database connection established!")
	
	// Smart Migration
	runMigrations(db)

	DB = db

	// Ensure essential data exists
	EnsureSeedData()

	log.Println("✅ Database initialization complete!")
}

func runMigrations(db *gorm.DB) {
	log.Println("🔄 Running Auto-Migrations...")

	// Helper to check for breaking schema changes before migration
	checkLegacy := func(model interface{}, tableName, column string) {
		if db.Migrator().HasTable(tableName) && !db.Migrator().HasColumn(model, column) {
			log.Printf("🚨 SCHEMA ALERT: Table '%s' is missing expected column '%s'. Migration might be partial.", tableName, column)
		}
	}

	checkLegacy(&TeamPage{}, "team_pages", "id")
	checkLegacy(&Order{}, "orders", "customer_name")
	checkLegacy(&User{}, "users", "user_name")

	// 🛠️ FIX: Check if telegram_templates has an incompatible 'id' column (bigint instead of text)
	if db.Migrator().HasTable("telegram_templates") {
		var dataType string
		db.Raw("SELECT data_type FROM information_schema.columns WHERE table_name = 'telegram_templates' AND column_name = 'id'").Scan(&dataType)
		if dataType == "bigint" || dataType == "integer" {
			log.Println("⚠️  Incompatible 'id' column type (bigint) detected in telegram_templates. Dropping table to fix schema...")
			if err := db.Migrator().DropTable("telegram_templates"); err != nil {
				log.Printf("❌ Failed to drop table telegram_templates: %v", err)
			}
		}
	}

	err := db.AutoMigrate(
		&User{}, &Store{}, &Setting{}, &TeamPage{}, &Product{}, &Location{}, &ShippingMethod{},
		&Color{}, &Driver{}, &BankAccount{}, &PhoneCarrier{}, &TelegramTemplate{},
		&Inventory{}, &StockTransfer{}, &ReturnItem{},
		&Order{}, &RevenueEntry{}, &ChatMessage{}, &EditLog{}, &UserActivityLog{},
		&Role{}, &RolePermission{}, &Promotion{},
		&IncentiveProject{}, &IncentiveCalculator{}, &IncentiveResult{},
		&IncentiveManualData{}, &IncentiveCustomPayout{},
		&DriverRecommendation{}, &Movie{}, &PendingSync{}, &Shift{},
	)
	if err != nil {
		log.Printf("❌ Migration failed: %v", err)
	}

	// 🛠️ EXTRA CHECK: Ensure pending_syncs exists (sometimes AutoMigrate skips it if previous errors occurred)
	if !db.Migrator().HasTable(&PendingSync{}) {
		log.Println("⚠️ Table 'pending_syncs' missing after AutoMigrate. Attempting explicit creation...")
		if err := db.Migrator().CreateTable(&PendingSync{}); err != nil {
			log.Printf("❌ Failed to create table 'pending_syncs' explicitly: %v", err)
		} else {
			log.Println("✅ Table 'pending_syncs' created explicitly.")
		}
	}

	// Functional index: allow UPPER(TRIM(order_id)) queries to use index instead of full table scan
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_orders_order_id_upper ON orders (UPPER(TRIM(order_id)))`).Error; err != nil {
		log.Printf("⚠️ Could not create functional index on order_id: %v", err)
	} else {
		log.Println("✅ Functional index idx_orders_order_id_upper ensured")
	}

	// Data Repair: Fill missing Team values in orders based on Page assignment
	repairMissingTeams(db)
}

func repairMissingTeams(db *gorm.DB) {
	const flagKey = "team_repair_done"

	// Check if repair has already been completed in a previous startup
	var flag Setting
	if err := db.Where("config_key = ?", flagKey).First(&flag).Error; err == nil {
		log.Println("⏭️ Team repair already completed — skipping.")
		return
	}

	log.Println("🛠️ Checking for orders with missing team assignments...")
	var count int64
	db.Model(&Order{}).Where("team = '' OR team IS NULL").Count(&count)
	if count > 0 {
		log.Printf("🛠️ Found %d orders with missing team. Attempting to repair...", count)
		var orders []Order
		db.Where("team = '' OR team IS NULL").Find(&orders)

		repaired := 0
		for _, o := range orders {
			var tp TeamPage
			if err := db.Where("page_name = ?", o.Page).First(&tp).Error; err == nil && tp.Team != "" {
				db.Model(&o).Update("team", tp.Team)
				repaired++
			}
		}
		log.Printf("✅ Repaired %d orders with team assignments from Page records.", repaired)
	} else {
		log.Println("✅ No orders with missing team — nothing to repair.")
	}

	// Mark repair as done so it never runs again on future startups
	db.Create(&Setting{
		ConfigKey:   flagKey,
		ConfigValue: "true",
		Description: "One-time team repair completed. Do not delete.",
	})
}

func EnsureSeedData() {
	if DB == nil {
		return
	}
	// Default roles to create if they don't exist
	defaultRoles := []Role{
		{RoleName: "Admin", Description: "System Administrator - Full Access"},
		{RoleName: "Manager", Description: "Store/Team Manager"},
		{RoleName: "Sale", Description: "Sales representative"},
		{RoleName: "Fulfillment", Description: "Order packing & fulfillment staff"},
		{RoleName: "Driver", Description: "Delivery driver"},
		{RoleName: "Packer", Description: "Packaging team member"},
	}

	for _, r := range defaultRoles {
		var existing Role
		if err := DB.Where("LOWER(role_name) = LOWER(?)", r.RoleName).First(&existing).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if createErr := DB.Create(&r).Error; createErr == nil {
					log.Printf("✅ Created default role: %s", r.RoleName)
				} else {
					log.Printf("⚠️ Failed to create role %s: %v", r.RoleName, createErr)
				}
			}
		}
	}

	// Default permissions — only insert if not already present.
	for _, p := range DefaultPermissions() {
		var roleObj Role
		roleID := uint(0)
		if err := DB.Where("LOWER(role_name) = LOWER(?)", p.Role).First(&roleObj).Error; err == nil {
			roleID = roleObj.ID
		}

		var existing RolePermission
		if err := DB.Where("LOWER(TRIM(role)) = ? AND LOWER(TRIM(feature)) = ?", p.Role, p.Feature).First(&existing).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			p.RoleID = roleID
			if createErr := DB.Create(&p).Error; createErr != nil {
				log.Printf("⚠️ Failed to seed permission [%s:%s]: %v", p.Role, p.Feature, createErr)
			}
		} else if err == nil && (existing.RoleID == 0 && roleID != 0) {
			// Auto-repair missing RoleIDs for existing records
			DB.Model(&existing).Update("role_id", roleID)
		}
	}

	// Default admin user
	var count int64
	DB.Model(&User{}).Where("user_name = ?", "admin").Count(&count)
	if count == 0 {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		admin := User{
			UserName:      "admin",
			Password:      string(hashedPassword),
			FullName:      "Administrator",
			Role:          "Admin",
			IsSystemAdmin: true,
		}
		if err := DB.Create(&admin).Error; err == nil {
			log.Println("✅ Created default admin user: Username=admin, Password=admin123")
		}
	}
}

// DefaultPermissions returns the canonical set of permissions seeded on every startup.
// Used by EnsureSeedData (insert-if-missing) and HandleResetPermissions (full rebuild).
func DefaultPermissions() []RolePermission {
	permissions := []RolePermission{}

	features := []string{
		"view_order_list", "edit_order", "delete_order", "verify_order", "create_order",
		"access_sales_portal", "access_fulfillment", "view_admin_dashboard", "view_entertainment",
		"manage_roles", "manage_permissions", "view_revenue", "export_data", "migrate_data",
		"manage_inventory", "stock_transfer", "view_team_leaderboard", "set_targets", "view_global_orders",
		"view_promotions", "manage_promotions",
	}

	// Define standard templates
	roleTemplates := map[string]map[string]bool{
		"Admin": {
			"all": true,
		},
		"Manager": {
			"view_order_list":       true,
			"edit_order":            true,
			"delete_order":          true,
			"verify_order":          true,
			"create_order":          true,
			"access_sales_portal":   true,
			"access_fulfillment":    true,
			"view_admin_dashboard":  true,
			"view_entertainment":    true,
			"view_revenue":          true,
			"export_data":           true,
			"manage_inventory":      true,
			"stock_transfer":        true,
			"view_team_leaderboard": true,
			"set_targets":           true,
		},
		"Sale": {
			"view_order_list":       true,
			"edit_order":            true,
			"create_order":          true,
			"access_sales_portal":   true,
			"view_entertainment":    true,
			"view_team_leaderboard": true,
		},
		"Fulfillment": {
			"view_order_list":    true,
			"edit_order":         true,
			"verify_order":       true,
			"access_fulfillment": true,
			"view_entertainment": true,
			"manage_inventory":   true,
			"stock_transfer":     true,
		},
		"Packer": {
			"view_order_list":    true,
			"access_fulfillment": true,
			"view_entertainment": true,
		},
		"Driver": {
			"view_order_list":    true,
			"access_fulfillment": true,
			"view_entertainment": true,
		},
		"Viewer": {
			"view_order_list":    true,
			"view_entertainment": true,
		},
	}

	// Fetch actual roles from DB to only create permissions for roles that EXIST
	var actualRoles []Role
	if DB != nil {
		DB.Find(&actualRoles)
	}

	// If no roles in DB yet, use standard defaults for seeding
	if len(actualRoles) == 0 {
		for rName, perms := range roleTemplates {
			for _, f := range features {
				enabled := perms["all"] || perms[f]
				permissions = append(permissions, RolePermission{Role: rName, Feature: f, IsEnabled: enabled})
			}
		}
		return permissions
	}

	// Create permissions based on ACTUAL roles in DB
	for _, role := range actualRoles {
		templateName := ""
		rName := strings.ToLower(role.RoleName)

		// Map actual role name to a template
		if strings.Contains(rName, "admin") { templateName = "Admin" }
		if strings.Contains(rName, "manager") { templateName = "Manager" }
		if strings.Contains(rName, "sale") || strings.Contains(rName, "sell") { templateName = "Sale" }
		if strings.Contains(rName, "fulfill") || strings.Contains(rName, "dispatch") { templateName = "Fulfillment" }
		if strings.Contains(rName, "pack") { templateName = "Packer" }
		if strings.Contains(rName, "driver") { templateName = "Driver" }
		if strings.Contains(rName, "view") { templateName = "Viewer" }

		if templateName != "" {
			perms := roleTemplates[templateName]
			for _, f := range features {
				enabled := perms["all"] || perms[f]
				permissions = append(permissions, RolePermission{RoleID: role.ID, Role: role.RoleName, Feature: f, IsEnabled: enabled})
			}
		}
	}

	return permissions
}

// CheckHealth returns true if the database is reachable
func CheckHealth() bool {
	if DB == nil {
		return false
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return false
	}
	return sqlDB.Ping() == nil
}
