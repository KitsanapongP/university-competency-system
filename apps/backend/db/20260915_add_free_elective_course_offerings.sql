-- Free Elective Management: course masters and offerings
-- Run this migration manually against the selected database.
-- It intentionally does not contain USE <database>.

SELECT DATABASE() AS selected_database;

-- Preflight: every dependency must already exist before the new foreign keys
-- are created. Review any MISSING row before continuing.
SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'org_faculties' AS table_name
    UNION ALL SELECT 'auth_users'
    UNION ALL SELECT 'edu_student_cohorts'
    UNION ALL SELECT 'kku_enrollments'
    UNION ALL SELECT 'kku_enrollment_curricula'
    UNION ALL SELECT 'comp_competencies'
    UNION ALL SELECT 'crs_courses'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

SELECT 'crs_courses' AS table_name,
       'grade_scheme' AS column_name,
       CASE WHEN existing.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM information_schema.columns existing
WHERE existing.table_schema = DATABASE()
  AND existing.table_name = 'crs_courses'
  AND existing.column_name = 'grade_scheme'
UNION ALL
SELECT 'crs_courses', 'grade_scheme', 'MISSING'
WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'crs_courses'
      AND column_name = 'grade_scheme'
);

-- A partially-created table with the same name must be repaired manually. The
-- postflight query below makes an incomplete shape visible instead of silently
-- treating it as a successful migration.
CREATE TABLE IF NOT EXISTS ele_free_elective_courses (
    free_elective_course_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    faculty_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(50) NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NULL,
    description TEXT NULL,
    credits INT NOT NULL DEFAULT 3,
    grade_scheme ENUM('letter', 'satisfactory') NOT NULL DEFAULT 'letter',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    live_unique_key TINYINT GENERATED ALWAYS AS (
        CASE WHEN deleted_at IS NULL THEN 1 ELSE NULL END
    ) STORED,
    PRIMARY KEY (free_elective_course_id),
    UNIQUE KEY uq_ele_free_courses_faculty_code_live
        (faculty_id, code, live_unique_key),
    KEY idx_ele_free_courses_faculty (faculty_id),
    KEY idx_ele_free_courses_active (is_active),
    KEY idx_ele_free_courses_deleted_at (deleted_at),
    KEY idx_ele_free_courses_created_by (created_by),
    CONSTRAINT fk_ele_free_courses_faculty
        FOREIGN KEY (faculty_id) REFERENCES org_faculties (faculty_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_free_courses_created_by
        FOREIGN KEY (created_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master วิชาเสรีของคณะ';

CREATE TABLE IF NOT EXISTS ele_free_elective_offerings (
    offering_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    free_elective_course_id BIGINT UNSIGNED NOT NULL,
    academic_year_be SMALLINT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    section_no VARCHAR(20) NOT NULL DEFAULT '01',
    capacity INT UNSIGNED NULL,
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
    PRIMARY KEY (offering_id),
    UNIQUE KEY uq_ele_offerings_course_period_section_live
        (free_elective_course_id, academic_year_be, semester, section_no, live_unique_key),
    KEY idx_ele_offerings_course (free_elective_course_id),
    KEY idx_ele_offerings_period (academic_year_be, semester),
    KEY idx_ele_offerings_status (status),
    KEY idx_ele_offerings_deleted_at (deleted_at),
    KEY idx_ele_offerings_created_by (created_by),
    CONSTRAINT fk_ele_offerings_course
        FOREIGN KEY (free_elective_course_id)
        REFERENCES ele_free_elective_courses (free_elective_course_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_offerings_recalculated_by
        FOREIGN KEY (scores_recalculated_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_offerings_finalized_by
        FOREIGN KEY (finalized_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_offerings_created_by
        FOREIGN KEY (created_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_offerings_semester CHECK (semester IN (1, 2, 3)),
    CONSTRAINT chk_ele_offerings_section_no CHECK (CHAR_LENGTH(TRIM(section_no)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='รอบเปิดสอนวิชาเสรีตามปีการศึกษาและภาคเรียน';

-- Postflight: verify the expected columns, indexes, and foreign-key targets.
SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('ele_free_elective_courses', 'ele_free_elective_offerings')
ORDER BY table_name, ordinal_position;

SELECT table_name, index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN ('ele_free_elective_courses', 'ele_free_elective_offerings')
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;

SELECT table_name, constraint_name, referenced_table_name
FROM information_schema.referential_constraints
WHERE constraint_schema = DATABASE()
  AND table_name IN ('ele_free_elective_courses', 'ele_free_elective_offerings')
ORDER BY table_name, constraint_name;
