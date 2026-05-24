package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type IncentiveProject struct {
	ID          uint   `gorm:"primaryKey"`
	ProjectName string
	DataSource  string `gorm:"column:data_source"`
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Try to read from .env or similar if available, but here we just exit
		fmt.Println("DATABASE_URL not set")
		return
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var projects []IncentiveProject
	db.Find(&projects)

	fmt.Println("Checking project data sources:")
	for _, p := range projects {
		ds := strings.TrimSpace(p.DataSource)
		dsLower := strings.ToLower(ds)
		isManual := dsLower == "manual" || dsLower == "manual override"
		fmt.Printf("ID: %d | Name: %-20s | Raw DS: '%s' | Detected Manual: %v\n", p.ID, p.ProjectName, p.DataSource, isManual)
	}
}
