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
	repeats := flag.Int("repeat", 1, "repeat every fixture (1-10); use 3 for the release gate")
	minutes := flag.Int("minutes", 90, "maximum evaluation duration in minutes (1-90)")
	flag.Parse()
	if *minutes < 1 || *minutes > 90 {
		fatalf("minutes must be between 1 and 90")
	}
	if *repeats < 1 || *repeats > 10 {
		fatalf("repeat must be between 1 and 10")
	}

	if os.Getenv("LEARNER_ASSESSMENT_EVAL") != "1" {
		fatalf("set LEARNER_ASSESSMENT_EVAL=1 to confirm that only synthetic fixtures will be sent to Ollama")
	}
	casesDirectory, err := resolveEvaluationCasesDirectory(*fixtureDir)
	if err != nil {
		fatalf("evaluation fixtures must be inside the checked-in synthetic fixture directory")
	}

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*minutes)*time.Minute)
	defer cancel()
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
	var failures []error
	for round := 1; round <= *repeats; round++ {
		if ctx.Err() != nil {
			failures = append(failures, ctx.Err())
			break
		}
		fmt.Printf("ROUND %d/%d\n", round, *repeats)
		if err := evaluateDirectory(ctx, casesDirectory, provider, cfg, digest); err != nil {
			failures = append(failures, err)
		}
	}
	if len(failures) > 0 {
		fatalf("evaluation failed: %v", errors.Join(failures...))
	}
}

func resolveEvaluationCasesDirectory(directory string) (string, error) {
	allowedRoot, err := filepath.Abs(filepath.Join("testdata", "learner_assessment"))
	if err != nil {
		return "", err
	}
	allowedRoot, err = filepath.EvalSymlinks(allowedRoot)
	if err != nil {
		return "", err
	}
	requestedDirectory, err := filepath.Abs(directory)
	if err != nil {
		return "", err
	}
	requestedDirectory, err = filepath.EvalSymlinks(requestedDirectory)
	if err != nil {
		return "", err
	}
	relative, err := filepath.Rel(allowedRoot, requestedDirectory)
	if err != nil || filepath.IsAbs(relative) || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("evaluation fixture path is outside the synthetic fixture directory")
	}
	info, err := os.Stat(requestedDirectory)
	if err != nil || !info.IsDir() {
		return "", fmt.Errorf("evaluation fixture path is not a directory")
	}
	return requestedDirectory, nil
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
	var failures []error
	for _, path := range paths {
		if ctx.Err() != nil {
			return fmt.Errorf("evaluation deadline reached: %w", ctx.Err())
		}
		if err := evaluateFixture(ctx, path, provider, budget, cfg.AssessmentOllamaThink, modelDigest); err != nil {
			failures = append(failures, fmt.Errorf("%s: %w", filepath.Base(path), err))
		}
	}
	fmt.Printf("SUMMARY attempted=%d succeeded=%d failed=%d first_attempt_success=%.1f%% retries=0 human_review=pending\n",
		len(paths), len(paths)-len(failures), len(failures), float64(len(paths)-len(failures))*100/float64(len(paths)))
	if len(failures) > 0 {
		return fmt.Errorf("%d evaluation fixture(s) failed: %w", len(failures), errors.Join(failures...))
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
	diagnostics := services.EstimateAssessmentContextDiagnostics(fixture.Input, systemPrompt, userPrompt, budget, services.EstimateAssessmentPromptTokens(systemPrompt, userPrompt))
	if diagnostics.EstimatedTotalTokens > diagnostics.ContextTokens {
		return fmt.Errorf("fixture %s exceeds the configured context (estimated_total=%d context=%d input=%d input_budget=%d)",
			fixture.Name,
			diagnostics.EstimatedTotalTokens,
			diagnostics.ContextTokens,
			diagnostics.EstimatedInputTokens,
			diagnostics.InputBudgetTokens,
		)
	}

	startedAt := time.Now()
	defer func() {
		fmt.Printf("ATTEMPT %q context=%d input_tokens=%d elapsed=%s\n", fixture.Name, budget.ContextTokens, diagnostics.EstimatedInputTokens, time.Since(startedAt).Round(time.Millisecond))
	}()
	raw, err := provider.Generate(ctx, systemPrompt, userPrompt, services.AssessmentOutputJSONSchema(fixture.Input))
	if err != nil {
		return fmt.Errorf("fixture %s provider request failed: %w", fixture.Name, safeProviderError(err))
	}
	validated, err := services.ValidateAssessmentProviderOutput(raw, fixture.Input)
	if err != nil {
		services.LogAssessmentOutputRejection(ctx, err, len(raw))
		return fmt.Errorf("fixture %s returned invalid structured output (shape=%s input_tokens=%d total_tokens=%d context=%d output_reserve=%d): %w",
			fixture.Name,
			assessmentOutputShape(raw),
			diagnostics.EstimatedInputTokens,
			diagnostics.EstimatedTotalTokens,
			diagnostics.ContextTokens,
			diagnostics.OutputReserveTokens,
			err,
		)
	}
	formatted, err := json.MarshalIndent(validated, "", "  ")
	if err != nil {
		return fmt.Errorf("format validated output for %s", fixture.Name)
	}

	fmt.Printf("CASE %q model=%s digest=%s think=%t input_tokens=%d total_tokens=%d context=%d output_reserve=%d safety_margin=%d source_bytes=%d readiness_bytes=%d availability_bytes=%d academic_bytes=%d competency_bytes=%d activity_bytes=%d elapsed=%s schema=valid\n",
		fixture.Name,
		services.DefaultAssessmentModel(),
		modelDigest,
		think,
		diagnostics.EstimatedInputTokens,
		diagnostics.EstimatedTotalTokens,
		diagnostics.ContextTokens,
		diagnostics.OutputReserveTokens,
		diagnostics.SafetyMarginTokens,
		diagnostics.SourceDataBytes,
		diagnostics.ReadinessBytes,
		diagnostics.AvailabilityBytes,
		diagnostics.AcademicEvidenceBytes,
		diagnostics.CompetencyScoresBytes,
		diagnostics.ActivityEvidenceBytes,
		time.Since(startedAt).Round(time.Millisecond),
	)
	fmt.Printf("Review checklist: %s\n", strings.Join(fixture.ReviewChecklist, "; "))
	fmt.Printf("%s\n\n", formatted)
	return nil
}

