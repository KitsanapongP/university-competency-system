package services

import (
	"testing"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/utils"
)

func TestFreeElectiveOfficerScopeUsesClaimedFaculty(t *testing.T) {
	facultyID := int64(7)
	service := &FreeElectiveService{}
	claims := &utils.Claims{Roles: []string{"officer"}, FacultyID: &facultyID}

	scoped, err := service.scopedFaculty(claims, nil)
	if err != nil || scoped == nil || *scoped != 7 {
		t.Fatalf("scopedFaculty() = (%v, %v), want faculty 7", scoped, err)
	}

	otherFaculty := uint64(8)
	if _, err := service.scopedFaculty(claims, &otherFaculty); err != ErrFreeElectiveForbidden {
		t.Fatalf("scopedFaculty(other faculty) = %v, want ErrFreeElectiveForbidden", err)
	}
}

func TestFreeElectiveAdminCanChooseAnyFaculty(t *testing.T) {
	service := &FreeElectiveService{}
	requested := uint64(9)
	claims := &utils.Claims{Roles: []string{"admin"}}

	scoped, err := service.scopedFaculty(claims, &requested)
	if err != nil || scoped == nil || *scoped != requested {
		t.Fatalf("admin scopedFaculty() = (%v, %v), want requested faculty", scoped, err)
	}
}

func TestValidateFreeElectiveCoursePayloadRequiresGradeScheme(t *testing.T) {
	err := validateFreeElectiveCoursePayload(models.UpsertFreeElectiveCoursePayload{
		FacultyID:  1,
		Code:       "GE001",
		NameTH:     "Free elective",
		Credits:    3,
		GradeScheme: "",
	})
	if err == nil {
		t.Fatal("validateFreeElectiveCoursePayload() = nil, want validation error")
	}
}
