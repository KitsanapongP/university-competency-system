package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"github.com/spw32767/university-competency-system-backend/config"
)

var identifier = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func quote(name string) string {
	if !identifier.MatchString(name) {
		panic("unsafe database identifier")
	}
	return "`" + name + "`"
}

func validateDestination(source, target string) error {
	if !identifier.MatchString(target) || !strings.HasSuffix(target, "_test") || strings.EqualFold(source, target) {
		return fmt.Errorf("destination must be a different database ending in _test")
	}
	return nil
}

func connect(cfg config.Config) (*sql.DB, error) {
	dsn := mysql.NewConfig()
	dsn.User, dsn.Passwd, dsn.DBName = cfg.DBUser, cfg.DBPass, cfg.DBName
	dsn.Net, dsn.Addr = "tcp", cfg.DBHost+":"+cfg.DBPort
	dsn.ParseTime, dsn.Loc = true, time.Local
	dsn.Params = map[string]string{"charset": "utf8mb4"}
	db, err := sql.Open("mysql", dsn.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("database connection configuration failed")
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("database connection failed")
	}
	return db, nil
}

func main() {
	mode := flag.String("mode", "inspect", "inspect, setup, or verify")
	target := flag.String("target", "ucs_assessment_llm_test", "new isolated database")
	email := flag.String("account", "veerapat@dev.local", "learner to copy")
	envPath := flag.String("env-out", "", "private environment file outside the repository")
	flag.Parse()
	_ = godotenv.Load(".env")
	cfg := config.Load()
	if err := validateDestination(cfg.DBName, *target); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	db, err := connect(cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if *mode == "inspect" {
		err = inspect(ctx, db, cfg.DBName)
	} else if *mode == "setup" {
		err = setup(ctx, db, cfg, *target, *email, *envPath)
	} else if *mode == "verify" {
		var userID uint64
		if queryErr := db.QueryRowContext(ctx, "SELECT user_id FROM auth_users WHERE email=?", *email).Scan(&userID); queryErr != nil {
			err = fmt.Errorf("source test account unavailable")
		} else {
			cfg.DBName = *target
			var targetDB *sql.DB
			targetDB, err = connect(cfg)
			if err == nil {
				err = compareSnapshots(ctx, db, targetDB, userID)
				targetDB.Close()
			}
		}
	} else {
		err = fmt.Errorf("unknown mode")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func inspect(ctx context.Context, db *sql.DB, schema string) error {
	rows, err := db.QueryContext(ctx, `SELECT TABLE_NAME,COLUMN_NAME,COLUMN_KEY,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION`, schema)
	if err != nil {
		return fmt.Errorf("schema inspection failed")
	}
	defer rows.Close()
	for rows.Next() {
		var table, col, key, extra string
		if err := rows.Scan(&table, &col, &key, &extra); err != nil {
			return err
		}
		fmt.Printf("%s %s %s %s\n", table, col, key, extra)
	}
	return rows.Err()
}
