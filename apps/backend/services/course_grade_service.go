package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

type CourseGradeService struct {
	Cohorts *StudentCohortService
	Repo    *repositories.CourseGradeRepository
}

func NewCourseGradeService(cohorts *StudentCohortService, repo *repositories.CourseGradeRepository) *CourseGradeService {
	return &CourseGradeService{Cohorts: cohorts, Repo: repo}
}

func (s *CourseGradeService) GetOverview(ctx context.Context, cohortID uint64, filters models.CourseGradeFilters, roles []string, facultyID *int64) (*models.CourseGradeOverview, error) {
	if _, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID); err != nil {
		return nil, err
	}
	filters = normalizeCourseGradeFilters(filters)
	return s.Repo.GetOverview(ctx, cohortID, filters)
}

func (s *CourseGradeService) GetStudentGrades(ctx context.Context, cohortID, enrollmentID uint64, filters models.CourseGradeFilters, roles []string, facultyID *int64) (*models.CourseGradeStudentDetail, error) {
	if _, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID); err != nil {
		return nil, err
	}
	if _, err := s.Cohorts.Repo.GetCohortStudentByEnrollmentID(ctx, cohortID, enrollmentID); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCohortStudentNotFound
	} else if err != nil {
		return nil, err
	}
	filters = normalizeCourseGradeFilters(filters)
	return s.Repo.GetStudentGrades(ctx, cohortID, enrollmentID, filters)
}

func (s *CourseGradeService) PutGrades(ctx context.Context, cohortID uint64, payload models.PutCourseGradesRequest, roles []string, facultyID *int64) (*models.CourseGradeImportCommitResult, error) {
	cohort, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return nil, err
	}
	rows, err := normalizeCourseGradeRows(payload.Rows, false)
	if err != nil {
		return nil, err
	}
	if err := ensureUniqueGradeRows(rows); err != nil {
		return nil, err
	}
	imported, replaced, err := s.Repo.UpsertGrades(ctx, cohortID, rows, "manual")
	if err != nil {
		return nil, err
	}
	return &models.CourseGradeImportCommitResult{ImportedRows: imported, ReplacedRows: replaced, CourseScoresRecalculationRequired: true}, nil
}

func (s *CourseGradeService) PreviewImport(ctx context.Context, cohortID uint64, payload models.PutCourseGradesRequest, roles []string, facultyID *int64) (*models.CourseGradeImportPreview, error) {
	cohort, err := s.Cohorts.GetCohort(ctx, cohortID, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if err := ensureCohortRosterWritable(cohort); err != nil {
		return nil, err
	}
	preview := &models.CourseGradeImportPreview{
		ValidRows: make([]models.UpsertCourseGradeRow, 0),
		Conflicts: make([]models.CourseGradeImportConflict, 0),
		Errors:    make([]models.CourseGradeImportIssue, 0),
	}
	if len(payload.Rows) == 0 {
		preview.Errors = append(preview.Errors, models.CourseGradeImportIssue{Message: "at least one grade row is required"})
		return preview, nil
	}
	if len(payload.Rows) > 5000 {
		preview.Errors = append(preview.Errors, models.CourseGradeImportIssue{Message: "a maximum of 5,000 grade rows can be imported at once"})
		return preview, nil
	}
	rows, rowErrors := normalizeCourseGradeRowsForPreview(payload.Rows)
	preview.Errors = append(preview.Errors, rowErrors...)
	seen := make(map[string]bool)
	for _, row := range rows {
		key := gradeRowKey(row)
		if seen[key] {
			preview.Errors = append(preview.Errors, models.CourseGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode, Message: "duplicate student, course, academic year, and semester in file"})
			continue
		}
		seen[key] = true
		enrollmentID, _, courseID, resolveErr := s.Repo.ResolveRow(ctx, cohortID, row)
		if errors.Is(resolveErr, sql.ErrNoRows) {
			preview.Errors = append(preview.Errors, models.CourseGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode, Message: "student or course is not in this cohort curriculum"})
			continue
		}
		if resolveErr != nil {
			return nil, resolveErr
		}
		row.EnrollmentID = enrollmentID
		row.CourseID = courseID
		if row.CourseCode == "" {
			row.CourseCode = fmt.Sprintf("course-%d", courseID)
		}
		preview.ValidRows = append(preview.ValidRows, row)
		existing, existingErr := s.Repo.GetExistingGrade(ctx, cohortID, row)
		if errors.Is(existingErr, sql.ErrNoRows) {
			continue
		}
		if existingErr != nil {
			return nil, existingErr
		}
		preview.Conflicts = append(preview.Conflicts, models.CourseGradeImportConflict{
			RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode,
			AcademicYearBE: row.AcademicYearBE, Semester: row.Semester, ExistingGrade: existing.Grade,
			IncomingGrade: row.Grade, CourseStudentID: existing.CourseStudentID, Replace: row.Replace,
		})
	}
	return preview, nil
}

