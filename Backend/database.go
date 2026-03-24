package backend

import (
	"encoding/base64"
	"log"
	"os"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	log.Println("🔌 Initializing PostgreSQL database connection...")
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("❌ DATABASE_URL is not set!")
	}

	// បន្ថែម connect_timeout ដើម្បីកុំឱ្យវា Hang យូរពេកពេលភ្ជាប់មិនបាន
	if !strings.Contains(dsn, "connect_timeout=") {
		if strings.Contains(dsn, "?") {
			dsn += "&connect_timeout=15"
		} else {
			dsn += "?connect_timeout=15"
		}
	}

	// --- SSL/TLS Check & Configuration (Aiven.io) ---
	caCertEnv := os.Getenv("DB_CA_CERT")
	if caCertEnv != "" {
		caPath := "ca.pem"
		// ព្យាយាម Decode បើវាជា base64 បើមិនមែនទេប្រើផ្ទាល់តែម្តង
		certData, err := base64.StdEncoding.DecodeString(caCertEnv)
		if err != nil {
			certData = []byte(caCertEnv)
		}

		if err := os.WriteFile(caPath, certData, 0600); err != nil {
			log.Printf("⚠️ មិនអាចបង្កើតឯកសារ SSL CA: %v", err)
		} else {
			log.Println("🔒 SSL CA Certificate ត្រូវបានកំណត់សម្រាប់ការត្រួតពិនិត្យ (verify-full)")
			if !strings.Contains(dsn, "sslrootcert=") {
				if strings.Contains(dsn, "?") {
					dsn += "&sslrootcert=" + caPath
				} else {
					dsn += "?sslrootcert=" + caPath
				}
			}
			// ប្តូរ sslmode ទៅ verify-full ដើម្បីសុវត្ថិភាពខ្ពស់បំផុត
			if !strings.Contains(dsn, "sslmode=") {
				dsn += "&sslmode=verify-full"
			} else if strings.Contains(dsn, "sslmode=require") {
				dsn = strings.Replace(dsn, "sslmode=require", "sslmode=verify-full", 1)
			}
		}
	} else if !strings.Contains(dsn, "sslmode=") {
		// បើមិនមានការកំណត់ SSL ទេ ដាក់ឱ្យវា require ជាលំនាំដើមសម្រាប់ Aiven
		if strings.Contains(dsn, "?") {
			dsn += "&sslmode=require"
		} else {
			dsn += "?sslmode=require"
		}
		log.Println("🛡️ SSL Mode ត្រូវបានកំណត់ត្រឹម 'require' (Encryption Only)")
	}

	var db *gorm.DB
	var err error
	maxRetries := 10

	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Error)})
		if err == nil {
			break
		}
		log.Printf("⚠️ ភ្ជាប់ Database មិនបាន (ព្យាយាមលើកទី %d/%d): %v", i+1, maxRetries, err)
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Fatal("❌ បរាជ័យក្នុងការភ្ជាប់ Database ជាស្ថាពរ:", err)
	}

	sqlDB, err := db.DB()
	if err == nil {
		// Optimized pool for 3 Sync workers + 1 Order worker + HTTP traffic
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetMaxOpenConns(15)
		sqlDB.SetConnMaxLifetime(10 * time.Minute)
		log.Println("⚡ Database Connection Pool Optimized (Balanced for Workers)!")
	}

	log.Println("✅ Database connection established!")
	log.Println("🔄 Auto-migrating ALL tables...")

	// Never drop production tables automatically. Warn and rely on explicit migrations.
	if db.Migrator().HasTable(&TeamPage{}) && !db.Migrator().HasColumn(&TeamPage{}, "id") {
		log.Println("⚠️ Legacy schema detected for TeamPage (missing id). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&ShippingMethod{}) && !db.Migrator().HasColumn(&ShippingMethod{}, "enable_driver_recommendation") {
		log.Println("⚠️ Legacy schema detected for ShippingMethod (missing enable_driver_recommendation). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&User{}) && !db.Migrator().HasColumn(&User{}, "user_name") {
		log.Println("⚠️ Legacy schema detected for User (missing user_name). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&Store{}) && !db.Migrator().HasColumn(&Store{}, "store_name") {
		log.Println("⚠️ Legacy schema detected for Store (missing store_name). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&Product{}) && !db.Migrator().HasColumn(&Product{}, "product_name") {
		log.Println("⚠️ Legacy schema detected for Product (missing product_name). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&DriverRecommendation{}) && !db.Migrator().HasColumn(&DriverRecommendation{}, "day_of_week") {
		log.Println("⚠️ Legacy schema detected for DriverRecommendation (missing day_of_week). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&Order{}) && !db.Migrator().HasColumn(&Order{}, "customer_name") {
		log.Println("⚠️ Legacy schema detected for Order (missing customer_name). Table will NOT be dropped automatically.")
	}
	if db.Migrator().HasTable(&RevenueEntry{}) && !db.Migrator().HasColumn(&RevenueEntry{}, "revenue") {
		log.Println("⚠️ Legacy schema detected for RevenueEntry (missing revenue). Table will NOT be dropped automatically.")
	}

	err = db.AutoMigrate(
		&User{}, &Store{}, &Setting{}, &TeamPage{}, &Product{}, &Location{}, &ShippingMethod{},
		&Color{}, &Driver{}, &BankAccount{}, &PhoneCarrier{}, &TelegramTemplate{},
		&Inventory{}, &StockTransfer{}, &ReturnItem{},
		&Order{}, &RevenueEntry{}, &ChatMessage{}, &EditLog{}, &UserActivityLog{},
		&Role{},
		&RolePermission{},
		&IncentiveProject{},
		&IncentiveCalculator{},
		&IncentiveResult{},
		&IncentiveManualData{},
		&IncentiveCustomPayout{},
		&TempImage{},
		&DriverRecommendation{},
		&Movie{},
	)
	if err != nil {
		log.Fatal("❌ Migration failed:", err)
	}

	DB = db

	// ធានាថាមាន Role "Admin" ជានិច្ច (តែមួយគត់ដែលជាកាតព្វកិច្ច)
	var adminRole Role
	result := DB.Where("LOWER(role_name) = ?", "admin").First(&adminRole)
	if result.Error != nil && result.Error == gorm.ErrRecordNotFound {
		adminRole = Role{RoleName: "Admin", Description: "Administrator with full access"}
		if err := DB.Create(&adminRole).Error; err == nil {
			log.Println("✅ បង្បង្កើតតួនាទី (Admin) ដោយស្វ័យប្រវត្តិបានជោគជ័យ!")
		}
	}

	log.Println("✅ Successfully setup database tables!")
}
