"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCheck,
  Clock3,
  Lock,
  RefreshCw,
  Save,
  UserPlus,
  Users,
} from "lucide-react";
import BaseModal from "../../../../components/ui/BaseModal";
import ConfirmActionModal from "../../../../components/ui/ConfirmActionModal";
import ToastNotifications from "../../../../components/ui/ToastNotifications";
import { useLanguage } from "../../../../providers/LanguageContext";
import { officerText } from "../../officer-labels";
import {
  addSessionWalkIn,
  fetchActivitySessionWorkspace,
  fetchSessionParticipants,
  fetchSessionScores,
  finalizeSessionScores,
  markUnrecordedSessionParticipantsAbsent,
  openSessionScoreCorrection,
  saveSessionAttendance,
  saveSessionScores,
  searchSessionWalkInCandidates,
} from "../../../../lib/activity-session";
import "../../curriculum-management/CourseLayout.css";
import "../../activity-management/ActivityManagement.css";
import "./ActivitySessionWorkspace.css";

const ATTENDANCE_OPTIONS = [
  { value: "present" },
  { value: "late" },
  { value: "absent" },
  { value: "excused" },
];

const ATTENDANCE_LABELS = {
  present: ["มาเข้าร่วม", "Present"],
  late: ["มาสาย", "Late"],
  absent: ["ขาด", "Absent"],
  excused: ["ลา/ได้รับยกเว้น", "Excused"],
};

function attendanceLabel(value, language) {
  return officerText(language, ...(ATTENDANCE_LABELS[value] || [value, value]));
}

function asLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function errorMessage(error, language) {
  return officerText(
    language,
    error?.message || error?.data?.message || "ไม่สามารถดำเนินการได้ในขณะนี้",
    error?.message || error?.data?.message || "Unable to complete the operation.",
  );
}

