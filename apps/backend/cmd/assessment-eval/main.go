package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/spw32767/university-competency-system-backend/config"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/services"
)

const maxEvalFixtureBytes = 2 << 20

type evalFixture struct {
	Name            string                         `json:"name"`
	Input           models.AssessmentProviderInput `json:"input"`
	ReviewChecklist []string                       `json:"review_checklist"`
}

func main() {
	fixtureDir := flag.String("cases", "testdata/learner_assessment", "directory containing synthetic JSON evaluation cases")
	flag.Parse()

	if os.Getenv("LEARNER_ASSESSMENT_EVAL") != "1" {
		fatalf("set LEARNER_ASSESSMENT_EVAL=1 to confirm that only synthetic fixtures will be sent to Ollama")
	}

	cfg := config.Load()
	ctx := context.Background()
	digest, err := services.ResolveOllamaModelDigest(ctx, cfg.AssessmentOllamaURL, services.DefaultAssessmentModel())
	if err != nil {
		fatalf("could not verify the configured Ollama model: %v", err)
	}
	provider := services.NewOllamaAssessmentProvider(
		cfg.AssessmentOllamaURL,
		services.DefaultAssessmentModel(),
		cfg.AssessmentOllamaTimeout,
		cfg.AssessmentOllamaKeepAlive,
		cfg.AssessmentOllamaThink,
		cfg.AssessmentOutputReserveTokens,
		cfg.AssessmentContextTokens,
	)
	if err := evaluateDirectory(ctx, *fixtureDir, provider, cfg, digest); err != nil {
		fatalf("evaluation failed: %v", err)
	}
}

func evaluateDirectory(
	ctx context.Context,
	directory string,
	provider services.AssessmentProvider,
	cfg config.Config,
	modelDigest string,
) error {
	paths, err := filepath.Glob(filepath.Join(directory, "*.json"))
	if err != nil {
		return fmt.Errorf("find evaluation fixtures")
	}
	sort.Strings(paths)
	if len(paths) == 0 {
		return fmt.Errorf("no JSON evaluation fixtures found")
	}

	budget := services.AssessmentContextBudget{
		ContextTokens:       cfg.AssessmentContextTokens,
		OutputReserveTokens: cfg.AssessmentOutputReserveTokens,
		SafetyMarginTokens:  cfg.AssessmentTokenSafetyMargin,
	}
	for _, path := range paths {
		if err := evaluateFixture(ctx, path, provider, budget, cfg.AssessmentOllamaThink, modelDigest); err != nil {
			return err
		}
	}
	return nil
}

func evaluateFixture(
	ctx context.Context,
	path string,
	provider services.AssessmentProvider,
	budget services.AssessmentContextBudget,
	think bool,
	modelDigest string,
) error {
	fixtureBytes, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read fixture %s", filepath.Base(path))
	}
	if len(fixtureBytes) > maxEvalFixtureBytes {
		return fmt.Errorf("fixture %s exceeds the size limit", filepath.Base(path))
	}
	var fixture evalFixture
	if err := json.Unmarshal(fixtureBytes, &fixture); err != nil {
		return fmt.Errorf("decode fixture %s: %w", filepath.Base(path), err)
	}
	if strings.TrimSpace(fixture.Name) == "" {
		return fmt.Errorf("fixture %s has no name", filepath.Base(path))
	}
	if fixture.Input.Completeness == "none" {
		return fmt.Errorf("fixture %s has no analyzable evidence; the backend must not call the provider for this state", fixture.Name)
	}
	systemPrompt, userPrompt, err := services.BuildAssessmentPrompt(fixture.Input)
	if err != nil {
		return fmt.Errorf("build prompt for %s", fixture.Name)
	}
	estimatedTokens := services.EstimateAssessmentPromptTokens(systemPrompt, userPrompt)
	budgetLimit := budget.ContextTokens - budget.OutputReserveTokens - budget.SafetyMarginTokens
	if estimatedTokens > budgetLimit {
		return fmt.Errorf("fixture %s exceeds the input budget (%d > %d estimated tokens)", fixture.Name, estimatedTokens, budgetLimit)
	}

	startedAt := time.Now()
	raw, err := provider.Generate(ctx, systemPrompt, userPrompt, services.AssessmentOutputJSONSchema())
	if err != nil {
		return fmt.Errorf("fixture %s provider request failed: %w", fixture.Name, safeProviderError(err))
	}
	validated, err := services.ValidateAssessmentProviderOutput(raw, fixture.Input)
	if err != nil {
		return fmt.Errorf("fixture %s returned invalid structured output: %w", fixture.Name, err)
	}
	formatted, err := json.MarshalIndent(validated, "", "  ")
	if err != nil {
		return fmt.Errorf("format validated output for %s", fixture.Name)
	}

	fmt.Printf("CASE %q model=%s digest=%s think=%t estimated_input_tokens=%d elapsed=%s schema=valid\n",
		fixture.Name, services.DefaultAssessmentModel(), modelDigest, think, estimatedTokens, time.Since(startedAt).Round(time.Millisecond))
	fmt.Printf("Review checklist: %s\n", strings.Join(fixture.ReviewChecklist, "; "))
	fmt.Printf("%s\n\n", formatted)
	return nil
}

func safeProviderError(err error) error {
	var providerErr services.AssessmentProviderError
	if errors.As(err, &providerErr) {
		return fmt.Errorf("provider error code %s", providerErr.Code)
	}
	return errors.New("provider request failed")
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
