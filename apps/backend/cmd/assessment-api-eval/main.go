package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/joho/godotenv"
	"github.com/spw32767/university-competency-system-backend/config"
	appdb "github.com/spw32767/university-competency-system-backend/db"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/services"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Synthetic evidence only. Database access is limited to shared API accounting.
func main() {
	_ = godotenv.Load(".env")
	cases := flag.String("cases", "testdata/learner_assessment/api", "synthetic fixture directory")
	maxCalls := flag.Int("max-calls", 1, "maximum paid calls for this evaluation (1-20)")
	flag.Parse()
	if os.Getenv("LEARNER_ASSESSMENT_API_EVAL") != "1" || *maxCalls < 1 || *maxCalls > 20 {
		fail("Set LEARNER_ASSESSMENT_API_EVAL=1 and choose --max-calls between 1 and 20 to acknowledge paid synthetic evaluation")
	}
	cfg := config.Load()
	budget, g, err := services.AssessmentRuntime(cfg)
	if err != nil {
		fail(err.Error())
	}
	if g.Provider == "ollama" {
		fail("Use assessment-eval for Ollama")
	}
	root, err := filepath.Abs("testdata/learner_assessment")
	if err != nil {
		fail("fixture root unavailable")
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		fail("fixture root unavailable")
	}
	dir, err := filepath.Abs(*cases)
	if err != nil {
		fail("invalid fixture path")
	}
	dir, err = filepath.EvalSymlinks(dir)
	if err != nil || !inside(root, dir) {
		fail("fixtures must be inside the synthetic fixture root")
	}
	paths, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil || len(paths) == 0 || len(paths) > *maxCalls {
		fail("no fixtures or fixture count exceeds --max-calls")
	}
	db, err := appdb.NewMySQL(cfg)
	if err != nil {
		fail("database accounting unavailable; migrate assessment API limits first")
	}
	defer db.Close()
	accounting := &repositories.AssessmentAPIRepository{DB: db}
	provider := services.NewAPIAssessmentProvider(g.Provider, g.Model, cfg.AssessmentAPIKey, cfg.AssessmentAPITimeout, cfg.AssessmentAPIIdleTimeout, budget.OutputReserveTokens)
	failed := false
	for _, path := range paths {
		resolved, err := filepath.EvalSymlinks(path)
		if err != nil || !inside(root, resolved) {
			fail("fixture symlink escapes synthetic root")
		}
		info, err := os.Stat(resolved)
		if err != nil || info.Size() > 2<<20 {
			fail("invalid fixture size")
		}
		raw, err := os.ReadFile(resolved)
		if err != nil {
			fail("cannot read fixture")
		}
		if regexp.MustCompile(`(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[0-9]{8,13}\b`).Match(raw) {
			fail("fixture contains identifiers; remove them before external evaluation")
		}
		var fixture struct {
			Name  string                         `json:"name"`
			Input models.AssessmentProviderInput `json:"input"`
		}
		if json.Unmarshal(raw, &fixture) != nil || fixture.Input.Completeness == "none" {
			fail("invalid or insufficient synthetic evidence")
		}
		system, user, err := services.BuildAssessmentPromptForProvider(fixture.Input, g.Provider)
		if err != nil {
			fail("prompt preparation failed")
		}
		if services.EstimateAssessmentPromptTokens(system, user)+budget.OutputReserveTokens+budget.SafetyMarginTokens > budget.ContextTokens {
			fail("fixture exceeds configured context")
		}
		ctx, cancel := context.WithTimeout(context.Background(), cfg.AssessmentAPITimeout)
		var nonce [16]byte
		if _, err = rand.Read(nonce[:]); err != nil {
			cancel()
			fail("cannot create evaluation reference")
		}
		callID, reserveErr := accounting.ReserveEvaluation(ctx, hex.EncodeToString(nonce[:]), g.Provider, g.Model, cfg.AssessmentAPIDailyLimit, cfg.AssessmentAPITimeout+time.Minute)
		if reserveErr != nil {
			cancel()
			fail("API accounting reservation denied; check daily quota and active calls")
		}
		usage := services.AssessmentAPIUsage{}
		out, err := provider.Generate(services.WithAssessmentAPIUsage(ctx, &usage), system, user, services.AssessmentAPIOutputJSONSchema(fixture.Input))
		cancel()
		finishCtx, finishCancel := context.WithTimeout(context.Background(), 5*time.Second)
		finishErr := accounting.Finish(finishCtx, callID, usage.InputTokens, usage.OutputTokens)
		finishCancel()
		if finishErr != nil {
			fail("API accounting finalization failed")
		}
		if err != nil {
			fmt.Printf("CASE %s provider_request_failed\n", filepath.Base(path))
			failed = true
			continue
		}
		normalized, err := services.NormalizeAssessmentAPIOutput(out)
		if err == nil {
			_, err = services.ValidateAssessmentProviderOutput(normalized, fixture.Input)
		}
		if err != nil {
			services.LogAssessmentAPIOutputRejection(context.Background(), err, len(out))
			failed = true
			fmt.Printf("CASE %s validation=failed\n", filepath.Base(path))
		} else {
			fmt.Printf("CASE %s validation=passed human_review=pending\n", filepath.Base(path))
		}
	}
	if failed {
		os.Exit(1)
	}
}

func inside(root, path string) bool {
	relative, err := filepath.Rel(root, path)
	return err == nil && !filepath.IsAbs(relative) && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}
func fail(message string) { fmt.Fprintln(os.Stderr, message); os.Exit(1) }