func assessmentOutputShape(raw []byte) string {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		var syntaxError *json.SyntaxError
		if errors.As(err, &syntaxError) {
			class := "invalid-syntax"
			if strings.Contains(syntaxError.Error(), "unexpected end") {
				class = "unexpected-end"
			}
			return fmt.Sprintf("malformed-json(bytes=%d,syntax_offset=%d,class=%s)", len(raw), syntaxError.Offset, class)
		}
		return fmt.Sprintf("malformed-json(bytes=%d,class=invalid-input)", len(raw))
	}
	shape, err := json.Marshal(summarizeAssessmentJSONShape(value))
	if err != nil {
		return "unavailable"
	}
	return string(shape)
}

func summarizeAssessmentJSONShape(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		fields := make(map[string]any, len(typed))
		unknownKeys := 0
		for key, child := range typed {
			if !assessmentOutputFieldNames[key] {
				unknownKeys++
				continue
			}
			fields[key] = summarizeAssessmentJSONShape(child)
		}
		return map[string]any{"type": "object", "fields": fields, "unknown_keys": unknownKeys}
	case []any:
		shape := map[string]any{"type": "array", "items": len(typed)}
		if len(typed) > 0 {
			shape["first"] = summarizeAssessmentJSONShape(typed[0])
		}
		return shape
	case string:
		return "string"
	case bool:
		return "boolean"
	case float64:
		return "number"
	case nil:
		return "null"
	default:
		return "unknown"
	}
}

var assessmentOutputFieldNames = map[string]bool{
	"paragraphs":            true,
	"section":               true,
	"sentences":             true,
	"intent":                true,
	"text":                  true,
	"readiness_explanation": true,
	"strengths":             true,
	"limitations":           true,
	"title":                 true,
	"reason":                true,
	"development_advice":    true,
	"evidence_refs":         true,
	"observation_id":        true,
	"explanation":           true,
	"observations":          true,
	"th":                    true,
	"en":                    true,
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
