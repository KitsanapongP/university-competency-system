package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestAssessmentUnsupportedProseRules(t *testing.T) {
	for _, test := range []struct{ name, text, language, rule string }{
		{"Thai number", "ผลการเรียนผ่าน 3 เกณฑ์", "th", "numeric_literal"},
		{"Thai digit", "ผ่าน ๓ เกณฑ์", "th", "numeric_literal"},
		{"English number", "Your GPA is 3.00.", "en", "numeric_literal"},
		{"Thai grade", "ได้เกรด A", "th", "grade_literal"},
		{"English grade", "Your grade is A.", "en", "grade_literal"},
		{"Thai approval", "ได้รับอนุมัติให้ไปสหกิจศึกษา", "th", "placement_approval"},
		{"English approval", "You are approved for internship.", "en", "placement_approval"},
		{"Thai career", "เหมาะกับอาชีพนักพัฒนา", "th", "career_content"},
		{"English career", "Consider a career as a software developer.", "en", "career_content"},
		{"bold", "**ผลการเรียนถึงเกณฑ์**", "th", "prose_markup"},
		{"HTML", "<b>ผลการเรียนถึงเกณฑ์</b>", "th", "prose_markup"},
		{"backticks", "`ผลการเรียนถึงเกณฑ์`", "th", "prose_markup"},
	} {
		t.Run(test.name, func(t *testing.T) {
			output := validAssessmentProviderOutput()
			if test.language == "th" {
				output.Paragraphs[0].Sentences[0].Text.TH = test.text
			} else {
				output.Paragraphs[0].Sentences[0].Text.EN = test.text
			}
			raw, err := json.Marshal(output)
			if err != nil {
				t.Fatal(err)
			}
			_, err = ValidateAssessmentProviderOutput(raw, validAssessmentProviderInput())
			var diagnostic *AssessmentOutputValidationError
			if !errors.As(err, &diagnostic) || diagnostic.Reason != assessmentReasonUnsupportedClaim || diagnostic.Rule != test.rule || diagnostic.Language != test.language || diagnostic.ParagraphIndex != 1 || diagnostic.SentenceIndex != 1 {
				t.Fatalf("unexpected rejection: %#v", diagnostic)
			}
			buffer := captureAssessmentLog(t)
			logAssessmentOutputRejection(context.Background(), err, len(raw))
			entry := readAssessmentLog(t, buffer)[0]
			assertAssessmentLogAllowedFields(t, entry)
			if entry["validation_rule"] != test.rule || strings.Contains(buffer.String(), test.text) {
				t.Fatal("missing safe rule or exposed output")
			}
		})
	}
}

func TestAssessmentProsePreparationWithoutClaims(t *testing.T) {
	for _, text := range []string{
		"ผลการเรียนถึงเกณฑ์ที่กำหนดแล้ว",
		"ผลการเรียนเป็นพื้นฐานสำหรับเตรียมความพร้อมก่อนสหกิจศึกษา",
		"The academic result meets the specified criterion.",
	} {
		if rule := assessmentUnsupportedProseRule(text); rule != "" {
			t.Fatalf("unexpected rule %s for plain preparation prose", rule)
		}
	}
	if !strings.Contains(assessmentSystemPrompt, "These examples illustrate wording only") || assessmentPromptVersion != "learner-assessment-prompt-v1.1.2" {
		t.Fatal("prompt clarification or version missing")
	}
}
