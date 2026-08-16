-- Optional local fixture for Course Competency Scoring v1.
-- This file is never executed by the application. Set the IDs for a local
-- active Cohort and its Curriculum Course records before running it manually.

SET @cohort_id = 0;
SET @student_enrollment_id = 0;
SET @student_curriculum_id = 0;
SET @required_course_id = 0;
SET @elective_course_id = 0;

-- Replace the zero values above, then insert the best grade for each course.
-- A required course contributes Core Score; an elective contributes Course Bonus.
INSERT INTO crs_course_enrollment (
    course_id, enrollment_id, student_curricula_id, academic_year_be, semester,
    grade, is_best_grade, retake_sequence, created_at, updated_at
) VALUES
    (@required_course_id, @student_enrollment_id, @student_curriculum_id, 2569, 1, 'B+', 1, 1, NOW(), NOW()),
    (@elective_course_id, @student_enrollment_id, @student_curriculum_id, 2569, 1, 'A', 1, 1, NOW(), NOW());

-- After assigning an active assessment plan and setting Cohort targets, call:
-- POST /api/v1/student-cohorts/{cohort_id}/course-competency-scores/recalculate