export default function ActivitySessionWorkspacePage() {
  const params = useParams();
  const { language } = useLanguage();
  const sessionId = Number(params?.sessionId || 0);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [scoreParticipants, setScoreParticipants] = useState([]);
  const [activeTab, setActiveTab] = useState("attendance");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInQuery, setWalkInQuery] = useState("");
  const [walkInCandidates, setWalkInCandidates] = useState([]);
  const [confirmAction, setConfirmAction] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, message) => {
    setToasts((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, type, message },
    ]);
  }, []);

  const dismissToast = useCallback(
    (id) => setToasts((prev) => prev.filter((item) => item.id !== id)),
    [],
  );

  const loadWorkspace = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [sessionData, participantData] = await Promise.all([
        fetchActivitySessionWorkspace(sessionId),
        fetchSessionParticipants(sessionId),
      ]);
      setSession(sessionData);
      setParticipants(participantData);
      try {
        setScoreParticipants(await fetchSessionScores(sessionId));
      } catch {
        // Attendance-only assignees can still use their permitted workspace tab.
        setScoreParticipants([]);
      }
    } catch (error) {
      pushToast("error", errorMessage(error, language));
    } finally {
      setLoading(false);
    }
  }, [language, pushToast, sessionId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!walkInOpen || !sessionId) return;
    const timer = setTimeout(async () => {
      try {
        setWalkInCandidates(
          await searchSessionWalkInCandidates(sessionId, walkInQuery),
        );
      } catch (error) {
        pushToast("error", errorMessage(error, language));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [language, pushToast, sessionId, walkInOpen, walkInQuery]);

  const filteredParticipants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return participants;
    return participants.filter((item) =>
      [item.studentCode, item.nameTh, item.nameEn, item.attendanceStatus]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [participants, query]);

  const canEditRecords =
    session?.isSetupFinalized &&
    session?.status !== "cancelled" &&
    (!session?.scoresFinalizedAt || session?.scoresRecalculationRequired);
  const scoreProgress = useMemo(() => {
    const eligible = scoreParticipants.filter(
      (item) => item.eligibleForScoring,
    );
    const complete = eligible.filter((item) =>
      item.scores.every(
        (score) => score.rawScore !== null && score.rawScore !== undefined,
      ),
    );
    return { eligible: eligible.length, complete: complete.length };
  }, [scoreParticipants]);

  const saveAttendance = async (participant, patch) => {
    setSaving(true);
    try {
      await saveSessionAttendance(sessionId, participant.personId, {
        status: patch.status ?? participant.attendanceStatus ?? "present",
        checkinAt: patch.checkinAt ?? asLocalInput(participant.checkinAt),
        checkoutAt: patch.checkoutAt ?? asLocalInput(participant.checkoutAt),
        overrideStatus: Boolean(patch.overrideStatus),
        notes: patch.notes ?? participant.attendanceNotes,
      });
      await loadWorkspace();
      pushToast("success", officerText(language, "บันทึกการเข้าร่วมแล้ว", "Attendance saved."));
    } catch (error) {
      pushToast("error", errorMessage(error, language));
    } finally {
      setSaving(false);
    }
  };

  const addWalkIn = async (candidate) => {
    setSaving(true);
    try {
      await addSessionWalkIn(sessionId, {
        personId: candidate.personId,
        checkinAt: new Date().toISOString(),
      });
      setWalkInOpen(false);
      await loadWorkspace();
      pushToast(
        "success",
        officerText(language, `เพิ่ม ${candidate.nameTh} เป็นผู้เข้าร่วมหน้างานแล้ว`, `${candidate.nameTh} was added as a walk-in.`),
      );
    } catch (error) {
      pushToast("error", errorMessage(error, language));
    } finally {
      setSaving(false);
    }
  };

  const updateScore = (personId, sessionCompetencyId, value) => {
    setScoreParticipants((prev) =>
      prev.map((participant) =>
        participant.personId !== personId
          ? participant
          : {
              ...participant,
              scores: participant.scores.map((score) =>
                score.sessionCompetencyId !== sessionCompetencyId
                  ? score
                  : { ...score, rawScore: value },
              ),
            },
      ),
    );
  };

  const saveScores = async () => {
    const scores = scoreParticipants.flatMap((participant) =>
      participant.eligibleForScoring
        ? participant.scores.map((score) => ({
            personId: participant.personId,
            sessionCompetencyId: score.sessionCompetencyId,
            rawScore: score.rawScore,
            notes: score.notes,
          }))
        : [],
    );
    setSaving(true);
    try {
      await saveSessionScores(sessionId, scores);
      await loadWorkspace();
      pushToast("success", officerText(language, "บันทึกคะแนนแล้ว", "Scores saved."));
    } catch (error) {
      pushToast("error", errorMessage(error, language));
    } finally {
      setSaving(false);
    }
  };

  const runConfirmAction = async () => {
    setSaving(true);
    try {
      if (confirmAction === "absent") {
        await markUnrecordedSessionParticipantsAbsent(sessionId);
        pushToast(
          "success",
          officerText(
            language,
            "บันทึกผู้ที่ยังไม่เช็กชื่อเป็นขาดแล้ว",
            "Unrecorded participants were marked absent.",
          ),
        );
      }
      if (confirmAction === "finalize") {
        await finalizeSessionScores(sessionId);
        pushToast(
          "success",
          officerText(
            language,
            "ปิดคะแนนและคำนวณผลสมรรถนะแล้ว",
            "Scores were finalized and competencies recalculated.",
          ),
        );
      }
      if (confirmAction === "correction") {
        await openSessionScoreCorrection(sessionId, correctionReason);
        setCorrectionReason("");
        pushToast(
          "success",
          officerText(
            language,
            "เปิดโหมดแก้ไขแล้ว กรุณาแก้ไขและปิดคะแนนใหม่",
            "Correction mode is open. Update the records and finalize scores again.",
          ),
        );
      }
      setConfirmAction("");
      await loadWorkspace();
    } catch (error) {
      pushToast("error", errorMessage(error, language));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="activity-session-workspace officer-page">
        <div className="activity-session-workspace__empty">
          {officerText(language, "กำลังโหลดรอบกิจกรรม...", "Loading activity session...")}
        </div>
      </div>
    );

  return (
    <div className="activity-session-workspace officer-page">
      <header className="activity-session-workspace__header officer-page__header">
        <div>
          <Link
            className="activity-session-workspace__back"
            href="/activity-management"
          >
            {officerText(language, "กลับหน้ากิจกรรม", "Back to activities")}
          </Link>
          <h1>{officerText(language, "ผู้เข้าร่วมและคะแนน", "Participants and scores")}</h1>
          <p>
            {session?.activityCode}{" "}
            {language === "en"
              ? session?.activityNameEn || session?.activityNameTh
              : session?.activityNameTh} | {officerText(language, "รอบที่ ", "Session ")}
            {session?.sessionNo}
          </p>
        </div>
        <div className="activity-session-workspace__actions">
          <button
            className="course-btn course-btn--ghost"
            onClick={loadWorkspace}
            disabled={saving}
          >
            <RefreshCw size={16} /> {officerText(language, "โหลดใหม่", "Refresh")}
          </button>
          {session?.scoresFinalizedAt ? (
            <button
              className="course-btn course-btn--danger"
              onClick={() => setConfirmAction("correction")}
              disabled={saving}
            >
              <Lock size={16} /> {officerText(language, "เปิดโหมดแก้ไข", "Open correction")}
            </button>
          ) : (
            <button
              className="course-btn course-btn--primary"
              onClick={() => setConfirmAction("finalize")}
              disabled={saving || session?.status !== "completed"}
            >
              <CheckCheck size={16} /> {officerText(language, "ปิดคะแนน", "Finalize scores")}
            </button>
          )}
        </div>
      </header>

      <div className="activity-session-workspace__summary">
        <span>
          {officerText(language, "สถานะรอบ: ", "Session status: ")}
          <strong>{statusLabel(session?.status, language)}</strong>
        </span>
        <span>
          {officerText(language, "การตั้งค่า: ", "Setup: ")}
          <strong>
            {session?.isSetupFinalized
              ? officerText(language, "ล็อกแล้ว", "Finalized")
              : officerText(language, "ยังไม่ล็อก", "Not finalized")}
          </strong>
        </span>
        <span>
          {officerText(language, "เช็กชื่อแล้ว: ", "Attendance recorded: ")}
          <strong>
            {participants.filter((item) => item.attendanceRecorded).length}/
            {participants.length}
          </strong>
        </span>
        <span>
          {officerText(language, "คะแนนครบ: ", "Scores complete: ")}
          <strong>
            {scoreProgress.complete}/{scoreProgress.eligible}
          </strong>
        </span>
        {session?.scoresRecalculationRequired && (
          <span className="activity-session-workspace__warning">
            {officerText(language, "ต้องคำนวณคะแนนใหม่", "Recalculation required")}
          </span>
        )}
      </div>

      <div className="activity-session-workspace__tabs">
        <button
          className={activeTab === "attendance" ? "active" : ""}
          onClick={() => setActiveTab("attendance")}
        >
          <Users size={16} /> {officerText(language, "ผู้เข้าร่วมและเช็กชื่อ", "Participants and attendance")}
        </button>
        <button
          className={activeTab === "scores" ? "active" : ""}
          onClick={() => setActiveTab("scores")}
        >
          <Clock3 size={16} /> {officerText(language, "คะแนนตามสมรรถนะ", "Scores by competency")}
        </button>
      </div>

      {activeTab === "attendance" ? (
        <section className="activity-session-workspace__panel">
          <div className="activity-session-workspace__toolbar">
            <input
              className="course-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={officerText(language, "ค้นหารหัสนักศึกษา หรือชื่อ", "Search student code or name")}
            />
            <div>
              <button
                className="course-btn course-btn--ghost"
                onClick={() => setConfirmAction("absent")}
                disabled={
                  saving || session?.status !== "completed" || !canEditRecords
                }
              >
                {officerText(language, "บันทึกผู้ที่เหลือเป็นขาด", "Mark remaining participants absent")}
              </button>
              <button
                className="course-btn course-btn--primary"
                onClick={() => setWalkInOpen(true)}
                disabled={saving || !canEditRecords}
              >
                <UserPlus size={16} /> {officerText(language, "เพิ่มผู้เข้าร่วมหน้างาน", "Add walk-in")}
              </button>
            </div>
          </div>
          <div className="activity-session-workspace__table-wrap">
            <table className="activity-session-workspace__table">
              <thead>
                <tr>
                  <th>{officerText(language, "ผู้เรียน", "Learner")}</th>
                  <th>{officerText(language, "สถานะ", "Status")}</th>
                  <th>{officerText(language, "เวลาเข้า", "Check-in")}</th>
                  <th>{officerText(language, "เวลาออก", "Check-out")}</th>
                  <th>{officerText(language, "หมายเหตุ", "Note")}</th>
                  <th aria-label={officerText(language, "การจัดการ", "Actions")} />
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr key={participant.personId}>
                    <td>
                      <strong>
                        {language === "en"
                          ? participant.nameEn || participant.nameTh
                          : participant.nameTh || participant.nameEn}
                      </strong>
                      <span>{participant.studentCode}</span>
                    </td>
                    <td>
                      <select
                        className="course-input"
                        defaultValue={participant.attendanceStatus || ""}
                        disabled={!canEditRecords || saving}
                        onChange={(event) =>
                          saveAttendance(participant, {
                            status: event.target.value,
                            overrideStatus: true,
                            notes:
                              participant.attendanceNotes ||
                              officerText(
                                language,
                                "ปรับสถานะโดยเจ้าหน้าที่",
                                "Status adjusted by officer",
                              ),
                          })
                        }
                      >
                        <option value="">
                          {officerText(language, "ยังไม่บันทึก", "Not recorded")}
                        </option>
                        {ATTENDANCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {attendanceLabel(option.value, language)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="datetime-local"
                        className="course-input"
                        defaultValue={asLocalInput(participant.checkinAt)}
                        disabled={!canEditRecords || saving}
                        onBlur={(event) =>
                          event.target.value &&
                          saveAttendance(participant, {
                            status: participant.attendanceStatus || "present",
                            checkinAt: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="datetime-local"
                        className="course-input"
                        defaultValue={asLocalInput(participant.checkoutAt)}
                        disabled={
                          !canEditRecords ||
                          saving ||
                          !participant.attendanceStatus
                        }
                        onBlur={(event) =>
                          event.target.value &&
                          saveAttendance(participant, {
                            status: participant.attendanceStatus,
                            checkoutAt: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <span>{participant.attendanceNotes || "-"}</span>
                    </td>
                    <td>
                      <button
                        className="course-btn course-btn--ghost"
                        onClick={() =>
                          saveAttendance(participant, {
                            status: participant.attendanceStatus || "present",
                            checkinAt: new Date().toISOString(),
                          })
                        }
                        disabled={!canEditRecords || saving}
                      >
                        {officerText(language, "เช็กชื่อ", "Check in")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="activity-session-workspace__panel">
          <div className="activity-session-workspace__toolbar">
            <p>
              {officerText(language, "กรอกคะแนนดิบเต็ม ", "Enter raw scores out of ")}
              {session?.maxRawScore}{" "}
              {officerText(
                language,
                "คะแนน ผู้ที่ไม่เข้าเกณฑ์จะไม่สามารถให้คะแนนได้",
                ". Participants who are not eligible cannot be graded.",
              )}
            </p>
            <button
              className="course-btn course-btn--primary"
              onClick={saveScores}
              disabled={
                saving ||
                !canEditRecords ||
                session?.gradingMode === "attendance_only"
              }
            >
              <Save size={16} /> {officerText(language, "บันทึกคะแนน", "Save scores")}
            </button>
          </div>
          <div className="activity-session-workspace__table-wrap">
            <table className="activity-session-workspace__table">
              <thead>
                <tr>
                  <th>{officerText(language, "ผู้เรียน", "Learner")}</th>
                  <th>{officerText(language, "การเข้าร่วม", "Attendance")}</th>
                  {session?.competencies?.map((item) => (
                    <th key={item.sessionCompetencyId}>
                      {item.competencyCode}
                      <span>{item.maxPercent}%</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scoreParticipants.map((participant) => (
                  <tr key={participant.personId}>
                    <td>
                      <strong>
                        {language === "en"
                          ? participant.nameEn || participant.nameTh
                          : participant.nameTh || participant.nameEn}
                      </strong>
                      <span>{participant.studentCode}</span>
                    </td>
                    <td>
                      {participant.attendanceStatus
                        ? attendanceLabel(participant.attendanceStatus, language)
                        : officerText(language, "ยังไม่บันทึก", "Not recorded")}
                      {!participant.eligibleForScoring && (
                        <span>{participant.scoringIneligibilityReason}</span>
                      )}
                    </td>
                    {participant.scores.map((score) => (
                      <td key={score.sessionCompetencyId}>
                        <input
                          type="number"
                          min="0"
                          max={session?.maxRawScore}
                          step="0.01"
                          className="course-input"
                          value={score.rawScore ?? ""}
                          disabled={
                            !canEditRecords ||
                            !participant.eligibleForScoring ||
                            session?.gradingMode === "attendance_only"
                          }
                          onChange={(event) =>
                            updateScore(
                              participant.personId,
                              score.sessionCompetencyId,
                              event.target.value,
                            )
                          }
                        />
                        <span>
                          {score.finalScore !== null &&
                          score.finalScore !== undefined
                            ? `${officerText(language, "หลังหักคะแนน ", "After penalty ")}${score.finalScore}`
                            : ""}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <BaseModal
        open={walkInOpen}
        title={officerText(language, "เพิ่มผู้เข้าร่วมหน้างาน", "Add walk-in participant")}
        onClose={() => setWalkInOpen(false)}
        size="md"
      >
        <input
          className="course-input"
          autoFocus
          value={walkInQuery}
          onChange={(event) => setWalkInQuery(event.target.value)}
          placeholder={officerText(language, "ค้นหารหัสนักศึกษา หรือชื่อ", "Search student code or name")}
        />
        <div className="activity-session-workspace__walkins">
          {walkInCandidates.map((candidate) => (
            <button
              key={candidate.personId}
              onClick={() => addWalkIn(candidate)}
              disabled={saving}
            >
              <strong>
                {language === "en"
                  ? candidate.nameEn || candidate.nameTh
                  : candidate.nameTh || candidate.nameEn}
              </strong>
              <span>{candidate.studentCode}</span>
            </button>
          ))}
        </div>
      </BaseModal>

      <ConfirmActionModal
        open={confirmAction === "absent"}
        title={officerText(language, "บันทึกเป็นขาด", "Mark as absent")}
        message={officerText(
          language,
          "ผู้สมัครที่อนุมัติแล้วและยังไม่มีข้อมูลเช็กชื่อ จะถูกบันทึกเป็นขาด",
          "Approved participants without attendance records will be marked absent.",
        )}
        confirmLabel={officerText(language, "ยืนยันบันทึก", "Confirm")}
        variant="warning"
        loading={saving}
        onConfirm={runConfirmAction}
        onCancel={() => setConfirmAction("")}
      />
      <ConfirmActionModal
        open={confirmAction === "finalize"}
        title={officerText(language, "ปิดคะแนนและคำนวณผล", "Finalize and calculate results")}
        message={officerText(
          language,
          "ระบบจะล็อกคะแนนรายบุคคล คำนวณผลสมรรถนะใหม่ และอัปเดตผลรวมของผู้เรียน",
          "Individual scores will be locked, competencies recalculated, and learner totals updated.",
        )}
        confirmLabel={officerText(language, "ปิดคะแนน", "Finalize scores")}
        variant="warning"
        loading={saving}
        onConfirm={runConfirmAction}
        onCancel={() => setConfirmAction("")}
      />
      <BaseModal
        open={confirmAction === "correction"}
        title={officerText(language, "เปิดโหมดแก้ไขคะแนน", "Open score correction")}
        onClose={() => setConfirmAction("")}
        size="sm"
        footer={
          <>
            <button
              className="course-btn course-btn--ghost"
              onClick={() => setConfirmAction("")}
            >
                {officerText(language, "ยกเลิก", "Cancel")}
            </button>
            <button
              className="course-btn course-btn--danger"
              onClick={runConfirmAction}
              disabled={saving || !correctionReason.trim()}
            >
              {officerText(language, "เปิดโหมดแก้ไข", "Open correction")}
            </button>
          </>
        }
      >
        <p>
          {officerText(
            language,
            "การแก้ไขการเข้าร่วมหรือคะแนนจะกระทบผลสมรรถนะของผู้เข้าร่วมในรอบนี้",
            "Changing attendance or scores affects competency results for participants in this session.",
          )}
        </p>
        <textarea
          className="course-input"
          value={correctionReason}
          onChange={(event) => setCorrectionReason(event.target.value)}
          placeholder={officerText(language, "ระบุเหตุผล", "Enter a reason")}
          rows={4}
        />
      </BaseModal>
      <ToastNotifications toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
