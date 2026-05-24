package main

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Checking pending_syncs table...")
	if !db.Migrator().HasColumn("pending_syncs", "last_error_message") {
		log.Println("Column last_error_message missing. Adding it...")
		err := db.Exec("ALTER TABLE pending_syncs ADD COLUMN last_error_message text").Error
		if err != nil {
			log.Fatalf("Failed to add column: %v", err)
		}
		log.Println("✅ Column last_error_message added successfully.")
	} else {
		log.Println("✅ Column last_error_message already exists.")
	}
}
