package services

import (
	"reflect"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestAcademicSummaryPartitionsAllRecordsDeterministically(t *testing.T) {
	courses := []models.AssessmentProviderCourse{
		{EvidenceRef: "c:1", AcademicYear: 2569, Semester: 1, GradeScheme: "letter", Grade: "D", OccurrenceCount: 2},
		{EvidenceRef: "c:2", AcademicYear: 2569, Semester: 1, GradeScheme: "satisfactory", Grade: "S"},
		{EvidenceRef: "c:3", AcademicYear: 2569, Semester: 1},
		{EvidenceRef: "c:4", AcademicYear: 2569, Semester: 3, GradeScheme: "letter", Grade: "A"},
	}
	first := buildAcademicSummaryObservations(courses)
	if len(first) != 2 || *first[0].Values.RecordCount != 4 || *first[0].Values.MissingGradeCount != 1 || len(first[0].EvidenceRefs) != 3 {
		t.Fatalf("incorrect partition: %+v", first)
	}
	if first[1].ObservationID != "academic:2569:3" {
		t.Fatal("Summer missing")
	}
	for i, j := 0, len(courses)-1; i < j; i, j = i+1, j-1 {
		courses[i], courses[j] = courses[j], courses[i]
	}
	if !reflect.DeepEqual(first, buildAcademicSummaryObservations(courses)) {
		t.Fatal("summary depends on order")
	}
	if len(first[0].Values.GradeCounts) != 2 {
		t.Fatal("grade schemes were mixed")
	}
}
