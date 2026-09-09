package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
)

func TestValidateCreateCourseMutationRequiresGradeScheme(t *testing.T) {
	payload := models.CreateCurriculumCoursePayload{
		Code:   "CS101",
		NameTH: "วิชาทดสอบ",
	}

	if err := validateCreateCourseMutation(payload); err == nil || err.Error() != "course grade_scheme must be letter or satisfactory" {
		t.Fatalf("validateCreateCourseMutation() error = %v, want required grade scheme error", err)
	}
}

func TestValidateUpdateCourseMutationRejectsUnknownGradeScheme(t *testing.T) {
	value := "numeric"
	payload := models.UpdateCurriculumCourseDetailPayload{GradeScheme: &value}

	if err := validateUpdateCourseMutation(payload); err == nil || err.Error() != "course grade_scheme must be letter or satisfactory" {
		t.Fatalf("validateUpdateCourseMutation() error = %v, want invalid grade scheme error", err)
	}
}
