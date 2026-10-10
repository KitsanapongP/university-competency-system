-- Manual migration. Run after assessment reports and progress migrations.
-- No provider calls or source data changes. DDL auto-commits in MySQL.
DELIMITER $$
DROP PROCEDURE IF EXISTS migrate_assessment_api_v1$$
CREATE PROCEDURE migrate_assessment_api_v1()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ai_report_jobs' AND engine = 'InnoDB')
    OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'kku_enrollment_curricula' AND engine = 'InnoDB') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Assessment jobs and enrollment curricula must exist with InnoDB';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ai_report_jobs' AND column_name = 'job_id' AND column_type = 'bigint unsigned')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'kku_enrollment_curricula' AND column_name = 'enrollment_curriculum_id' AND column_type = 'bigint unsigned') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Referenced assessment IDs must be BIGINT UNSIGNED';
  END IF;

  CREATE TABLE IF NOT EXISTS ai_report_drafts (
    enrollment_curriculum_id BIGINT UNSIGNED NOT NULL,
    semester TINYINT UNSIGNED NOT NULL,
    job_id BIGINT UNSIGNED NOT NULL,
    source_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    preview MEDIUMTEXT NOT NULL,
    truncated TINYINT(1) NOT NULL DEFAULT 0,
    violation JSON NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (enrollment_curriculum_id, semester),
    CONSTRAINT fk_ai_draft_owner FOREIGN KEY (enrollment_curriculum_id) REFERENCES kku_enrollment_curricula (enrollment_curriculum_id),
    CONSTRAINT fk_ai_draft_job FOREIGN KEY (job_id) REFERENCES ai_report_jobs (job_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS ai_api_daily_usage (
    usage_date DATE NOT NULL PRIMARY KEY,
    call_count INT UNSIGNED NOT NULL DEFAULT 0
  ) ENGINE=InnoDB;

  CREATE TABLE IF NOT EXISTS ai_api_calls (
    call_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    job_id BIGINT UNSIGNED NOT NULL,
    attempt_count INT UNSIGNED NOT NULL,
    provider_name VARCHAR(40) NOT NULL,
    model_name VARCHAR(120) NOT NULL,
    input_tokens INT UNSIGNED NULL,
    output_tokens INT UNSIGNED NULL,
    reserved_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    UNIQUE KEY uq_ai_api_attempt (job_id, attempt_count),
    CONSTRAINT fk_ai_call_job FOREIGN KEY (job_id) REFERENCES ai_report_jobs (job_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE IF NOT EXISTS ai_api_gate (
    gate_id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    active_call_id BIGINT UNSIGNED NULL,
    active_until DATETIME NULL
  ) ENGINE=InnoDB;
  INSERT IGNORE INTO ai_api_gate (gate_id) VALUES (1);

  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ai_report_drafts' AND column_name IN ('enrollment_curriculum_id','semester','job_id','source_hash','preview','truncated','violation','created_at')) <> 8
    OR (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'ai_report_drafts' AND constraint_type = 'FOREIGN KEY') <> 2
    OR NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'ai_api_calls' AND index_name = 'uq_ai_api_attempt' AND non_unique = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Partial or incompatible assessment API schema: inspect before retrying';
  END IF;
END$$
CALL migrate_assessment_api_v1()$$
DROP PROCEDURE migrate_assessment_api_v1$$
DELIMITER ;
