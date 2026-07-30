//go:build ignore

package main

import (
	"context"
	"fmt"
	"log"

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

	ctx := context.Background()

	// 1. Check if table comp_template_categories exists, if not run create
	_, err = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS comp_template_categories (
		  template_category_id bigint unsigned NOT NULL AUTO_INCREMENT,
		  template_id bigint unsigned NOT NULL,
		  curriculum_parent_id bigint unsigned DEFAULT NULL,
		  parent_id bigint unsigned DEFAULT NULL,
		  code varchar(20) DEFAULT NULL,
		  name varchar(255) NOT NULL,
		  display_order int unsigned NOT NULL DEFAULT '0',
		  is_active tinyint(1) NOT NULL DEFAULT '1',
		  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
		  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		  deleted_at datetime DEFAULT NULL,
		  PRIMARY KEY (template_category_id),
		  KEY idx_ctc_template (template_id),
		  KEY idx_ctc_curri_parent (curriculum_parent_id),
		  KEY idx_ctc_parent (parent_id),
		  KEY idx_ctc_deleted_at (deleted_at)
		) ENGINE=InnoDB AUTO_INCREMENT=50001 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
	`)
	if err != nil {
		log.Fatalf("Create table comp_template_categories failed: %v", err)
	}

	// 2. Add curriculum_parent_id column if it doesn't exist
	var colExists int
	err = db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM information_schema.COLUMNS 
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comp_template_categories' AND COLUMN_NAME = 'curriculum_parent_id'
	`).Scan(&colExists)
	if err == nil && colExists == 0 {
		_, err = db.ExecContext(ctx, `ALTER TABLE comp_template_categories ADD COLUMN curriculum_parent_id bigint unsigned DEFAULT NULL AFTER template_id`)
		if err != nil {
			fmt.Printf("Add column curriculum_parent_id error or warning: %v\n", err)
		} else {
			fmt.Println("Added column curriculum_parent_id to comp_template_categories")
		}
	}

	// 3. Ensure AUTO_INCREMENT is at least 50001
	var autoInc uint64
	err = db.QueryRowContext(ctx, `
		SELECT AUTO_INCREMENT FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comp_template_categories'
	`).Scan(&autoInc)
	if err == nil && autoInc < 50001 {
		_, err = db.ExecContext(ctx, `ALTER TABLE comp_template_categories AUTO_INCREMENT = 50001`)
		if err != nil {
			fmt.Printf("Set AUTO_INCREMENT error or warning: %v\n", err)
		} else {
			fmt.Println("Set comp_template_categories AUTO_INCREMENT = 50001")
		}
	}

	fmt.Println("Migration completed successfully!")
}
