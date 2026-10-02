-- Latest learner assessment reports and durable Ollama generation jobs.
-- Run manually after the cooperative career-path migration.

SELECT DATABASE() AS selected_database, VERSION() AS mysql_version;

DELIMITER $$

DROP PROCEDURE IF EXISTS verify_learner_assessment_dependencies$$
CREATE PROCEDURE verify_learner_assessment_dependencies()
BEGIN
    DECLARE missing_count INT DEFAULT 0;
    DECLARE incompatible_count INT DEFAULT 0;
    DECLARE mysql_major INT DEFAULT 0;
    DECLARE mysql_minor INT DEFAULT 0;
    DECLARE mysql_patch INT DEFAULT 0;

    IF DATABASE() IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Select the target database before running this migration';
    END IF;

    SET mysql_major = CAST(SUBSTRING_INDEX(VERSION(), '.', 1) AS UNSIGNED);
    SET mysql_minor = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(VERSION(), '.', 2), '.', -1) AS UNSIGNED);
    SET mysql_patch = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(VERSION(), '.', 3), '.', -1) AS UNSIGNED);

    IF VERSION() LIKE '%MariaDB%'
       OR mysql_major < 5
       OR (mysql_major = 5 AND mysql_minor < 7)
       OR (mysql_major = 5 AND mysql_minor = 7 AND mysql_patch < 8) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Learner assessment reports require MySQL 5.7.8 or newer';
    END IF;

    SELECT COUNT(*) INTO missing_count
    FROM (
        SELECT 'kku_enrollment_curricula' AS table_name
        UNION ALL SELECT 'edu_student_cohorts'
        UNION ALL SELECT 'crs_coop_requirement_sets'
        UNION ALL SELECT 'coop_career_paths'
        UNION ALL SELECT 'coop_career_versions'
        UNION ALL SELECT 'coop_career_curricula'
        UNION ALL SELECT 'coop_career_competencies'
    ) required
    LEFT JOIN information_schema.tables actual
        ON actual.table_schema = DATABASE()
       AND actual.table_name = required.table_name
    WHERE actual.table_name IS NULL;

    IF missing_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Run the learner, readiness, and career-path migrations first';
    END IF;

    SELECT COUNT(*) INTO incompatible_count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN (
          'kku_enrollment_curricula', 'edu_student_cohorts', 'crs_coop_requirement_sets',
          'coop_career_paths', 'coop_career_versions', 'coop_career_curricula',
          'coop_career_competencies'
      )
      AND engine <> 'InnoDB';

    IF incompatible_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Learner assessment foreign-key dependencies must use InnoDB';
    END IF;

    SELECT COUNT(*) INTO incompatible_count
    FROM (
        SELECT 'kku_enrollment_curricula' AS table_name, 'enrollment_curriculum_id' AS column_name
        UNION ALL SELECT 'edu_student_cohorts', 'cohort_id'
        UNION ALL SELECT 'crs_coop_requirement_sets', 'requirement_set_id'
        UNION ALL SELECT 'coop_career_paths', 'career_path_id'
        UNION ALL SELECT 'coop_career_versions', 'career_version_id'
    ) required
    LEFT JOIN information_schema.columns actual
        ON actual.table_schema = DATABASE()
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
       AND actual.column_type = 'bigint unsigned'
    WHERE actual.column_name IS NULL;

    IF incompatible_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A referenced learner assessment ID is missing or is not BIGINT UNSIGNED';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'ai_learner_reports'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'ai_learner_reports'
          AND column_name = 'source_hash'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Existing ai_learner_reports has an incompatible schema; inspect before continuing';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'ai_report_jobs'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'ai_report_jobs'
          AND column_name = 'active_scope_id'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Existing ai_report_jobs has an incompatible schema; inspect before continuing';
    END IF;

    SELECT COUNT(*) INTO incompatible_count
    FROM (
        SELECT 'ai_learner_reports' AS table_name, 'enrollment_curriculum_id' AS column_name
        UNION ALL SELECT 'ai_learner_reports', 'semester'
        UNION ALL SELECT 'ai_learner_reports', 'target_year_be'
        UNION ALL SELECT 'ai_learner_reports', 'source_hash'
        UNION ALL SELECT 'ai_learner_reports', 'source_snapshot'
        UNION ALL SELECT 'ai_learner_reports', 'report_content'
        UNION ALL SELECT 'ai_learner_reports', 'provider_name'
        UNION ALL SELECT 'ai_learner_reports', 'model_name'
        UNION ALL SELECT 'ai_learner_reports', 'model_digest'
        UNION ALL SELECT 'ai_learner_reports', 'provider_config_fingerprint'
        UNION ALL SELECT 'ai_learner_reports', 'pipeline_version'
        UNION ALL SELECT 'ai_learner_reports', 'prompt_version'
        UNION ALL SELECT 'ai_learner_reports', 'output_schema_version'
        UNION ALL SELECT 'ai_report_jobs', 'enrollment_curriculum_id'
        UNION ALL SELECT 'ai_report_jobs', 'semester'
        UNION ALL SELECT 'ai_report_jobs', 'input_hash'
        UNION ALL SELECT 'ai_report_jobs', 'status'
        UNION ALL SELECT 'ai_report_jobs', 'attempt_count'
        UNION ALL SELECT 'ai_report_jobs', 'active_scope_id'
        UNION ALL SELECT 'ai_report_jobs', 'active_semester'
        UNION ALL SELECT 'ai_report_jobs', 'lease_token'
        UNION ALL SELECT 'ai_report_jobs', 'lease_expires_at'
        UNION ALL SELECT 'ai_report_jobs', 'next_attempt_at'
        UNION ALL SELECT 'ai_report_jobs', 'failure_wait_until'
        UNION ALL SELECT 'ai_report_jobs', 'error_code'
    ) required
    JOIN information_schema.tables existing
        ON existing.table_schema = DATABASE()
       AND existing.table_name = required.table_name
    LEFT JOIN information_schema.columns actual
        ON actual.table_schema = DATABASE()
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL;

    IF incompatible_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'An existing report table is only partially created; inspect before continuing';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'ai_learner_reports'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'ai_learner_reports'
          AND index_name = 'uq_ai_report_scope_semester' AND non_unique = 0
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Existing ai_learner_reports is missing its unique learner-semester index';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'ai_report_jobs'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'ai_report_jobs'
          AND index_name = 'uq_ai_report_job_active_scope' AND non_unique = 0
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Existing ai_report_jobs is missing its active-job uniqueness guard';
    END IF;
