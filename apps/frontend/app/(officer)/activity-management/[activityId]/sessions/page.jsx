"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import ToastNotifications from "../../../../../components/ui/ToastNotifications";
import BaseModal from "../../../../../components/ui/BaseModal";
import ConfirmActionModal from "../../../../../components/ui/ConfirmActionModal";
import { useLanguage } from "../../../../../providers/LanguageContext";
import { fetchActivity } from "../../../../../lib/activity";
import { fetchCompetenciesForManagement } from "../../../../../lib/competency-management";
import {
  createActivitySession,
  deleteActivitySession,
  fetchActivitySession,
  fetchActivitySessions,
  fetchSessionAssigneeOptions,
  finalizeActivitySession,
  replaceSessionAssignments,
  replaceSessionCompetencies,
  updateActivitySession,
  updateActivitySessionStatus,
} from "../../../../../lib/activity-session";
import "../../../curriculum-management/CourseLayout.css";
import "../../../curriculum-management/CourseList.css";
import "../../ActivityManagement.css";
import "./ActivitySessionManagement.css";

const TAB_OPTIONS = [
  { id: "info", label: "ข้อมูลรอบกิจกรรม" },
  { id: "assignments", label: "ผู้รับผิดชอบ" },
  { id: "competencies", label: "Competency Mapping" },
];

const ASSIGNMENT_ROLE_OPTIONS = [
  { value: "lecturer", label: "อาจารย์/วิทยากร" },
  { value: "officer", label: "เจ้าหน้าที่" },
  { value: "assistant", label: "ผู้ช่วย" },
  { value: "supervisor", label: "ผู้ดูแล" },
];

const GRADING_MODE_OPTIONS = [
  { value: "attendance_only" },
  { value: "manual_score" },
  { value: "submission" },
  { value: "exam" },
  { value: "hybrid" },
];

const GRADING_MODE_LABELS = {
  th: {
    attendance_only: "ให้คะแนนจากการเข้ากิจกรรม",
    manual_score: "กรอกคะแนนเอง",
    submission: "ให้คะแนนจากงานที่ส่ง",
    exam: "ให้คะแนนจากการสอบ",
    hybrid: "ให้คะแนนแบบผสม",
  },
  en: {
    attendance_only: "Score from attendance",
    manual_score: "Manual score entry",
    submission: "Score from submitted work",
    exam: "Score from exam",
    hybrid: "Hybrid scoring",
  },
};

function gradingModeLabel(value, language) {
  return (
    GRADING_MODE_LABELS[language]?.[value] ||
    GRADING_MODE_LABELS.en[value] ||
    value
  );
}

const EMPTY_CONFIRM = { type: "", session: null };

const BACKEND_SESSION_MESSAGE_TH = {
  "activity not found": "ไม่พบกิจกรรม",
  "activity session not found": "ไม่พบรอบกิจกรรม",
  "insufficient activity session scope": "คุณไม่มีสิทธิ์จัดการรอบกิจกรรมนี้",
  "closed or cancelled activity sessions are read-only":
    "กิจกรรมที่ปิดหรือยกเลิกแล้วไม่สามารถแก้ไขรอบกิจกรรมได้",
  "finalized session cannot be changed":
    "รอบกิจกรรมนี้ถูก Finalize แล้ว ไม่สามารถแก้ไขได้",
  "session is already finalized": "รอบกิจกรรมนี้ถูก Finalize แล้ว",
  "cancelled session cannot be changed":
    "รอบกิจกรรมที่ยกเลิกแล้วไม่สามารถแก้ไขได้",
  "cancelled session cannot be finalized":
    "รอบกิจกรรมที่ยกเลิกแล้วไม่สามารถ Finalize ได้",
  "session status can only change from scheduled":
    "เปลี่ยนสถานะได้เฉพาะรอบกิจกรรมที่ยัง Scheduled",
  "invalid session status transition":
    "ไม่สามารถเปลี่ยนสถานะรอบกิจกรรมตามลำดับนี้ได้",
  "start_at is required": "กรุณาระบุวันเวลาเริ่มต้น",
  "end_at is required": "กรุณาระบุวันเวลาสิ้นสุด",
  "start_at must be before end_at": "เวลาเริ่มต้นต้องมาก่อนเวลาสิ้นสุด",
  "late_at is invalid": "กำหนดเวลาสายไม่ถูกต้อง",
  "late_at must be after start_at":
    "กำหนดเวลาสายต้องไม่เร็วกว่ารอบกิจกรรมเริ่ม",
  "late_at must be before end_at":
    "กำหนดเวลาสายต้องอยู่ก่อนเวลาสิ้นสุดรอบกิจกรรม",
  "grading_mode is invalid": "รูปแบบการประเมินไม่ถูกต้อง",
  "max_raw_score must be greater than 0": "คะแนนเต็มต้องมากกว่า 0",
  "pass_threshold is invalid": "เกณฑ์ผ่านไม่ถูกต้อง",
  "late_penalty_factor is invalid": "ตัวคูณหักคะแนนการมาสายไม่ถูกต้อง",
  "assignment user_id is required": "กรุณาเลือกผู้รับผิดชอบ",
  "assignment_role is invalid": "บทบาทผู้รับผิดชอบไม่ถูกต้อง",
  "duplicate assignee role in payload": "มีผู้รับผิดชอบบทบาทเดียวกันซ้ำ",
  "assignee must be active staff in activity faculty":
    "เลือกได้เฉพาะ staff ที่ยังใช้งานอยู่ในคณะของกิจกรรมนี้",
  "competency_id is required": "กรุณาเลือก Competency",
  "max_percent is invalid": "สัดส่วน Competency ต้องมากกว่า 0 และไม่เกิน 100",
  "duplicate competency in payload": "มี Competency ซ้ำในรอบกิจกรรมนี้",
  "competency is not active": "Competency นี้ไม่พร้อมใช้งาน",
  "session needs at least one assignee before finalize":
    "ต้องมีผู้รับผิดชอบอย่างน้อย 1 คนก่อน Finalize",
  "session needs at least one competency before finalize":
    "ต้องมี Competency อย่างน้อย 1 รายการก่อน Finalize",
  "session competency percent total must equal 100":
    "สัดส่วน Competency รวมต้องเท่ากับ 100% ก่อน Finalize",
  "finalized session cannot be deleted":
    "ไม่สามารถลบรอบกิจกรรมที่ Finalize แล้ว",
  "session cannot be deleted because registration or attendance exists":
    "รอบกิจกรรมนี้มีข้อมูลลงทะเบียนหรือเช็กชื่อแล้ว ให้ยกเลิกแทนการลบ",
  "activity session operation failed": "ไม่สามารถดำเนินการกับรอบกิจกรรมได้",
};

