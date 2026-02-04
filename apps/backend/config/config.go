package config

import (
	"os"
	"strconv"
)

type Config struct {
	HTTPAddr string

	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string

	JWTSecret        string
	JWTIssuer        string
	JWTExpireMinutes int
}

func Load() Config {
	return Config{
		HTTPAddr: getEnv("HTTP_ADDR", ":8080"),

		DBHost: getEnv("DB_HOST", "127.0.0.1"),
		DBPort: getEnv("DB_PORT", "3306"),
		DBUser: getEnv("DB_USER", "root"),
		DBPass: getEnv("DB_PASS", ""),
		DBName: getEnv("DB_NAME", "ucs"),

		JWTSecret:        mustEnv("JWT_SECRET", "dev-secret-change-me"),
		JWTIssuer:        getEnv("JWT_ISSUER", "ucs-api"),
		JWTExpireMinutes: getEnvInt("JWT_EXPIRE_MINUTES", 120),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key, fallback string) string {
	// ใน production คุณอาจเลือก panic ถ้าไม่ตั้งค่า
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
