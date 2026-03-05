package main

import (
	"context"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"

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

	// ข้อมูล user ใหม่ (แก้ไขตามต้องการ)
	username := "testuser"
	email := "test@example.com"
	password := "password123" // password จริง
	displayName := "Test User"
	facultyID := int64(1) // สมมติ faculty 1

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash failed: %v", err)
	}

	// Insert user
	result, err := db.ExecContext(context.Background(), `
		INSERT INTO auth_users (username, email, password_hash, display_name, faculty_id, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
	`, username, email, string(hashed), displayName, facultyID)
	if err != nil {
		log.Fatalf("insert user failed: %v", err)
	}

	userID, _ := result.LastInsertId()

	// Insert role (learner)
	_, err = db.ExecContext(context.Background(), `
		INSERT INTO auth_user_roles (user_id, role_id, scope_faculty_id)
		VALUES (?, 1, NULL)
	`, userID)
	if err != nil {
		log.Fatalf("insert role failed: %v", err)
	}

	fmt.Printf("User added successfully! ID: %d, Email: %s, Password: %s\n", userID, email, password)
}
