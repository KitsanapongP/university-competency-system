-- ============================================================
-- NEW TABLES: Course Schema
-- university-competency-system
-- ============================================================
-- รวม SQL ทั้งหมดที่ต้องเพิ่ม:
--   - 8 table ใหม่ (crs_* และ score_section_*)
--   - ALTER TABLE เพิ่ม degree_level
-- ============================================================

-- ------------------------------------------------------------
-- 1. crs_courses
-- ------------------------------------------------------------
CREATE TABLE `crs_courses` (
    `course_id`     bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of course',
    `faculty_id`    bigint UNSIGNED NOT NULL COMMENT 'FK to org_faculties',
    `degree_level`  enum('bachelor','master','phd','other') NOT NULL DEFAULT 'bachelor' COMMENT 'ระดับปริญญาของรายวิชา',
    `code`          varchar(50) NOT NULL COMMENT 'รหัสวิชา เช่น 001141',
    `name_th`       varchar(255) NOT NULL COMMENT 'ชื่อวิชาภาษาไทย',
    `name_en`       varchar(255) DEFAULT NULL COMMENT 'ชื่อวิชาภาษาอังกฤษ',
    `credits`       tinyint UNSIGNED NOT NULL DEFAULT 3 COMMENT 'จำนวนหน่วยกิต',
    `description`   text DEFAULT NULL COMMENT 'คำอธิบายรายวิชา',
    `created_by`    bigint UNSIGNED DEFAULT NULL COMMENT 'FK to auth_users ผู้สร้าง',
    `status`        enum('draft','published','closed') NOT NULL DEFAULT 'draft' COMMENT 'สถานะรายวิชา',
    `is_active`     tinyint NOT NULL DEFAULT 1 COMMENT 'Active flag',
    `created_at`    datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`    datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`    datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`course_id`),
    -- code + faculty + degree_level ต้อง unique เพื่อรองรับวิชาเดียวกันคนละระดับปริญญา
    UNIQUE KEY `uq_crs_courses_faculty_code_degree` (`faculty_id`, `code`, `degree_level`),
    KEY `idx_crs_courses_faculty` (`faculty_id`),
    KEY `idx_crs_courses_degree` (`degree_level`),
    KEY `idx_crs_courses_status` (`status`),
    KEY `idx_crs_courses_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_crs_courses_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Master รายวิชา';

-- ------------------------------------------------------------
-- 2. crs_course_categories
--    หมวด/กลุ่มวิชาในหลักสูตร รองรับ hierarchy ด้วย parent_id
-- ------------------------------------------------------------
CREATE TABLE `crs_course_categories` (
    `category_id`       bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of category',
    `curriculum_id`     bigint UNSIGNED NOT NULL COMMENT 'FK to edu_curricula',
    `parent_id`         bigint UNSIGNED DEFAULT NULL COMMENT 'FK to self (NULL = root)',
    `code`              varchar(20) DEFAULT NULL COMMENT 'รหัสหมวด เช่น 1, 1.1, 2.3.1',
    `name_th`           varchar(255) NOT NULL COMMENT 'ชื่อหมวดวิชา',
    `required_credits`  int UNSIGNED NOT NULL DEFAULT 0 COMMENT 'จำนวนหน่วยกิตตามเกณฑ์',
    `display_order`     int UNSIGNED NOT NULL DEFAULT 0 COMMENT 'ลำดับแสดงผล',
    `is_active`         tinyint NOT NULL DEFAULT 1 COMMENT 'Active flag',
    `created_at`        datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`        datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`        datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`category_id`),
    KEY `idx_ccc_curriculum` (`curriculum_id`),
    KEY `idx_ccc_parent` (`parent_id`),
    KEY `idx_ccc_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_ccc_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE,
    CONSTRAINT `fk_ccc_parent` FOREIGN KEY (`parent_id`) REFERENCES `crs_course_categories` (`category_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='หมวด/กลุ่มวิชาในหลักสูตร รองรับ hierarchy ด้วย parent_id';

-- ------------------------------------------------------------
-- 3. crs_curriculum_courses
--    Junction: รายวิชาที่อยู่ในหมวดวิชาของหลักสูตร
-- ------------------------------------------------------------
CREATE TABLE `crs_curriculum_courses` (
    `curriculum_course_id`  bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `category_id`           bigint UNSIGNED NOT NULL COMMENT 'FK to crs_course_categories',
    `course_id`             bigint UNSIGNED NOT NULL COMMENT 'FK to crs_courses',
    `is_required`           tinyint NOT NULL DEFAULT 1 COMMENT '1=บังคับ, 0=วิชาเลือก',
    `display_order`         int UNSIGNED NOT NULL DEFAULT 0 COMMENT 'ลำดับแสดงผลในหมวด',
    `is_active`             tinyint NOT NULL DEFAULT 1 COMMENT 'Active flag',
    `created_at`            datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`            datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`            datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`curriculum_course_id`),
    UNIQUE KEY `uq_crs_cc_category_course` (`category_id`, `course_id`),
    KEY `idx_crs_cc_category` (`category_id`),
    KEY `idx_crs_cc_course` (`course_id`),
    KEY `idx_crs_cc_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_crs_cc_category` FOREIGN KEY (`category_id`) REFERENCES `crs_course_categories` (`category_id`) ON UPDATE CASCADE,
    CONSTRAINT `fk_crs_cc_course` FOREIGN KEY (`course_id`) REFERENCES `crs_courses` (`course_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รายวิชาที่อยู่ในหมวดวิชาของหลักสูตร';

-- ------------------------------------------------------------
-- 4. crs_course_sections
--    กลุ่มเรียน (เหมือน act_sessions)
-- ------------------------------------------------------------
CREATE TABLE `crs_course_sections` (
    `section_id`        bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of section',
    `course_id`         bigint UNSIGNED NOT NULL COMMENT 'FK to crs_courses',
    `degree_level`      enum('bachelor','master','phd','other') NOT NULL DEFAULT 'bachelor' COMMENT 'Snapshot ระดับปริญญาจาก course',
    `section_no`        varchar(10) NOT NULL COMMENT 'เลขกลุ่ม เช่น 01, 02',
    `academic_year_be`  smallint UNSIGNED NOT NULL COMMENT 'ปีการศึกษา พ.ศ. เช่น 2568',
    `semester`          tinyint UNSIGNED NOT NULL COMMENT '1=ต้น, 2=ปลาย, 3=summer',
    `capacity`          int UNSIGNED DEFAULT NULL COMMENT 'จำนวนนักศึกษาสูงสุด',
    `status`            enum('open','closed','cancelled') NOT NULL DEFAULT 'open' COMMENT 'สถานะกลุ่มเรียน',
    `is_finalized`      tinyint NOT NULL DEFAULT 0 COMMENT 'ปิดตัดเกรด/ล็อกคะแนนแล้ว',
    `finalized_at`      datetime DEFAULT NULL COMMENT 'เวลาที่ finalize',
    `finalized_by`      bigint UNSIGNED DEFAULT NULL COMMENT 'FK to auth_users',
    `created_at`        datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`        datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`        datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`section_id`),
    UNIQUE KEY `uq_crs_section_course_no_year_sem` (`course_id`, `section_no`, `academic_year_be`, `semester`),
    KEY `idx_crs_sections_course` (`course_id`),
    KEY `idx_crs_sections_degree` (`degree_level`),
    KEY `idx_crs_sections_status` (`status`),
    KEY `idx_crs_sections_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_crs_sections_course` FOREIGN KEY (`course_id`) REFERENCES `crs_courses` (`course_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='กลุ่มเรียนของรายวิชา (เหมือน act_sessions)';

-- ------------------------------------------------------------
-- 5. crs_section_competencies
--    ผูก section กับ competency (เหมือน act_session_competencies)
-- ------------------------------------------------------------
CREATE TABLE `crs_section_competencies` (
    `section_competency_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `section_id`            bigint UNSIGNED NOT NULL COMMENT 'FK to crs_course_sections',
    `competency_id`         bigint UNSIGNED NOT NULL COMMENT 'FK to comp_competencies',
    `max_percent`           decimal(6,2) NOT NULL COMMENT 'สัดส่วน % สูงสุดที่ได้จาก section นี้',
    `created_at`            datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`            datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`            datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`section_competency_id`),
    UNIQUE KEY `uq_crs_sc_section_competency` (`section_id`, `competency_id`),
    KEY `idx_crs_sc_section` (`section_id`),
    KEY `idx_crs_sc_competency` (`competency_id`),
    KEY `idx_crs_sc_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_crs_sc_section` FOREIGN KEY (`section_id`) REFERENCES `crs_course_sections` (`section_id`) ON UPDATE CASCADE,
    CONSTRAINT `fk_crs_sc_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Competency ที่ได้จาก section และสัดส่วน % สูงสุด';

-- ------------------------------------------------------------
-- 6. crs_section_enrollments
--    การลงทะเบียนเรียนของนักศึกษา (เหมือน act_session_registrations)
-- ------------------------------------------------------------
CREATE TABLE `crs_section_enrollments` (
    `section_enrollment_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `section_id`            bigint UNSIGNED NOT NULL COMMENT 'FK to crs_course_sections',
    `person_id`             bigint UNSIGNED NOT NULL COMMENT 'FK to persons',
    `status`                enum('enrolled','withdrawn','completed','failed') NOT NULL DEFAULT 'enrolled' COMMENT 'สถานะการลงทะเบียน',
    `grade`                 varchar(5) DEFAULT NULL COMMENT 'เกรด เช่น A, B+, C',
    `enrolled_at`           datetime NOT NULL DEFAULT current_timestamp() COMMENT 'วันที่ลงทะเบียน',
    `created_at`            datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`            datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`            datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`section_enrollment_id`),
    UNIQUE KEY `uq_crs_se_section_person` (`section_id`, `person_id`),
    KEY `idx_crs_se_section` (`section_id`),
    KEY `idx_crs_se_person` (`person_id`),
    KEY `idx_crs_se_status` (`status`),
    KEY `idx_crs_se_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_crs_se_section` FOREIGN KEY (`section_id`) REFERENCES `crs_course_sections` (`section_id`) ON UPDATE CASCADE,
    CONSTRAINT `fk_crs_se_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='การลงทะเบียนเรียนของนักศึกษาต่อ section';

-- ------------------------------------------------------------
-- 7. score_section_competency_scores
--    คะแนน competency ต่อนักศึกษา (เหมือน score_session_competency_scores)
-- ------------------------------------------------------------
CREATE TABLE `score_section_competency_scores` (
    `section_competency_score_id`   bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `section_competency_id`         bigint UNSIGNED NOT NULL COMMENT 'FK to crs_section_competencies',
    `person_id`                     bigint UNSIGNED NOT NULL COMMENT 'FK to persons',
    `grading_source`                enum('grade','manual','system') NOT NULL DEFAULT 'manual' COMMENT 'แหล่งที่มาของคะแนน',
    `raw_score`                     decimal(6,2) DEFAULT NULL COMMENT 'คะแนนดิบ',
    `max_raw_score_snapshot`        decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Snapshot ของ max score ณ เวลาให้คะแนน',
    `penalty_factor_snapshot`       decimal(5,4) NOT NULL DEFAULT 1.0000 COMMENT 'Snapshot ของ penalty multiplier',
    `final_score`                   decimal(6,2) DEFAULT NULL COMMENT 'คะแนนสุทธิ',
    `graded_by`                     bigint UNSIGNED DEFAULT NULL COMMENT 'FK to auth_users',
    `graded_at`                     datetime DEFAULT NULL COMMENT 'เวลาที่ให้คะแนน',
    `notes`                         varchar(500) DEFAULT NULL COMMENT 'หมายเหตุ',
    `is_locked`                     tinyint NOT NULL DEFAULT 0 COMMENT 'ล็อกหลัง finalize',
    `locked_at`                     datetime DEFAULT NULL COMMENT 'เวลาที่ล็อก',
    `created_at`                    datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`                    datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`                    datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`section_competency_score_id`),
    UNIQUE KEY `uq_sscs_section_comp_person` (`section_competency_id`, `person_id`),
    KEY `idx_sscs_section_comp` (`section_competency_id`),
    KEY `idx_sscs_person` (`person_id`),
    KEY `idx_sscs_graded_at` (`graded_at`),
    KEY `idx_sscs_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_sscs_section_comp` FOREIGN KEY (`section_competency_id`) REFERENCES `crs_section_competencies` (`section_competency_id`) ON UPDATE CASCADE,
    CONSTRAINT `fk_sscs_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='คะแนน competency ต่อนักศึกษาต่อ section';

