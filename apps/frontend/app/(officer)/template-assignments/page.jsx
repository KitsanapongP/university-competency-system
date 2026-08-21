'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, History, Link2, RefreshCw, Replace, Unlink, Users } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import { fetchFaculties } from '../../../lib/curriculum';
import {
    createTemplateAssignment,
    fetchAvailableAssignmentCohorts,
    fetchAvailableAssignmentTemplates,
    fetchTemplateAssignmentHistory,
    fetchTemplateAssignments,
    removeTemplateAssignment,
    replaceTemplateAssignment,
} from '../../../lib/template-assignment';
import BaseModal from '../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import './TemplateAssignments.css';
import '../curriculum-management/CourseLayout.css';

const EMPTY_ACTION = { type: '', assignment: null, template: null, cohort: null, reason: '' };

function text(language, thai, english) {
    return language === 'th' ? thai : english;
}

function errorMessage(error, language) {
    const messages = {
        TEMPLATE_INACTIVE: ['แบบแผนการประเมินต้องอยู่ในสถานะพร้อมใช้งานก่อนกำหนดให้รุ่น', 'The template must be active before it can be assigned.'],
        COHORT_INACTIVE: ['รุ่นนักศึกษาต้องอยู่ในสถานะใช้งานก่อนกำหนดแบบแผนการประเมิน', 'The student cohort must be active before assignment.'],
        CURRICULUM_MISMATCH: ['แบบแผนการประเมินและรุ่นนักศึกษาต้องอยู่ในหลักสูตรเดียวกัน', 'The template and cohort must belong to the same curriculum.'],
        TEMPLATE_CURRENTLY_ASSIGNED: ['แบบแผนการประเมินนี้กำลังเชื่อมกับรุ่นอื่นอยู่', 'This assessment plan is currently assigned to another cohort.'],
        TEMPLATE_REACTIVATION_NOT_READY: ['แบบแผนการประเมินนี้ยังไม่พร้อมเปิดใช้งาน กรุณาตรวจสอบน้ำหนักสมรรถนะก่อน', 'This assessment plan is not ready to be reactivated. Check its competency weights first.'],
        COHORT_ALREADY_ASSIGNED: ['รุ่นนักศึกษานี้มีแบบแผนการประเมินที่กำหนดอยู่แล้ว', 'This student cohort already has a current template assignment.'],
        ASSIGNMENT_LOCKED_BY_SCORES: ['ไม่สามารถเปลี่ยนหรือถอด Template ได้ เพราะรุ่นนี้มีข้อมูลคะแนนผู้เรียนแล้ว', 'This assignment cannot change because the cohort has learner scores.'],
        TEMPLATE_HAS_NO_CURRICULUM: ['Template เดิมนี้ไม่มีหลักสูตรเจ้าของ จึงดูได้อย่างเดียว', 'This legacy template has no curriculum owner and is read-only.'],
        CONFIRMATION_REQUIRED: ['กรุณายืนยันการดำเนินการ', 'Please confirm this action.'],
        FORBIDDEN: ['คุณไม่มีสิทธิ์จัดการข้อมูลนี้', 'You do not have permission to manage this data.'],
    };
    const pair = messages[error?.code];
    return pair ? text(language, pair[0], pair[1]) : (error?.message || text(language, 'ไม่สามารถดำเนินการได้', 'Unable to complete the operation.'));
}