function mapSessionError(error) {
  const message = error?.message || error?.payload?.error?.message || "";
  return (
    BACKEND_SESSION_MESSAGE_TH[message] ||
    message ||
    "ไม่สามารถดำเนินการกับรอบกิจกรรมได้"
  );
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function datePart(value) {
  return String(value || "").split("T")[0] || "";
}

function timePart(value) {
  return (
    String(value || "")
      .split("T")[1]
      ?.slice(0, 5) || ""
  );
}

function combineDateTime(date, time) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function updateDateTimePart(setForm, field, part, value) {
  setForm((prev) => {
    const currentDate = datePart(prev[field]);
    const currentTime = timePart(prev[field]);
    return {
      ...prev,
      [field]: combineDateTime(
        part === "date" ? value : currentDate,
        part === "time" ? value : currentTime,
      ),
    };
  });
}

function defaultDateTimeLocal(minutesFromNow) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return toDateTimeLocal(date.toISOString());
}

function lateTimeFromDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return { lateAtTime: "09:00" };
  }

  const hour24 = date.getHours();
  const minute = Math.round(date.getMinutes() / 5) * 5;
  const normalizedMinute = minute === 60 ? 0 : minute;
  const normalizedHour24 = minute === 60 ? (hour24 + 1) % 24 : hour24;
  return {
    lateAtTime: `${String(normalizedHour24).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`,
  };
}

function lateTimeFromStart(startAt, graceMinutes = 0) {
  const startDate = new Date(startAt);
  if (Number.isNaN(startDate.getTime())) {
    return lateTimeFromDate(null);
  }
  startDate.setMinutes(startDate.getMinutes() + (Number(graceMinutes) || 0));
  return lateTimeFromDate(startDate);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateRange(session) {
  if (!session) return "-";
  return `${formatDateTime(session.startAt)} - ${formatDateTime(session.endAt)}`;
}

function statusLabel(status) {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "-";
  }
}

function createSessionForm(activity) {
  const startAt = defaultDateTimeLocal(60);
  return {
    startAt,
    endAt: defaultDateTimeLocal(180),
    timezone: "Asia/Bangkok",
    locationName: "",
    locationDetail: "",
    latitude: "",
    longitude: "",
    capacity: "",
    registrationRequired: Boolean(activity?.registrationRequired),
    gradingMode: "attendance_only",
    maxRawScore: "100",
    passThreshold: "",
    latePolicyEnabled: false,
    lateGraceMinutes: "0",
    ...lateTimeFromStart(startAt, 0),
    latePenaltyFactor: "1",
    requireCheckout: false,
    minAttendanceMinutes: "",
  };
}

function sessionToForm(session) {
  const startAt = toDateTimeLocal(session?.startAt);
  return {
    startAt,
    endAt: toDateTimeLocal(session?.endAt),
    timezone: session?.timezone || "Asia/Bangkok",
    locationName: session?.locationName || "",
    locationDetail: session?.locationDetail || "",
    latitude: session?.latitude ?? "",
    longitude: session?.longitude ?? "",
    capacity: session?.capacity ?? "",
    registrationRequired: Boolean(session?.registrationRequired),
    gradingMode: session?.gradingMode || "attendance_only",
    maxRawScore: session?.maxRawScore ?? "100",
    passThreshold: session?.passThreshold ?? "",
    latePolicyEnabled: Number(session?.lateGraceMinutes || 0) > 0,
    lateGraceMinutes: session?.lateGraceMinutes ?? "0",
    ...lateTimeFromStart(startAt, session?.lateGraceMinutes ?? 0),
    latePenaltyFactor: session?.latePenaltyFactor ?? "1",
    requireCheckout: Boolean(session?.requireCheckout),
    minAttendanceMinutes: session?.minAttendanceMinutes ?? "",
  };
}

