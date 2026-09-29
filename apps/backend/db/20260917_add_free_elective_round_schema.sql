-- Free Elective Management v2: one opening round contains many courses.
-- Run manually after the existing 20260915 free-elective migrations.
-- This file intentionally does not contain USE <database>.

SELECT DATABASE() AS selected_database;

-- Review every dependency before continuing. A missing dependency means the
-- previous migrations have not been applied to the selected database.
SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'org_faculties' AS table_name
    UNION ALL SELECT 'auth_users'
    UNION ALL SELECT 'comp_competencies'
    UNION ALL SELECT 'kku_enrollments'
    UNION ALL SELECT 'kku_enrollment_curricula'
    UNION ALL SELECT 'ele_free_elective_courses'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

CREATE TABLE IF NOT EXISTS ele_free_elective_rounds (
    round_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    faculty_id BIGINT UNSIGNED NOT NULL,
    academic_year_be SMALLINT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    status ENUM('draft', 'active', 'finalized', 'cancelled') NOT NULL DEFAULT 'draft',
    scores_recalculation_required TINYINT(1) NOT NULL DEFAULT 0,
    scores_recalculated_at DATETIME NULL,
    scores_recalculated_by BIGINT UNSIGNED NULL,
    finalized_at DATETIME NULL,
    finalized_by BIGINT UNSIGNED NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (round_id),
    UNIQUE KEY uq_ele_round_faculty_period_live
        (faculty_id, academic_year_be, semester, live_unique_key),
    KEY idx_ele_round_faculty (faculty_id),
    KEY idx_ele_round_period (academic_year_be, semester),
    KEY idx_ele_round_status (status),
    KEY idx_ele_round_deleted_at (deleted_at),
    CONSTRAINT fk_ele_round_faculty
        FOREIGN KEY (faculty_id) REFERENCES org_faculties (faculty_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_recalculated_by
        FOREIGN KEY (scores_recalculated_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_finalized_by
        FOREIGN KEY (finalized_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_created_by
        FOREIGN KEY (created_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_round_semester CHECK (semester IN (1, 2, 3))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Free-elective opening round containing multiple courses';

CREATE TABLE IF NOT EXISTS ele_free_elective_round_courses (
    round_course_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    round_id BIGINT UNSIGNED NOT NULL,
    free_elective_course_id BIGINT UNSIGNED NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    course_name_th VARCHAR(255) NOT NULL,
    course_name_en VARCHAR(255) NULL,
    description TEXT NULL,
    credits INT NOT NULL DEFAULT 3,
    grade_scheme ENUM('letter', 'satisfactory') NOT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (round_course_id),
    UNIQUE KEY uq_ele_round_courses_course_live
        (round_id, free_elective_course_id, live_unique_key),
    KEY idx_ele_round_courses_round (round_id, display_order),
    KEY idx_ele_round_courses_master (free_elective_course_id),
    KEY idx_ele_round_courses_deleted_at (deleted_at),
    CONSTRAINT fk_ele_round_courses_round
        FOREIGN KEY (round_id) REFERENCES ele_free_elective_rounds (round_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_courses_master
        FOREIGN KEY (free_elective_course_id)
        REFERENCES ele_free_elective_courses (free_elective_course_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_courses_created_by
        FOREIGN KEY (created_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_round_courses_credits CHECK (credits >= 0),
    CONSTRAINT chk_ele_round_courses_name CHECK (CHAR_LENGTH(TRIM(course_name_th)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Course metadata snapshot inside a free-elective round';

CREATE TABLE IF NOT EXISTS ele_free_elective_round_course_competencies (
    round_course_competency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    round_course_id BIGINT UNSIGNED NOT NULL,
    competency_id BIGINT UNSIGNED NOT NULL,
    weight_percent DECIMAL(6,2) NOT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (round_course_competency_id),
    UNIQUE KEY uq_ele_round_course_competency_live
        (round_course_id, competency_id, live_unique_key),
    KEY idx_ele_round_course_competencies_competency (competency_id),
    KEY idx_ele_round_course_competencies_order (round_course_id, display_order),
    KEY idx_ele_round_course_competencies_deleted_at (deleted_at),
    CONSTRAINT fk_ele_round_course_competencies_course
        FOREIGN KEY (round_course_id)
        REFERENCES ele_free_elective_round_courses (round_course_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_course_competencies_competency
        FOREIGN KEY (competency_id) REFERENCES comp_competencies (competency_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_round_course_competencies_weight
        CHECK (weight_percent >= 0 AND weight_percent <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Competencies and weights for a course in a specific round';

CREATE TABLE IF NOT EXISTS ele_free_elective_round_course_enrollments (
    round_course_enrollment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    round_course_id BIGINT UNSIGNED NOT NULL,
    enrollment_id BIGINT UNSIGNED NOT NULL,
    enrollment_curriculum_id BIGINT UNSIGNED NOT NULL,
    status ENUM('enrolled', 'withdrawn', 'completed') NOT NULL DEFAULT 'enrolled',
    enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enrolled_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (round_course_enrollment_id),
    UNIQUE KEY uq_ele_round_course_enrollments_live
        (round_course_id, enrollment_id, live_unique_key),
    KEY idx_ele_round_course_enrollments_student (enrollment_id),
    KEY idx_ele_round_course_enrollments_curriculum (enrollment_curriculum_id),
    KEY idx_ele_round_course_enrollments_status (status),
    KEY idx_ele_round_course_enrollments_deleted_at (deleted_at),
    CONSTRAINT fk_ele_round_course_enrollments_course
        FOREIGN KEY (round_course_id)
        REFERENCES ele_free_elective_round_courses (round_course_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_course_enrollments_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES kku_enrollments (enrollment_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_course_enrollments_curriculum
        FOREIGN KEY (enrollment_curriculum_id)
        REFERENCES kku_enrollment_curricula (enrollment_curriculum_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_course_enrollments_enrolled_by
        FOREIGN KEY (enrolled_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Learners enrolled in a course within a free-elective round';

CREATE TABLE IF NOT EXISTS ele_free_elective_round_course_grade_records (
    grade_record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    round_course_enrollment_id BIGINT UNSIGNED NOT NULL,
    grade VARCHAR(5) NOT NULL,
    grade_source ENUM('manual', 'excel', 'reg') NOT NULL DEFAULT 'manual',
    source_reference VARCHAR(255) NULL,
    is_best_grade TINYINT(1) NOT NULL DEFAULT 0,
    recorded_by BIGINT UNSIGNED NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (grade_record_id),
    UNIQUE KEY uq_ele_round_course_grades_live
        (round_course_enrollment_id, live_unique_key),
    KEY idx_ele_round_course_grades_grade (grade),
    KEY idx_ele_round_course_grades_best (is_best_grade),
    KEY idx_ele_round_course_grades_deleted_at (deleted_at),
    CONSTRAINT fk_ele_round_course_grades_enrollment
        FOREIGN KEY (round_course_enrollment_id)
        REFERENCES ele_free_elective_round_course_enrollments (round_course_enrollment_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_round_course_grades_recorded_by
        FOREIGN KEY (recorded_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_round_course_grades_not_blank
        CHECK (CHAR_LENGTH(TRIM(grade)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Current grade and grade history for round-course enrollment';

CREATE TABLE IF NOT EXISTS score_free_elective_round_course_competency_scores (
    free_elective_score_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    grade_record_id BIGINT UNSIGNED NOT NULL,
    round_course_competency_id BIGINT UNSIGNED NOT NULL,
    raw_score DECIMAL(8,2) NOT NULL,
    weighted_score DECIMAL(10,4) NOT NULL,
    weight_snapshot DECIMAL(6,2) NOT NULL,
    grade_snapshot VARCHAR(5) NOT NULL,
    grade_scheme_snapshot VARCHAR(32) NOT NULL,
    calculated_by BIGINT UNSIGNED NULL,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (free_elective_score_id),
    UNIQUE KEY uq_score_ele_round_course_grade_comp_live
        (grade_record_id, round_course_competency_id, live_unique_key),
    KEY idx_score_ele_round_course_grade (grade_record_id),
    KEY idx_score_ele_round_course_competency (round_course_competency_id),
    KEY idx_score_ele_round_course_deleted_at (deleted_at),
    CONSTRAINT fk_score_ele_round_course_grade
        FOREIGN KEY (grade_record_id)
        REFERENCES ele_free_elective_round_course_grade_records (grade_record_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_score_ele_round_course_competency
        FOREIGN KEY (round_course_competency_id)
        REFERENCES ele_free_elective_round_course_competencies (round_course_competency_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_score_ele_round_course_calculated_by
        FOREIGN KEY (calculated_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_score_ele_round_course_raw_score
        CHECK (raw_score >= 0 AND raw_score <= 100),
    CONSTRAINT chk_score_ele_round_course_weighted_score
        CHECK (weighted_score >= 0),
    CONSTRAINT chk_score_ele_round_course_weight_snapshot
        CHECK (weight_snapshot >= 0 AND weight_snapshot <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Free-elective competency scores calculated from round-course grades';

-- Postflight: the new model should expose six tables and the expected keys.
SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN (
      'ele_free_elective_rounds',
      'ele_free_elective_round_courses',
      'ele_free_elective_round_course_competencies',
      'ele_free_elective_round_course_enrollments',
      'ele_free_elective_round_course_grade_records',
      'score_free_elective_round_course_competency_scores'
  )
ORDER BY table_name, ordinal_position;

SELECT table_name, index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN (
      'ele_free_elective_rounds',
      'ele_free_elective_round_courses',
      'ele_free_elective_round_course_competencies',
      'ele_free_elective_round_course_enrollments',
      'ele_free_elective_round_course_grade_records',
      'score_free_elective_round_course_competency_scores'
  )
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;