function formatDate(value, language) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function AssignmentActionModal({ language, action, loading, onClose, onContinue }) {
    const [reason, setReason] = useState('');
    const needsReason = action.type === 'replace' || action.type === 'unassign';
    const isReplace = action.type === 'replace';
    const template = action.template || action.assignment;
    return (
        <BaseModal
            open={Boolean(action.type)}
            size="md"
            title={isReplace ? text(language, 'เปลี่ยนแบบแผนการประเมิน', 'Replace template') : text(language, 'ถอดแบบแผนการประเมิน', 'Unassign template')}
            onClose={onClose}
            closeDisabled={loading}
            footer={<>
                <button type="button" className="course-btn course-btn--ghost" onClick={onClose} disabled={loading}>{text(language, 'ยกเลิก', 'Cancel')}</button>
                <button type="button" className="course-btn course-btn--danger" onClick={() => onContinue(reason)} disabled={loading || (needsReason && !reason.trim())}>{text(language, 'ดำเนินการต่อ', 'Continue')}</button>
            </>}
        >
            <p className="course-modal-message">
                {isReplace
                    ? text(language, `แบบแผนเดิม ${action.assignment?.templateName} จะสิ้นสุดการเชื่อม และแทนที่ด้วย ${template?.templateName || '-'}. ประวัติเดิมจะยังเก็บไว้`, `The current template ${action.assignment?.templateName} will be ended and replaced by ${template?.templateName || '-'}. Previous history will be kept.`)
                    : text(language, `แบบแผน ${action.assignment?.templateName} จะถูกถอดจากรุ่น ${action.assignment?.entryYearBe}.`, `Template ${action.assignment?.templateName} will be unassigned from cohort ${action.assignment?.entryYearBe}.`)}
            </p>
            <div className="template-assignment-impact">
                <span>{text(language, 'หลักสูตร', 'Curriculum')}</span><strong>{action.assignment?.curriculumCode} - {action.assignment?.curriculumNameTh}</strong>
                <span>{text(language, 'รุ่นนักศึกษา', 'Student cohort')}</span><strong>{action.assignment?.entryYearBe} · {action.assignment?.rosterCount || 0} {text(language, 'รายชื่อ', 'students')}</strong>
            </div>
            {needsReason && <label className="course-field">
                <span className="course-label">{text(language, 'เหตุผล', 'Reason')}<span className="course-required">*</span></span>
                <textarea className="course-input template-assignment-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder={text(language, 'ระบุเหตุผลที่ต้องเปลี่ยนหรือถอดแบบแผนการประเมิน', 'Explain why this Template is being changed or removed.')} />
            </label>}
        </BaseModal>
    );
}