-- ------------------------------------------------------------
-- 8. score_section_competency_results
--    Earned percent (เหมือน score_session_competency_results)
-- ------------------------------------------------------------
CREATE TABLE `score_section_competency_results` (
    `section_competency_result_id`  bigint UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key',
    `score_id`                      bigint UNSIGNED NOT NULL COMMENT 'FK to score_section_competency_scores',
    `max_percent_snapshot`          decimal(6,2) NOT NULL COMMENT 'Snapshot ของ max_percent',
    `factor_snapshot`               decimal(7,6) NOT NULL COMMENT 'Snapshot ของ normalization factor',
    `earned_percent`                decimal(6,2) NOT NULL COMMENT 'Computed earned percent',
    `computed_by`                   bigint UNSIGNED DEFAULT NULL COMMENT 'FK to auth_users หรือ system',
    `computed_at`                   datetime NOT NULL DEFAULT current_timestamp() COMMENT 'เวลาที่ compute',
    `is_locked`                     tinyint NOT NULL DEFAULT 0 COMMENT 'ล็อกผลลัพธ์',
    `locked_at`                     datetime DEFAULT NULL COMMENT 'เวลาที่ล็อก',
    `created_at`                    datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at`                    datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `deleted_at`                    datetime DEFAULT NULL COMMENT 'Soft delete timestamp',
    PRIMARY KEY (`section_competency_result_id`),
    UNIQUE KEY `uq_sscr_score_id` (`score_id`),
    KEY `idx_sscr_computed_at` (`computed_at`),
    KEY `idx_sscr_deleted_at` (`deleted_at`),
    CONSTRAINT `fk_sscr_score` FOREIGN KEY (`score_id`) REFERENCES `score_section_competency_scores` (`section_competency_score_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Earned percent ของ competency จาก course section';

-- ============================================================
-- สรุป table ใหม่ทั้งหมด 8 ตาราง
-- ============================================================
-- crs_courses                       ← master รายวิชา (มี degree_level)
-- crs_course_categories             ← หมวด/กลุ่มวิชา (hierarchy)
-- crs_curriculum_courses            ← รายวิชาในหลักสูตร (junction)
-- crs_course_sections               ← กลุ่มเรียน (มี degree_level snapshot)
-- crs_section_competencies          ← ผูก section กับ competency
-- crs_section_enrollments           ← การลงทะเบียนของนักศึกษา
-- score_section_competency_scores   ← คะแนนต่อนักศึกษา
-- score_section_competency_results  ← earned_percent (computed)
-- ============================================================
-- FK ที่ชี้ไปยัง table เดิม
--   org_faculties      ← crs_courses.faculty_id
--   edu_curricula      ← crs_course_categories.curriculum_id
--   comp_competencies  ← crs_section_competencies.competency_id
--   persons            ← crs_section_enrollments.person_id
--                      ← score_section_competency_scores.person_id
-- ============================================================
