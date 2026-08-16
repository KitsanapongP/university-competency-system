-- Session workflow refactor: setup locking, score finalization, and correction audit.
-- Run this after Database_migration_20260625.sql and the activity unique migration.

-- Preflight: review sessions whose score rows are not completely locked.
SELECT
  asc_map.session_id,
  COUNT(*) AS score_count,
  SUM(CASE WHEN scs.is_locked = 1 THEN 1 ELSE 0 END) AS locked_score_count,
  SUM(CASE WHEN scsr.session_competency_result_id IS NOT NULL AND scsr.is_locked = 1 THEN 1 ELSE 0 END) AS locked_result_count
FROM score_session_competency_scores scs
JOIN act_session_competencies asc_map
  ON asc_map.session_competency_id = scs.session_competency_id
LEFT JOIN score_session_competency_results scsr
  ON scsr.score_id = scs.session_competency_score_id
  AND scsr.deleted_at IS NULL
WHERE scs.deleted_at IS NULL
GROUP BY asc_map.session_id;

ALTER TABLE act_sessions
  CHANGE COLUMN is_finalized is_setup_finalized TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Whether session setup is locked',
  CHANGE COLUMN finalized_at setup_finalized_at DATETIME NULL
    COMMENT 'Datetime when session setup was finalized',
  CHANGE COLUMN finalized_by setup_finalized_by BIGINT UNSIGNED NULL
    COMMENT 'User ID who finalized session setup',
  DROP INDEX idx_sessions_finalized,
  DROP INDEX idx_sessions_finalized_at,
  ADD COLUMN scores_finalized_at DATETIME NULL
    COMMENT 'Datetime when session scores were finalized' AFTER setup_finalized_by,
  ADD COLUMN scores_finalized_by BIGINT UNSIGNED NULL
    COMMENT 'User ID who finalized session scores' AFTER scores_finalized_at,
  ADD COLUMN scores_recalculation_required TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Whether score results are stale and must be recalculated' AFTER scores_finalized_by,
  ADD KEY idx_sessions_setup_finalized (is_setup_finalized),
  ADD KEY idx_sessions_setup_finalized_at (setup_finalized_at),
  ADD KEY idx_sessions_scores_finalized_at (scores_finalized_at),
  ADD KEY idx_sessions_scores_recalculation_required (scores_recalculation_required);

CREATE TABLE score_session_correction_logs (
  session_score_correction_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  previous_scores_finalized_at DATETIME NULL,
  previous_scores_finalized_by BIGINT UNSIGNED NULL,
  opened_by BIGINT UNSIGNED NOT NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  open_unique_key TINYINT GENERATED ALWAYS AS (
    CASE WHEN resolved_at IS NULL THEN 1 ELSE NULL END
  ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_score_correction_log_id),
  UNIQUE KEY uq_session_score_correction_open (session_id, open_unique_key),
  KEY idx_sscl_session (session_id),
  KEY idx_sscl_opened_by (opened_by),
  KEY idx_sscl_opened_at (opened_at),
  CONSTRAINT fk_sscl_session FOREIGN KEY (session_id)
    REFERENCES act_sessions (session_id) ON UPDATE CASCADE,
  CONSTRAINT fk_sscl_opened_by FOREIGN KEY (opened_by)
    REFERENCES auth_users (user_id) ON UPDATE CASCADE,
  CONSTRAINT fk_sscl_resolved_by FOREIGN KEY (resolved_by)
    REFERENCES auth_users (user_id) ON UPDATE CASCADE,
  CONSTRAINT fk_sscl_previous_finalized_by FOREIGN KEY (previous_scores_finalized_by)
    REFERENCES auth_users (user_id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit log for controlled corrections after session score finalization';

ALTER TABLE act_session_registrations
  ADD KEY idx_asr_session_status_live (session_id, status, deleted_at);

ALTER TABLE att_session_attendances
  ADD KEY idx_asa_session_status_live (session_id, status, deleted_at);

-- Backfill score finalization only when every live score and computed result is locked.
UPDATE act_sessions s
JOIN (
  SELECT
    asc_map.session_id,
    COALESCE(
      MAX(COALESCE(scsr.locked_at, scs.locked_at)),
      MAX(scs.updated_at)
    ) AS inferred_finalized_at
  FROM score_session_competency_scores scs
  JOIN act_session_competencies asc_map
    ON asc_map.session_competency_id = scs.session_competency_id
    AND asc_map.deleted_at IS NULL
  LEFT JOIN score_session_competency_results scsr
    ON scsr.score_id = scs.session_competency_score_id
    AND scsr.deleted_at IS NULL
  WHERE scs.deleted_at IS NULL
  GROUP BY asc_map.session_id
  HAVING COUNT(*) > 0
    AND SUM(CASE WHEN scs.is_locked = 1 THEN 1 ELSE 0 END) = COUNT(*)
    AND SUM(CASE WHEN scsr.session_competency_result_id IS NOT NULL AND scsr.is_locked = 1 THEN 1 ELSE 0 END) = COUNT(*)
) locked_sessions ON locked_sessions.session_id = s.session_id
SET s.scores_finalized_at = locked_sessions.inferred_finalized_at,
    s.scores_finalized_by = NULL,
    s.scores_recalculation_required = 0;
