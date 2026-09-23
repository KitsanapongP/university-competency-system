package services

import (
	"math"
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestBuildLearnerAcademicTermSummariesCalculatesTermAndCumulativeTotals(t *testing.T) {
	courses := []models.LearnerAcademicCourse{
		{RecordID: 1, CourseID: 10, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "B+"},
		{RecordID: 2, CourseID: 11, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 3, CourseID: 12, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "F"},
		{RecordID: 4, CourseID: 13, Source: "free_elective", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: "S"},
		{RecordID: 5, CourseID: 14, Source: "free_elective", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: "U"},
		{RecordID: 6, CourseID: 15, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "W"},
		{RecordID: 7, CourseID: 16, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "I"},
		{RecordID: 8, CourseID: 17, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 1, Credits: 3, GradeScheme: "letter"},
		{RecordID: 9, CourseID: 10, Source: "curriculum", AcademicYearBE: 2566, StudyYear: 1, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
	}

	summaries := buildLearnerAcademicTermSummaries(courses)
	if len(summaries) != 2 {
		t.Fatalf("got %d term summaries, want 2", len(summaries))
	}

	first := summaries[0]
	if first.Term.CR != 24 || first.Term.CP != 9 || first.Term.CA != 9 || first.Term.GP != 22.5 {
		t.Errorf("first term totals = %#v, want CR 24, CP 9, CA 9, GP 22.5", first.Term)
	}
	if first.Term.GPA == nil || *first.Term.GPA != 2.5 {
		t.Errorf("first term GPA = %v, want 2.5", first.Term.GPA)
	}
	if first.Cumulative.CP != 9 {
		t.Errorf("first cumulative CP = %d, want 9", first.Cumulative.CP)
	}

	second := summaries[1]
	if second.Term.CR != 3 || second.Term.CP != 3 || second.Term.CA != 3 || second.Term.GP != 12 {
		t.Errorf("second term totals = %#v, want CR 3, CP 3, CA 3, GP 12", second.Term)
	}
	if second.Cumulative.CR != 27 || second.Cumulative.CP != 9 || second.Cumulative.CA != 12 || second.Cumulative.GP != 34.5 {
		t.Errorf("cumulative totals = %#v, want CR 27, CP 9, CA 12, GP 34.5", second.Cumulative)
	}
	if second.Cumulative.GPA == nil || *second.Cumulative.GPA != 2.875 {
		t.Errorf("cumulative GPA = %v, want 2.875", second.Cumulative.GPA)
	}
}

func TestBuildLearnerAcademicTermSummariesMatchesTranscriptTotals(t *testing.T) {
	courses := []models.LearnerAcademicCourse{
		{RecordID: 1, CourseID: 1, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 2, CourseID: 2, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 3, CourseID: 3, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 4, CourseID: 4, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 5, CourseID: 5, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 6, CourseID: 6, Source: "curriculum", AcademicYearBE: 2566, Semester: 1, Credits: 3, GradeScheme: "letter", Grade: "B+"},
		{RecordID: 7, CourseID: 7, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 8, CourseID: 8, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 9, CourseID: 9, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 10, CourseID: 10, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 11, CourseID: 11, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "A"},
		{RecordID: 12, CourseID: 12, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "C+"},
		{RecordID: 13, CourseID: 13, Source: "curriculum", AcademicYearBE: 2566, Semester: 2, Credits: 3, GradeScheme: "letter", Grade: "B"},
	}

	summaries := buildLearnerAcademicTermSummaries(courses)
	if len(summaries) != 2 {
		t.Fatalf("got %d term summaries, want 2", len(summaries))
	}
	if summaries[0].Term.CR != 18 || summaries[0].Term.CP != 18 || summaries[0].Term.CA != 18 || summaries[0].Term.GP != 70.5 {
		t.Errorf("first term totals = %#v, want CR/CP/CA 18 and GP 70.5", summaries[0].Term)
	}
	if summaries[0].Term.GPA == nil || math.Abs(*summaries[0].Term.GPA-70.5/18) > 1e-9 {
		t.Errorf("first term GPA = %v, want 70.5/18", summaries[0].Term.GPA)
	}
	if summaries[1].Term.CR != 21 || summaries[1].Term.CP != 21 || summaries[1].Term.CA != 21 || summaries[1].Term.GP != 76.5 {
		t.Errorf("second term totals = %#v, want CR/CP/CA 21 and GP 76.5", summaries[1].Term)
	}
	if summaries[1].Cumulative.CR != 39 || summaries[1].Cumulative.CP != 39 || summaries[1].Cumulative.CA != 39 || summaries[1].Cumulative.GP != 147 {
		t.Errorf("cumulative totals = %#v, want CR/CP/CA 39 and GP 147", summaries[1].Cumulative)
	}
	if summaries[1].Cumulative.GPA == nil || math.Abs(*summaries[1].Cumulative.GPA-147.0/39) > 1e-9 {
		t.Errorf("cumulative GPA = %v, want 147/39", summaries[1].Cumulative.GPA)
	}
}

func TestBuildLearnerAcademicTermSummariesLeavesGPAEmptyWithoutNumericGrades(t *testing.T) {
	summaries := buildLearnerAcademicTermSummaries([]models.LearnerAcademicCourse{
		{RecordID: 1, CourseID: 1, Source: "free_elective", AcademicYearBE: 2567, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: "S"},
		{RecordID: 2, CourseID: 2, Source: "free_elective", AcademicYearBE: 2567, Semester: 1, Credits: 3, GradeScheme: "satisfactory", Grade: "U"},
	})
	if len(summaries) != 1 {
		t.Fatalf("got %d term summaries, want 1", len(summaries))
	}
	if summaries[0].Term.GPA != nil {
		t.Fatalf("GPA = %v, want nil when there are no GPA credits", *summaries[0].Term.GPA)
	}
	if summaries[0].Term.CP != 3 || summaries[0].Term.CA != 0 || summaries[0].Term.GP != 0 {
		t.Errorf("term totals = %#v, want CP 3, CA 0, GP 0", summaries[0].Term)
	}
}