export default function TemplateAssignmentsPage() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const isAdmin = user?.roles?.includes('admin');
    const [faculties, setFaculties] = useState([]);
    const [facultyId, setFacultyId] = useState('');
    const [availableTemplates, setAvailableTemplates] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);
    const [toast, setToast] = useState({ success: '', error: '' });
    const [assignmentTemplate, setAssignmentTemplate] = useState(null);
    const [availableCohorts, setAvailableCohorts] = useState([]);
    const [cohortsLoading, setCohortsLoading] = useState(false);
    const [action, setAction] = useState(EMPTY_ACTION);
    const [confirmation, setConfirmation] = useState(null);
    const [historyAssignment, setHistoryAssignment] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const scopedFacultyId = isAdmin ? facultyId : (facultyId || faculties[0]?.facultyId || '');

    useEffect(() => {
        let active = true;
        fetchFaculties()
            .then(items => {
                if (!active) return;
                setFaculties(items || []);
                if (!isAdmin && items?.length === 1) setFacultyId(String(items[0].facultyId));
            })
            .catch(error => active && setToast({ success: '', error: errorMessage(error, language) }));
        return () => { active = false; };
    }, [isAdmin, language]);

    const loadWorkspace = useCallback(async () => {
        setLoading(true);
        try {
            const filters = isAdmin && scopedFacultyId ? { facultyId: scopedFacultyId } : {};
            const [templates, currentAssignments] = await Promise.all([
                fetchAvailableAssignmentTemplates(filters),
                fetchTemplateAssignments(filters),
            ]);
            setAvailableTemplates(templates);
            setAssignments(currentAssignments);
        } catch (error) {
            setToast({ success: '', error: errorMessage(error, language) });
        } finally {
            setLoading(false);
        }
    }, [isAdmin, language, scopedFacultyId]);

    useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

    const openAssign = async template => {
        setAssignmentTemplate(template);
        setAvailableCohorts([]);
        setCohortsLoading(true);
        try {
            setAvailableCohorts(await fetchAvailableAssignmentCohorts(template.templateId));
        } catch (error) {
            setToast({ success: '', error: errorMessage(error, language) });
        } finally {
            setCohortsLoading(false);
        }
    };

    const openReplace = async assignment => {
        setOperationLoading(true);
        try {
            const candidates = await fetchAvailableAssignmentTemplates(isAdmin && scopedFacultyId ? { facultyId: scopedFacultyId } : {});
            setAssignmentTemplate({ ...assignment, replacementCandidates: candidates.filter(item => item.curriculumId === assignment.curriculumId) });
        } catch (error) {
            setToast({ success: '', error: errorMessage(error, language) });
        } finally {
            setOperationLoading(false);
        }
    };

    const openHistory = async assignment => {
        setHistoryAssignment(assignment);
        setHistory([]);
        setHistoryLoading(true);
        try {
            setHistory(await fetchTemplateAssignmentHistory(assignment.cohortId));
        } catch (error) {
            setToast({ success: '', error: errorMessage(error, language) });
        } finally {
            setHistoryLoading(false);
        }
    };

    const continueAction = reason => {
        const next = { ...action, reason: String(reason || '').trim() };
        setAction(EMPTY_ACTION);
        setConfirmation(next);
    };

    const confirmAction = async () => {
        if (!confirmation) return;
        setOperationLoading(true);
        try {
            if (confirmation.type === 'assign') {
                await createTemplateAssignment(confirmation.template.templateId, confirmation.cohort.cohortId);
                setToast({ success: text(language, 'กำหนดแบบแผนการประเมินให้รุ่นนักศึกษาแล้ว', 'Template assigned to the student cohort.'), error: '' });
            } else if (confirmation.type === 'replace') {
                await replaceTemplateAssignment(confirmation.assignment.assignmentId, confirmation.template.templateId, confirmation.reason);
                setToast({ success: text(language, 'เปลี่ยนแบบแผนการประเมินของรุ่นนักศึกษาแล้ว', 'Template assignment replaced.'), error: '' });
            } else {
                await removeTemplateAssignment(confirmation.assignment.assignmentId, confirmation.reason);
                setToast({ success: text(language, 'ถอดแบบแผนการประเมินออกจากรุ่นนักศึกษาแล้ว', 'Template unassigned from the student cohort.'), error: '' });
            }
            setConfirmation(null);
            setAssignmentTemplate(null);
            await loadWorkspace();
        } catch (error) {
            setToast({ success: '', error: errorMessage(error, language) });
        } finally {
            setOperationLoading(false);
        }
    };

    const facultyLocked = !isAdmin || faculties.length <= 1;
    const emptyAvailable = !loading && availableTemplates.length === 0;
    const emptyAssignments = !loading && assignments.length === 0;
    const confirmationTitle = confirmation?.type === 'assign'
        ? text(language, 'ยืนยันการกำหนดแบบแผนการประเมิน', 'Confirm template assignment')
        : confirmation?.type === 'replace'
            ? text(language, 'ยืนยันการเปลี่ยนแบบแผนการประเมิน', 'Confirm template replacement')
            : text(language, 'ยืนยันการถอดแบบแผนการประเมิน', 'Confirm template unassignment');

    return (
        <div className="template-assignments-page">
            <header className="course-list-header">
                <div className="course-list-header__left">
                    <h1 className="course-list-header__title">{text(language, 'กำหนดแบบแผนให้นักศึกษา', 'Assign plans to students')}</h1>
                    <p className="course-list-header__subtitle">{text(language, 'กำหนดแบบแผนการประเมินให้รุ่นนักศึกษา และนำแบบแผนที่เคยถอดแล้วกลับมาใช้ได้', 'Assign assessment plans to student cohorts and reuse plans whose previous assignment has ended.')}</p>
                </div>
                <div className="course-list-header__actions">
                    <button type="button" className="course-btn course-btn--ghost" onClick={loadWorkspace} disabled={loading || operationLoading}><RefreshCw size={16} className={loading ? 'template-assignment-spin' : ''} />{text(language, 'โหลดใหม่', 'Refresh')}</button>
                </div>
            </header>

            <ToastNotifications success={toast.success} error={toast.error} onCloseSuccess={() => setToast({ success: '', error: '' })} onCloseError={() => setToast({ success: '', error: '' })} />

            <section className="template-assignment-filter" aria-label={text(language, 'ตัวกรองคณะ', 'Faculty filter')}>
                <label className="course-field">
                    <span className="course-label">{text(language, 'คณะ', 'Faculty')}</span>
                    <select className="course-input" value={facultyId} disabled={facultyLocked} onChange={event => setFacultyId(event.target.value)}>
                        <option value="">{isAdmin ? text(language, 'ทุกคณะ', 'All faculties') : text(language, 'คณะของคุณ', 'Your faculty')}</option>
                        {faculties.map(faculty => <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.nameTh}</option>)}
                    </select>
                </label>
                <p>{text(language, 'แบบแผนหนึ่งชุดเชื่อมกับรุ่นได้ครั้งละหนึ่งรุ่น และนำกลับมาใช้กับรุ่นอื่นได้เมื่อถอดการเชื่อมเดิมแล้ว', 'A plan can be live with one cohort at a time and can be reused after its previous assignment ends.')}</p>
            </section>

            <section className="template-assignment-section">
                <div className="template-assignment-section__header">
                    <div><h2>{text(language, 'พร้อมกำหนด', 'Ready to assign')}</h2><p>{text(language, 'แบบแผนที่พร้อมใช้งานและยังไม่มีรุ่นกำลังใช้อยู่ สามารถนำแบบแผนเดิมกลับมาใช้ได้', 'Active or reusable assessment plans with no current cohort assignment.')}</p></div>
                    <span className="template-assignment-count"><Link2 size={15} /> {availableTemplates.length}</span>
                </div>
                {emptyAvailable ? <div className="template-assignment-empty">{text(language, 'ไม่มีแบบแผนที่พร้อมกำหนดในขณะนี้', 'No assessment plans are ready for assignment.')}</div> : (
                    <div className="template-assignment-ready-grid">
                        {availableTemplates.map(template => <article key={template.templateId} className="template-assignment-ready-item">
                            <div><strong>{template.templateName}</strong><span>{template.templateCode}</span>{template.wasAssignedBefore && <em className="template-assignment-reuse-badge">{text(language, 'เคยกำหนดแล้ว', 'Previously assigned')}</em>}</div>
                            <p>{template.curriculumCode} · {template.curriculumNameTh}</p>
                            {template.requiresReactivation && <p className="template-assignment-reuse-note">{text(language, 'ระบบจะตรวจความพร้อมและเปิดใช้งานก่อนเชื่อม', 'The plan will be validated and reactivated before assignment.')}</p>}
                            <button type="button" className="course-btn course-btn--primary" onClick={() => openAssign(template)} disabled={loading || operationLoading}><Link2 size={15} />{text(language, 'เชื่อมกับรุ่น', 'Assign to cohort')}</button>
                        </article>)}
                    </div>
                )}
            </section>

            <section className="template-assignment-section">
                <div className="template-assignment-section__header">
                    <div><h2>{text(language, 'กำหนดแล้ว', 'Current assignments')}</h2><p>{text(language, 'ตรวจสอบแบบแผนการประเมินที่กำลังใช้งานกับแต่ละรุ่นนักศึกษา', 'Review the assessment plan currently assigned to each student cohort.')}</p></div>
                    <span className="template-assignment-count"><Users size={15} /> {assignments.length}</span>
                </div>
                {emptyAssignments ? <div className="template-assignment-empty">{text(language, 'ยังไม่มีรุ่นนักศึกษาที่เชื่อม Template', 'No cohort currently has a Template assignment.')}</div> : (
                    <div className="template-assignment-table-wrap"><table className="template-assignment-table"><thead><tr>
                        <th>{text(language, 'รุ่นนักศึกษา', 'Cohort')}</th><th>{text(language, 'หลักสูตร', 'Curriculum')}</th><th>{text(language, 'Template ปัจจุบัน', 'Current template')}</th><th>{text(language, 'รายชื่อ', 'Roster')}</th><th>{text(language, 'วันที่เชื่อม', 'Assigned at')}</th><th>{text(language, 'สถานะ', 'State')}</th><th aria-label={text(language, 'การจัดการ', 'Actions')} />
                    </tr></thead><tbody>{assignments.map(assignment => <tr key={assignment.assignmentId}>
                        <td><strong>{text(language, 'รุ่น', 'Cohort')} {assignment.entryYearBe}</strong><span>{assignment.cohortStatus}</span></td>
                        <td><strong>{assignment.curriculumCode}</strong><span>{assignment.curriculumNameTh}</span></td>
                        <td><strong>{assignment.templateName}</strong><span>{assignment.templateIsActive ? text(language, 'แบบแผนที่พร้อมใช้งาน', 'Assessment plan active') : text(language, 'แบบแผนปิดใช้งานชั่วคราว', 'Assessment plan temporarily inactive')}</span></td>
                        <td>{assignment.rosterCount} {text(language, 'รายชื่อ', 'students')}</td><td>{formatDate(assignment.assignedAt, language)}</td>
                        <td>{assignment.scoreLocked ? <span className="template-assignment-state template-assignment-state--locked">{text(language, 'มีคะแนนแล้ว · ยังแก้ได้', 'Scores exist · Changeable')}</span> : <span className="template-assignment-state">{text(language, 'แก้ไขได้', 'Changeable')}</span>}</td>
                        <td><div className="template-assignment-actions"><button type="button" className="icon-btn" title={text(language, 'ดูประวัติ', 'View history')} onClick={() => openHistory(assignment)}><History size={17} /></button><button type="button" className="icon-btn" title={text(language, 'เปลี่ยน Template', 'Replace template')} disabled={operationLoading} onClick={() => openReplace(assignment)}><Replace size={17} /></button><button type="button" className="icon-btn icon-btn--danger" title={text(language, 'ถอด Template', 'Unassign template')} disabled={operationLoading} onClick={() => setAction({ type: 'unassign', assignment, template: null, cohort: null, reason: '' })}><Unlink size={17} /></button></div></td>
                    </tr>)}</tbody></table></div>
                )}
            </section>

            <BaseModal open={Boolean(assignmentTemplate && !assignmentTemplate.replacementCandidates)} title={text(language, 'เลือกรุ่นนักศึกษา', 'Select student cohort')} size="lg" onClose={() => setAssignmentTemplate(null)} footer={<button type="button" className="course-btn course-btn--ghost" onClick={() => setAssignmentTemplate(null)}>{text(language, 'ยกเลิก', 'Cancel')}</button>}>
                {assignmentTemplate && <><p className="course-modal-message">{assignmentTemplate.templateName} · {assignmentTemplate.curriculumCode} - {assignmentTemplate.curriculumNameTh}</p>{cohortsLoading ? <div className="template-assignment-empty">{text(language, 'กำลังโหลดรุ่นนักศึกษา...', 'Loading student cohorts...')}</div> : availableCohorts.length === 0 ? <div className="template-assignment-empty">{text(language, 'ไม่มีรุ่นที่พร้อมเชื่อมในหลักสูตรนี้', 'No active unassigned cohort is available for this curriculum.')}</div> : <div className="template-assignment-choice-list">{availableCohorts.map(cohort => <button type="button" key={cohort.cohortId} onClick={() => { setAssignmentTemplate(null); setConfirmation({ type: 'assign', template: assignmentTemplate, cohort, assignment: null, reason: '' }); }}><span><strong>{text(language, 'รุ่น', 'Cohort')} {cohort.entryYearBe}</strong><small>{cohort.rosterCount} {text(language, 'รายชื่อ', 'students')}</small></span><Check size={18} /></button>)}</div>}</>}
            </BaseModal>

            <BaseModal open={Boolean(assignmentTemplate?.replacementCandidates)} title={text(language, 'เลือกแบบแผนการประเมินใหม่', 'Select replacement assessment plan')} size="lg" onClose={() => setAssignmentTemplate(null)} footer={<button type="button" className="course-btn course-btn--ghost" onClick={() => setAssignmentTemplate(null)}>{text(language, 'ยกเลิก', 'Cancel')}</button>}>
                {assignmentTemplate && <><p className="course-modal-message">{text(language, `เลือกรายการสำหรับรุ่น ${assignmentTemplate.entryYearBe}`, `Choose a replacement for cohort ${assignmentTemplate.entryYearBe}.`)}</p>{assignmentTemplate.replacementCandidates.length === 0 ? <div className="template-assignment-empty">{text(language, 'ไม่มีแบบแผนที่พร้อมใช้ในหลักสูตรนี้', 'No reusable assessment plan is available in this curriculum.')}</div> : <div className="template-assignment-choice-list">{assignmentTemplate.replacementCandidates.map(template => <button type="button" key={template.templateId} onClick={() => { const assignment = assignments.find(item => item.assignmentId === assignmentTemplate.assignmentId); setAssignmentTemplate(null); setAction({ type: 'replace', assignment, template, cohort: null, reason: '' }); }}><span><strong>{template.templateName}</strong><small>{template.templateCode}{template.requiresReactivation ? ` · ${text(language, 'ต้องเปิดใช้งานใหม่', 'Reactivation required')}` : ''}</small></span><Replace size={18} /></button>)}</div>}</>}
            </BaseModal>

            <AssignmentActionModal language={language} action={action} loading={operationLoading} onClose={() => setAction(EMPTY_ACTION)} onContinue={continueAction} />
            <ConfirmActionModal open={Boolean(confirmation)} title={confirmationTitle} message={confirmation?.type === 'assign' ? text(language, `เชื่อม ${confirmation?.template?.templateName} กับรุ่น ${confirmation?.cohort?.entryYearBe}`, `Assign ${confirmation?.template?.templateName} to cohort ${confirmation?.cohort?.entryYearBe}`) : confirmation?.type === 'replace' && confirmation?.template?.requiresReactivation ? text(language, 'แบบแผนเดิมจะสิ้นสุดการเชื่อม และระบบจะตรวจความพร้อมของแบบแผนเก่าก่อนเปิดใช้งานกลับมา ประวัติและคะแนนเดิมจะยังเก็บไว้', 'The current assignment will end. The previous plan will be validated and reactivated before it is assigned again. Existing history and scores will be kept.') : text(language, 'การดำเนินการนี้จะเก็บประวัติการเชื่อมไว้ และสามารถนำแบบแผนกลับมาใช้ได้เมื่อไม่มีการเชื่อมปัจจุบัน', 'This keeps assignment history, and the plan can be reused when it has no current assignment.')} impact={confirmation && <div className="template-assignment-impact"><span>{text(language, 'หลักสูตร', 'Curriculum')}</span><strong>{confirmation.type === 'assign' ? confirmation.template.curriculumCode : confirmation.assignment.curriculumCode}</strong><span>{text(language, 'จำนวนรายชื่อ', 'Roster')}</span><strong>{confirmation.type === 'assign' ? confirmation.cohort.rosterCount : confirmation.assignment.rosterCount}</strong></div>} confirmLabel={text(language, 'ยืนยัน', 'Confirm')} cancelLabel={text(language, 'ยกเลิก', 'Cancel')} variant={confirmation?.type === 'assign' ? 'info' : 'danger'} loading={operationLoading} onConfirm={confirmAction} onCancel={() => setConfirmation(null)} />

            <BaseModal open={Boolean(historyAssignment)} title={text(language, 'ประวัติการเชื่อม Template', 'Template assignment history')} size="lg" onClose={() => setHistoryAssignment(null)} footer={<button type="button" className="course-btn course-btn--ghost" onClick={() => setHistoryAssignment(null)}>{text(language, 'ปิด', 'Close')}</button>}>
                {historyLoading ? <div className="template-assignment-empty">{text(language, 'กำลังโหลดประวัติ...', 'Loading history...')}</div> : <div className="template-assignment-history">{history.map(item => <article key={item.assignmentId}><div><strong>{item.templateName}</strong><span>{item.deletedAt ? text(language, 'สิ้นสุดแล้ว', 'Ended') : text(language, 'กำลังเชื่อมอยู่', 'Current')}</span></div><p>{text(language, 'เริ่มเชื่อม', 'Assigned')}: {formatDate(item.assignedAt, language)}</p>{item.endedAt && <><p>{text(language, 'สิ้นสุด', 'Ended')}: {formatDate(item.endedAt, language)}</p><p>{text(language, 'เหตุผล', 'Reason')}: {item.endReason || '-'}</p></>}</article>)}</div>}
            </BaseModal>
        </div>
    );
}