function assignmentToRow(item) {
  return {
    rowId: item.sessionAssignmentId || crypto.randomUUID(),
    userId: String(item.userId || ""),
    assignmentRole: item.assignmentRole || "lecturer",
    canRecordAttendance: Boolean(item.canRecordAttendance),
    canGrade: Boolean(item.canGrade),
    canFinalize: Boolean(item.canFinalize),
    note: item.note || "",
  };
}

function competencyToRow(item) {
  return {
    rowId: item.sessionCompetencyId || crypto.randomUUID(),
    competencyId: String(item.competencyId || ""),
    maxPercent: item.maxPercent ?? "",
  };
}

function StatusBadge({ status, finalized }) {
  return (
    <span
      className={`activity-session-status activity-session-status--${status || "scheduled"}`}
    >
      {finalized && <Lock size={12} />}
      {finalized ? "Finalized" : statusLabel(status)}
    </span>
  );
}

function SessionForm({ form, setForm, disabled }) {
  const { language } = useLanguage();
  const scoringModeLabel =
    language === "en" ? "Scoring method" : "รูปแบบการให้คะแนน";

  return (
    <div className="activity-session-form">
      <div className="course-row">
        <label className="course-field">
          <span className="course-label">
            วันที่เริ่มต้น<span className="course-required">*</span>
          </span>
          <input
            type="date"
            className="course-input"
            value={datePart(form.startAt)}
            onChange={(event) =>
              updateDateTimePart(setForm, "startAt", "date", event.target.value)
            }
            disabled={disabled}
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            เวลาเริ่มต้น<span className="course-required">*</span>
          </span>
          <input
            type="time"
            className="course-input"
            value={timePart(form.startAt)}
            onChange={(event) =>
              updateDateTimePart(setForm, "startAt", "time", event.target.value)
            }
            disabled={disabled}
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            วันที่สิ้นสุด<span className="course-required">*</span>
          </span>
          <input
            type="date"
            className="course-input"
            value={datePart(form.endAt)}
            onChange={(event) =>
              updateDateTimePart(setForm, "endAt", "date", event.target.value)
            }
            disabled={disabled}
          />
        </label>
        <label className="course-field">
          <span className="course-label">
            เวลาสิ้นสุด<span className="course-required">*</span>
          </span>
          <input
            type="time"
            className="course-input"
            value={timePart(form.endAt)}
            onChange={(event) =>
              updateDateTimePart(setForm, "endAt", "time", event.target.value)
            }
            disabled={disabled}
          />
        </label>
      </div>

      <div className="course-row">
        <label className="course-field">
          <span className="course-label">สถานที่</span>
          <input
            className="course-input"
            value={form.locationName}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, locationName: event.target.value }))
            }
            placeholder="เช่น ห้องประชุม 1"
            disabled={disabled}
          />
        </label>
        <label className="course-field">
          <span className="course-label">จำนวนรับ</span>
          <input
            type="number"
            min="0"
            className="course-input"
            value={form.capacity}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, capacity: event.target.value }))
            }
            placeholder="ไม่จำกัด"
            disabled={disabled}
          />
        </label>
      </div>

      <label className="course-field">
        <span className="course-label">รายละเอียดสถานที่</span>
        <textarea
          className="course-input activity-session-textarea"
          rows={3}
          value={form.locationDetail}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, locationDetail: event.target.value }))
          }
          placeholder="รายละเอียดเพิ่มเติมสำหรับผู้เข้าร่วม"
          disabled={disabled}
        />
      </label>

      <div className="course-row">
        <label className="course-field">
          <span className="course-label">{scoringModeLabel}</span>
          <select
            className="course-input"
            value={form.gradingMode}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, gradingMode: event.target.value }))
            }
            disabled={disabled}
          >
            {GRADING_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {gradingModeLabel(option.value, language)}
              </option>
            ))}
          </select>
        </label>
        <label className="course-field">
          <span className="course-label">คะแนนเต็ม</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="course-input"
            value={form.maxRawScore}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, maxRawScore: event.target.value }))
            }
            disabled={disabled}
          />
        </label>
        <label className="course-field">
          <span className="course-label">เกณฑ์ผ่าน</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="course-input"
            value={form.passThreshold}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                passThreshold: event.target.value,
              }))
            }
            placeholder="ไม่กำหนด"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="course-row">
        <label className="course-field">
          <span className="course-label">กำหนดเวลาสาย</span>
          <input
            type="time"
            className="course-input"
            value={form.lateAtTime}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, lateAtTime: event.target.value }))
            }
            disabled={disabled || !form.latePolicyEnabled}
          />
          <label className="activity-session-toggle-field">
            <input
              type="checkbox"
              checked={Boolean(form.latePolicyEnabled)}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  latePolicyEnabled: event.target.checked,
                }))
              }
              disabled={disabled}
            />
            <span>เปิดใช้งาน กำหนดเวลาสาย</span>
          </label>
        </label>
        <label className="course-field">
          <span className="course-label">Late penalty factor</span>
          <input
            type="number"
            min="0.01"
            max="1"
            step="0.0001"
            className="course-input"
            value={form.latePenaltyFactor}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                latePenaltyFactor: event.target.value,
              }))
            }
            disabled={disabled}
          />
        </label>
        <label className="course-field">
          <span className="course-label">เวลาเข้าเรียนขั้นต่ำ (นาที)</span>
          <input
            type="number"
            min="0"
            className="course-input"
            value={form.minAttendanceMinutes}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                minAttendanceMinutes: event.target.value,
              }))
            }
            placeholder="ไม่กำหนด"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="activity-session-check-row">
        <label className="activity-management__checkbox">
          <input
            type="checkbox"
            checked={form.registrationRequired}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                registrationRequired: event.target.checked,
              }))
            }
            disabled={disabled}
          />
          <span>ต้องลงทะเบียนก่อนเข้าร่วม</span>
        </label>
        <label className="activity-management__checkbox">
          <input
            type="checkbox"
            checked={form.requireCheckout}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                requireCheckout: event.target.checked,
              }))
            }
            disabled={disabled}
          />
          <span>ต้อง checkout</span>
        </label>
      </div>
    </div>
  );
}

