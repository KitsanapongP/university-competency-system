-- Free Elective Management: offering enrollments and grade history
-- Run after 20260915_add_free_elective_course_offerings.sql.
-- Run this migration manually against the selected database.

SELECT DATABASE() AS selected_database;

-- Preflight: the offering table must have been created first.
SELECT required.table_name,
       CASE WHEN existing.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
    SELECT 'ele_free_elective_offerings' AS table_name
    UNION ALL SELECT 'kku_enrollments'
    UNION ALL SELECT 'kku_enrollment_curricula'
    UNION ALL SELECT 'auth_users'
) required
LEFT JOIN information_schema.tables existing
    ON existing.table_schema = DATABASE()
   AND existing.table_name = required.table_name
ORDER BY required.table_name;

CREATE TABLE IF NOT EXISTS ele_offering_enrollments (
    offering_enrollment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    offering_id BIGINT UNSIGNED NOT NULL,
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
    PRIMARY KEY (offering_enrollment_id),
    UNIQUE KEY uq_ele_enrollments_offering_student_live
        (offering_id, enrollment_id, live_unique_key),
    KEY idx_ele_enrollments_offering (offering_id),
    KEY idx_ele_enrollments_student (enrollment_id),
    KEY idx_ele_enrollments_curriculum (enrollment_curriculum_id),
    KEY idx_ele_enrollments_status (status),
    KEY idx_ele_enrollments_deleted_at (deleted_at),
    KEY idx_ele_enrollments_enrolled_by (enrolled_by),
    CONSTRAINT fk_ele_enrollments_offering
        FOREIGN KEY (offering_id)
        REFERENCES ele_free_elective_offerings (offering_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_enrollments_enrollment
        FOREIGN KEY (enrollment_id)
        REFERENCES kku_enrollments (enrollment_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_enrollments_curriculum
        FOREIGN KEY (enrollment_curriculum_id)
        REFERENCES kku_enrollment_curricula (enrollment_curriculum_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_enrollments_enrolled_by
        FOREIGN KEY (enrolled_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ผู้เรียนที่ลงทะเบียนในรอบวิชาเสรี';

CREATE TABLE IF NOT EXISTS ele_offering_grade_records (
    grade_record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    offering_enrollment_id BIGINT UNSIGNED NOT NULL,
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
    UNIQUE KEY uq_ele_grade_records_enrollment_live
        (offering_enrollment_id, live_unique_key),
    KEY idx_ele_grade_records_grade (grade),
    KEY idx_ele_grade_records_source (grade_source),
    KEY idx_ele_grade_records_best (is_best_grade),
    KEY idx_ele_grade_records_recorded_by (recorded_by),
    KEY idx_ele_grade_records_deleted_at (deleted_at),
    CONSTRAINT fk_ele_grade_records_enrollment
        FOREIGN KEY (offering_enrollment_id)
        REFERENCES ele_offering_enrollments (offering_enrollment_id)
        ON UPDATE CASCADE,
    CONSTRAINT fk_ele_grade_records_recorded_by
        FOREIGN KEY (recorded_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE,
    CONSTRAINT chk_ele_grade_records_grade_not_blank CHECK (CHAR_LENGTH(TRIM(grade)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ผลการเรียนและประวัติผลการเรียนของวิชาเสรี';

-- Postflight: verify the expected columns and uniqueness rules.
SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('ele_offering_enrollments', 'ele_offering_grade_records')
ORDER BY table_name, ordinal_position;

SELECT table_name, index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN ('ele_offering_enrollments', 'ele_offering_grade_records')
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;

SELECT table_name, constraint_name, referenced_table_name
FROM information_schema.referential_constraints
WHERE constraint_schema = DATABASE()
  AND table_name IN ('ele_offering_enrollments', 'ele_offering_grade_records')
ORDER BY table_name, constraint_name;
