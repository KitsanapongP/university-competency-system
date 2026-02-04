-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Feb 04, 2026 at 06:28 PM
-- Server version: 10.11.11-MariaDB-0+deb12u1-log
-- PHP Version: 8.4.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `kku_competency`
--

-- --------------------------------------------------------

--
-- Table structure for table `act_activities`
--

CREATE TABLE `act_activities` (
  `activity_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of activity',
  `faculty_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Faculty that owns and manages this activity',
  `code` varchar(50) DEFAULT NULL COMMENT 'Optional internal activity code or number',
  `name_th` varchar(255) NOT NULL COMMENT 'Activity name in Thai',
  `name_en` varchar(255) DEFAULT NULL COMMENT 'Activity name in English',
  `description` text DEFAULT NULL COMMENT 'Detailed description of the activity',
  `category` varchar(100) DEFAULT NULL COMMENT 'Activity category (e.g. volunteer, academic, sport)',
  `type` varchar(100) DEFAULT NULL COMMENT 'Activity type or classification',
  `created_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID of staff who created the activity',
  `status` enum('draft','published','closed','cancelled') NOT NULL DEFAULT 'draft' COMMENT 'Activity lifecycle status',
  `visibility_scope` enum('faculty_only','university_wide') NOT NULL DEFAULT 'faculty_only' COMMENT 'Visibility scope of the activity',
  `registration_required` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether participants must register before joining',
  `published_at` datetime DEFAULT NULL COMMENT 'Datetime when activity is published',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Faculty-level activities (parent entity)';

-- --------------------------------------------------------

--
-- Table structure for table `act_faculty_policies`
--

CREATE TABLE `act_faculty_policies` (
  `faculty_policy_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of faculty activity policy',
  `faculty_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Faculty that owns this default policy',
  `default_timezone` varchar(50) NOT NULL DEFAULT 'Asia/Bangkok' COMMENT 'Default timezone used when creating new sessions',
  `default_registration_required` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Default registration_required for new sessions',
  `default_grading_mode` enum('attendance_only','manual_score','submission','exam','hybrid') NOT NULL DEFAULT 'attendance_only' COMMENT 'Default grading_mode for new sessions',
  `default_max_raw_score` decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Default maximum raw score for new sessions',
  `default_pass_threshold` decimal(6,2) DEFAULT NULL COMMENT 'Default pass threshold for new sessions (optional)',
  `default_late_grace_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Default grace period in minutes before marking as late',
  `default_late_penalty_factor` decimal(5,4) NOT NULL DEFAULT 1.0000 COMMENT 'Default multiplier applied when late (e.g. 0.8000 means 80%)',
  `default_require_checkout` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Default flag: require checkout for attendance to be considered valid',
  `default_min_attendance_minutes` int(10) UNSIGNED DEFAULT NULL COMMENT 'Default minimum attendance duration in minutes to be eligible (optional)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this policy is active',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Default session settings per faculty to reduce repeated data entry';

-- --------------------------------------------------------

--
-- Table structure for table `act_sessions`
--

CREATE TABLE `act_sessions` (
  `session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of activity session',
  `activity_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Parent activity',
  `session_no` int(10) UNSIGNED NOT NULL COMMENT 'Session sequence number (1,2,3...)',
  `start_at` datetime NOT NULL COMMENT 'Session start datetime',
  `end_at` datetime NOT NULL COMMENT 'Session end datetime',
  `timezone` varchar(50) NOT NULL DEFAULT 'Asia/Bangkok' COMMENT 'Timezone of the session',
  `location_name` varchar(255) DEFAULT NULL COMMENT 'Location name (building / room / venue)',
  `location_detail` text DEFAULT NULL COMMENT 'Additional location detail or description',
  `latitude` decimal(10,7) DEFAULT NULL COMMENT 'Latitude for map integration',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT 'Longitude for map integration',
  `capacity` int(10) UNSIGNED DEFAULT NULL COMMENT 'Maximum number of participants',
  `registration_required` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether this session requires registration',
  `grading_mode` enum('attendance_only','manual_score','submission','exam','hybrid') NOT NULL DEFAULT 'attendance_only' COMMENT 'Grading mode for this session',
  `max_raw_score` decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Maximum raw score for grading',
  `pass_threshold` decimal(6,2) DEFAULT NULL COMMENT 'Minimum raw score required to pass (optional)',
  `late_grace_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Grace period in minutes before marking as late',
  `late_penalty_factor` decimal(5,4) NOT NULL DEFAULT 1.0000 COMMENT 'Multiplier applied when late (e.g. 0.8000 means 80%)',
  `require_checkout` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Require checkout for attendance to be considered valid',
  `min_attendance_minutes` int(10) UNSIGNED DEFAULT NULL COMMENT 'Minimum attendance duration (minutes) to be eligible (optional)',
  `status` enum('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled' COMMENT 'Session status',
  `is_finalized` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether this session is finalized (locked for edits)',
  `finalized_at` datetime DEFAULT NULL COMMENT 'Datetime when session was finalized',
  `finalized_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who finalized the session',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Actual scheduled sessions of activities';

-- --------------------------------------------------------

--
-- Table structure for table `act_session_assignments`
--

CREATE TABLE `act_session_assignments` (
  `session_assignment_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of session assignment',
  `session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to act_sessions',
  `user_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to auth_users (assigned staff/lecturer)',
  `assignment_role` enum('lecturer','officer','assistant','supervisor') NOT NULL COMMENT 'Role of the assignee for this session',
  `can_record_attendance` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'If 1, user can record/edit attendance for this session',
  `can_grade` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'If 1, user can create/update competency scores for this session',
  `can_finalize` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'If 1, user can finalize this session',
  `note` varchar(500) DEFAULT NULL COMMENT 'Optional note about assignment',
  `created_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who created this assignment (optional)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Assign lecturers/officers to a session and define their permissions';

-- --------------------------------------------------------

--
-- Table structure for table `act_session_competencies`
--

CREATE TABLE `act_session_competencies` (
  `session_competency_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of session-competency mapping',
  `session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Activity session that grants competency',
  `competency_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Competency granted by this session',
  `max_percent` decimal(6,2) NOT NULL COMMENT 'Maximum percent contribution to this competency from this session (e.g. 5.00)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Defines which competencies a session awards and the max percent for each';

-- --------------------------------------------------------

--
-- Table structure for table `act_session_registrations`
--

CREATE TABLE `act_session_registrations` (
  `session_registration_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of session registration',
  `session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to act_sessions',
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to persons',
  `status` enum('pending','approved','waitlisted','rejected','cancelled','checked_in','no_show') NOT NULL DEFAULT 'pending' COMMENT 'Registration status',
  `registered_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Datetime when student registered',
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who approvedrejected (optional)',
  `approved_at` datetime DEFAULT NULL COMMENT 'Datetime when approvedrejected',
  `cancel_reason` varchar(255) DEFAULT NULL COMMENT 'Reason for cancellation (optional)',
  `note` varchar(500) DEFAULT NULL COMMENT 'Optional note',
  `source` enum('student','officer','lecturer','system') NOT NULL DEFAULT 'student' COMMENT 'Who created the registration',
  `created_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who created the registration (optional)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student registrations per session (supports required registration and walk-in)';

-- --------------------------------------------------------

--
-- Table structure for table `att_session_attendances`
--

CREATE TABLE `att_session_attendances` (
  `session_attendance_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of session attendance',
  `session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Activity session attended',
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Person who attends the session',
  `status` enum('present','late','absent','excused') NOT NULL DEFAULT 'absent' COMMENT 'Attendance status',
  `checkin_at` datetime DEFAULT NULL COMMENT 'Check-in timestamp',
  `checkout_at` datetime DEFAULT NULL COMMENT 'Check-out timestamp (optional)',
  `checkin_method` enum('qr','manual','system','other') DEFAULT NULL COMMENT 'How check-in was recorded',
  `checkout_method` enum('qr','manual','system','other') DEFAULT NULL COMMENT 'How check-out was recorded (optional)',
  `notes` varchar(500) DEFAULT NULL COMMENT 'Optional notes about attendance',
  `recorded_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who recorded/edited the attendance (staff/lecturer)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Attendance per student per session, including optional check-in/out';

-- --------------------------------------------------------

--
-- Table structure for table `auth_roles`
--

CREATE TABLE `auth_roles` (
  `role_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of role',
  `code` varchar(50) NOT NULL COMMENT 'Role code (admin, student, lecturer, officer, dean)',
  `name_th` varchar(100) NOT NULL COMMENT 'Role name in Thai',
  `name_en` varchar(100) DEFAULT NULL COMMENT 'Role name in English',
  `description` varchar(255) DEFAULT NULL COMMENT 'Role description',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles master table';

--
-- Dumping data for table `auth_roles`
--

INSERT INTO `auth_roles` (`role_id`, `code`, `name_th`, `name_en`, `description`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'admin', 'ผู้ดูแลระบบ', 'Admin', 'System administrator', '2026-01-26 13:33:04', '2026-01-26 13:33:04', NULL),
(2, 'student', 'นักศึกษา', 'Student', 'Learner / student user', '2026-01-26 13:33:04', '2026-01-26 13:33:04', NULL),
(3, 'lecturer', 'อาจารย์', 'Lecturer', 'Lecturer / assessor', '2026-01-26 13:33:04', '2026-01-26 13:33:04', NULL),
(4, 'officer', 'เจ้าหน้าที่พัฒนานักศึกษา', 'Student Development Officer', 'Faculty officer who manages activities', '2026-01-26 13:33:04', '2026-01-26 13:33:04', NULL),
(5, 'dean', 'คณบดี', 'Dean', 'Faculty dean view/report', '2026-01-26 13:33:04', '2026-01-26 13:33:04', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `auth_users`
--

CREATE TABLE `auth_users` (
  `user_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of user',
  `username` varchar(100) NOT NULL COMMENT 'Login username (could be student code or staff account)',
  `email` varchar(255) DEFAULT NULL COMMENT 'Email (optional)',
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'Password hash (NULL if using SSO)',
  `auth_provider` enum('local','sso','ldap','oauth') NOT NULL DEFAULT 'local' COMMENT 'Authentication provider',
  `display_name` varchar(255) NOT NULL COMMENT 'Display name shown in UI',
  `user_type` enum('student','staff','mixed') NOT NULL DEFAULT 'staff' COMMENT 'High-level user type',
  `faculty_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Faculty scope for staff/officer (activity visibility); NULL for global/admin',
  `person_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'FK to persons (nullable; link login user to person identity)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Active flag',
  `last_login_at` datetime DEFAULT NULL COMMENT 'Last login datetime',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='System users for authentication and auditing';

-- --------------------------------------------------------

--
-- Table structure for table `auth_user_roles`
--

CREATE TABLE `auth_user_roles` (
  `user_role_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of user-role mapping',
  `user_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to auth_users',
  `role_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to auth_roles',
  `scope_faculty_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Optional scope for this role (e.g., officer of faculty X)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mapping of users to roles with optional faculty scope';

-- --------------------------------------------------------

--
-- Table structure for table `comp_competencies`
--

CREATE TABLE `comp_competencies` (
  `competency_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(80) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `comp_curriculum_requirements`
--

CREATE TABLE `comp_curriculum_requirements` (
  `curriculum_requirement_id` bigint(20) UNSIGNED NOT NULL,
  `curriculum_id` bigint(20) UNSIGNED NOT NULL,
  `competency_id` bigint(20) UNSIGNED NOT NULL,
  `target_percent` decimal(6,2) NOT NULL DEFAULT 100.00,
  `is_required` tinyint(1) NOT NULL DEFAULT 1,
  `display_order` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `comp_templates`
--

CREATE TABLE `comp_templates` (
  `template_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of competency template',
  `faculty_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Owner faculty of this template',
  `code` varchar(80) NOT NULL COMMENT 'Unique code e.g., tpl_comp_comsci_2568',
  `name` varchar(255) NOT NULL COMMENT 'Display name e.g., ComSci Competency Template (2568)',
  `description` varchar(500) DEFAULT NULL COMMENT 'Optional description / notes',
  `version_year_be` smallint(5) UNSIGNED DEFAULT NULL COMMENT 'B.E. year (พ.ศ.) for this template (e.g., 2568)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Active flag',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Named competency templates per faculty (used to initialize new curricula)';

-- --------------------------------------------------------

--
-- Table structure for table `comp_template_items`
--

CREATE TABLE `comp_template_items` (
  `template_item_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of competency template item',
  `template_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to comp_templates',
  `competency_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to comp_competencies',
  `display_order` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Order in UI',
  `default_target_percent` decimal(6,2) DEFAULT NULL COMMENT 'Optional default target percent when generating curriculum requirements (e.g., 100.00)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Active flag (hide item without deleting)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Competency items inside a named template';

-- --------------------------------------------------------

--
-- Table structure for table `deliv_deliverables`
--

CREATE TABLE `deliv_deliverables` (
  `deliverable_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of deliverable (assignment/exam) under an activity',
  `activity_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Parent activity that owns this deliverable',
  `name_th` varchar(255) NOT NULL COMMENT 'Deliverable name in Thai',
  `name_en` varchar(255) DEFAULT NULL COMMENT 'Deliverable name in English',
  `deliverable_type` enum('submission','exam','quiz','presentation','other') NOT NULL COMMENT 'Type of deliverable',
  `description` text DEFAULT NULL COMMENT 'Instructions/description of the deliverable',
  `due_at` datetime DEFAULT NULL COMMENT 'Due datetime for submission (optional)',
  `max_raw_score` decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Maximum raw score for this deliverable',
  `allow_multiple_attempts` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether multiple attempts are allowed',
  `max_attempts` int(10) UNSIGNED DEFAULT NULL COMMENT 'Maximum attempts allowed (NULL means unlimited when allow_multiple_attempts=1)',
  `late_grace_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Grace period in minutes before marking as late',
  `late_penalty_factor` decimal(5,4) NOT NULL DEFAULT 1.0000 COMMENT 'Penalty multiplier when late (e.g. 0.8000 means 80%)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this deliverable is active and usable',
  `created_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who created this deliverable',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Deliverables (assignments/exams) defined under an activity';

-- --------------------------------------------------------

--
-- Table structure for table `deliv_deliverable_sessions`
--

CREATE TABLE `deliv_deliverable_sessions` (
  `deliverable_session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of deliverable-to-session mapping',
  `deliverable_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to activity_deliverables',
  `session_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to activity_sessions where this deliverable is applicable',
  `require_attendance` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'If 1, student must attend this session (or be eligible) before submitting',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Maps an activity deliverable to one or more sessions (supports multi-day activities)';

-- --------------------------------------------------------

--
-- Table structure for table `deliv_student_exam_attempts`
--

CREATE TABLE `deliv_student_exam_attempts` (
  `exam_attempt_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of exam attempt record',
  `deliverable_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to activity_deliverables',
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Person who takes the exam',
  `attempt_no` int(10) UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Attempt number (1,2,3...)',
  `status` enum('scheduled','started','submitted','graded','absent','cancelled') NOT NULL DEFAULT 'scheduled' COMMENT 'Exam attempt status lifecycle',
  `started_at` datetime DEFAULT NULL COMMENT 'Datetime when exam started',
  `submitted_at` datetime DEFAULT NULL COMMENT 'Datetime when exam submitted/finished',
  `duration_seconds` int(10) UNSIGNED DEFAULT NULL COMMENT 'Duration in seconds (optional)',
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'Raw exam score',
  `max_raw_score_snapshot` decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Snapshot of deliverable max_raw_score at grading time',
  `final_score` decimal(6,2) DEFAULT NULL COMMENT 'Final score (usually equals raw_score unless penalty applies)',
  `graded_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who graded this exam attempt',
  `graded_at` datetime DEFAULT NULL COMMENT 'Datetime when graded',
  `grader_notes` text DEFAULT NULL COMMENT 'Grader notes',
  `external_exam_ref` varchar(255) DEFAULT NULL COMMENT 'External exam system reference (future integration)',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Lock exam attempt after finalization',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when locked',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Exam attempts per activity deliverable (supports multiple attempts)';

-- --------------------------------------------------------

--
-- Table structure for table `deliv_student_submissions`
--

CREATE TABLE `deliv_student_submissions` (
  `submission_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of student submission',
  `deliverable_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to activity_deliverables',
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Person who submits',
  `attempt_no` int(10) UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Attempt number (1,2,3...)',
  `status` enum('draft','submitted','late','missing','graded','rejected') NOT NULL DEFAULT 'draft' COMMENT 'Submission status lifecycle',
  `submitted_at` datetime DEFAULT NULL COMMENT 'Datetime when submission was submitted',
  `due_at_snapshot` datetime DEFAULT NULL COMMENT 'Snapshot of due datetime at submission time (optional)',
  `late_minutes` int(10) UNSIGNED DEFAULT NULL COMMENT 'Minutes late compared to due_at_snapshot (optional)',
  `submission_text` longtext DEFAULT NULL COMMENT 'Optional text content of submission',
  `submission_url` varchar(1000) DEFAULT NULL COMMENT 'Optional URL for submission',
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'Raw score for this submission (before penalties)',
  `penalty_factor_snapshot` decimal(5,4) NOT NULL DEFAULT 1.0000 COMMENT 'Snapshot penalty multiplier applied (e.g. late penalty)',
  `final_score` decimal(6,2) DEFAULT NULL COMMENT 'Final score after penalty (raw_score * penalty_factor_snapshot)',
  `max_raw_score_snapshot` decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Snapshot of deliverable max_raw_score at grading time',
  `graded_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who graded this submission',
  `graded_at` datetime DEFAULT NULL COMMENT 'Datetime when graded',
  `grader_notes` text DEFAULT NULL COMMENT 'Grader feedback/notes',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Lock this submission after finalization',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when locked',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student submissions per activity deliverable (supports multiple attempts)';

-- --------------------------------------------------------

--
-- Table structure for table `deliv_student_submission_files`
--

CREATE TABLE `deliv_student_submission_files` (
  `submission_file_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of submission file record',
  `submission_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to student_deliverable_submissions',
  `storage_key` varchar(500) NOT NULL COMMENT 'Storage key/path (server path or object storage key)',
  `original_filename` varchar(255) NOT NULL COMMENT 'Original filename uploaded by student',
  `mime_type` varchar(100) DEFAULT NULL COMMENT 'MIME type',
  `file_size_bytes` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'File size in bytes',
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Datetime when file was uploaded',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Files attached to a student submission (multiple files supported)';

-- --------------------------------------------------------

--
-- Table structure for table `deliv_templates`
--

CREATE TABLE `deliv_templates` (
  `deliverable_template_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of deliverable template file',
  `deliverable_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to activity_deliverables',
  `storage_key` varchar(500) NOT NULL COMMENT 'Storage key/path of the template file (server path or object storage key)',
  `original_filename` varchar(255) NOT NULL COMMENT 'Original template filename (e.g., template.docx)',
  `mime_type` varchar(100) DEFAULT NULL COMMENT 'MIME type of the template file',
  `file_size_bytes` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Template file size in bytes',
  `uploaded_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who uploaded the template file',
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Datetime when template file was uploaded',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Template files for a deliverable (students download these to complete the work)';

-- --------------------------------------------------------

--
-- Table structure for table `edu_curricula`
--

CREATE TABLE `edu_curricula` (
  `curriculum_id` bigint(20) UNSIGNED NOT NULL,
  `major_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(80) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `effective_year` smallint(5) UNSIGNED NOT NULL,
  `status` enum('draft','active','retired') NOT NULL DEFAULT 'draft',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `edu_majors`
--

CREATE TABLE `edu_majors` (
  `major_id` bigint(20) UNSIGNED NOT NULL,
  `department_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `degree_level` enum('bachelor','master','phd','other') DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `kku_enrollments`
--

CREATE TABLE `kku_enrollments` (
  `enrollment_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of KKU enrollment record',
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to persons',
  `student_code` varchar(30) DEFAULT NULL COMMENT 'KKU student code (may be NULL if not officially student yet)',
  `faculty_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'KKU faculty (for visibility / ownership)',
  `major_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'KKU major',
  `entry_year_be` smallint(5) UNSIGNED DEFAULT NULL COMMENT 'Entry year in Buddhist Era (พ.ศ.)',
  `enrollment_status` enum('prospect','student','alumni','suspended','inactive') NOT NULL DEFAULT 'prospect' COMMENT 'Enrollment status at KKU',
  `is_kku_student` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Convenience flag: 1 if currently a student',
  `started_at` date DEFAULT NULL COMMENT 'Enrollment start date',
  `ended_at` date DEFAULT NULL COMMENT 'Enrollment end date (if any)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='KKU enrollment status & academic affiliation per person';

-- --------------------------------------------------------

--
-- Table structure for table `kku_enrollment_curricula`
--

CREATE TABLE `kku_enrollment_curricula` (
  `enrollment_curriculum_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of enrollment curriculum record',
  `enrollment_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to kku_enrollments',
  `curriculum_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to edu_curricula',
  `start_academic_year_be` smallint(5) UNSIGNED NOT NULL COMMENT 'Start academic year in Buddhist Era (พ.ศ.)',
  `start_semester` tinyint(3) UNSIGNED NOT NULL COMMENT 'Start semester (1/2/3 if summer)',
  `end_academic_year_be` smallint(5) UNSIGNED DEFAULT NULL COMMENT 'End academic year in Buddhist Era (พ.ศ.), NULL if current',
  `end_semester` tinyint(3) UNSIGNED DEFAULT NULL COMMENT 'End semester, NULL if current',
  `is_current` tinyint(1) DEFAULT NULL COMMENT 'Current flag: 1=current, NULL=historical (default NULL to avoid accidental current rows)',
  `change_reason` enum('initial','curriculum_change','major_change','other') NOT NULL DEFAULT 'initial' COMMENT 'Reason for curriculum assignment/change',
  `note` varchar(500) DEFAULT NULL COMMENT 'Optional note',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Curriculum history per KKU enrollment';

-- --------------------------------------------------------

--
-- Table structure for table `org_departments`
--

CREATE TABLE `org_departments` (
  `department_id` bigint(20) UNSIGNED NOT NULL,
  `faculty_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `org_faculties`
--

CREATE TABLE `org_faculties` (
  `faculty_id` bigint(20) UNSIGNED NOT NULL,
  `university_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `org_universities`
--

CREATE TABLE `org_universities` (
  `university_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `persons`
--

CREATE TABLE `persons` (
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key for person',
  `national_id` char(13) DEFAULT NULL COMMENT 'Thai national ID (unique when present)',
  `passport_no` varchar(30) DEFAULT NULL COMMENT 'Passport number for non-Thai (optional)',
  `prefix_th` varchar(50) DEFAULT NULL COMMENT 'Thai prefix',
  `first_name_th` varchar(120) DEFAULT NULL COMMENT 'Thai first name',
  `last_name_th` varchar(120) DEFAULT NULL COMMENT 'Thai last name',
  `first_name_en` varchar(120) DEFAULT NULL COMMENT 'English first name',
  `last_name_en` varchar(120) DEFAULT NULL COMMENT 'English last name',
  `email` varchar(255) DEFAULT NULL COMMENT 'Email',
  `phone` varchar(50) DEFAULT NULL COMMENT 'Phone',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Person master data (identity)';

-- --------------------------------------------------------

--
-- Table structure for table `score_session_competency_evidences`
--

CREATE TABLE `score_session_competency_evidences` (
  `session_competency_evidence_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of score evidence record',
  `score_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to session_competency_scores',
  `evidence_type` enum('submission','exam','external','other') NOT NULL COMMENT 'Type of evidence linked to this competency score',
  `submission_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Reference to student_deliverable_submissions.id when evidence_type=submission',
  `exam_attempt_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Reference to student_deliverable_exam_attempts.id when evidence_type=exam',
  `external_ref` varchar(255) DEFAULT NULL COMMENT 'External reference (e.g., exam sheet id, Google Form response id) when evidence is outside the system',
  `note` varchar(500) DEFAULT NULL COMMENT 'Optional note about this evidence',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Links competency scores to multiple evidence records (submission/exam/external)';

-- --------------------------------------------------------

--
-- Table structure for table `score_session_competency_results`
--

CREATE TABLE `score_session_competency_results` (
  `session_competency_result_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of computed competency result',
  `score_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to session_competency_scores (source of computation)',
  `max_percent_snapshot` decimal(6,2) NOT NULL COMMENT 'Snapshot of max_percent from session_competencies at computation time',
  `factor_snapshot` decimal(7,6) NOT NULL COMMENT 'Snapshot of normalization factor (final_score / max_raw_score_snapshot)',
  `earned_percent` decimal(6,2) NOT NULL COMMENT 'Computed earned percent contributed to the competency from this session',
  `computed_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID or system user who computed the result',
  `computed_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Datetime when result was computed',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Lock computed result to prevent changes (historical record)',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when computed result was locked',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stored computed earned percent per score record (snapshotted + lockable)';

-- --------------------------------------------------------

--
-- Table structure for table `score_session_competency_scores`
--

CREATE TABLE `score_session_competency_scores` (
  `session_competency_score_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Primary key of score record',
  `session_competency_id` bigint(20) UNSIGNED NOT NULL COMMENT 'FK to session_competencies (ensures competency is configured for this session)',
  `person_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Person who is being scored',
  `grading_source` enum('attendance','manual','submission','exam','hybrid','system') NOT NULL DEFAULT 'manual' COMMENT 'Where this score comes from',
  `raw_score` decimal(6,2) DEFAULT NULL COMMENT 'Raw score before penalty (NULL allowed if not graded yet)',
  `max_raw_score_snapshot` decimal(6,2) NOT NULL DEFAULT 100.00 COMMENT 'Snapshot of max raw score used for normalization at grading time',
  `attendance_status_snapshot` enum('present','late','absent','excused') DEFAULT NULL COMMENT 'Snapshot of attendance status at grading time (optional but useful for audit)',
  `penalty_factor_snapshot` decimal(5,4) NOT NULL DEFAULT 1.0000 COMMENT 'Snapshot multiplier applied to raw_score (e.g. late penalty 0.8000)',
  `final_score` decimal(6,2) DEFAULT NULL COMMENT 'Final score after applying penalty (raw_score * penalty_factor_snapshot)',
  `graded_by` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'User ID who graded this competency score',
  `graded_at` datetime DEFAULT NULL COMMENT 'Datetime when this competency score was graded',
  `notes` varchar(500) DEFAULT NULL COMMENT 'Optional notes for this score',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Lock the score record to prevent changes after session is finalized',
  `locked_at` datetime DEFAULT NULL COMMENT 'Datetime when the score record was locked',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Record last update timestamp',
  `deleted_at` datetime DEFAULT NULL COMMENT 'Soft delete timestamp'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Raw/final score per student per session competency (score is separated per competency)';

--
-- Indexes for dumped tables
--

--
-- Indexes for table `act_activities`
--
ALTER TABLE `act_activities`
  ADD PRIMARY KEY (`activity_id`),
  ADD KEY `idx_activities_faculty` (`faculty_id`),
  ADD KEY `idx_activities_status` (`status`),
  ADD KEY `idx_activities_deleted_at` (`deleted_at`);

--
-- Indexes for table `act_faculty_policies`
--
ALTER TABLE `act_faculty_policies`
  ADD PRIMARY KEY (`faculty_policy_id`),
  ADD UNIQUE KEY `uq_faculty_policy` (`faculty_id`),
  ADD KEY `idx_fap_faculty` (`faculty_id`),
  ADD KEY `idx_fap_deleted_at` (`deleted_at`);

--
-- Indexes for table `act_sessions`
--
ALTER TABLE `act_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD UNIQUE KEY `uq_activity_session_no` (`activity_id`,`session_no`),
  ADD KEY `idx_sessions_activity` (`activity_id`),
  ADD KEY `idx_sessions_status` (`status`),
  ADD KEY `idx_sessions_deleted_at` (`deleted_at`),
  ADD KEY `idx_sessions_finalized` (`is_finalized`),
  ADD KEY `idx_sessions_finalized_at` (`finalized_at`);

--
-- Indexes for table `act_session_assignments`
--
ALTER TABLE `act_session_assignments`
  ADD PRIMARY KEY (`session_assignment_id`),
  ADD UNIQUE KEY `uq_session_user_assignment_role` (`session_id`,`user_id`,`assignment_role`),
  ADD KEY `idx_asa_session` (`session_id`),
  ADD KEY `idx_asa_user` (`user_id`),
  ADD KEY `idx_asa_deleted_at` (`deleted_at`);

--
-- Indexes for table `act_session_competencies`
--
ALTER TABLE `act_session_competencies`
  ADD PRIMARY KEY (`session_competency_id`),
  ADD UNIQUE KEY `uq_session_competency` (`session_id`,`competency_id`),
  ADD KEY `idx_sc_session` (`session_id`),
  ADD KEY `idx_sc_competency` (`competency_id`),
  ADD KEY `idx_sc_deleted_at` (`deleted_at`);

--
-- Indexes for table `act_session_registrations`
--
ALTER TABLE `act_session_registrations`
  ADD PRIMARY KEY (`session_registration_id`),
  ADD UNIQUE KEY `uq_asr_session_student` (`session_id`,`person_id`),
  ADD KEY `idx_asr_session` (`session_id`),
  ADD KEY `idx_asr_student` (`person_id`),
  ADD KEY `idx_asr_status` (`status`),
  ADD KEY `idx_asr_deleted_at` (`deleted_at`);

--
-- Indexes for table `att_session_attendances`
--
ALTER TABLE `att_session_attendances`
  ADD PRIMARY KEY (`session_attendance_id`),
  ADD UNIQUE KEY `uq_session_student` (`session_id`,`person_id`),
  ADD KEY `idx_sa_session` (`session_id`),
  ADD KEY `idx_sa_student` (`person_id`),
  ADD KEY `idx_sa_status` (`status`),
  ADD KEY `idx_sa_deleted_at` (`deleted_at`);

--
-- Indexes for table `auth_roles`
--
ALTER TABLE `auth_roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `uq_auth_roles_code` (`code`),
  ADD KEY `idx_auth_roles_deleted_at` (`deleted_at`);

--
-- Indexes for table `auth_users`
--
ALTER TABLE `auth_users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `uq_auth_users_username` (`username`),
  ADD UNIQUE KEY `uq_auth_users_email` (`email`),
  ADD KEY `idx_auth_users_faculty` (`faculty_id`),
  ADD KEY `idx_auth_users_deleted_at` (`deleted_at`),
  ADD KEY `idx_auth_users_person` (`person_id`);

--
-- Indexes for table `auth_user_roles`
--
ALTER TABLE `auth_user_roles`
  ADD PRIMARY KEY (`user_role_id`),
  ADD UNIQUE KEY `uq_auth_user_roles` (`user_id`,`role_id`,`scope_faculty_id`),
  ADD KEY `idx_aur_user` (`user_id`),
  ADD KEY `idx_aur_role` (`role_id`),
  ADD KEY `idx_aur_deleted_at` (`deleted_at`),
  ADD KEY `fk_aur_scope_faculty` (`scope_faculty_id`);

--
-- Indexes for table `comp_competencies`
--
ALTER TABLE `comp_competencies`
  ADD PRIMARY KEY (`competency_id`),
  ADD UNIQUE KEY `uq_competencies_code` (`code`),
  ADD KEY `idx_competencies_deleted_at` (`deleted_at`),
  ADD KEY `idx_competencies_active` (`is_active`);

--
-- Indexes for table `comp_curriculum_requirements`
--
ALTER TABLE `comp_curriculum_requirements`
  ADD PRIMARY KEY (`curriculum_requirement_id`),
  ADD UNIQUE KEY `uq_ccr_curriculum_competency` (`curriculum_id`,`competency_id`),
  ADD KEY `idx_ccr_curriculum` (`curriculum_id`),
  ADD KEY `idx_ccr_competency` (`competency_id`),
  ADD KEY `idx_ccr_deleted_at` (`deleted_at`);

--
-- Indexes for table `comp_templates`
--
ALTER TABLE `comp_templates`
  ADD PRIMARY KEY (`template_id`),
  ADD UNIQUE KEY `uq_comp_templates_faculty_code` (`faculty_id`,`code`),
  ADD KEY `idx_comp_templates_faculty` (`faculty_id`),
  ADD KEY `idx_comp_templates_deleted_at` (`deleted_at`);

--
-- Indexes for table `comp_template_items`
--
ALTER TABLE `comp_template_items`
  ADD PRIMARY KEY (`template_item_id`),
  ADD UNIQUE KEY `uq_cti_template_competency` (`template_id`,`competency_id`),
  ADD KEY `idx_cti_template` (`template_id`),
  ADD KEY `idx_cti_competency` (`competency_id`),
  ADD KEY `idx_cti_deleted_at` (`deleted_at`);

--
-- Indexes for table `deliv_deliverables`
--
ALTER TABLE `deliv_deliverables`
  ADD PRIMARY KEY (`deliverable_id`),
  ADD KEY `idx_ad_activity` (`activity_id`),
  ADD KEY `idx_ad_type` (`deliverable_type`),
  ADD KEY `idx_ad_deleted_at` (`deleted_at`);

--
-- Indexes for table `deliv_deliverable_sessions`
--
ALTER TABLE `deliv_deliverable_sessions`
  ADD PRIMARY KEY (`deliverable_session_id`),
  ADD UNIQUE KEY `uq_ads_deliverable_session` (`deliverable_id`,`session_id`),
  ADD KEY `idx_ads_deliverable` (`deliverable_id`),
  ADD KEY `idx_ads_session` (`session_id`),
  ADD KEY `idx_ads_deleted_at` (`deleted_at`);

--
-- Indexes for table `deliv_student_exam_attempts`
--
ALTER TABLE `deliv_student_exam_attempts`
  ADD PRIMARY KEY (`exam_attempt_id`),
  ADD UNIQUE KEY `uq_sdea_attempt` (`deliverable_id`,`person_id`,`attempt_no`),
  ADD KEY `idx_sdea_deliverable` (`deliverable_id`),
  ADD KEY `idx_sdea_student` (`person_id`),
  ADD KEY `idx_sdea_status` (`status`),
  ADD KEY `idx_sdea_deleted_at` (`deleted_at`);

--
-- Indexes for table `deliv_student_submissions`
--
ALTER TABLE `deliv_student_submissions`
  ADD PRIMARY KEY (`submission_id`),
  ADD UNIQUE KEY `uq_sds_attempt` (`deliverable_id`,`person_id`,`attempt_no`),
  ADD KEY `idx_sds_deliverable` (`deliverable_id`),
  ADD KEY `idx_sds_student` (`person_id`),
  ADD KEY `idx_sds_status` (`status`),
  ADD KEY `idx_sds_deleted_at` (`deleted_at`);

--
-- Indexes for table `deliv_student_submission_files`
--
ALTER TABLE `deliv_student_submission_files`
  ADD PRIMARY KEY (`submission_file_id`),
  ADD KEY `idx_sdsf_submission` (`submission_id`),
  ADD KEY `idx_sdsf_deleted_at` (`deleted_at`);

--
-- Indexes for table `deliv_templates`
--
ALTER TABLE `deliv_templates`
  ADD PRIMARY KEY (`deliverable_template_id`),
  ADD KEY `idx_adt_deliverable` (`deliverable_id`),
  ADD KEY `idx_adt_deleted_at` (`deleted_at`);

--
-- Indexes for table `edu_curricula`
--
ALTER TABLE `edu_curricula`
  ADD PRIMARY KEY (`curriculum_id`),
  ADD UNIQUE KEY `uq_curricula_major_year` (`major_id`,`effective_year`),
  ADD UNIQUE KEY `uq_curricula_major_code` (`major_id`,`code`),
  ADD KEY `idx_curricula_major` (`major_id`),
  ADD KEY `idx_curricula_status` (`status`),
  ADD KEY `idx_curricula_deleted_at` (`deleted_at`);

--
-- Indexes for table `edu_majors`
--
ALTER TABLE `edu_majors`
  ADD PRIMARY KEY (`major_id`),
  ADD UNIQUE KEY `uq_majors_department_code` (`department_id`,`code`),
  ADD KEY `idx_majors_department` (`department_id`),
  ADD KEY `idx_majors_deleted_at` (`deleted_at`);

--
-- Indexes for table `kku_enrollments`
--
ALTER TABLE `kku_enrollments`
  ADD PRIMARY KEY (`enrollment_id`),
  ADD UNIQUE KEY `uq_kku_student_code` (`student_code`),
  ADD KEY `idx_kku_enroll_person` (`person_id`),
  ADD KEY `idx_kku_enroll_faculty` (`faculty_id`),
  ADD KEY `idx_kku_enroll_major` (`major_id`),
  ADD KEY `idx_kku_enroll_deleted_at` (`deleted_at`);

--
-- Indexes for table `kku_enrollment_curricula`
--
ALTER TABLE `kku_enrollment_curricula`
  ADD PRIMARY KEY (`enrollment_curriculum_id`),
  ADD UNIQUE KEY `uq_kec_one_current` (`enrollment_id`,`is_current`),
  ADD KEY `idx_kec_enrollment` (`enrollment_id`),
  ADD KEY `idx_kec_curriculum` (`curriculum_id`),
  ADD KEY `idx_kec_deleted_at` (`deleted_at`);

--
-- Indexes for table `org_departments`
--
ALTER TABLE `org_departments`
  ADD PRIMARY KEY (`department_id`),
  ADD UNIQUE KEY `uq_departments_faculty_code` (`faculty_id`,`code`),
  ADD KEY `idx_departments_faculty` (`faculty_id`),
  ADD KEY `idx_departments_deleted_at` (`deleted_at`);

--
-- Indexes for table `org_faculties`
--
ALTER TABLE `org_faculties`
  ADD PRIMARY KEY (`faculty_id`),
  ADD UNIQUE KEY `uq_faculties_university_code` (`university_id`,`code`),
  ADD KEY `idx_faculties_university` (`university_id`),
  ADD KEY `idx_faculties_deleted_at` (`deleted_at`);

--
-- Indexes for table `org_universities`
--
ALTER TABLE `org_universities`
  ADD PRIMARY KEY (`university_id`),
  ADD UNIQUE KEY `uq_universities_code` (`code`),
  ADD KEY `idx_universities_deleted_at` (`deleted_at`);

--
-- Indexes for table `persons`
--
ALTER TABLE `persons`
  ADD PRIMARY KEY (`person_id`),
  ADD UNIQUE KEY `uq_persons_national_id` (`national_id`),
  ADD UNIQUE KEY `uq_persons_passport_no` (`passport_no`),
  ADD KEY `idx_persons_deleted_at` (`deleted_at`);

--
-- Indexes for table `score_session_competency_evidences`
--
ALTER TABLE `score_session_competency_evidences`
  ADD PRIMARY KEY (`session_competency_evidence_id`),
  ADD KEY `idx_scse_score` (`score_id`),
  ADD KEY `idx_scse_submission` (`submission_id`),
  ADD KEY `idx_scse_exam_attempt` (`exam_attempt_id`),
  ADD KEY `idx_scse_deleted_at` (`deleted_at`);

--
-- Indexes for table `score_session_competency_results`
--
ALTER TABLE `score_session_competency_results`
  ADD PRIMARY KEY (`session_competency_result_id`),
  ADD UNIQUE KEY `uq_scr_score_id` (`score_id`),
  ADD KEY `idx_scr_deleted_at` (`deleted_at`),
  ADD KEY `idx_scr_computed_at` (`computed_at`);

--
-- Indexes for table `score_session_competency_scores`
--
ALTER TABLE `score_session_competency_scores`
  ADD PRIMARY KEY (`session_competency_score_id`),
  ADD UNIQUE KEY `uq_scs_session_competency_student` (`session_competency_id`,`person_id`),
  ADD KEY `idx_scs_session_competency` (`session_competency_id`),
  ADD KEY `idx_scs_student` (`person_id`),
  ADD KEY `idx_scs_graded_at` (`graded_at`),
  ADD KEY `idx_scs_deleted_at` (`deleted_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `act_activities`
--
ALTER TABLE `act_activities`
  MODIFY `activity_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of activity';

--
-- AUTO_INCREMENT for table `act_faculty_policies`
--
ALTER TABLE `act_faculty_policies`
  MODIFY `faculty_policy_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of faculty activity policy';

--
-- AUTO_INCREMENT for table `act_sessions`
--
ALTER TABLE `act_sessions`
  MODIFY `session_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of activity session';

--
-- AUTO_INCREMENT for table `act_session_assignments`
--
ALTER TABLE `act_session_assignments`
  MODIFY `session_assignment_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session assignment';

--
-- AUTO_INCREMENT for table `act_session_competencies`
--
ALTER TABLE `act_session_competencies`
  MODIFY `session_competency_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session-competency mapping';

--
-- AUTO_INCREMENT for table `act_session_registrations`
--
ALTER TABLE `act_session_registrations`
  MODIFY `session_registration_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session registration';

--
-- AUTO_INCREMENT for table `att_session_attendances`
--
ALTER TABLE `att_session_attendances`
  MODIFY `session_attendance_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of session attendance';

--
-- AUTO_INCREMENT for table `auth_roles`
--
ALTER TABLE `auth_roles`
  MODIFY `role_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of role', AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `auth_users`
--
ALTER TABLE `auth_users`
  MODIFY `user_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of user';

--
-- AUTO_INCREMENT for table `auth_user_roles`
--
ALTER TABLE `auth_user_roles`
  MODIFY `user_role_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of user-role mapping';

--
-- AUTO_INCREMENT for table `comp_competencies`
--
ALTER TABLE `comp_competencies`
  MODIFY `competency_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `comp_curriculum_requirements`
--
ALTER TABLE `comp_curriculum_requirements`
  MODIFY `curriculum_requirement_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `comp_templates`
--
ALTER TABLE `comp_templates`
  MODIFY `template_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of competency template';

--
-- AUTO_INCREMENT for table `comp_template_items`
--
ALTER TABLE `comp_template_items`
  MODIFY `template_item_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of competency template item';

--
-- AUTO_INCREMENT for table `deliv_deliverables`
--
ALTER TABLE `deliv_deliverables`
  MODIFY `deliverable_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of deliverable (assignment/exam) under an activity';

--
-- AUTO_INCREMENT for table `deliv_deliverable_sessions`
--
ALTER TABLE `deliv_deliverable_sessions`
  MODIFY `deliverable_session_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of deliverable-to-session mapping';

--
-- AUTO_INCREMENT for table `deliv_student_exam_attempts`
--
ALTER TABLE `deliv_student_exam_attempts`
  MODIFY `exam_attempt_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of exam attempt record';

--
-- AUTO_INCREMENT for table `deliv_student_submissions`
--
ALTER TABLE `deliv_student_submissions`
  MODIFY `submission_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of student submission';

--
-- AUTO_INCREMENT for table `deliv_student_submission_files`
--
ALTER TABLE `deliv_student_submission_files`
  MODIFY `submission_file_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of submission file record';

--
-- AUTO_INCREMENT for table `deliv_templates`
--
ALTER TABLE `deliv_templates`
  MODIFY `deliverable_template_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of deliverable template file';

--
-- AUTO_INCREMENT for table `edu_curricula`
--
ALTER TABLE `edu_curricula`
  MODIFY `curriculum_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `edu_majors`
--
ALTER TABLE `edu_majors`
  MODIFY `major_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kku_enrollments`
--
ALTER TABLE `kku_enrollments`
  MODIFY `enrollment_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of KKU enrollment record';

--
-- AUTO_INCREMENT for table `kku_enrollment_curricula`
--
ALTER TABLE `kku_enrollment_curricula`
  MODIFY `enrollment_curriculum_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of enrollment curriculum record';

--
-- AUTO_INCREMENT for table `org_departments`
--
ALTER TABLE `org_departments`
  MODIFY `department_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `org_faculties`
--
ALTER TABLE `org_faculties`
  MODIFY `faculty_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `org_universities`
--
ALTER TABLE `org_universities`
  MODIFY `university_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `persons`
--
ALTER TABLE `persons`
  MODIFY `person_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key for person';

--
-- AUTO_INCREMENT for table `score_session_competency_evidences`
--
ALTER TABLE `score_session_competency_evidences`
  MODIFY `session_competency_evidence_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of score evidence record';

--
-- AUTO_INCREMENT for table `score_session_competency_results`
--
ALTER TABLE `score_session_competency_results`
  MODIFY `session_competency_result_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of computed competency result';

--
-- AUTO_INCREMENT for table `score_session_competency_scores`
--
ALTER TABLE `score_session_competency_scores`
  MODIFY `session_competency_score_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Primary key of score record';

--
-- Constraints for dumped tables
--

--
-- Constraints for table `act_activities`
--
ALTER TABLE `act_activities`
  ADD CONSTRAINT `fk_activities_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE;

--
-- Constraints for table `act_faculty_policies`
--
ALTER TABLE `act_faculty_policies`
  ADD CONSTRAINT `fk_fap_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE;

--
-- Constraints for table `act_sessions`
--
ALTER TABLE `act_sessions`
  ADD CONSTRAINT `fk_sessions_activity` FOREIGN KEY (`activity_id`) REFERENCES `act_activities` (`activity_id`) ON UPDATE CASCADE;

--
-- Constraints for table `act_session_assignments`
--
ALTER TABLE `act_session_assignments`
  ADD CONSTRAINT `fk_asa_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_asa_user` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`user_id`) ON UPDATE CASCADE;

--
-- Constraints for table `act_session_competencies`
--
ALTER TABLE `act_session_competencies`
  ADD CONSTRAINT `fk_sc_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sc_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE;

--
-- Constraints for table `act_session_registrations`
--
ALTER TABLE `act_session_registrations`
  ADD CONSTRAINT `fk_asr_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_asr_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE;

--
-- Constraints for table `att_session_attendances`
--
ALTER TABLE `att_session_attendances`
  ADD CONSTRAINT `fk_att_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sa_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE;

--
-- Constraints for table `auth_users`
--
ALTER TABLE `auth_users`
  ADD CONSTRAINT `fk_auth_users_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_auth_users_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `auth_user_roles`
--
ALTER TABLE `auth_user_roles`
  ADD CONSTRAINT `fk_aur_role` FOREIGN KEY (`role_id`) REFERENCES `auth_roles` (`role_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aur_scope_faculty` FOREIGN KEY (`scope_faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_aur_user` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`user_id`) ON UPDATE CASCADE;

--
-- Constraints for table `comp_curriculum_requirements`
--
ALTER TABLE `comp_curriculum_requirements`
  ADD CONSTRAINT `fk_ccr_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ccr_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE;

--
-- Constraints for table `comp_templates`
--
ALTER TABLE `comp_templates`
  ADD CONSTRAINT `fk_comp_templates_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE;

--
-- Constraints for table `comp_template_items`
--
ALTER TABLE `comp_template_items`
  ADD CONSTRAINT `fk_cti_competency` FOREIGN KEY (`competency_id`) REFERENCES `comp_competencies` (`competency_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_cti_template` FOREIGN KEY (`template_id`) REFERENCES `comp_templates` (`template_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deliv_deliverables`
--
ALTER TABLE `deliv_deliverables`
  ADD CONSTRAINT `fk_ad_activity` FOREIGN KEY (`activity_id`) REFERENCES `act_activities` (`activity_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deliv_deliverable_sessions`
--
ALTER TABLE `deliv_deliverable_sessions`
  ADD CONSTRAINT `fk_ads_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ads_session` FOREIGN KEY (`session_id`) REFERENCES `act_sessions` (`session_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deliv_student_exam_attempts`
--
ALTER TABLE `deliv_student_exam_attempts`
  ADD CONSTRAINT `fk_deliv_exam_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sdea_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deliv_student_submissions`
--
ALTER TABLE `deliv_student_submissions`
  ADD CONSTRAINT `fk_deliv_submissions_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sds_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deliv_student_submission_files`
--
ALTER TABLE `deliv_student_submission_files`
  ADD CONSTRAINT `fk_sdsf_submission` FOREIGN KEY (`submission_id`) REFERENCES `deliv_student_submissions` (`submission_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deliv_templates`
--
ALTER TABLE `deliv_templates`
  ADD CONSTRAINT `fk_adt_deliverable` FOREIGN KEY (`deliverable_id`) REFERENCES `deliv_deliverables` (`deliverable_id`) ON UPDATE CASCADE;

--
-- Constraints for table `edu_curricula`
--
ALTER TABLE `edu_curricula`
  ADD CONSTRAINT `fk_curricula_major` FOREIGN KEY (`major_id`) REFERENCES `edu_majors` (`major_id`) ON UPDATE CASCADE;

--
-- Constraints for table `edu_majors`
--
ALTER TABLE `edu_majors`
  ADD CONSTRAINT `fk_majors_department` FOREIGN KEY (`department_id`) REFERENCES `org_departments` (`department_id`) ON UPDATE CASCADE;

--
-- Constraints for table `kku_enrollments`
--
ALTER TABLE `kku_enrollments`
  ADD CONSTRAINT `fk_kku_enroll_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_kku_enroll_major` FOREIGN KEY (`major_id`) REFERENCES `edu_majors` (`major_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_kku_enroll_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE;

--
-- Constraints for table `kku_enrollment_curricula`
--
ALTER TABLE `kku_enrollment_curricula`
  ADD CONSTRAINT `fk_kec_curriculum` FOREIGN KEY (`curriculum_id`) REFERENCES `edu_curricula` (`curriculum_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_kec_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `kku_enrollments` (`enrollment_id`) ON UPDATE CASCADE;

--
-- Constraints for table `org_departments`
--
ALTER TABLE `org_departments`
  ADD CONSTRAINT `fk_departments_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `org_faculties` (`faculty_id`) ON UPDATE CASCADE;

--
-- Constraints for table `org_faculties`
--
ALTER TABLE `org_faculties`
  ADD CONSTRAINT `fk_faculties_university` FOREIGN KEY (`university_id`) REFERENCES `org_universities` (`university_id`) ON UPDATE CASCADE;

--
-- Constraints for table `score_session_competency_evidences`
--
ALTER TABLE `score_session_competency_evidences`
  ADD CONSTRAINT `fk_scse_score` FOREIGN KEY (`score_id`) REFERENCES `score_session_competency_scores` (`session_competency_score_id`) ON UPDATE CASCADE;

--
-- Constraints for table `score_session_competency_results`
--
ALTER TABLE `score_session_competency_results`
  ADD CONSTRAINT `fk_scr_score` FOREIGN KEY (`score_id`) REFERENCES `score_session_competency_scores` (`session_competency_score_id`) ON UPDATE CASCADE;

--
-- Constraints for table `score_session_competency_scores`
--
ALTER TABLE `score_session_competency_scores`
  ADD CONSTRAINT `fk_score_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`person_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_scs_session_competency` FOREIGN KEY (`session_competency_id`) REFERENCES `act_session_competencies` (`session_competency_id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
