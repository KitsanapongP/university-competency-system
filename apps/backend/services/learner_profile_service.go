package services

import (
	"context"
	"database/sql"
	"errors"
	"sort"

	"github.com/spw32767/university-competency-system-backend/models"
	"github.com/spw32767/university-competency-system-backend/repositories"
)

var ErrLearnerProfileNotFound = errors.New("learner profile not found")

type LearnerProfileService struct {
	Repo *repositories.LearnerProfileRepository
}

func NewLearnerProfileService(repo *repositories.LearnerProfileRepository) *LearnerProfileService {
	return &LearnerProfileService{Repo: repo}
}

func (s *LearnerProfileService) GetAcademicProfile(ctx context.Context, userID int64) (*models.LearnerAcademicProfileResponse, error) {
	personID, err := s.Repo.ResolvePersonID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if personID == 0 {
		return nil, ErrLearnerProfileNotFound
	}

	profile, err := s.Repo.GetProfile(ctx, personID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrLearnerProfileNotFound
		}
		return nil, err
	}

	curriculumCourses, err := s.Repo.GetCurriculumCourseHistory(ctx, personID)
	if err != nil {
		return nil, err
	}
	freeElectiveCourses, err := s.Repo.GetFreeElectiveCourseHistory(ctx, personID)
	if err != nil {
		return nil, err
	}

	courses := append(curriculumCourses, freeElectiveCourses...)
	for index := range courses {
		courses[index].StudyYear = studyYear(profile.EntryYearBE, courses[index].AcademicYearBE)
	}
	sortLearnerAcademicCourses(courses)

	return &models.LearnerAcademicProfileResponse{
		Profile:       profile,
		CourseHistory: courses,
	}, nil
}

func studyYear(entryYearBE, academicYearBE uint64) uint64 {
	if entryYearBE == 0 || academicYearBE < entryYearBE {
		return 0
	}
	return academicYearBE - entryYearBE + 1
}

func sortLearnerAcademicCourses(courses []models.LearnerAcademicCourse) {
	sort.SliceStable(courses, func(left, right int) bool {
		if courses[left].AcademicYearBE != courses[right].AcademicYearBE {
			return courses[left].AcademicYearBE < courses[right].AcademicYearBE
		}
		if courses[left].Semester != courses[right].Semester {
			return courses[left].Semester < courses[right].Semester
		}
		if courses[left].Source != courses[right].Source {
			return courses[left].Source < courses[right].Source
		}
		if courses[left].CourseCode != courses[right].CourseCode {
			return courses[left].CourseCode < courses[right].CourseCode
		}
		return courses[left].RecordID < courses[right].RecordID
	})
}
