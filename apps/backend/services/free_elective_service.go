package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/spw32767/university-competency-system-backend/grading"
	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
	"github.com/spw32767/university-competency-system-backend/utils"
)

var (
	ErrFreeElectiveForbidden            = errors.New("insufficient free-elective scope")
	ErrFreeElectiveCourseNotFound       = errors.New("free-elective course not found")
	ErrFreeElectiveOfferingNotFound     = errors.New("free-elective offering not found")
	ErrFreeElectiveOfferingLocked       = errors.New("free-elective offering is locked")
	ErrFreeElectiveStudentGroupNotFound = errors.New("free-elective student group not found")
)

type FreeElectiveValidationError struct {
	Message string
}

func (e FreeElectiveValidationError) Error() string {
	return e.Message
}

type FreeElectiveConflictError struct {
	Code    string
	Message string
	Data    any
}

func (e FreeElectiveConflictError) Error() string {
	return e.Message
}

type FreeElectiveService struct {
	Repo *repositories.FreeElectiveRepository
}

func NewFreeElectiveService(repo *repositories.FreeElectiveRepository) *FreeElectiveService {
	return &FreeElectiveService{Repo: repo}
}

func freeElectiveHasRole(claims *utils.Claims, role string) bool {
	for _, item := range claims.Roles {
		if item == role {
			return true
		}
	}
	return false
}

func (s *FreeElectiveService) scopedFaculty(claims *utils.Claims, requested *uint64) (*uint64, error) {
	if freeElectiveHasRole(claims, "admin") {
		return requested, nil
	}
	if !freeElectiveHasRole(claims, "officer") || claims.FacultyID == nil || *claims.FacultyID <= 0 {
		return nil, ErrFreeElectiveForbidden
	}
	scoped := uint64(*claims.FacultyID)
	if requested != nil && *requested != scoped {
		return nil, ErrFreeElectiveForbidden
	}
	return &scoped, nil
}

func (s *FreeElectiveService) ListCourses(ctx context.Context, claims *utils.Claims, filters models.FreeElectiveCourseFilters) ([]*models.FreeElectiveCourse, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return nil, err
	}
	return s.Repo.ListCourses(ctx, facultyID)
}

func (s *FreeElectiveService) CreateCourse(ctx context.Context, claims *utils.Claims, payload models.UpsertFreeElectiveCoursePayload) (*models.FreeElectiveCourse, error) {
	facultyID, err := s.scopedFaculty(claims, nonZeroFreeElectiveID(payload.FacultyID))
	if err != nil {
		return nil, err
	}
	if facultyID == nil || *facultyID == 0 {
		return nil, FreeElectiveValidationError{Message: "faculty_id is required"}
	}
	payload.FacultyID = *facultyID
	if err := validateFreeElectiveCoursePayload(payload); err != nil {
		return nil, err
	}
	return s.Repo.CreateCourse(ctx, payload, uint64(claims.UserID))
}