func (s *CourseGradeService) CommitImport(ctx context.Context, cohortID uint64, payload models.PutCourseGradesRequest, roles []string, facultyID *int64) (*models.CourseGradeImportCommitResult, error) {
	preview, err := s.PreviewImport(ctx, cohortID, payload, roles, facultyID)
	if err != nil {
		return nil, err
	}
	if len(preview.Errors) > 0 {
		return nil, StudentCohortValidationError{Message: "grade import contains invalid rows"}
	}
	conflictKeys := make(map[string]bool, len(preview.Conflicts))
	for _, conflict := range preview.Conflicts {
		conflictKeys[importConflictKey(conflict)] = true
	}
	rows := make([]models.UpsertCourseGradeRow, 0, len(preview.ValidRows))
	skipped := 0
	for _, row := range preview.ValidRows {
		key := gradeRowKey(row)
		if conflictKeys[key] && !row.Replace {
			skipped++
			continue
		}
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return &models.CourseGradeImportCommitResult{SkippedConflicts: skipped}, nil
	}
	imported, replaced, err := s.Repo.UpsertGrades(ctx, cohortID, rows, "excel")
	if err != nil {
		return nil, err
	}
	return &models.CourseGradeImportCommitResult{ImportedRows: imported, ReplacedRows: replaced, SkippedConflicts: skipped, CourseScoresRecalculationRequired: true}, nil
}

func normalizeCourseGradeFilters(filters models.CourseGradeFilters) models.CourseGradeFilters {
	filters.Search = strings.TrimSpace(filters.Search)
	return filters
}

func normalizeCourseGradeRows(rows []models.UpsertCourseGradeRow, allowMissingIdentity bool) ([]models.UpsertCourseGradeRow, error) {
	normalized, issues := normalizeCourseGradeRowsForPreview(rows)
	if len(issues) > 0 {
		return nil, StudentCohortValidationError{Message: issues[0].Message}
	}
	if !allowMissingIdentity {
		for _, row := range normalized {
			if row.EnrollmentID == 0 || row.StudentCode == "" {
				return nil, StudentCohortValidationError{Message: "enrollment_id and student_code are required"}
			}
		}
	}
	return normalized, nil
}

func normalizeCourseGradeRowsForPreview(rows []models.UpsertCourseGradeRow) ([]models.UpsertCourseGradeRow, []models.CourseGradeImportIssue) {
	normalized := make([]models.UpsertCourseGradeRow, 0, len(rows))
	issues := make([]models.CourseGradeImportIssue, 0)
	for index, row := range rows {
		row.StudentCode = strings.TrimSpace(row.StudentCode)
		row.CourseCode = strings.TrimSpace(row.CourseCode)
		row.Grade = grading.Normalize(row.Grade)
		if row.RowNumber == 0 {
			row.RowNumber = index + 2
		}
		if row.StudentCode == "" || (row.CourseID == 0 && row.CourseCode == "") {
			issues = append(issues, models.CourseGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode, Message: "student_code and course_code are required"})
			continue
		}
		if row.AcademicYearBE == 0 {
			issues = append(issues, models.CourseGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode, Message: "academic_year_be is required"})
			continue
		}
		if row.Semester < 1 || row.Semester > 3 {
			issues = append(issues, models.CourseGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode, Message: "semester must be 1, 2, or 3"})
			continue
		}
		if !grading.IsRecognized(row.Grade) {
			issues = append(issues, models.CourseGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, CourseCode: row.CourseCode, Message: "grade is not in the supported Grade Map"})
			continue
		}
		normalized = append(normalized, row)
	}
	return normalized, issues
}

func ensureUniqueGradeRows(rows []models.UpsertCourseGradeRow) error {
	seen := make(map[string]bool, len(rows))
	for _, row := range rows {
		key := gradeRowKey(row)
		if seen[key] {
			return StudentCohortValidationError{Message: "duplicate grade row"}
		}
		seen[key] = true
	}
	return nil
}

func gradeRowKey(row models.UpsertCourseGradeRow) string {
	return fmt.Sprintf("%s:%s:%d:%d", strings.ToLower(strings.TrimSpace(row.StudentCode)), strings.ToLower(strings.TrimSpace(row.CourseCode)), row.AcademicYearBE, row.Semester)
}

func importConflictKey(conflict models.CourseGradeImportConflict) string {
	return fmt.Sprintf("%s:%s:%d:%d",
		strings.ToLower(strings.TrimSpace(conflict.StudentCode)),
		strings.ToLower(strings.TrimSpace(conflict.CourseCode)),
		conflict.AcademicYearBE,
		conflict.Semester,
	)
}
