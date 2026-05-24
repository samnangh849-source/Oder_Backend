package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type IncentiveProject struct {
	ID         uint   `gorm:"primaryKey"`
	ProjectName string
	DataSource string `gorm:"column:data_source"`
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var projects []IncentiveProject
	db.Find(&projects)

	fmt.Println("Projects in DB:")
	for _, p := range projects {
		fmt.Printf("ID: %d, Name: %s, DataSource: '%s'\n", p.ID, p.ProjectName, p.DataSource)
	}
}