func (s *FreeElectiveService) UpdateCourse(ctx context.Context, claims *utils.Claims, courseID uint64, payload models.UpsertFreeElectiveCoursePayload) (*models.FreeElectiveCourse, error) {
	existing, err := s.Repo.GetCourse(ctx, courseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.scopedFaculty(claims, &existing.FacultyID); err != nil {
		return nil, err
	}
	if payload.FacultyID == 0 {
		payload.FacultyID = existing.FacultyID
	}
	facultyID, err := s.scopedFaculty(claims, &payload.FacultyID)
	if err != nil {
		return nil, err
	}
	payload.FacultyID = *facultyID
	if payload.GradeScheme == "" {
		payload.GradeScheme = existing.GradeScheme
	}
	if payload.Code == "" {
		payload.Code = existing.Code
	}
	if payload.NameTH == "" {
		payload.NameTH = existing.NameTH
	}
	if payload.Credits == 0 {
		payload.Credits = existing.Credits
	}
	if err := validateFreeElectiveCoursePayload(payload); err != nil {
		return nil, err
	}

	nextScheme := strings.ToLower(strings.TrimSpace(payload.GradeScheme))
	resetGrades := nextScheme != existing.GradeScheme &&
		(existing.OfferingCount > 0 || existing.FinalizedOfferingCount > 0)
	if resetGrades {
		impact, err := s.Repo.GetCourseImpact(ctx, courseID)
		if err != nil {
			return nil, err
		}
		impact.PreviousScheme = existing.GradeScheme
		impact.NextScheme = nextScheme
		if !payload.ConfirmImpact {
			return nil, FreeElectiveConflictError{
				Code:    "GRADE_SCHEME_CHANGE_REQUIRES_CONFIRMATION",
				Message: "changing the grade scheme will clear current grade records and reopen offerings",
				Data:    impact,
			}
		}
	}
	if err := s.Repo.UpdateCourse(ctx, courseID, payload, uint64(claims.UserID), resetGrades); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveCourseNotFound
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetCourse(ctx, courseID)
}

func (s *FreeElectiveService) GetCourse(ctx context.Context, claims *utils.Claims, courseID uint64) (*models.FreeElectiveCourse, error) {
	course, err := s.Repo.GetCourse(ctx, courseID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveCourseNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.scopedFaculty(claims, &course.FacultyID); err != nil {
		return nil, err
	}
	return course, nil
}

func validateFreeElectiveCoursePayload(payload models.UpsertFreeElectiveCoursePayload) error {
	if payload.FacultyID == 0 {
		return FreeElectiveValidationError{Message: "faculty_id is required"}
	}
	if strings.TrimSpace(payload.Code) == "" {
		return FreeElectiveValidationError{Message: "code is required"}
	}
	if strings.TrimSpace(payload.NameTH) == "" {
		return FreeElectiveValidationError{Message: "name_th is required"}
	}
	if payload.Credits <= 0 {
		return FreeElectiveValidationError{Message: "credits must be greater than zero"}
	}
	if !grading.IsValidScheme(payload.GradeScheme) {
		return FreeElectiveValidationError{Message: "grade_scheme must be letter or satisfactory"}
	}
	return nil
}

func (s *FreeElectiveService) ListOfferings(ctx context.Context, claims *utils.Claims, filters models.FreeElectiveCourseFilters) ([]*models.FreeElectiveOffering, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return nil, err
	}
	filters.FacultyID = facultyID
	if filters.YearBE != nil && *filters.YearBE == 0 {
		return nil, FreeElectiveValidationError{Message: "academic_year_be must be greater than zero"}
	}
	if filters.Semester != nil && (*filters.Semester < 1 || *filters.Semester > 3) {
		return nil, FreeElectiveValidationError{Message: "semester must be 1, 2, or 3"}
	}
	if filters.Status != "" && !validFreeElectiveOfferingStatus(filters.Status) {
		return nil, FreeElectiveValidationError{Message: "status is invalid"}
	}
	return s.Repo.ListOfferings(ctx, filters)
}

func (s *FreeElectiveService) CreateOffering(ctx context.Context, claims *utils.Claims, payload models.UpsertFreeElectiveOfferingPayload) (*models.FreeElectiveOffering, error) {
	course, err := s.GetCourse(ctx, claims, payload.FreeElectiveCourseID)
	if err != nil {
		return nil, err
	}
	if !course.IsActive {
		return nil, FreeElectiveConflictError{Code: "COURSE_INACTIVE", Message: "inactive free-elective course cannot open a new offering"}
	}
	if err := validateFreeElectiveOfferingPayload(payload); err != nil {
		return nil, err
	}
	if payload.SectionNo == "" {
		payload.SectionNo = "01"
	}
	offering, err := s.Repo.CreateOffering(ctx, payload, uint64(claims.UserID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveOfferingNotFound
	}
	return offering, err
}

func (s *FreeElectiveService) GetOffering(ctx context.Context, claims *utils.Claims, offeringID uint64) (*models.FreeElectiveOffering, error) {
	offering, err := s.Repo.GetOffering(ctx, offeringID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveOfferingNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.GetCourse(ctx, claims, offering.FreeElectiveCourseID); err != nil {
		return nil, err
	}
	return offering, nil
}

func (s *FreeElectiveService) UpdateOfferingStatus(ctx context.Context, claims *utils.Claims, offeringID uint64, payload models.UpdateFreeElectiveOfferingStatusPayload) (*models.FreeElectiveOffering, error) {
	offering, err := s.GetOffering(ctx, claims, offeringID)
	if err != nil {
		return nil, err
	}
	nextStatus := strings.ToLower(strings.TrimSpace(payload.Status))
	if nextStatus != "active" && nextStatus != "cancelled" {
		return nil, FreeElectiveValidationError{Message: "status must be active or cancelled"}
	}
	if offering.Status == "finalized" || offering.Status == "cancelled" {
		return nil, FreeElectiveConflictError{Code: "OFFERING_NOT_EDITABLE", Message: "finalized or cancelled offering cannot change status"}
	}
	if nextStatus == "active" {
		readiness, err := s.Repo.GetOfferingReadiness(ctx, offeringID)
		if err != nil {
			return nil, err
		}
		if !readiness.CompetencyMapped {
			return nil, FreeElectiveConflictError{Code: "COMPETENCY_REQUIRED", Message: "add competency mappings before opening the offering", Data: readiness}
		}
	}
	if err := s.Repo.UpdateOfferingStatus(ctx, offeringID, nextStatus); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveOfferingNotFound
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOffering(ctx, offeringID)
}

func (s *FreeElectiveService) FinalizeOffering(ctx context.Context, claims *utils.Claims, offeringID uint64) (*models.FreeElectiveOffering, error) {
	offering, err := s.GetOffering(ctx, claims, offeringID)
	if err != nil {
		return nil, err
	}
	if offering.Status != "active" {
		return nil, FreeElectiveConflictError{Code: "OFFERING_NOT_ACTIVE", Message: "only an active offering can be finalized"}
	}
	readiness, err := s.Repo.GetOfferingReadiness(ctx, offeringID)
	if err != nil {
		return nil, err
	}
	if !readiness.Ready {
		return nil, FreeElectiveConflictError{Code: "OFFERING_NOT_READY", Message: "offering is not ready to finalize", Data: readiness}
	}
	if err := s.Repo.FinalizeOfferingAndCalculate(ctx, offeringID, uint64(claims.UserID)); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveOfferingNotFound
	} else if errors.Is(err, repositories.ErrFreeElectiveOfferingLocked) {
		return nil, ErrFreeElectiveOfferingLocked
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOffering(ctx, offeringID)
}

func validateFreeElectiveOfferingPayload(payload models.UpsertFreeElectiveOfferingPayload) error {
	if payload.FreeElectiveCourseID == 0 {
		return FreeElectiveValidationError{Message: "free_elective_course_id is required"}
	}
	if payload.AcademicYearBE == 0 {
		return FreeElectiveValidationError{Message: "academic_year_be is required"}
	}
	if payload.Semester < 1 || payload.Semester > 3 {
		return FreeElectiveValidationError{Message: "semester must be 1, 2, or 3"}
	}
	if strings.TrimSpace(payload.SectionNo) == "" {
		return FreeElectiveValidationError{Message: "section_no is required"}
	}
	if payload.Capacity != nil && *payload.Capacity < 0 {
		return FreeElectiveValidationError{Message: "capacity must be zero or greater"}
	}
	return nil
}

func validFreeElectiveOfferingStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "draft", "active", "finalized", "cancelled":
		return true
	default:
		return false
	}
}

func (s *FreeElectiveService) GetStudentGroups(ctx context.Context, claims *utils.Claims, filters models.FreeElectiveStudentGroupFilters) ([]models.FreeElectiveStudentGroup, error) {
	facultyID, err := s.scopedFaculty(claims, filters.FacultyID)
	if err != nil {
		return nil, err
	}
	filters.FacultyID = facultyID
	return s.Repo.GetStudentGroups(ctx, filters)
}

func (s *FreeElectiveService) GetCohortStudents(ctx context.Context, claims *utils.Claims, cohortID uint64) ([]models.FreeElectiveStudent, error) {
	facultyID, err := s.scopedFaculty(claims, nil)
	if err != nil {
		return nil, err
	}
	groups, err := s.Repo.GetStudentGroups(ctx, models.FreeElectiveStudentGroupFilters{FacultyID: facultyID})
	if err != nil {
		return nil, err
	}
	var group *models.FreeElectiveStudentGroup
	for index := range groups {
		if groups[index].CohortID == cohortID {
			group = &groups[index]
			break
		}
	}
	if group == nil {
		return nil, ErrFreeElectiveStudentGroupNotFound
	}
	return s.Repo.GetCohortStudents(ctx, cohortID)
}

func (s *FreeElectiveService) GetOfferingEnrollments(ctx context.Context, claims *utils.Claims, offeringID uint64) ([]models.FreeElectiveEnrollment, error) {
	if _, err := s.GetOffering(ctx, claims, offeringID); err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingEnrollments(ctx, offeringID)
}

func (s *FreeElectiveService) GetOfferingReadiness(ctx context.Context, claims *utils.Claims, offeringID uint64) (models.FreeElectiveReadiness, error) {
	if _, err := s.GetOffering(ctx, claims, offeringID); err != nil {
		return models.FreeElectiveReadiness{}, err
	}
	return s.Repo.GetOfferingReadiness(ctx, offeringID)
}

func (s *FreeElectiveService) GetStudentDetail(ctx context.Context, claims *utils.Claims, enrollmentID uint64) (*models.FreeElectiveStudentDetail, error) {
	detail, err := s.Repo.GetStudentDetail(ctx, enrollmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveStudentGroupNotFound
	}
	if err != nil {
		return nil, err
	}
	if detail.Student.FacultyID > 0 {
		if _, err := s.scopedFaculty(claims, &detail.Student.FacultyID); err != nil {
			return nil, err
		}
		return detail, nil
	}
	if !freeElectiveHasRole(claims, "admin") {
		return nil, ErrFreeElectiveForbidden
	}
	return detail, nil
}

func (s *FreeElectiveService) AddOfferingEnrollments(ctx context.Context, claims *utils.Claims, offeringID uint64, payload models.AddFreeElectiveEnrollmentsPayload) ([]models.FreeElectiveEnrollment, error) {
	if _, err := s.GetOffering(ctx, claims, offeringID); err != nil {
		return nil, err
	}
	if len(payload.Enrollments) == 0 {
		return nil, FreeElectiveValidationError{Message: "at least one learner is required"}
	}
	if err := s.Repo.AddOfferingEnrollments(ctx, offeringID, uint64(claims.UserID), payload.Enrollments); errors.Is(err, repositories.ErrFreeElectiveOfferingLocked) {
		return nil, ErrFreeElectiveOfferingLocked
	} else if errors.Is(err, repositories.ErrFreeElectiveEnrollmentExists) {
		return nil, FreeElectiveConflictError{Code: "LEARNER_ALREADY_ENROLLED", Message: "one or more learners are already enrolled in this offering"}
	} else if errors.Is(err, repositories.ErrFreeElectiveCapacityExceeded) {
		return nil, FreeElectiveConflictError{Code: "OFFERING_CAPACITY_REACHED", Message: "offering capacity has been reached"}
	} else if errors.Is(err, repositories.ErrFreeElectiveEnrollmentInvalid) {
		return nil, FreeElectiveValidationError{Message: "each learner and curriculum selection must belong to the same active student"}
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingEnrollments(ctx, offeringID)
}

func (s *FreeElectiveService) UpdateOfferingEnrollmentStatus(ctx context.Context, claims *utils.Claims, offeringID, enrollmentID uint64, payload models.UpdateFreeElectiveEnrollmentStatusPayload) ([]models.FreeElectiveEnrollment, error) {
	if _, err := s.GetOffering(ctx, claims, offeringID); err != nil {
		return nil, err
	}
	status := strings.ToLower(strings.TrimSpace(payload.Status))
	if status != "enrolled" && status != "withdrawn" && status != "completed" {
		return nil, FreeElectiveValidationError{Message: "status must be enrolled, withdrawn, or completed"}
	}
	if err := s.Repo.UpdateOfferingEnrollmentStatus(ctx, offeringID, enrollmentID, status); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFreeElectiveOfferingNotFound
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingEnrollments(ctx, offeringID)
}

func (s *FreeElectiveService) UpsertOfferingGrade(ctx context.Context, claims *utils.Claims, offeringID, offeringEnrollmentID uint64, payload models.UpsertFreeElectiveGradePayload) ([]models.FreeElectiveEnrollment, error) {
	offering, err := s.GetOffering(ctx, claims, offeringID)
	if err != nil {
		return nil, err
	}
	if err := validateFreeElectiveGrade(payload.Grade, offering.GradeScheme); err != nil {
		return nil, err
	}
	source := strings.ToLower(strings.TrimSpace(payload.GradeSource))
	if source == "" {
		source = "manual"
	}
	if source != "manual" && source != "excel" && source != "reg" {
		return nil, FreeElectiveValidationError{Message: "grade_source is invalid"}
	}
	if err := s.Repo.UpsertOfferingGrade(ctx, offeringID, models.FreeElectiveGradeWrite{
		OfferingEnrollmentID: offeringEnrollmentID,
		Grade:                payload.Grade,
		GradeSource:          source,
		SourceReference:      payload.SourceReference,
	}, uint64(claims.UserID)); errors.Is(err, repositories.ErrFreeElectiveOfferingLocked) {
		return nil, ErrFreeElectiveOfferingLocked
	} else if errors.Is(err, repositories.ErrFreeElectiveGradeTargetNotFound) {
		return nil, FreeElectiveValidationError{Message: "the selected learner is not enrolled in this offering"}
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingEnrollments(ctx, offeringID)
}

func (s *FreeElectiveService) PreviewGradeImport(ctx context.Context, claims *utils.Claims, offeringID uint64, payload models.FreeElectiveGradeImportPayload) (*models.FreeElectiveGradeImportPreview, error) {
	offering, err := s.GetOffering(ctx, claims, offeringID)
	if err != nil {
		return nil, err
	}
	targets, err := s.Repo.GetOfferingGradeTargets(ctx, offeringID)
	if err != nil {
		return nil, err
	}
	preview := &models.FreeElectiveGradeImportPreview{
		ValidRows:     make([]models.FreeElectiveGradeImportRow, 0),
		ExistingRows:  make([]models.FreeElectiveGradeImportRow, 0),
		InvalidRows:   make([]models.FreeElectiveGradeImportIssue, 0),
		DuplicateRows: make([]models.FreeElectiveGradeImportIssue, 0),
	}
	seen := make(map[string]struct{}, len(payload.Rows))
	for index, row := range payload.Rows {
		if row.RowNumber == 0 {
			row.RowNumber = index + 2
		}
		code := strings.ToUpper(strings.TrimSpace(row.StudentCode))
		if code == "" {
			preview.InvalidRows = append(preview.InvalidRows, models.FreeElectiveGradeImportIssue{RowNumber: row.RowNumber, Message: "student_code is required"})
			continue
		}
		if _, exists := seen[code]; exists {
			preview.DuplicateRows = append(preview.DuplicateRows, models.FreeElectiveGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, Message: "student appears more than once in the file"})
			continue
		}
		seen[code] = struct{}{}
		target, exists := targets[code]
		if !exists {
			preview.InvalidRows = append(preview.InvalidRows, models.FreeElectiveGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, Message: "student is not enrolled in this offering"})
			continue
		}
		if err := validateFreeElectiveGrade(row.Grade, offering.GradeScheme); err != nil {
			preview.InvalidRows = append(preview.InvalidRows, models.FreeElectiveGradeImportIssue{RowNumber: row.RowNumber, StudentCode: row.StudentCode, Message: err.Error()})
			continue
		}
		if target.HasGrade {
			preview.ExistingRows = append(preview.ExistingRows, row)
			continue
		}
		preview.ValidRows = append(preview.ValidRows, row)
	}
	return preview, nil
}

func (s *FreeElectiveService) CommitGradeImport(ctx context.Context, claims *utils.Claims, offeringID uint64, payload models.FreeElectiveGradeImportPayload) ([]models.FreeElectiveEnrollment, error) {
	preview, err := s.PreviewGradeImport(ctx, claims, offeringID, payload)
	if err != nil {
		return nil, err
	}
	if len(preview.InvalidRows) > 0 || len(preview.DuplicateRows) > 0 {
		return nil, FreeElectiveConflictError{Code: "GRADE_IMPORT_HAS_ERRORS", Message: "fix the invalid or duplicate rows before importing", Data: preview}
	}
	if len(preview.ExistingRows) > 0 && !payload.ReplaceExisting {
		return nil, FreeElectiveConflictError{Code: "GRADE_IMPORT_REPLACE_REQUIRED", Message: "the file contains existing grades; confirm replacement before importing", Data: preview}
	}
	targets, err := s.Repo.GetOfferingGradeTargets(ctx, offeringID)
	if err != nil {
		return nil, err
	}
	writes := make([]models.FreeElectiveGradeWrite, 0, len(preview.ValidRows)+len(preview.ExistingRows))
	for _, row := range append(preview.ValidRows, preview.ExistingRows...) {
		target := targets[strings.ToUpper(strings.TrimSpace(row.StudentCode))]
		writes = append(writes, models.FreeElectiveGradeWrite{
			OfferingEnrollmentID: target.OfferingEnrollmentID,
			Grade:                row.Grade,
			GradeSource:          "excel",
		})
	}
	if len(writes) == 0 {
		return nil, FreeElectiveValidationError{Message: "the import file has no grade rows"}
	}
	if err := s.Repo.ImportOfferingGrades(ctx, offeringID, uint64(claims.UserID), writes); errors.Is(err, repositories.ErrFreeElectiveOfferingLocked) {
		return nil, ErrFreeElectiveOfferingLocked
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingEnrollments(ctx, offeringID)
}

func validateFreeElectiveGrade(value, scheme string) error {
	if strings.TrimSpace(value) == "" {
		return FreeElectiveValidationError{Message: "grade is required"}
	}
	if err := grading.ValidateGrade(scheme, value); err != nil {
		return FreeElectiveValidationError{Message: "grade is not allowed for this course grade scheme"}
	}
	return nil
}

func (s *FreeElectiveService) GetOfferingCompetencies(ctx context.Context, claims *utils.Claims, offeringID uint64) ([]models.FreeElectiveCompetency, error) {
	if _, err := s.GetOffering(ctx, claims, offeringID); err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingCompetencies(ctx, offeringID)
}

func (s *FreeElectiveService) ReplaceOfferingCompetencies(ctx context.Context, claims *utils.Claims, offeringID uint64, payload models.ReplaceFreeElectiveCompetenciesPayload) ([]models.FreeElectiveCompetency, error) {
	offering, err := s.GetOffering(ctx, claims, offeringID)
	if err != nil {
		return nil, err
	}
	if offering.Status == "finalized" || offering.Status == "cancelled" {
		return nil, ErrFreeElectiveOfferingLocked
	}
	seen := make(map[uint64]struct{}, len(payload.Competencies))
	for _, input := range payload.Competencies {
		if input.CompetencyID == 0 {
			return nil, FreeElectiveValidationError{Message: "competency_id is required"}
		}
		if _, exists := seen[input.CompetencyID]; exists {
			return nil, FreeElectiveValidationError{Message: "each competency can be added only once per offering"}
		}
		if input.WeightPercent < 0 || input.WeightPercent > 100 {
			return nil, FreeElectiveValidationError{Message: "weight_percent must be between zero and one hundred"}
		}
		seen[input.CompetencyID] = struct{}{}
	}
	if err := s.Repo.ReplaceOfferingCompetencies(ctx, offeringID, payload.Competencies); errors.Is(err, repositories.ErrFreeElectiveOfferingLocked) {
		return nil, ErrFreeElectiveOfferingLocked
	} else if err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingCompetencies(ctx, offeringID)
}

func (s *FreeElectiveService) CopyPreviousOfferingCompetencies(ctx context.Context, claims *utils.Claims, offeringID uint64) ([]models.FreeElectiveCompetency, error) {
	if _, err := s.GetOffering(ctx, claims, offeringID); err != nil {
		return nil, err
	}
	err := s.Repo.CopyPreviousOfferingCompetencies(ctx, offeringID)
	if errors.Is(err, repositories.ErrFreeElectiveOfferingLocked) {
		return nil, ErrFreeElectiveOfferingLocked
	}
	if errors.Is(err, sql.ErrNoRows) {
		return nil, FreeElectiveConflictError{Code: "PREVIOUS_MAPPING_NOT_FOUND", Message: "no previous offering has competency mappings to copy"}
	}
	if err != nil {
		return nil, err
	}
	return s.Repo.GetOfferingCompetencies(ctx, offeringID)
}

func nonZeroFreeElectiveID(value uint64) *uint64 {
	if value == 0 {
		return nil
	}
	return &value
}
