package services

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestAssessmentDuplicateSentencesRemainRejected(t *testing.T) {
	for _, language := range []string{"th", "en"} {
		for _, across := range []bool{false, true} {
			t.Run(language+map[bool]string{true: " across paragraphs", false: " within paragraph"}[across], func(t *testing.T) {
				output := validAssessmentProviderOutput()
				first := output.Paragraphs[0].Sentences[0]
				second := first
				if language == "th" {
					second.Text.TH = "  " + first.Text.TH + "  "
					second.Text.EN = "The available result meets the stated criterion."
				} else {
					second.Text.EN = "  " + first.Text.EN + "  "
					second.Text.TH = "ผลการเรียนที่มีอยู่ถึงเกณฑ์ที่กำหนดแล้ว"
				}
				paragraph, sentence := 1, 2
				if across {
					output.Paragraphs = append(output.Paragraphs, models.AssessmentNarrativeParagraph{Section: "strengths", Sentences: []models.AssessmentNarrativeSentence{second}})
					paragraph, sentence = 3, 1
				} else {
					output.Paragraphs[0].Sentences = append(output.Paragraphs[0].Sentences, second)
				}
				raw, _ := json.Marshal(output)
				_, err := ValidateAssessmentProviderOutput(raw, validAssessmentProviderInput())
				var diagnostic *AssessmentOutputValidationError
				if !errors.As(err, &diagnostic) || diagnostic.Reason != assessmentReasonDuplicateSentence || diagnostic.Language != language || diagnostic.ParagraphIndex != paragraph || diagnostic.SentenceIndex != sentence {
					t.Fatalf("unexpected duplicate diagnostic: %#v", diagnostic)
				}
			})
		}
	}
}

func TestAssessmentOneSentenceAndDistinctSameObservationAccepted(t *testing.T) {
	output := validAssessmentProviderOutput()
	for _, extend := range []bool{false, true} {
		if extend {
			second := output.Paragraphs[0].Sentences[0]
			second.Text = models.AssessmentBilingualText{TH: "ผลการเรียนนี้เป็นข้อมูลประกอบการเตรียมความพร้อมตามเกณฑ์ที่กำหนด", EN: "This academic result supports preparation against the specified criterion."}
			output.Paragraphs[0].Sentences = append(output.Paragraphs[0].Sentences, second)
		}
		raw, _ := json.Marshal(output)
		if _, err := ValidateAssessmentProviderOutput(raw, validAssessmentProviderInput()); err != nil {
			t.Fatal(err)
		}
	}
}
