package services

import (
	"fmt"
	"sort"
	"strings"

	"github.com/spw32767/university-competency-system-backend/models"
)

// Partition every grade record; do not deduplicate attempts or recompute GPA.
func buildAcademicSummaryObservations(courses []models.AssessmentProviderCourse) []models.AssessmentObservation {
	type term struct{ year, semester uint64 }
	groups := make(map[term][]models.AssessmentProviderCourse)
	for _, course := range courses {
		key := term{course.AcademicYear, course.Semester}
		groups[key] = append(groups[key], course)
	}
	keys := make([]term, 0, len(groups))
	for key := range groups {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].year != keys[j].year {
			return keys[i].year < keys[j].year
		}
		return keys[i].semester < keys[j].semester
	})
	result := make([]models.AssessmentObservation, 0, len(keys))
	for _, key := range keys {
		counts := make(map[[2]string]int)
		refs := make(map[string]bool)
		total, missing := 0, 0
		for _, course := range groups[key] {
			count := course.OccurrenceCount
			if count < 1 {
				count = 1
			}
			total += count
			refs[course.EvidenceRef] = true
			if course.Grade == "" {
				missing += count
				continue
			}
			counts[[2]string{course.GradeScheme, course.Grade}] += count
		}
		bins := make([]models.AssessmentGradeCount, 0, len(counts))
		for bin, count := range counts {
			bins = append(bins, models.AssessmentGradeCount{GradeScheme: bin[0], Grade: bin[1], Count: count})
		}
		sort.Slice(bins, func(i, j int) bool {
			if bins[i].GradeScheme != bins[j].GradeScheme {
				return bins[i].GradeScheme < bins[j].GradeScheme
			}
			return bins[i].Grade < bins[j].Grade
		})
		details := make([]string, 0, len(bins))
		for _, bin := range bins {
			details = append(details, fmt.Sprintf("%s %s: %d", bin.GradeScheme, bin.Grade, bin.Count))
		}
		result = append(result, models.AssessmentObservation{
			ObservationID: fmt.Sprintf("academic:%d:%d", key.year, key.semester), Kind: "neutral", FactType: "academic_summary",
			Values:       models.AssessmentFactValues{AcademicYear: &key.year, Semester: &key.semester, RecordCount: &total, MissingGradeCount: &missing, GradeCounts: bins},
			Title:        models.AssessmentBilingualText{TH: fmt.Sprintf("ผลการเรียนปี %d ภาคเรียน %d", key.year, key.semester), EN: fmt.Sprintf("Academic year BE %d, semester %d", key.year, key.semester)},
			Fact:         models.AssessmentBilingualText{TH: fmt.Sprintf("%d รายการผลการเรียน; ยังไม่มีเกรด %d รายการ; %s", total, missing, strings.Join(details, "; ")), EN: fmt.Sprintf("%d grade records; %d without grades; %s. Counts are records, not passed or unique courses.", total, missing, strings.Join(details, "; "))},
			EvidenceRefs: sortedKeys(refs),
		})
	}
	return result
}
