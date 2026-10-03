package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
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

	AssessmentContextTokens       int
	AssessmentOutputReserveTokens int
	AssessmentTokenSafetyMargin   int
	AssessmentOllamaURL           string
	AssessmentOllamaTimeout       time.Duration
	AssessmentOllamaKeepAlive     string
	AssessmentOllamaThink         bool
	AssessmentOllamaModelDigest   string
	AssessmentWorkerPollInterval  time.Duration
	AssessmentWorkerLeaseDuration time.Duration
}

func Load() Config {
	return Config{
		HTTPAddr: getEnv("HTTP_ADDR", ":8080"),

		DBHost: getEnv("DB_HOST", "127.0.0.1"),
		DBPort: getEnv("DB_PORT", "3306"),
		DBUser: getEnv("DB_USER", ""),
		DBPass: getEnv("DB_PASS", ""),
		DBName: getEnv("DB_NAME", "ucs"),

		JWTSecret:        getEnv("JWT_SECRET", ""),
		JWTIssuer:        getEnv("JWT_ISSUER", "ucs-api"),
		JWTExpireMinutes: getEnvInt("JWT_EXPIRE_MINUTES", 120),

		AssessmentContextTokens:       getEnvInt("LEARNER_ASSESSMENT_CONTEXT_TOKENS", 4096),
		AssessmentOutputReserveTokens: getEnvInt("LEARNER_ASSESSMENT_OUTPUT_RESERVE_TOKENS", 1024),
		AssessmentTokenSafetyMargin:   getEnvInt("LEARNER_ASSESSMENT_TOKEN_SAFETY_MARGIN", 128),
		AssessmentOllamaURL:           getEnv("LEARNER_ASSESSMENT_OLLAMA_URL", "http://127.0.0.1:11434"),
		AssessmentOllamaTimeout:       time.Duration(getEnvInt("LEARNER_ASSESSMENT_OLLAMA_TIMEOUT_SECONDS", 120)) * time.Second,
		AssessmentOllamaKeepAlive:     getEnv("LEARNER_ASSESSMENT_OLLAMA_KEEP_ALIVE", "5m"),
		AssessmentOllamaThink:         getEnvBool("LEARNER_ASSESSMENT_OLLAMA_THINK", false),
		AssessmentOllamaModelDigest:   getEnv("LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST", ""),
		AssessmentWorkerPollInterval:  time.Duration(getEnvInt("LEARNER_ASSESSMENT_WORKER_POLL_SECONDS", 3)) * time.Second,
		AssessmentWorkerLeaseDuration: time.Duration(getEnvInt("LEARNER_ASSESSMENT_WORKER_LEASE_SECONDS", 900)) * time.Second,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (c Config) ValidateAPI() error {
	if strings.TrimSpace(c.DBUser) == "" {
		return errors.New("DB_USER is required")
	}
	if len(strings.TrimSpace(c.JWTSecret)) < 32 {
		return errors.New("JWT_SECRET must contain at least 32 bytes")
	}
	return nil
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

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return n
}
