'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCheck, Clock3, Lock, Plus, RefreshCw, Save, UserPlus, Users } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../../components/ui/ToastNotifications';
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
} from '../../../../lib/activity-session';
import '../../curriculum-management/CourseLayout.css';
import '../../activity-management/ActivityManagement.css';
import './ActivitySessionWorkspace.css';

const ATTENDANCE_OPTIONS = [
    { value: 'present', label: 'มาเข้าร่วม' },
    { value: 'late', label: 'มาสาย' },
    { value: 'absent', label: 'ขาด' },
    { value: 'excused', label: 'ลา/ได้รับยกเว้น' },
];

function asLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function errorMessage(error) {
    return error?.message || error?.data?.message || 'ไม่สามารถดำเนินการได้ในขณะนี้';
}

export default function ActivitySessionWorkspacePage() {
    const params = useParams();
    const sessionId = Number(params?.sessionId || 0);
    const [session, setSession] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [scoreParticipants, setScoreParticipants] = useState([]);
    const [activeTab, setActiveTab] = useState('attendance');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [walkInOpen, setWalkInOpen] = useState(false);
    const [walkInQuery, setWalkInQuery] = useState('');
    const [walkInCandidates, setWalkInCandidates] = useState([]);
    const [confirmAction, setConfirmAction] = useState('');
    const [correctionReason, setCorrectionReason] = useState('');
    const [toasts, setToasts] = useState([]);

    const pushToast = useCallback((type, message) => {
        setToasts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, type, message }]);
    }, []);

    const dismissToast = useCallback(id => setToasts(prev => prev.filter(item => item.id !== id)), []);

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
            pushToast('error', errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [pushToast, sessionId]);

    useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

    useEffect(() => {
        if (!walkInOpen || !sessionId) return;
        const timer = setTimeout(async () => {
            try {
                setWalkInCandidates(await searchSessionWalkInCandidates(sessionId, walkInQuery));
            } catch (error) {
                pushToast('error', errorMessage(error));
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [pushToast, sessionId, walkInOpen, walkInQuery]);

    const filteredParticipants = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return participants;
        return participants.filter(item => [item.studentCode, item.nameTh, item.nameEn, item.attendanceStatus].join(' ').toLowerCase().includes(normalized));
    }, [participants, query]);

    const canEditRecords = session?.isSetupFinalized && session?.status !== 'cancelled' && (!session?.scoresFinalizedAt || session?.scoresRecalculationRequired);
    const scoreProgress = useMemo(() => {
        const eligible = scoreParticipants.filter(item => item.eligibleForScoring);
        const complete = eligible.filter(item => item.scores.every(score => score.rawScore !== null && score.rawScore !== undefined));
        return { eligible: eligible.length, complete: complete.length };
    }, [scoreParticipants]);

    const saveAttendance = async (participant, patch) => {
        setSaving(true);
        try {
            await saveSessionAttendance(sessionId, participant.personId, {
                status: patch.status ?? participant.attendanceStatus ?? 'present',
                checkinAt: patch.checkinAt ?? asLocalInput(participant.checkinAt),
                checkoutAt: patch.checkoutAt ?? asLocalInput(participant.checkoutAt),
                overrideStatus: Boolean(patch.overrideStatus),
                notes: patch.notes ?? participant.attendanceNotes,
            });
            await loadWorkspace();
            pushToast('success', 'บันทึกการเข้าร่วมแล้ว');
        } catch (error) {
            pushToast('error', errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const addWalkIn = async candidate => {
        setSaving(true);
        try {
            await addSessionWalkIn(sessionId, { personId: candidate.personId, checkinAt: new Date().toISOString() });
            setWalkInOpen(false);
            await loadWorkspace();
            pushToast('success', `เพิ่ม ${candidate.nameTh} เป็น Walk-in แล้ว`);
        } catch (error) {
            pushToast('error', errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const updateScore = (personId, sessionCompetencyId, value) => {
        setScoreParticipants(prev => prev.map(participant => participant.personId !== personId ? participant : ({
            ...participant,
            scores: participant.scores.map(score => score.sessionCompetencyId !== sessionCompetencyId ? score : ({ ...score, rawScore: value })),
        })));
    };

    const saveScores = async () => {
        const scores = scoreParticipants.flatMap(participant => participant.eligibleForScoring ? participant.scores.map(score => ({
            personId: participant.personId,
            sessionCompetencyId: score.sessionCompetencyId,
            rawScore: score.rawScore,
            notes: score.notes,
        })) : []);
        setSaving(true);
        try {
            await saveSessionScores(sessionId, scores);
            await loadWorkspace();
            pushToast('success', 'บันทึกคะแนนแล้ว');
        } catch (error) {
            pushToast('error', errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const runConfirmAction = async () => {
        setSaving(true);
        try {
            if (confirmAction === 'absent') {
                await markUnrecordedSessionParticipantsAbsent(sessionId);
                pushToast('success', 'บันทึกผู้ที่ยังไม่เช็กชื่อเป็นขาดแล้ว');
            }
            if (confirmAction === 'finalize') {
                await finalizeSessionScores(sessionId);
                pushToast('success', 'ปิดคะแนนและคำนวณผล Competency แล้ว');
            }
            if (confirmAction === 'correction') {
                await openSessionScoreCorrection(sessionId, correctionReason);
                setCorrectionReason('');
                pushToast('success', 'เปิด Correction แล้ว กรุณาแก้ไขและปิดคะแนนใหม่');
            }
            setConfirmAction('');
            await loadWorkspace();
        } catch (error) {
            pushToast('error', errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="activity-session-workspace"><div className="activity-session-workspace__empty">กำลังโหลดรอบกิจกรรม...</div></div>;

    return (
        <div className="activity-session-workspace">
            <header className="activity-session-workspace__header">
                <div>
                    <Link className="activity-session-workspace__back" href="/activity-management">กลับหน้ากิจกรรม</Link>
                    <h1>ผู้เข้าร่วมและคะแนน</h1>
                    <p>{session?.activityCode} {session?.activityNameTh} | รอบที่ {session?.sessionNo}</p>
                </div>
                <div className="activity-session-workspace__actions">
                    <button className="course-btn course-btn--ghost" onClick={loadWorkspace} disabled={saving}><RefreshCw size={16} /> โหลดใหม่</button>
                    {session?.scoresFinalizedAt ? (
                        <button className="course-btn course-btn--danger" onClick={() => setConfirmAction('correction')} disabled={saving}><Lock size={16} /> เปิด Correction</button>
                    ) : (
                        <button className="course-btn course-btn--primary" onClick={() => setConfirmAction('finalize')} disabled={saving || session?.status !== 'completed'}><CheckCheck size={16} /> ปิดคะแนน</button>
                    )}
                </div>
            </header>

            <div className="activity-session-workspace__summary">
                <span>สถานะรอบ: <strong>{session?.status}</strong></span>
                <span>Setup: <strong>{session?.isSetupFinalized ? 'ล็อกแล้ว' : 'ยังไม่ล็อก'}</strong></span>
                <span>เช็กชื่อแล้ว: <strong>{participants.filter(item => item.attendanceRecorded).length}/{participants.length}</strong></span>
                <span>คะแนนครบ: <strong>{scoreProgress.complete}/{scoreProgress.eligible}</strong></span>
                {session?.scoresRecalculationRequired && <span className="activity-session-workspace__warning">ต้องคำนวณคะแนนใหม่</span>}
            </div>

            <div className="activity-session-workspace__tabs">
                <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}><Users size={16} /> ผู้เข้าร่วมและเช็กชื่อ</button>
                <button className={activeTab === 'scores' ? 'active' : ''} onClick={() => setActiveTab('scores')}><Clock3 size={16} /> คะแนนตาม Competency</button>
            </div>

            {activeTab === 'attendance' ? (
                <section className="activity-session-workspace__panel">
                    <div className="activity-session-workspace__toolbar">
                        <input className="course-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหารหัสนักศึกษา หรือชื่อ" />
                        <div>
                            <button className="course-btn course-btn--ghost" onClick={() => setConfirmAction('absent')} disabled={saving || session?.status !== 'completed' || !canEditRecords}>บันทึกผู้ที่เหลือเป็นขาด</button>
                            <button className="course-btn course-btn--primary" onClick={() => setWalkInOpen(true)} disabled={saving || !canEditRecords}><UserPlus size={16} /> เพิ่ม Walk-in</button>
                        </div>
                    </div>
                    <div className="activity-session-workspace__table-wrap">
                        <table className="activity-session-workspace__table">
                            <thead><tr><th>ผู้เรียน</th><th>สถานะ</th><th>เวลาเข้า</th><th>เวลาออก</th><th>หมายเหตุ</th><th /></tr></thead>
                            <tbody>{filteredParticipants.map(participant => (
                                <tr key={participant.personId}>
                                    <td><strong>{participant.nameTh}</strong><span>{participant.studentCode}</span></td>
                                    <td><select className="course-input" defaultValue={participant.attendanceStatus || ''} disabled={!canEditRecords || saving} onChange={event => saveAttendance(participant, { status: event.target.value, overrideStatus: true, notes: participant.attendanceNotes || 'ปรับสถานะด้วยเจ้าหน้าที่' })}><option value="">ยังไม่บันทึก</option>{ATTENDANCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
                                    <td><input type="datetime-local" className="course-input" defaultValue={asLocalInput(participant.checkinAt)} disabled={!canEditRecords || saving} onBlur={event => event.target.value && saveAttendance(participant, { status: participant.attendanceStatus || 'present', checkinAt: event.target.value })} /></td>
                                    <td><input type="datetime-local" className="course-input" defaultValue={asLocalInput(participant.checkoutAt)} disabled={!canEditRecords || saving || !participant.attendanceStatus} onBlur={event => event.target.value && saveAttendance(participant, { status: participant.attendanceStatus, checkoutAt: event.target.value })} /></td>
                                    <td><span>{participant.attendanceNotes || '-'}</span></td>
                                    <td><button className="course-btn course-btn--ghost" onClick={() => saveAttendance(participant, { status: participant.attendanceStatus || 'present', checkinAt: new Date().toISOString() })} disabled={!canEditRecords || saving}>เช็กชื่อ</button></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                </section>
            ) : (
                <section className="activity-session-workspace__panel">
                    <div className="activity-session-workspace__toolbar"><p>กรอกคะแนนดิบเต็ม {session?.maxRawScore} คะแนน ผู้ที่ไม่เข้าเกณฑ์จะไม่สามารถให้คะแนนได้</p><button className="course-btn course-btn--primary" onClick={saveScores} disabled={saving || !canEditRecords || session?.gradingMode === 'attendance_only'}><Save size={16} /> บันทึกคะแนน</button></div>
                    <div className="activity-session-workspace__table-wrap"><table className="activity-session-workspace__table"><thead><tr><th>ผู้เรียน</th><th>Attendance</th>{session?.competencies?.map(item => <th key={item.sessionCompetencyId}>{item.competencyCode}<span>{item.maxPercent}%</span></th>)}</tr></thead><tbody>{scoreParticipants.map(participant => <tr key={participant.personId}><td><strong>{participant.nameTh}</strong><span>{participant.studentCode}</span></td><td>{participant.attendanceStatus || 'ยังไม่บันทึก'}{!participant.eligibleForScoring && <span>{participant.scoringIneligibilityReason}</span>}</td>{participant.scores.map(score => <td key={score.sessionCompetencyId}><input type="number" min="0" max={session?.maxRawScore} step="0.01" className="course-input" value={score.rawScore ?? ''} disabled={!canEditRecords || !participant.eligibleForScoring || session?.gradingMode === 'attendance_only'} onChange={event => updateScore(participant.personId, score.sessionCompetencyId, event.target.value)} /><span>{score.finalScore !== null && score.finalScore !== undefined ? `หลัง penalty ${score.finalScore}` : ''}</span></td>)}</tr>)}</tbody></table></div>
                </section>
            )}

            <BaseModal open={walkInOpen} title="เพิ่มผู้เข้าร่วมแบบ Walk-in" onClose={() => setWalkInOpen(false)} size="md">
                <input className="course-input" autoFocus value={walkInQuery} onChange={event => setWalkInQuery(event.target.value)} placeholder="ค้นหารหัสนักศึกษา หรือชื่อ" />
                <div className="activity-session-workspace__walkins">{walkInCandidates.map(candidate => <button key={candidate.personId} onClick={() => addWalkIn(candidate)} disabled={saving}><strong>{candidate.nameTh}</strong><span>{candidate.studentCode}</span></button>)}</div>
            </BaseModal>

            <ConfirmActionModal open={confirmAction === 'absent'} title="บันทึกเป็นขาด" message="ผู้สมัครที่อนุมัติแล้วและยังไม่มีข้อมูลเช็กชื่อ จะถูกบันทึกเป็นขาด" confirmLabel="ยืนยันบันทึก" variant="warning" loading={saving} onConfirm={runConfirmAction} onCancel={() => setConfirmAction('')} />
            <ConfirmActionModal open={confirmAction === 'finalize'} title="ปิดคะแนนและคำนวณผล" message="ระบบจะล็อกคะแนนรายบุคคล คำนวณผล Competency ใหม่ และอัปเดตผลรวมของผู้เรียน" confirmLabel="ปิดคะแนน" variant="warning" loading={saving} onConfirm={runConfirmAction} onCancel={() => setConfirmAction('')} />
            <BaseModal open={confirmAction === 'correction'} title="เปิด Correction คะแนน" onClose={() => setConfirmAction('')} size="sm" footer={<><button className="course-btn course-btn--ghost" onClick={() => setConfirmAction('')}>ยกเลิก</button><button className="course-btn course-btn--danger" onClick={runConfirmAction} disabled={saving || !correctionReason.trim()}>เปิด Correction</button></>}><p>การแก้ไข Attendance หรือคะแนนจะกระทบผล Competency ของผู้เข้าร่วมในรอบนี้</p><textarea className="course-input" value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} placeholder="ระบุเหตุผล" rows={4} /></BaseModal>
            <ToastNotifications toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
