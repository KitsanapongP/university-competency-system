-- Cooperative education readiness requirement versions.
-- Run manually against the selected database. Safe to execute more than once.

CREATE TABLE IF NOT EXISTS crs_coop_requirement_sets (
    requirement_set_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    curriculum_id BIGINT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    draft_curriculum_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (IF(status = 'draft', curriculum_id, NULL)) STORED,
    published_curriculum_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (IF(status = 'published', curriculum_id, NULL)) STORED,
    created_by BIGINT UNSIGNED DEFAULT NULL,
    published_by BIGINT UNSIGNED DEFAULT NULL,
    published_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (requirement_set_id),
    UNIQUE KEY uq_crs_coop_set_revision (curriculum_id, revision),
    UNIQUE KEY uq_crs_coop_draft_curriculum (draft_curriculum_id),
    UNIQUE KEY uq_crs_coop_published_curriculum (published_curriculum_id),
    KEY idx_crs_coop_set_status (curriculum_id, status),
    CONSTRAINT fk_crs_coop_set_curriculum
        FOREIGN KEY (curriculum_id) REFERENCES edu_curricula (curriculum_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crs_coop_requirements (
    requirement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    requirement_set_id BIGINT UNSIGNED NOT NULL,
    criterion_type ENUM(
        'overall_gpa',
        'category_gpa',
        'course_grade',
        'category_credits',
        'free_elective_credits'
    ) NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) DEFAULT NULL,
    minimum_value DECIMAL(8, 2) DEFAULT NULL,
    minimum_grade VARCHAR(4) DEFAULT NULL,
    category_id BIGINT UNSIGNED DEFAULT NULL,
    course_id BIGINT UNSIGNED DEFAULT NULL,
    display_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (requirement_id),
    KEY idx_crs_coop_req_set_order (requirement_set_id, display_order, requirement_id),
    KEY idx_crs_coop_req_category (category_id),
    KEY idx_crs_coop_req_course (course_id),
    CONSTRAINT fk_crs_coop_req_set
        FOREIGN KEY (requirement_set_id) REFERENCES crs_coop_requirement_sets (requirement_set_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_crs_coop_req_category
        FOREIGN KEY (category_id) REFERENCES crs_course_categories (category_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_crs_coop_req_course
        FOREIGN KEY (course_id) REFERENCES crs_courses (course_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('crs_coop_requirement_sets', 'crs_coop_requirements')
ORDER BY table_name;
