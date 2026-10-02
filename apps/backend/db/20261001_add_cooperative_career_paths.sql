-- Cooperative career catalogue with editable draft and immutable published versions.
-- Run manually against the selected database. Review the preflight result first.
-- This migration does not contain USE <database> and does not alter score tables.

SELECT DATABASE() AS selected_database;

DELIMITER $$

DROP PROCEDURE IF EXISTS verify_coop_career_dependencies$$
CREATE PROCEDURE verify_coop_career_dependencies()
BEGIN
    DECLARE missing_count INT DEFAULT 0;
    DECLARE incompatible_count INT DEFAULT 0;

    IF DATABASE() IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Select the target database before running this migration';
    END IF;

    SELECT COUNT(*) INTO missing_count
    FROM (
        SELECT 'org_faculties' AS table_name
        UNION ALL SELECT 'auth_users'
        UNION ALL SELECT 'edu_curricula'
        UNION ALL SELECT 'comp_competencies'
    ) required
    LEFT JOIN information_schema.tables actual
        ON actual.table_schema = DATABASE()
       AND actual.table_name = required.table_name
    WHERE actual.table_name IS NULL;

    IF missing_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Required faculty, user, curriculum, or competency table is missing';
    END IF;

    SELECT COUNT(*) INTO incompatible_count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('org_faculties', 'auth_users', 'edu_curricula', 'comp_competencies')
      AND engine <> 'InnoDB';

    IF incompatible_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Career catalogue foreign-key dependencies must use InnoDB';
    END IF;

    SELECT COUNT(*) INTO incompatible_count
    FROM (
        SELECT 'org_faculties' AS table_name, 'faculty_id' AS column_name
        UNION ALL SELECT 'auth_users', 'user_id'
        UNION ALL SELECT 'edu_curricula', 'curriculum_id'
        UNION ALL SELECT 'comp_competencies', 'competency_id'
    ) required
    LEFT JOIN information_schema.columns actual
        ON actual.table_schema = DATABASE()
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
       AND actual.column_type = 'bigint unsigned'
    WHERE actual.column_name IS NULL;

    IF incompatible_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A referenced ID column is missing or is not BIGINT UNSIGNED';
    END IF;
END$$

CALL verify_coop_career_dependencies()$$
DROP PROCEDURE verify_coop_career_dependencies$$

CREATE TABLE IF NOT EXISTS coop_career_paths (
    career_path_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    faculty_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(80) COLLATE utf8mb4_unicode_ci NOT NULL,
    status ENUM('draft', 'active', 'inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
    draft_version_id BIGINT UNSIGNED DEFAULT NULL,
    published_version_id BIGINT UNSIGNED DEFAULT NULL,
    live_code VARCHAR(80) COLLATE utf8mb4_unicode_ci
        GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN code ELSE NULL END) STORED,
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    PRIMARY KEY (career_path_id),
    UNIQUE KEY uq_coop_career_path_faculty_code_live (faculty_id, live_code),
    KEY idx_coop_career_path_status (faculty_id, status, deleted_at),
    KEY idx_coop_career_path_draft_version (draft_version_id),
    KEY idx_coop_career_path_published_version (published_version_id),
    CONSTRAINT fk_coop_career_path_faculty
        FOREIGN KEY (faculty_id) REFERENCES org_faculties (faculty_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_coop_career_path_created_by
        FOREIGN KEY (created_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coop_career_versions (
    career_version_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    career_path_id BIGINT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    status ENUM('draft', 'published', 'superseded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
    name_th VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    name_en VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    description_th TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    description_en TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    skills_description_th TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    skills_description_en TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    source_reference VARCHAR(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    reviewed_by BIGINT UNSIGNED DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    published_by BIGINT UNSIGNED DEFAULT NULL,
    published_at DATETIME DEFAULT NULL,
    created_by BIGINT UNSIGNED DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (career_version_id),
    UNIQUE KEY uq_coop_career_version_revision (career_path_id, revision),
    UNIQUE KEY uq_coop_career_version_owner (career_path_id, career_version_id),
    KEY idx_coop_career_version_status (career_path_id, status),
    CONSTRAINT fk_coop_career_version_path
        FOREIGN KEY (career_path_id) REFERENCES coop_career_paths (career_path_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_coop_career_version_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_coop_career_version_published_by
        FOREIGN KEY (published_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_coop_career_version_created_by
        FOREIGN KEY (created_by) REFERENCES auth_users (user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coop_career_curricula (
    career_version_id BIGINT UNSIGNED NOT NULL,
    curriculum_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (career_version_id, curriculum_id),
    KEY idx_coop_career_curriculum_curriculum (curriculum_id, career_version_id),
    CONSTRAINT fk_coop_career_curriculum_version
        FOREIGN KEY (career_version_id) REFERENCES coop_career_versions (career_version_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_coop_career_curriculum_curriculum
        FOREIGN KEY (curriculum_id) REFERENCES edu_curricula (curriculum_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coop_career_competencies (
    career_version_id BIGINT UNSIGNED NOT NULL,
    competency_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (career_version_id, competency_id),
    KEY idx_coop_career_competency_competency (competency_id, career_version_id),
    CONSTRAINT fk_coop_career_competency_version
        FOREIGN KEY (career_version_id) REFERENCES coop_career_versions (career_version_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_coop_career_competency_competency
        FOREIGN KEY (competency_id) REFERENCES comp_competencies (competency_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER ;

-- Add pointer constraints only after the versions table exists. This procedure
-- makes rerunning after a partial MySQL DDL commit safe.
DELIMITER $$

DROP PROCEDURE IF EXISTS add_coop_career_version_pointer_constraints$$
CREATE PROCEDURE add_coop_career_version_pointer_constraints()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints
        WHERE constraint_schema = DATABASE()
          AND constraint_name = 'fk_coop_career_path_draft_version'
    ) THEN
        ALTER TABLE coop_career_paths
            ADD CONSTRAINT fk_coop_career_path_draft_version
            FOREIGN KEY (career_path_id, draft_version_id)
            REFERENCES coop_career_versions (career_path_id, career_version_id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints
        WHERE constraint_schema = DATABASE()
          AND constraint_name = 'fk_coop_career_path_published_version'
    ) THEN
        ALTER TABLE coop_career_paths
            ADD CONSTRAINT fk_coop_career_path_published_version
            FOREIGN KEY (career_path_id, published_version_id)
            REFERENCES coop_career_versions (career_path_id, career_version_id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END$$

CALL add_coop_career_version_pointer_constraints()$$
DROP PROCEDURE add_coop_career_version_pointer_constraints$$

SELECT table_name, engine
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
      'coop_career_paths',
      'coop_career_versions',
      'coop_career_curricula',
      'coop_career_competencies'
  )
ORDER BY table_name;