END$$

CALL verify_learner_assessment_dependencies()$$
DROP PROCEDURE verify_learner_assessment_dependencies$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS ai_learner_reports (
    report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    enrollment_curriculum_id BIGINT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    target_year_be SMALLINT UNSIGNED NOT NULL,
    source_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_snapshot JSON NOT NULL,
    report_content JSON NOT NULL,
    data_completeness ENUM('full', 'partial') COLLATE utf8mb4_unicode_ci NOT NULL,
    provider_name VARCHAR(40) COLLATE utf8mb4_unicode_ci NOT NULL,
    model_name VARCHAR(120) COLLATE utf8mb4_unicode_ci NOT NULL,
    model_digest VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_config_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    pipeline_version VARCHAR(40) COLLATE utf8mb4_unicode_ci NOT NULL,
    prompt_version VARCHAR(40) COLLATE utf8mb4_unicode_ci NOT NULL,
    output_schema_version VARCHAR(40) COLLATE utf8mb4_unicode_ci NOT NULL,
    generated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (report_id),
    UNIQUE KEY uq_ai_report_scope_semester (enrollment_curriculum_id, semester),
    KEY idx_ai_report_source_hash (source_hash),
    CONSTRAINT fk_ai_report_enrollment_curriculum
        FOREIGN KEY (enrollment_curriculum_id)
        REFERENCES kku_enrollment_curricula (enrollment_curriculum_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_report_jobs (
    job_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    enrollment_curriculum_id BIGINT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    target_year_be SMALLINT UNSIGNED NOT NULL,
    input_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    input_snapshot JSON DEFAULT NULL,
    status ENUM('queued', 'running', 'succeeded', 'failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 3,
    active_scope_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (CASE WHEN status IN ('queued', 'running') THEN enrollment_curriculum_id ELSE NULL END) STORED,
    active_semester TINYINT UNSIGNED
        GENERATED ALWAYS AS (CASE WHEN status IN ('queued', 'running') THEN semester ELSE NULL END) STORED,
    lease_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    lease_expires_at DATETIME DEFAULT NULL,
    heartbeat_at DATETIME DEFAULT NULL,
    next_attempt_at DATETIME DEFAULT NULL,
    failure_wait_until DATETIME DEFAULT NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME DEFAULT NULL,
    finished_at DATETIME DEFAULT NULL,
    error_code VARCHAR(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (job_id),
    UNIQUE KEY uq_ai_report_job_active_scope (active_scope_id, active_semester),
    KEY idx_ai_report_job_claim (status, next_attempt_at, lease_expires_at, job_id),
    KEY idx_ai_report_job_scope_history (enrollment_curriculum_id, semester, requested_at),
    CONSTRAINT fk_ai_report_job_enrollment_curriculum
        FOREIGN KEY (enrollment_curriculum_id)
        REFERENCES kku_enrollment_curricula (enrollment_curriculum_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT table_name, engine
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('ai_learner_reports', 'ai_report_jobs')
ORDER BY table_name;
