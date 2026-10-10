package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/spw32767/university-competency-system-backend/config"
	appdb "github.com/spw32767/university-competency-system-backend/db"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
)

func main() {
	_ = godotenv.Load(".env")
	cfg := config.Load()
	budget, generationConfig, err := services.AssessmentRuntime(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if generationConfig.Provider == "ollama" {
		installedDigest, digestErr := services.ResolveOllamaModelDigest(context.Background(), cfg.AssessmentOllamaURL, services.DefaultAssessmentModel())
		if digestErr != nil || installedDigest != cfg.AssessmentOllamaModelDigest {
			log.Fatal("assessment worker model digest does not match the pinned configuration")
		}
	}
	db, err := appdb.NewMySQL(cfg)
	if err != nil {
		log.Fatal("assessment worker database connection failed")
	}
	defer db.Close()

	sourceRepo := repositories.NewAssessmentSourceRepository(db)
	readinessRepo := repositories.NewCooperativeReadinessRepository(db)
	curriculumRepo := repositories.NewCurriculumRepository(db)
	sourceBuilder := services.NewAssessmentSourceBuilder(db, sourceRepo, readinessRepo, curriculumRepo)
	sourceBuilder.ContextBudget = budget
	sourceBuilder.GenerationConfig = generationConfig
	jobRepo := repositories.NewAssessmentJobRepository(db)
	reportRepo := repositories.NewAssessmentReportRepository(db)
	var provider services.AssessmentProvider = services.NewOllamaAssessmentProvider(
		cfg.AssessmentOllamaURL,
		services.DefaultAssessmentModel(),
		cfg.AssessmentOllamaTimeout,
		cfg.AssessmentOllamaKeepAlive,
		cfg.AssessmentOllamaThink,
		cfg.AssessmentOutputReserveTokens,
		cfg.AssessmentContextTokens,
	)
	attemptTimeout := cfg.AssessmentOllamaTimeout
	if generationConfig.Provider != "ollama" {
		provider = services.NewAPIAssessmentProvider(generationConfig.Provider, generationConfig.Model, cfg.AssessmentAPIKey, cfg.AssessmentAPITimeout, cfg.AssessmentAPIIdleTimeout, cfg.AssessmentOutputReserveTokens)
		attemptTimeout = cfg.AssessmentAPITimeout
	}
	worker := services.NewLearnerAssessmentWorker(jobRepo, reportRepo, provider, sourceBuilder)
	worker.ContextBudget = budget
	worker.GenerationConfig = generationConfig
	if generationConfig.Provider != "ollama" {
		worker.APICalls = &repositories.AssessmentAPIRepository{DB: db}
		worker.APIDailyLimit = cfg.AssessmentAPIDailyLimit
	}
	worker.LeaseDuration = cfg.AssessmentWorkerLeaseDuration
	worker.AttemptTimeout = attemptTimeout + 60*time.Second

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pollInterval := cfg.AssessmentWorkerPollInterval
	if pollInterval <= 0 {
		pollInterval = 3 * time.Second
	}
	log.Printf("learner assessment worker started (provider=%s model=%s)", generationConfig.Provider, generationConfig.Model)
	for ctx.Err() == nil {
		processed, processErr := worker.ProcessOne(ctx)
		if processErr != nil {
			logAssessmentWorkerError(processErr)
		}
		if !processed || processErr != nil {
			if !waitForNextJob(ctx, pollInterval) {
				break
			}
		}
	}
	log.Print("learner assessment worker stopped")
}

func waitForNextJob(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func logAssessmentWorkerError(err error) {
	var providerErr services.AssessmentProviderError
	if errors.As(err, &providerErr) {
		log.Printf("learner assessment job failed (provider_code=%s)", providerErr.Code)
		return
	}
	log.Print("learner assessment job failed (internal error)")
}
