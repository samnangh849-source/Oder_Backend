package tools

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type PerformanceOrder struct {
	OrderID   string `gorm:"primaryKey;column:order_id"`
	Timestamp string `gorm:"index;column:timestamp"`
}

func CheckDBPerformance() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Try to find DSN in main.go or environment
		log.Fatal("DATABASE_URL not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var count int64
	db.Model(&PerformanceOrder{}).Count(&count)
	fmt.Printf("Total orders: %d\n", count)

	start := time.Now()
	var orders []PerformanceOrder
	result := db.Order("timestamp desc").Find(&orders)
	elapsed := time.Since(start)

	if result.Error != nil {
		log.Fatal(result.Error)
	}

	fmt.Printf("Fetched %d orders in %s\n", len(orders), elapsed)

	// Explain analyze
	fmt.Println("\nEXPLAIN ANALYZE result:")
	var explain string
	db.Raw("EXPLAIN ANALYZE SELECT * FROM orders ORDER BY timestamp DESC").Scan(&explain)
	fmt.Println(explain)
}
