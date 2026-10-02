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
	if cfg.AssessmentOllamaModelDigest == "" {
		log.Fatal("assessment worker requires LEARNER_ASSESSMENT_OLLAMA_MODEL_DIGEST; run the synthetic model evaluation and pin the reviewed digest")
	}
	installedDigest, err := services.ResolveOllamaModelDigest(context.Background(), cfg.AssessmentOllamaURL, services.DefaultAssessmentModel())
	if err != nil || installedDigest != cfg.AssessmentOllamaModelDigest {
		log.Fatal("assessment worker model digest does not match the pinned configuration")
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
	budget := services.AssessmentContextBudget{
		ContextTokens:       cfg.AssessmentContextTokens,
		OutputReserveTokens: cfg.AssessmentOutputReserveTokens,
		SafetyMarginTokens:  cfg.AssessmentTokenSafetyMargin,
	}
	generationConfig := services.AssessmentGenerationConfig{
		ModelDigest:  cfg.AssessmentOllamaModelDigest,
		ThinkEnabled: cfg.AssessmentOllamaThink,
		KeepAlive:    cfg.AssessmentOllamaKeepAlive,
	}
	sourceBuilder.ContextBudget = budget
	sourceBuilder.GenerationConfig = generationConfig
	jobRepo := repositories.NewAssessmentJobRepository(db)
	reportRepo := repositories.NewAssessmentReportRepository(db)
	provider := services.NewOllamaAssessmentProvider(
		cfg.AssessmentOllamaURL,
		services.DefaultAssessmentModel(),
		cfg.AssessmentOllamaTimeout,
		cfg.AssessmentOllamaKeepAlive,
		cfg.AssessmentOllamaThink,
		cfg.AssessmentOutputReserveTokens,
	)
	worker := services.NewLearnerAssessmentWorker(jobRepo, reportRepo, provider, sourceBuilder)
	worker.ContextBudget = budget
	worker.GenerationConfig = generationConfig
	worker.LeaseDuration = cfg.AssessmentWorkerLeaseDuration

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pollInterval := cfg.AssessmentWorkerPollInterval
	if pollInterval <= 0 {
		pollInterval = 3 * time.Second
	}
	log.Printf("learner assessment worker started (provider=ollama model=%s)", services.DefaultAssessmentModel())
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