export default function ActivitySessionManagementPage() {
  const params = useParams();
  const activityId = params?.activityId;
  const [activity, setActivity] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [competencyOptions, setCompetencyOptions] = useState([]);
  const [activeTab, setActiveTab] = useState("info");
  const [sessionForm, setSessionForm] = useState(createSessionForm(null));
  const [createForm, setCreateForm] = useState(createSessionForm(null));
  const [assignmentRows, setAssignmentRows] = useState([]);
  const [competencyRows, setCompetencyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(EMPTY_CONFIRM);

  const activityReadOnly =
    activity && !["draft", "published"].includes(activity.status);
  const sessionReadOnly = activityReadOnly || !selectedSession?.canEdit;
  const competencyTotal = useMemo(
    () =>
      competencyRows.reduce(
        (sum, item) => sum + (Number(item.maxPercent) || 0),
        0,
      ),
    [competencyRows],
  );
  const canFinalizeSelected =
    selectedSession?.canFinalize &&
    selectedSession.assignmentCount > 0 &&
    selectedSession.competencyCount > 0 &&
    Math.abs((selectedSession.competencyPercentTotal || 0) - 100) < 0.0001;

  const loadList = useCallback(
    async ({ keepSelection = true } = {}) => {
      const nextSessions = await fetchActivitySessions(activityId);
      setSessions(nextSessions);
      if (!keepSelection || !selectedSessionId) {
        setSelectedSessionId(nextSessions[0]?.sessionId || null);
      } else if (
        !nextSessions.some((item) => item.sessionId === selectedSessionId)
      ) {
        setSelectedSessionId(nextSessions[0]?.sessionId || null);
      }
      return nextSessions;
    },
    [activityId, selectedSessionId],
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    setFeedback({ type: "", message: "" });
    try {
      const [nextActivity, nextSessions, nextAssignees, nextCompetencies] =
        await Promise.all([
          fetchActivity(activityId),
          fetchActivitySessions(activityId),
          fetchSessionAssigneeOptions(activityId),
          fetchCompetenciesForManagement(),
        ]);
      setActivity(nextActivity);
      setCreateForm(createSessionForm(nextActivity));
      setSessions(nextSessions);
      setAssigneeOptions(nextAssignees);
      setCompetencyOptions(nextCompetencies.filter((item) => item.isActive));
      setSelectedSessionId(
        (current) => current || nextSessions[0]?.sessionId || null,
      );
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  const loadSelectedSession = useCallback(async (sessionId) => {
    if (!sessionId) {
      setSelectedSession(null);
      setAssignmentRows([]);
      setCompetencyRows([]);
      return;
    }
    setDetailLoading(true);
    try {
      const detail = await fetchActivitySession(sessionId);
      setSelectedSession(detail);
      setSessionForm(sessionToForm(detail));
      setAssignmentRows(detail.assignments.map(assignmentToRow));
      setCompetencyRows(detail.competencies.map(competencyToRow));
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    loadSelectedSession(selectedSessionId);
  }, [loadSelectedSession, selectedSessionId]);

  useEffect(() => {
    if (feedback.type !== "success" || !feedback.message) return undefined;
    const timer = window.setTimeout(() => {
      setFeedback((current) =>
        current.type === "success" && current.message === feedback.message
          ? { type: "", message: "" }
          : current,
      );
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const refreshSelectedAndList = async (sessionId = selectedSessionId) => {
    await loadList({ keepSelection: true });
    if (sessionId) {
      await loadSelectedSession(sessionId);
    }
  };

  const handleOpenCreate = () => {
    setCreateForm(createSessionForm(activity));
    setCreateModalOpen(true);
  };

  const handleCreateSession = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const created = await createActivitySession(activityId, createForm);
      setCreateModalOpen(false);
      setFeedback({ type: "success", message: "สร้างรอบกิจกรรมแล้ว" });
      const nextSessions = await loadList({ keepSelection: false });
      setSelectedSessionId(
        created.sessionId || nextSessions[0]?.sessionId || null,
      );
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!selectedSession || submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const updated = await updateActivitySession(
        selectedSession.sessionId,
        sessionForm,
      );
      setSelectedSession(updated);
      setFeedback({ type: "success", message: "บันทึกข้อมูลรอบกิจกรรมแล้ว" });
      await loadList({ keepSelection: true });
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedSession || submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      await replaceSessionAssignments(
        selectedSession.sessionId,
        assignmentRows,
      );
      setFeedback({ type: "success", message: "บันทึกผู้รับผิดชอบแล้ว" });
      await refreshSelectedAndList();
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCompetencies = async () => {
    if (!selectedSession || submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      await replaceSessionCompetencies(
        selectedSession.sessionId,
        competencyRows,
      );
      setFeedback({
        type: "success",
        message: "บันทึก Competency mapping แล้ว",
      });
      await refreshSelectedAndList();
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (session, status) => {
    if (!session || submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const updated = await updateActivitySessionStatus(
        session.sessionId,
        status,
      );
      setFeedback({
        type: "success",
        message:
          status === "completed"
            ? "เปลี่ยนสถานะเป็น Completed แล้ว"
            : "ยกเลิกรอบกิจกรรมแล้ว",
      });
      setSelectedSession(updated);
      await refreshSelectedAndList(session.sessionId);
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
      setConfirmAction(EMPTY_CONFIRM);
    }
  };

  const handleFinalize = async (session) => {
    if (!session || submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const finalized = await finalizeActivitySession(session.sessionId);
      setFeedback({ type: "success", message: "Finalize รอบกิจกรรมแล้ว" });
      setSelectedSession(finalized);
      await refreshSelectedAndList(session.sessionId);
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
      setConfirmAction(EMPTY_CONFIRM);
    }
  };

  const handleDelete = async (session) => {
    if (!session || submitting) return;
    setSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      await deleteActivitySession(session.sessionId);
      setFeedback({ type: "success", message: "ลบรอบกิจกรรมแล้ว" });
      setConfirmAction(EMPTY_CONFIRM);
      const nextSessions = await fetchActivitySessions(activityId);
      setSessions(nextSessions);
      setSelectedSessionId(nextSessions[0]?.sessionId || null);
    } catch (err) {
      setFeedback({ type: "error", message: mapSessionError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const addAssignmentRow = () => {
    setAssignmentRows((prev) => [
      ...prev,
      {
        rowId: crypto.randomUUID(),
        userId: "",
        assignmentRole: "lecturer",
        canRecordAttendance: false,
        canGrade: true,
        canFinalize: false,
        note: "",
      },
    ]);
  };

  const addCompetencyRow = () => {
    setCompetencyRows((prev) => [
      ...prev,
      {
        rowId: crypto.randomUUID(),
        competencyId: "",
        maxPercent: "",
      },
    ]);
  };

  const selectedSummary = selectedSession
    ? sessions.find((item) => item.sessionId === selectedSession.sessionId) ||
      selectedSession
    : null;

  const confirmConfig = (() => {
    if (!confirmAction.type || !confirmAction.session) return null;
    if (confirmAction.type === "complete") {
      return {
        title: "เปลี่ยนสถานะเป็น Completed",
        message: (
          <>
            ยืนยันว่ารอบกิจกรรม{" "}
            <strong>ครั้งที่ {confirmAction.session.sessionNo}</strong>{" "}
            ดำเนินการเสร็จแล้ว?
          </>
        ),
        confirmLabel: "เปลี่ยนเป็น Completed",
        variant: "info",
        onConfirm: () => handleStatusChange(confirmAction.session, "completed"),
      };
    }
    if (confirmAction.type === "cancel") {
      return {
        title: "ยกเลิกรอบกิจกรรม",
        message: (
          <>
            ยืนยันการยกเลิกรอบกิจกรรม{" "}
            <strong>ครั้งที่ {confirmAction.session.sessionNo}</strong> หรือไม่?
          </>
        ),
        hint: "รอบกิจกรรมที่ยกเลิกแล้วจะเป็น read-only",
        confirmLabel: "ยกเลิกรอบกิจกรรม",
        variant: "danger",
        onConfirm: () => handleStatusChange(confirmAction.session, "cancelled"),
      };
    }
    if (confirmAction.type === "finalize") {
      return {
        title: "Finalize รอบกิจกรรม",
        message: (
          <>
            ยืนยันการ lock setup ของรอบกิจกรรม{" "}
            <strong>ครั้งที่ {confirmAction.session.sessionNo}</strong> หรือไม่?
          </>
        ),
        hint: "หลัง Finalize แล้วจะไม่สามารถแก้ข้อมูลรอบกิจกรรม ผู้รับผิดชอบ หรือ Competency mapping ได้",
        confirmLabel: "Finalize",
        variant: "warning",
        onConfirm: () => handleFinalize(confirmAction.session),
      };
    }
    return {
      title: "ลบรอบกิจกรรม",
      message: (
        <>
          ยืนยันการลบรอบกิจกรรม{" "}
          <strong>ครั้งที่ {confirmAction.session.sessionNo}</strong> หรือไม่?
        </>
      ),
      hint: "ระบบจะ Soft delete ได้เฉพาะรอบที่ยังไม่มีข้อมูลลงทะเบียนหรือเช็กชื่อ",
      confirmLabel: "ลบรอบกิจกรรม",
      variant: "danger",
      onConfirm: () => handleDelete(confirmAction.session),
    };
  })();

  return (
    <div className="activity-session-page">
      <div className="course-list-header">
        <div className="course-list-header__left">
          <Link className="activity-session-back" href="/activity-management">
            <ArrowLeft size={16} />
            กลับหน้ากิจกรรม
          </Link>
          <h1 className="course-list-header__title">จัดการรอบกิจกรรม</h1>
          <p className="course-list-header__subtitle">
            {activity
              ? `${activity.code} - ${activity.nameTh}`
              : "กำลังโหลดข้อมูลกิจกรรม..."}
          </p>
        </div>
        <div className="course-list-header__actions">
          <button
            className="course-btn course-btn--ghost"
            onClick={loadPage}
            disabled={loading || submitting}
          >
            <RefreshCw
              size={16}
              className={loading ? "activity-management__spin" : ""}
            />
            โหลดใหม่
          </button>
          <button
            className="course-btn course-btn--primary"
            onClick={handleOpenCreate}
            disabled={loading || submitting || activityReadOnly}
          >
            <Plus size={16} />
            เพิ่มรอบกิจกรรม
          </button>
        </div>
      </div>

      <ToastNotifications
        success={feedback.type === "success" ? feedback.message : ""}
        error={feedback.type === "error" ? feedback.message : ""}
        onCloseSuccess={() =>
          setFeedback((current) =>
            current.type === "success" ? { type: "", message: "" } : current,
          )
        }
        onCloseError={() =>
          setFeedback((current) =>
            current.type === "error" ? { type: "", message: "" } : current,
          )
        }
      />

      <section className="activity-session-shell">
        <aside className="activity-session-list">
          <div className="activity-session-list__header">
            <div>
              <span>Activity Session</span>
              <strong>{sessions.length} รอบ</strong>
            </div>
            {activityReadOnly && (
              <span className="activity-session-lock-note">
                <Lock size={13} />
                Read-only
              </span>
            )}
          </div>

          <div className="activity-session-list__items">
            {loading ? (
              <div className="activity-session-empty">
                กำลังโหลดรอบกิจกรรม...
              </div>
            ) : sessions.length ? (
              sessions.map((session) => (
                <button
                  type="button"
                  key={session.sessionId}
                  className={`activity-session-card ${selectedSessionId === session.sessionId ? "activity-session-card--active" : ""}`}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                >
                  <div className="activity-session-card__top">
                    <strong>ครั้งที่ {session.sessionNo}</strong>
                    <StatusBadge
                      status={session.status}
                      finalized={session.isSetupFinalized}
                    />
                  </div>
                  <span className="activity-session-card__time">
                    <Clock size={13} />
                    {formatDateRange(session)}
                  </span>
                  <span className="activity-session-card__place">
                    <MapPin size={13} />
                    {session.locationName || "ยังไม่ระบุสถานที่"}
                  </span>
                  <div className="activity-session-card__meta">
                    <span>
                      <Users size={13} /> {session.assignmentCount}
                    </span>
                    <span>
                      <Award size={13} /> {session.competencyCount}
                    </span>
                    <span>{session.competencyPercentTotal}%</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="activity-session-empty">ยังไม่มีรอบกิจกรรม</div>
            )}
          </div>
        </aside>

        <main className="activity-session-detail">
          {!selectedSession ? (
            <div className="activity-session-detail__empty">
              <CalendarClock size={32} />
              <strong>เลือกรอบกิจกรรมเพื่อจัดการข้อมูล</strong>
              <span>
                Prototype รอบนี้ยังไม่ทำ registration, attendance และ scoring
                รายบุคคล
              </span>
            </div>
          ) : (
            <>
              <div className="activity-session-detail__header">
                <div>
                  <span className="activity-session-kicker">
                    Session #{selectedSession.sessionNo}
                  </span>
                  <h2>รอบกิจกรรมครั้งที่ {selectedSession.sessionNo}</h2>
                  <p>{formatDateRange(selectedSession)}</p>
                </div>
                <div className="activity-session-detail__actions">
                  <StatusBadge
                    status={selectedSummary?.status}
                    finalized={selectedSummary?.isSetupFinalized}
                  />
                  <Link
                    className="course-btn course-btn--ghost"
                    href={`/activity-sessions/${selectedSession.sessionId}`}
                  >
                    <Users size={16} />
                    ผู้เข้าร่วมและคะแนน
                  </Link>
                  <button
                    className="course-btn course-btn--ghost"
                    onClick={() =>
                      setConfirmAction({
                        type: "complete",
                        session: selectedSession,
                      })
                    }
                    disabled={!selectedSession.canComplete || submitting}
                  >
                    <CheckCircle2 size={16} />
                    Completed
                  </button>
                  <button
                    className="course-btn course-btn--ghost"
                    onClick={() =>
                      setConfirmAction({
                        type: "cancel",
                        session: selectedSession,
                      })
                    }
                    disabled={!selectedSession.canCancel || submitting}
                  >
                    <XCircle size={16} />
                    Cancel
                  </button>
                  <button
                    className="course-btn course-btn--primary"
                    onClick={() =>
                      setConfirmAction({
                        type: "finalize",
                        session: selectedSession,
                      })
                    }
                    disabled={!canFinalizeSelected || submitting}
                    title={
                      canFinalizeSelected
                        ? "Finalize"
                        : "ต้องมีผู้รับผิดชอบ, Competency และสัดส่วนรวม 100%"
                    }
                  >
                    <Lock size={16} />
                    Finalize
                  </button>
                  <button
                    className="course-btn course-btn--danger"
                    onClick={() =>
                      setConfirmAction({
                        type: "delete",
                        session: selectedSession,
                      })
                    }
                    disabled={!selectedSession.canDelete || submitting}
                  >
                    <Trash2 size={16} />
                    ลบ
                  </button>
                </div>
              </div>

              <div className="activity-session-summary">
                <span>
                  <UserPlus size={14} /> ผู้รับผิดชอบ{" "}
                  {selectedSession.assignmentCount} คน
                </span>
                <span>
                  <Award size={14} /> Competency{" "}
                  {selectedSession.competencyCount} รายการ
                </span>
                <span>
                  Mapping รวม {selectedSession.competencyPercentTotal}%
                </span>
                <span>
                  ลงทะเบียน {selectedSession.registrationCount} รายการ
                </span>
                <span>เช็กชื่อ {selectedSession.attendanceCount} รายการ</span>
              </div>

              <div className="activity-session-tabs">
                {TAB_OPTIONS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={
                      activeTab === tab.id
                        ? "activity-session-tab activity-session-tab--active"
                        : "activity-session-tab"
                    }
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="activity-session-tab-panel">
                {detailLoading ? (
                  <div className="activity-session-empty">
                    กำลังโหลดรายละเอียด...
                  </div>
                ) : activeTab === "info" ? (
                  <>
                    <SessionForm
                      form={sessionForm}
                      setForm={setSessionForm}
                      disabled={sessionReadOnly || submitting}
                    />
                    <div className="activity-session-panel-actions">
                      {sessionReadOnly && (
                        <span>รอบกิจกรรมนี้อยู่ในสถานะที่แก้ไขไม่ได้</span>
                      )}
                      <button
                        className="course-btn course-btn--primary"
                        onClick={handleSaveInfo}
                        disabled={sessionReadOnly || submitting}
                      >
                        <Save size={16} />
                        บันทึกข้อมูลรอบ
                      </button>
                    </div>
                  </>
                ) : activeTab === "assignments" ? (
                  <div className="activity-session-table-panel">
                    <div className="activity-session-panel-toolbar">
                      <div>
                        <strong>ผู้รับผิดชอบรอบกิจกรรม</strong>
                        <span>เลือก staff ในคณะของกิจกรรมนี้เท่านั้น</span>
                      </div>
                      <button
                        className="course-btn course-btn--ghost"
                        onClick={addAssignmentRow}
                        disabled={sessionReadOnly || submitting}
                      >
                        <Plus size={16} />
                        เพิ่มผู้รับผิดชอบ
                      </button>
                    </div>
                    <div className="activity-session-table-wrap">
                      <table className="activity-session-table">
                        <thead>
                          <tr>
                            <th>ผู้รับผิดชอบ</th>
                            <th>บทบาท</th>
                            <th>สิทธิ์</th>
                            <th>หมายเหตุ</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignmentRows.length ? (
                            assignmentRows.map((row, index) => (
                              <tr key={row.rowId}>
                                <td>
                                  <select
                                    className="course-input"
                                    value={row.userId}
                                    onChange={(event) =>
                                      setAssignmentRows((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                userId: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                  >
                                    <option value="">เลือกผู้รับผิดชอบ</option>
                                    {assigneeOptions.map((option) => (
                                      <option
                                        key={option.userId}
                                        value={option.userId}
                                      >
                                        {option.displayName}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <select
                                    className="course-input"
                                    value={row.assignmentRole}
                                    onChange={(event) =>
                                      setAssignmentRows((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                assignmentRole:
                                                  event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                  >
                                    {ASSIGNMENT_ROLE_OPTIONS.map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <div className="activity-session-permission-list">
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={row.canRecordAttendance}
                                        onChange={(event) =>
                                          setAssignmentRows((prev) =>
                                            prev.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    canRecordAttendance:
                                                      event.target.checked,
                                                  }
                                                : item,
                                            ),
                                          )
                                        }
                                        disabled={sessionReadOnly || submitting}
                                      />{" "}
                                      เช็กชื่อ
                                    </label>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={row.canGrade}
                                        onChange={(event) =>
                                          setAssignmentRows((prev) =>
                                            prev.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    canGrade:
                                                      event.target.checked,
                                                  }
                                                : item,
                                            ),
                                          )
                                        }
                                        disabled={sessionReadOnly || submitting}
                                      />{" "}
                                      ให้คะแนน
                                    </label>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={row.canFinalize}
                                        onChange={(event) =>
                                          setAssignmentRows((prev) =>
                                            prev.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    canFinalize:
                                                      event.target.checked,
                                                  }
                                                : item,
                                            ),
                                          )
                                        }
                                        disabled={sessionReadOnly || submitting}
                                      />{" "}
                                      Finalize
                                    </label>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    className="course-input"
                                    value={row.note}
                                    onChange={(event) =>
                                      setAssignmentRows((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                note: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                  />
                                </td>
                                <td>
                                  <button
                                    className="course-icon-btn course-icon-btn--danger"
                                    onClick={() =>
                                      setAssignmentRows((prev) =>
                                        prev.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                    title="ลบผู้รับผิดชอบ"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="activity-session-table-empty"
                              >
                                ยังไม่มีผู้รับผิดชอบ
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="activity-session-panel-actions">
                      <button
                        className="course-btn course-btn--primary"
                        onClick={handleSaveAssignments}
                        disabled={sessionReadOnly || submitting}
                      >
                        <Save size={16} />
                        บันทึกผู้รับผิดชอบ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="activity-session-table-panel">
                    <div className="activity-session-panel-toolbar">
                      <div>
                        <strong>Competency Mapping</strong>
                        <span
                          className={
                            Math.abs(competencyTotal - 100) < 0.0001
                              ? "activity-session-total-ok"
                              : "activity-session-total-warn"
                          }
                        >
                          รวม {competencyTotal}% / 100%
                        </span>
                      </div>
                      <button
                        className="course-btn course-btn--ghost"
                        onClick={addCompetencyRow}
                        disabled={sessionReadOnly || submitting}
                      >
                        <Plus size={16} />
                        เพิ่ม Competency
                      </button>
                    </div>
                    <div className="activity-session-table-wrap">
                      <table className="activity-session-table">
                        <thead>
                          <tr>
                            <th>Competency</th>
                            <th>Max percent</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {competencyRows.length ? (
                            competencyRows.map((row, index) => (
                              <tr key={row.rowId}>
                                <td>
                                  <select
                                    className="course-input"
                                    value={row.competencyId}
                                    onChange={(event) =>
                                      setCompetencyRows((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                competencyId:
                                                  event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                  >
                                    <option value="">เลือก Competency</option>
                                    {competencyOptions.map((option) => (
                                      <option
                                        key={option.competencyId}
                                        value={option.competencyId}
                                      >
                                        {option.nameTh} ({option.code})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    className="course-input"
                                    value={row.maxPercent}
                                    onChange={(event) =>
                                      setCompetencyRows((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                maxPercent: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                  />
                                </td>
                                <td>
                                  <button
                                    className="course-icon-btn course-icon-btn--danger"
                                    onClick={() =>
                                      setCompetencyRows((prev) =>
                                        prev.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                      )
                                    }
                                    disabled={sessionReadOnly || submitting}
                                    title="ลบ Competency"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={3}
                                className="activity-session-table-empty"
                              >
                                ยังไม่มี Competency mapping
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="activity-session-panel-actions">
                      <span>Finalize ได้เมื่อ mapping รวมครบ 100%</span>
                      <button
                        className="course-btn course-btn--primary"
                        onClick={handleSaveCompetencies}
                        disabled={sessionReadOnly || submitting}
                      >
                        <Save size={16} />
                        บันทึก Competency
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </section>

      {createModalOpen && (
        <BaseModal
          open
          title="เพิ่มรอบกิจกรรม"
          size="lg"
          onClose={() => !submitting && setCreateModalOpen(false)}
          closeDisabled={submitting}
          footer={
            <>
              <button
                className="course-btn course-btn--ghost"
                onClick={() => setCreateModalOpen(false)}
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                className="course-btn course-btn--primary"
                onClick={handleCreateSession}
                disabled={
                  submitting || !createForm.startAt || !createForm.endAt
                }
              >
                <Save size={16} />
                {submitting ? "กำลังสร้าง..." : "สร้างรอบกิจกรรม"}
              </button>
            </>
          }
        >
          <SessionForm
            form={createForm}
            setForm={setCreateForm}
            disabled={submitting}
          />
        </BaseModal>
      )}

      {confirmConfig && (
        <ConfirmActionModal
          open
          title={confirmConfig.title}
          message={confirmConfig.message}
          hint={confirmConfig.hint}
          confirmLabel={
            submitting ? "กำลังดำเนินการ..." : confirmConfig.confirmLabel
          }
          variant={confirmConfig.variant}
          loading={submitting}
          onCancel={() => !submitting && setConfirmAction(EMPTY_CONFIRM)}
          onConfirm={confirmConfig.onConfirm}
        />
      )}
    </div>
  );
}
