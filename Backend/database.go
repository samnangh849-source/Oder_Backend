package backend

import (
	"encoding/base64"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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
	if _, err := url.Parse(rawDSN); err != nil {
		// If it's not a full URL (e.g. host=localhost...), fallback to string manipulation
		log.Printf("⚠️ DSN is not a URL format, using string manipulation: %v", err)
	}

	dsn := rawDSN
	appendParam := func(d, key, val string) string {
		if !strings.Contains(d, key+"=") {
			if strings.Contains(d, "?") {
				return d + "&" + key + "=" + val
			}
			return d + "?" + key + "=" + val
		}
		return d
	}

	dsn = appendParam(dsn, "connect_timeout", "15")

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
			// Force sslmode to verify-full for security if CA is provided
			if strings.Contains(dsn, "sslmode=") {
				// Replace existing sslmode
				re := []string{"sslmode=disable", "sslmode=require", "sslmode=prefer", "sslmode=allow"}
				for _, mode := range re {
					dsn = strings.Replace(dsn, mode, "sslmode=verify-full", 1)
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
			Logger: newLogger,
			// PrepareStmt: true, // Increases performance for repeated queries
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
		// Configurable pool settings - Optimized for Aiven/entry-tier PostgreSQL
		maxIdle := GetEnvInt("DB_MAX_IDLE_CONNS", 5)
		maxOpen := GetEnvInt("DB_MAX_OPEN_CONNS", 10)
		sqlDB.SetMaxIdleConns(maxIdle)
		sqlDB.SetMaxOpenConns(maxOpen)
		sqlDB.SetConnMaxLifetime(15 * time.Minute)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
		log.Printf("⚡ Database Pool: MaxOpen=%d, MaxIdle=%d (Optimized for Workers)", maxOpen, maxIdle)
	}

	log.Println("✅ Database connection established!")
	
	// Smart Migration
	runMigrations(db)

	DB = db

	// Ensure essential data exists
	ensureSeedData()

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

	err := db.AutoMigrate(
		&User{}, &Store{}, &Setting{}, &TeamPage{}, &Product{}, &Location{}, &ShippingMethod{},
		&Color{}, &Driver{}, &BankAccount{}, &PhoneCarrier{}, &TelegramTemplate{},
		&Inventory{}, &StockTransfer{}, &ReturnItem{},
		&Order{}, &RevenueEntry{}, &ChatMessage{}, &EditLog{}, &UserActivityLog{},
		&Role{}, &RolePermission{},
		&IncentiveProject{}, &IncentiveCalculator{}, &IncentiveResult{},
		&IncentiveManualData{}, &IncentiveCustomPayout{},
		&DriverRecommendation{}, &Movie{},
	)
	if err != nil {
		log.Printf("❌ Migration failed: %v", err)
	}
}

func ensureSeedData() {
	var adminRole Role
	if err := DB.Where("LOWER(role_name) = ?", "admin").First(&adminRole).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			adminRole = Role{RoleName: "Admin", Description: "System Administrator"}
			if err := DB.Create(&adminRole).Error; err == nil {
				log.Println("✅ Created default Admin role")
				// Auto-seed basic permissions for Admin if needed
			}
		}
	}
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
