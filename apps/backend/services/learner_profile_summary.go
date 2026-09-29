package services

import (
	"github.com/spw32767/university-competency-system-backend/academicgrading"
	"github.com/spw32767/university-competency-system-backend/models"
)

type learnerAcademicTotals struct {
	registeredCredits int
	passedCredits     int
	gpaCredits        int
	gradePoints       float64
}

type learnerCourseIdentity struct {
	source   string
	courseID uint64
}

func buildLearnerAcademicTermSummaries(courses []models.LearnerAcademicCourse) []models.LearnerAcademicTermSummary {
	summaries := make([]models.LearnerAcademicTermSummary, 0)
	cumulative := learnerAcademicTotals{}
	passedCourses := make(map[learnerCourseIdentity]struct{})

	for start := 0; start < len(courses); {
		end := start + 1
		for end < len(courses) && sameAcademicTerm(courses[start], courses[end]) {
			end++
		}

		term := learnerAcademicTotals{}
		for _, course := range courses[start:end] {
			credits := max(course.Credits, 0)
			term.registeredCredits += credits
			cumulative.registeredCredits += credits

			if academicgrading.IsPassed(course.GradeScheme, course.Grade) {
				term.passedCredits += credits
				identity := learnerCourseIdentity{source: course.Source, courseID: course.CourseID}
				if identity.courseID == 0 {
					identity.courseID = course.RecordID
					identity.source += ":record"
				}
				if _, counted := passedCourses[identity]; !counted {
					cumulative.passedCredits += credits
					passedCourses[identity] = struct{}{}
				}
			}

			if gradePoint, countsTowardGPA := academicgrading.GradePoint(course.GradeScheme, course.Grade); countsTowardGPA {
				term.gpaCredits += credits
				term.gradePoints += float64(credits) * gradePoint
				cumulative.gpaCredits += credits
				cumulative.gradePoints += float64(credits) * gradePoint
			}
		}

		summaries = append(summaries, models.LearnerAcademicTermSummary{
			StudyYear:      courses[start].StudyYear,
			AcademicYearBE: courses[start].AcademicYearBE,
			Semester:       courses[start].Semester,
			Term:           learnerAcademicGradeSummary(term),
			Cumulative:     learnerAcademicGradeSummary(cumulative),
		})
		start = end
	}

	return summaries
}

func sameAcademicTerm(left, right models.LearnerAcademicCourse) bool {
	return left.AcademicYearBE == right.AcademicYearBE && left.Semester == right.Semester
}

func learnerAcademicGradeSummary(totals learnerAcademicTotals) models.LearnerAcademicGradeSummary {
	var gpa *float64
	if totals.gpaCredits > 0 {
		value := totals.gradePoints / float64(totals.gpaCredits)
		gpa = &value
	}

	return models.LearnerAcademicGradeSummary{
		CR:  totals.registeredCredits,
		CP:  totals.passedCredits,
		CA:  totals.gpaCredits,
		GP:  totals.gradePoints,
		GPA: gpa,
	}
}
