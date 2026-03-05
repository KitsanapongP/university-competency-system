package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"

	"github.com/spw32767/university-competency-system-backend/config"
	appdb "github.com/spw32767/university-competency-system-backend/db"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := appdb.NewMySQL(cfg)
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}
	defer db.Close()

	// อ่านไฟล์ SQL
	sqlFile := "../../kku_competency_v2_with_test_data.sql"
	content, err := ioutil.ReadFile(sqlFile)
	if err != nil {
		log.Fatalf("read file failed: %v", err)
	}

	// Split statements by semicolon and filter comments
	lines := strings.Split(string(content), "\n")
	var currentStmt strings.Builder
	count := 0

	for _, line := range lines {
		// Skip comments and empty lines
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") || strings.HasPrefix(trimmed, "/*") {
			continue
		}

		currentStmt.WriteString(line)
		currentStmt.WriteString("\n")

		// Check if line ends with semicolon (end of statement)
		if strings.HasSuffix(trimmed, ";") {
			stmt := strings.TrimSpace(currentStmt.String())
			currentStmt.Reset()

			// Execute statement
			if _, err := db.ExecContext(context.Background(), stmt); err != nil {
				// Skip error for duplicate keys
				if strings.Contains(err.Error(), "already exists") || strings.Contains(err.Error(), "Duplicate entry") {
					continue
				}
				// Print but don't fail on other errors (e.g. syntax issues from comments)
				if !strings.Contains(err.Error(), "Syntax") {
					fmt.Printf("Error executing: %s (skipping)\n", err)
				}
				continue
			}
			count++
		}
	}

	fmt.Printf("Successfully imported %d SQL statements!\n", count)

	// ตรวจสอบว่า tables มีอยู่แล้ว
	var tableCount int
	if err := db.QueryRowContext(context.Background(), "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()").Scan(&tableCount); err == nil {
		fmt.Printf("Database now has %d tables\n", tableCount)
	}
}
