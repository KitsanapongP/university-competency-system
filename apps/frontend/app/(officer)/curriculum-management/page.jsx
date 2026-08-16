'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, BookOpen, Trash2, Copy, Upload, ArrowLeft, Check, X, ChevronRight, Layers, Award } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import {
    createCurriculumCategory,
    createCurriculumCourse,
    commitCurriculumStructureImport,
    deleteCurriculum,
    deleteCurriculumCategory,
    deleteCurriculumCoursePlacement,
    duplicateCurriculum,
    fetchCurriculumDetail,
    fetchCurriculums,
	fetchFaculties,
    fetchMajors,
    getDeleteCurriculumCategoryPreview,
    previewCurriculumStructureImport,
    updateCurriculumCategory,
    updateCurriculumCoursePlacement,
    updateCurriculumCourseDetail,
	updateCurriculumMetadata,
    updateCurriculumStatus,
} from '../../../lib/curriculum';
import { getDisplayCourses } from '../../../lib/curriculum-structure';
import CurriculumCourseEditorPanel from './components/CurriculumCourseEditorPanel';
import CurriculumMetadataPanel from './components/CurriculumMetadataPanel';
import CurriculumStructureSidebar from './components/CurriculumStructureSidebar';
import CurriculumStructureImportModal from './components/CurriculumStructureImportModal';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import BaseModal from '../../../components/ui/BaseModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import DuplicateCourseWarningModal from '../../../components/ui/DuplicateCourseWarningModal';
import './CourseLayout.css';
import './CourseList.css';
import './CourseEditor.css';
import './CurriculumCourseEditorPanel.css';
import './CurriculumStructureSidebar.css';

// ============================================================
// Helper functions
// ============================================================
function findById(cats, id) {
    for (const c of cats) {
        if (c.id === id) return c;
        const f = findById(c.children || [], id);
        if (f) return f;
    }
    return null;
}

function getNextCode(parentCode, siblings) {
    const nextSegment = (siblings || []).reduce((max, sibling) => {
        const segments = String(sibling.code || '').split('.');
        return Math.max(max, Number(segments.at(-1)) || 0);
    }, 0) + 1;
    return parentCode ? `${parentCode}.${nextSegment}` : `${nextSegment}`;
}

function findCategoryInfo(cats, id, parent = null, siblings = cats, depth = 0) {
    for (let index = 0; index < cats.length; index += 1) {
        const category = cats[index];
        if (category.id === id) {
            return { category, parent, siblings, index, depth };
        }
        const childInfo = findCategoryInfo(category.children || [], id, category, category.children || [], depth + 1);
        if (childInfo) return childInfo;
    }
    return null;
}

function categoryContains(category, targetId) {
    return (category.children || []).some(child => child.id === targetId || categoryContains(child, targetId));
}

function getCategorySubtreeDepth(category) {
    if (!category?.children?.length) return 0;
    return Math.max(...category.children.map(child => 1 + getCategorySubtreeDepth(child)));
}

function getCategoryDepth(category, cats) {
    const info = findCategoryInfo(cats, category?.id);
    return info?.depth ?? -1;
}

function findCourseOwnerId(courseId, coursesByCategory) {
    const entry = Object.entries(coursesByCategory || {}).find(([, courses]) => {
        return (courses || []).some(course => String(course.id) === String(courseId));
    });
    return entry?.[0] || null;
}

function getCourseIdentity(course) {
    return String(course?.id ?? course?.curriculumCourseId ?? course?.courseId ?? '');
}

function normalizeName(value) {
    return String(value || '').trim();
}

function normalizeInsensitive(value) {
    return normalizeName(value).toLowerCase();
}

function getDuplicateCourseIssues(nextCourse, allCourses) {
    const labels = {
        code: 'รหัสวิชา',
        nameTh: 'ชื่อวิชาภาษาไทย',
        nameEn: 'ชื่อวิชาภาษาอังกฤษ',
    };
    const nextIdentity = getCourseIdentity(nextCourse);
    const otherCourses = (allCourses || []).filter(course => getCourseIdentity(course) !== nextIdentity);
    const issues = [];
    const nextCode = normalizeInsensitive(nextCourse.code);
    const nextNameTh = normalizeName(nextCourse.nameTh);
    const nextNameEn = normalizeInsensitive(nextCourse.nameEn);

    if (nextCode && otherCourses.some(course => normalizeInsensitive(course.code) === nextCode)) {
        issues.push(labels.code);
    }
    if (nextNameTh && otherCourses.some(course => normalizeName(course.nameTh) === nextNameTh)) {
        issues.push(labels.nameTh);
    }
    if (nextNameEn && otherCourses.some(course => normalizeInsensitive(course.nameEn) === nextNameEn)) {
        issues.push(labels.nameEn);
    }
    return issues;
}

const STATUS_LABELS = {
    draft: 'กำลังสร้าง',
    active: 'พร้อมใช้งาน',
    inactive: 'ปิดใช้งาน',
};

function getStatusAction(status) {
    if (status === 'active') {
        return { nextStatus: 'inactive', label: 'ปิดใช้งาน' };
    }
    return { nextStatus: 'active', label: 'เปิดใช้งาน' };
}

function buildConfirmationMessage(error) {
    const templates = error?.payload?.data?.affected_templates || [];
    const message = translateBackendMessage(error?.message);
    if (!templates.length) {
        return `${message}\n\nยืนยันดำเนินการต่อหรือไม่?`;
    }

    const templateList = templates
        .slice(0, 8)
        .map(template => `- ${template.name || template.code || 'Template'}${template.cohort_year_be ? ` (${template.cohort_year_be})` : ''}`)
        .join('\n');
    const more = templates.length > 8 ? `\n- และอีก ${templates.length - 8} รายการ` : '';

    return `${message}\n\nTemplate ที่อาจได้รับผลกระทบ:\n${templateList}${more}\n\nยืนยันดำเนินการต่อหรือไม่?`;
}

const BACKEND_MESSAGE_TH = {
    'curriculum structure is not ready to activate': 'โครงสร้างหลักสูตรยังไม่พร้อมเปิดใช้งาน',
    'status must be draft, active, or inactive': 'สถานะหลักสูตรไม่ถูกต้อง',
    'curriculum cannot transition back to draft': 'หลักสูตรที่ออกจาก Draft แล้ว ไม่สามารถย้อนกลับเป็น Draft ได้',
    'draft curriculum can only transition to active': 'หลักสูตร Draft สามารถเปลี่ยนเป็นพร้อมใช้งานได้เท่านั้น',
    'active curriculum can only transition to inactive': 'หลักสูตรที่พร้อมใช้งานสามารถเปลี่ยนเป็นปิดใช้งานได้เท่านั้น',
    'inactive curriculum can only transition to active': 'หลักสูตรที่ปิดใช้งานสามารถเปิดใช้งานได้เท่านั้น',
    'curriculum status is invalid': 'สถานะหลักสูตรปัจจุบันไม่ถูกต้อง',
    'curriculum cannot be inactive while active templates are connected': 'ยังปิดใช้งานหลักสูตรไม่ได้ เพราะมี Active Template เชื่อมอยู่',
    'curriculum cannot be deleted while templates are connected': 'ไม่สามารถลบหลักสูตรนี้ได้ เพราะมี Template เชื่อมอยู่',
    'curriculum cannot be deleted because it has real usage': 'ไม่สามารถลบหลักสูตรนี้ได้ เพราะมีข้อมูลการใช้งานจริงแล้ว ให้เปลี่ยนสถานะเป็นปิดใช้งานแทน',
    'curriculum structure is locked while active templates are connected': 'โครงสร้างหลักสูตรถูกล็อกอยู่ เพราะมี Active Template เชื่อมอยู่',
	'curriculum metadata is locked while active templates are connected': 'ข้อมูลหลักสูตรถูกล็อกอยู่ เพราะมี Active Template เชื่อมอยู่',
    'inactive curriculum edit requires confirmation because templates are connected': 'หลักสูตรนี้มี Template เชื่อมอยู่ กรุณายืนยันก่อนแก้ไข',
	'inactive curriculum metadata edit requires confirmation because templates are connected': 'หลักสูตรนี้มี Template เชื่อมอยู่ กรุณายืนยันก่อนแก้ไขข้อมูล',
	'curriculum major can only be changed while draft': 'เปลี่ยนสาขาได้เฉพาะหลักสูตรที่อยู่ในสถานะ Draft',
	'major_id must be active when changing curriculum major': 'สาขาปลายทางต้องเปิดใช้งานอยู่',
    'category delete requires confirmation': 'การลบหมวดวิชาต้องได้รับการยืนยันก่อน',
    'parent_id is invalid': 'หมวดวิชาหลักไม่ถูกต้อง',
    'category_id is invalid': 'หมวดวิชาไม่ถูกต้อง',
    'display_order must be zero or greater': 'ลำดับการแสดงผลต้องไม่น้อยกว่า 0',
    'category cannot be moved under itself or its child category': 'ไม่สามารถย้ายหมวดวิชาไปอยู่ใต้ตัวเองหรือหมวดย่อยของตัวเองได้',
    'category name_th is required': 'กรุณากรอกชื่อหมวดวิชาภาษาไทย',
    'category name_th cannot be empty': 'ชื่อหมวดวิชาภาษาไทยห้ามว่าง',
    'category required_credits must be zero or greater': 'หน่วยกิตของหมวดวิชาต้องไม่น้อยกว่า 0',
    'category display_order must be zero or greater': 'ลำดับหมวดวิชาต้องไม่น้อยกว่า 0',
    'course code is required': 'กรุณากรอกรหัสวิชา',
    'course code cannot be empty': 'รหัสวิชาห้ามว่าง',
    'course name_th is required': 'กรุณากรอกชื่อวิชาภาษาไทย',
    'course name_th cannot be empty': 'ชื่อวิชาภาษาไทยห้ามว่าง',
    'course credits must be zero or greater': 'หน่วยกิตรายวิชาต้องไม่น้อยกว่า 0',
    'course display_order must be zero or greater': 'ลำดับรายวิชาต้องไม่น้อยกว่า 0',
    'major_id is invalid': 'สาขาไม่ถูกต้อง',
    'major_id is required': 'กรุณาเลือกสาขา',
    'curriculum_code is required': 'กรุณากรอกรหัสหลักสูตร',
    'curriculum_name_th is required': 'กรุณากรอกชื่อหลักสูตรภาษาไทย',
    'effective_year_be is required': 'กรุณากรอกปีหลักสูตร',
    'course_id is not allowed when creating curriculum courses': 'การสร้างหลักสูตรต้องสร้างรายวิชาใหม่ ไม่สามารถอ้างอิง course_id เดิมได้',
    'duplicate course code in curriculum payload': 'มีรหัสวิชาซ้ำในหลักสูตร',
    'course code already exists in this curriculum': 'รหัสวิชานี้มีอยู่แล้วในหลักสูตร',
    'curriculum code already exists in this major': 'รหัสหลักสูตรนี้มีอยู่แล้วในสาขานี้',
    'curriculum name already exists in this major and effective year': 'มีชื่อหลักสูตรนี้อยู่แล้วในสาขาและปีการศึกษานี้',
    'curriculum already exists': 'มีหลักสูตรนี้อยู่แล้ว',
    'insufficient curriculum scope': 'คุณไม่มีสิทธิ์จัดการหลักสูตรนี้',
    'curriculum not found': 'ไม่พบหลักสูตร',
    'curriculum operation failed': 'ไม่สามารถดำเนินการกับหลักสูตรได้',
};

const CURRICULUM_VIOLATION_TH = {
    'curriculum must have at least one category': 'ต้องมีหมวดวิชาอย่างน้อย 1 หมวด',
    'curriculum must have at least one course': 'ต้องมีรายวิชาอย่างน้อย 1 รายวิชา',
    'all courses must have code, name_th, and credits >= 0': 'รายวิชาทุกตัวต้องมีรหัสวิชา ชื่อวิชาภาษาไทย และหน่วยกิตต้องไม่ติดลบ',
    'course code must be unique within the curriculum': 'รหัสวิชาต้องไม่ซ้ำกันภายในหลักสูตร',
};

function translateBackendMessage(message) {
    if (!message) return 'ไม่สามารถดำเนินการได้';
    return BACKEND_MESSAGE_TH[message] || message;
}

function normalizeViolationMessage(violation) {
    if (typeof violation === 'string') return violation;
    return violation?.message || violation?.reason || violation?.code || String(violation || '');
}

function translateViolation(violation) {
    const message = normalizeViolationMessage(violation);
    return CURRICULUM_VIOLATION_TH[message] || translateBackendMessage(message);
}

function mapCurriculumError(error) {
    const englishMessage = error?.message || error?.payload?.error?.message || '';
    const violations = error?.payload?.data?.violations || [];

    if (error?.code === 'CURRICULUM_STRUCTURE_LOCKED') {
        return {
            userMessage: 'โครงสร้างหลักสูตรถูกล็อกอยู่ เพราะมี Active Template เชื่อมอยู่',
            debugMessage: englishMessage,
        };
    }
	if (error?.code === 'CURRICULUM_METADATA_LOCKED') {
		return {
			userMessage: 'ข้อมูลหลักสูตรถูกล็อกอยู่ เพราะมี Active Template เชื่อมอยู่',
			debugMessage: englishMessage,
		};
	}
    if (error?.code === 'CURRICULUM_HAS_ACTIVE_TEMPLATE') {
        return {
            userMessage: 'ยังปิดใช้งานหลักสูตรไม่ได้ เพราะมี Active Template เชื่อมอยู่',
            debugMessage: englishMessage,
        };
    }
    if (error?.code === 'DUPLICATE') {
        return {
            userMessage: translateBackendMessage(englishMessage) || 'ข้อมูลซ้ำกับรายการเดิม',
            debugMessage: englishMessage,
        };
    }
    if (violations.length > 0) {
        const violationText = violations.map(violation => `- ${translateViolation(violation)}`).join('\n');
        return {
            userMessage: `${translateBackendMessage(englishMessage)}\n${violationText}`,
            debugMessage: `${englishMessage}\n${violations.map(normalizeViolationMessage).join('\n')}`,
        };
    }
    return {
        userMessage: translateBackendMessage(englishMessage) || 'ไม่สามารถบันทึกข้อมูลหลักสูตรได้',
        debugMessage: englishMessage,
    };
}

// ============================================================
// CourseCard — แสดงใน list view 
// ============================================================
function CourseCard({ course, onDuplicate, onDelete, onOpen }) {
    return (
        <div className="course-card" onClick={() => onOpen(course)}>
            <div className="course-card__header">
                <div className="course-card__icon">
                    <BookOpen size={24} />
                </div>
                <div className="course-card__actions">
                    <button className="icon-course-btn" title="ทำสำเนา" onClick={e => { e.stopPropagation(); onDuplicate(course); }}>
                        <Copy size={14} />
                    </button>
                    <button className="icon-course-btn icon-course-btn--danger" title="ลบ" onClick={e => { e.stopPropagation(); onDelete(course); }}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            <h3 className="course-card__title">
                {course.nameTh}
            </h3>
            <p className="course-card__subtitle">{course.nameEn}</p>
            <div className="course-card__meta">
                <span className="course-card__meta-item">
                    <BookOpen size={12} />
                    ปี {course.year}
                </span>
                <span className="course-card__meta-item">
                    <Award size={12} />
                    {course.degreeName}
                </span>
                <span className="course-card__meta-item">
                    <Layers size={12} />
                    {course.templateCount} Templates
                </span>
            </div>
            <div className="course-card__stats">
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.stats.totalCourses}</span>
                    <span className="course-card__stat-label">วิชา</span>
                </div>
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.stats.totalCategories}</span>
                    <span className="course-card__stat-label">หมวด</span>
                </div>
                <div className="course-card__stat">
                    <span className="course-card__stat-value">{course.stats.totalCredits}</span>
                    <span className="course-card__stat-label">หน่วยกิต</span>
                </div>
                <div className="course-card__status">
                    <span className={`course-card__badge ${course.isActive ? 'course-card__badge--active' : 'course-card__badge--inactive'}`}>
                        {course.isActive ? <Check size={12} /> : <X size={12} />}
                        {course.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Empty State
// ============================================================
function EmptyState({ onCreate }) {
    return (
        <div className="course-empty">
            <div className="course-empty__icon">
                <BookOpen size={40} />
            </div>
            <h3 className="course-empty__title">ยังไม่มีหลักสูตร</h3>
            <p className="course-empty__desc">เริ่มต้นสร้างหลักสูตรแรกของคุณเพื่อจัดการหลักสูตรนักศึกษา</p>
            <button className="course-btn course-btn--primary" onClick={onCreate}>
                <Plus size={16} /> สร้างหลักสูตร
            </button>
        </div>
    );
}

function DuplicateCurriculumModal({
    source,
    form,
    majors,
    loading,
    onChange,
    onClose,
    onSubmit,
}) {
    if (!source) return null;

    const canSubmit = Boolean(
        String(form.majorId || '').trim() &&
        String(form.code || '').trim() &&
        String(form.nameTh || '').trim() &&
        String(form.year || '').trim()
    ) && !loading;
    const hasSourceMajor = majors.some(major => String(major.majorId) === String(source.majorId));
    const displayedMajors = hasSourceMajor
        ? majors
        : [
            {
                majorId: source.majorId,
                nameTh: source.degreeName || `Major ID ${source.majorId}`,
                code: '',
            },
            ...majors,
        ];

    return (
        <BaseModal
            open
            title="ทำสำเนาหลักสูตร"
            size="md"
            onClose={onClose}
            closeDisabled={loading}
            footer={(
                <>
                    <button type="button" className="course-btn course-btn--ghost" onClick={onClose} disabled={loading}>
                        ยกเลิก
                    </button>
                    <button type="submit" form="duplicate-curriculum-form" className="course-btn course-btn--primary" disabled={!canSubmit}>
                        <Copy size={15} /> ทำสำเนา
                    </button>
                </>
            )}
        >
                <form id="duplicate-curriculum-form" onSubmit={onSubmit}>
                        <div className="course-field">
                            <label className="course-label">หลักสูตรต้นฉบับ</label>
                            <input className="course-input" value={source.nameTh || ''} disabled />
                        </div>
                        <div className="course-field">
                            <label className="course-label">สาขา *</label>
                            <select
                                className="course-input"
                                value={form.majorId}
                                onChange={e => onChange('majorId', e.target.value)}
                                disabled={loading}
                            >
                                {displayedMajors.map(major => (
                                    <option key={major.majorId} value={major.majorId}>
                                        {major.nameTh || major.code}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="course-field">
                            <label className="course-label">รหัสหลักสูตรใหม่ *</label>
                            <input
                                className="course-input"
                                value={form.code}
                                onChange={e => onChange('code', e.target.value)}
                                placeholder="เช่น CS70"
                                disabled={loading}
                            />
                        </div>
                        <div className="course-field">
                            <label className="course-label">ชื่อหลักสูตรใหม่ (ภาษาไทย) *</label>
                            <input
                                className="course-input"
                                value={form.nameTh}
                                onChange={e => onChange('nameTh', e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div className="course-field">
                            <label className="course-label">ชื่อหลักสูตรใหม่ (ภาษาอังกฤษ)</label>
                            <input
                                className="course-input"
                                value={form.nameEn}
                                onChange={e => onChange('nameEn', e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div className="course-field">
                            <label className="course-label">ปีการศึกษา *</label>
                            <input
                                className="course-input"
                                type="number"
                                value={form.year}
                                onChange={e => onChange('year', e.target.value)}
                                disabled={loading}
                            />
                        </div>
                </form>
        </BaseModal>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function CurriculumManagementPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { language, t } = useLanguage();
    const isAdmin = user?.roles?.includes('admin');
    const [view, setView] = useState('list'); // 'list' | 'editor'
    const [courses, setCourses] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [deletingCourse, setDeletingCourse] = useState(null);
    const [duplicatingCourse, setDuplicatingCourse] = useState(null);
    const [duplicateForm, setDuplicateForm] = useState({
        majorId: '',
        code: '',
        nameTh: '',
        nameEn: '',
        year: '',
    });
    const [majorOptions, setMajorOptions] = useState([]);
    const [faculties, setFaculties] = useState([]);
    const [detailTab, setDetailTab] = useState('structure');
    const [metadataFieldErrors, setMetadataFieldErrors] = useState({});
    const [metadataEditState, setMetadataEditState] = useState({ editing: false, dirty: false });
    const [metadataResetVersion, setMetadataResetVersion] = useState(0);
    const [metadataImpactConfirmation, setMetadataImpactConfirmation] = useState(null);
    const [discardConfirmation, setDiscardConfirmation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoadingId, setDetailLoadingId] = useState(null);
    const [operationLoading, setOperationLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorDebug, setErrorDebug] = useState('');
    const [success, setSuccess] = useState('');
    const [toast, setToast] = useState({ success: '', error: '', errorDebug: '' });
    const [showStructureImport, setShowStructureImport] = useState(false);

    const loadCurriculums = useCallback(async () => {
        setLoading(true);
        setError('');
        setErrorDebug('');
        try {
            const data = await fetchCurriculums();
            setCourses(data);
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage || 'ไม่สามารถโหลดข้อมูลหลักสูตรได้');
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum load error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCurriculums();
    }, [loadCurriculums]);

    useEffect(() => {
        let cancelled = false;

        async function loadMajors() {
            try {
                const majors = await fetchMajors({ includeInactive: true });
                if (!cancelled) {
                    setMajorOptions(majors);
                }
            } catch (err) {
                console.debug('Major options load error:', err);
            }
        }

        loadMajors();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadFaculties() {
            try {
                const data = await fetchFaculties();
                if (!cancelled) {
                    setFaculties(data);
                }
            } catch (err) {
                console.debug('Faculty options load error:', err);
            }
        }

        loadFaculties();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('created') === '1') {
            setSuccess('สร้างหลักสูตรสำเร็จ');
        }
    }, []);

    useEffect(() => {
        if (!success) return undefined;
        setToast({ success, error: '', errorDebug: '' });
        return undefined;
    }, [success]);

    useEffect(() => {
        if (!error) return undefined;
        setToast({ success: '', error, errorDebug });
        return undefined;
    }, [error, errorDebug]);

    useEffect(() => {
        if (!toast.success) return undefined;
        const timer = window.setTimeout(() => {
            setToast(current => (
                current.success === toast.success
                    ? { ...current, success: '' }
                    : current
            ));
        }, 5000);
        return () => window.clearTimeout(timer);
    }, [toast.success]);

    // Filter courses
    const filteredCourses = courses.filter(c => {
        const term = search.toLowerCase();
        return (c.nameTh || '').toLowerCase().includes(term) ||
            (c.nameEn || '').toLowerCase().includes(term) ||
            (c.code || '').toLowerCase().includes(term) ||
            String(c.year).includes(term);
    });

    // Stats
    const totalCourses = courses.length;
    const activeCourses = courses.filter(c => c.isActive).length;
    const totalTemplates = courses.reduce((sum, c) => sum + c.templateCount, 0);
    const totalCurriculumCredits = courses.reduce((sum, c) => sum + (c.stats?.totalCredits || 0), 0);

    // Handlers
    const handleOpenCourse = useCallback(async (course) => {
        setDetailLoadingId(course.id);
        setError('');
        setErrorDebug('');
        setSuccess('');
        try {
            const detail = await fetchCurriculumDetail(course.curriculumId || course.id);
            setSelectedCourse(detail);
            setSelectedCategory(null);
            setShowAllCourses(true);
            setDetailTab('structure');
            setMetadataFieldErrors({});
            setMetadataEditState({ editing: false, dirty: false });
            setView('editor');
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage || 'ไม่สามารถโหลดรายละเอียดหลักสูตรได้');
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum detail load error:', err);
        } finally {
            setDetailLoadingId(null);
        }
    }, []);

    const returnToList = useCallback(() => {
        setView('list');
        setSelectedCourse(null);
        setSelectedCategory(null);
        setShowAllCourses(false);
        setDetailTab('structure');
        setMetadataFieldErrors({});
        setMetadataEditState({ editing: false, dirty: false });
    }, []);

    const handleBackToList = useCallback(() => {
        if (metadataEditState.dirty) {
            setDiscardConfirmation({ action: 'list' });
            return;
        }
        returnToList();
    }, [metadataEditState.dirty, returnToList]);

    const handleCreateCourse = useCallback(() => {
        router.push('/curriculum-management/create');
    }, [router]);

    const handleDuplicateCourse = useCallback((course) => {
        setError('');
        setErrorDebug('');
        setSuccess('');
        setDuplicatingCourse(course);
        setDuplicateForm({
            majorId: String(course.majorId || ''),
            code: '',
            nameTh: `${course.nameTh || ''} (คัดลอก)`.trim(),
            nameEn: course.nameEn ? `${course.nameEn} (Copy)` : '',
            year: String(course.year || ''),
        });
    }, []);

    const handleDuplicateFormChange = useCallback((field, value) => {
        setDuplicateForm(current => ({ ...current, [field]: value }));
    }, []);

    const handleConfirmDuplicateCourse = useCallback(async (event) => {
        event.preventDefault();
        if (!duplicatingCourse || operationLoading) {
            return;
        }

        setOperationLoading(true);
        setError('');
        setErrorDebug('');
        setSuccess('');
        try {
            await duplicateCurriculum(duplicatingCourse.curriculumId || duplicatingCourse.id, duplicateForm);
            setDuplicatingCourse(null);
            setSuccess('ทำสำเนาหลักสูตรเรียบร้อยแล้ว');
            await loadCurriculums();
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage || 'ไม่สามารถทำสำเนาหลักสูตรได้');
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum duplicate error:', err);
        } finally {
            setOperationLoading(false);
        }
    }, [duplicateForm, duplicatingCourse, loadCurriculums, operationLoading]);

    const handleDeleteCourse = useCallback((course) => {
        if (course.templateCount > 0) {
            alert(`ไม่สามารถลบหลักสูตร "${course.nameTh}" ได้ เนื่องจากมี Template เชื่อมอยู่ ${course.templateCount} รายการ`);
            return;
        }
        setError('');
        setErrorDebug('');
        setSuccess('');
        setDeletingCourse(course);
    }, []);

    const handleConfirmDeleteCourse = useCallback(async () => {
        if (!deletingCourse || operationLoading) {
            return;
        }

        setOperationLoading(true);
        setError('');
        setErrorDebug('');
        setSuccess('');
        try {
            await deleteCurriculum(deletingCourse.curriculumId || deletingCourse.id);
            setDeletingCourse(null);
            if (selectedCourse?.id === deletingCourse.id) {
                setSelectedCourse(null);
                setView('list');
            }
            setSuccess('ลบหลักสูตรเรียบร้อยแล้ว');
            await loadCurriculums();
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage || 'ไม่สามารถลบหลักสูตรได้');
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum delete error:', err);
        } finally {
            setOperationLoading(false);
        }
    }, [deletingCourse, loadCurriculums, operationLoading, selectedCourse]);

    // ============================================================
    // Editor View (Category/Curriculum Management)
    // ============================================================
    const [categories, setCategories] = useState(selectedCourse?.categories || []);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [coursesByCategory, setCoursesByCategory] = useState({});
    const [deletingCategory, setDeletingCategory] = useState(null);
    const [courseDeleteConfirmation, setCourseDeleteConfirmation] = useState(null);
    const [courseDeleteImpactConfirmation, setCourseDeleteImpactConfirmation] = useState(null);
    const [courseDuplicateWarning, setCourseDuplicateWarning] = useState(null);
    const [draggedCategoryId, setDraggedCategoryId] = useState(null);
    const [draggedCourseId, setDraggedCourseId] = useState(null);
    const [dropTargetCategoryId, setDropTargetCategoryId] = useState(null);
    const [isCourseEditorEditing, setIsCourseEditorEditing] = useState(false);

    useEffect(() => {
        const nextCategories = selectedCourse?.categories || [];
        setCategories(nextCategories);
        setCoursesByCategory(selectedCourse?.coursesByCategory || {});
        setSelectedCategory(current => (current ? findById(nextCategories, current.id) : null));
        if (!selectedCourse) {
            setShowAllCourses(false);
        }
    }, [selectedCourse]);

    const commitCurriculumMutation = useCallback(async (operation, successMessage) => {
        let confirmImpact = false;

        for (;;) {
            setOperationLoading(true);
            setError('');
            setErrorDebug('');
            setSuccess('');

            try {
                const detail = await operation(confirmImpact);
                setSelectedCourse(detail);
                setSuccess(successMessage);
                await loadCurriculums();
                return detail;
            } catch (err) {
                const needsConfirmation = err?.status === 409 && err?.code === 'CONFIRMATION_REQUIRED' && !confirmImpact;
                if (needsConfirmation && window.confirm(buildConfirmationMessage(err))) {
                    confirmImpact = true;
                    continue;
                }

                const mapped = mapCurriculumError(err);
                setError(mapped.userMessage);
                setErrorDebug(mapped.debugMessage);
                console.debug('Curriculum mutation error:', err);
                return null;
            } finally {
                setOperationLoading(false);
            }
        }
    }, [loadCurriculums]);

    const handleCommitStructureImport = useCallback(async (rows, confirmImpact) => {
        if (!selectedCourse) return null;
        setOperationLoading(true);
        setError('');
        setErrorDebug('');
        try {
            const detail = await commitCurriculumStructureImport(selectedCourse.curriculumId, rows, confirmImpact);
            setSelectedCourse(detail);
            setSelectedCategory(null);
            setShowAllCourses(true);
            setSuccess(language === 'en' ? 'Courses imported successfully.' : 'นำเข้ารายวิชาสำเร็จ');
            await loadCurriculums();
            return detail;
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage);
            setErrorDebug(mapped.debugMessage);
            throw err;
        } finally {
            setOperationLoading(false);
        }
    }, [language, loadCurriculums, selectedCourse]);

    const handleSelectAllCourses = useCallback(() => {
        setSelectedCategory(null);
        setShowAllCourses(true);
    }, []);

    const handleSelectCategory = useCallback((cat) => {
        setSelectedCategory(cat);
        setShowAllCourses(false);
    }, []);

    const handleClearCurriculumSelection = useCallback(() => {
        setSelectedCategory(null);
        setShowAllCourses(false);
    }, []);

    const handleAddCategory = useCallback(async (parentCategory = null) => {
        if (!selectedCourse) return;
        const targetParent = parentCategory || selectedCategory;
        const parentId = targetParent?.id;
        const siblings = parentId ? targetParent.children || [] : categories;
        const code = getNextCode(targetParent?.code || '', siblings);

        await commitCurriculumMutation((confirmImpact) => createCurriculumCategory(selectedCourse.curriculumId, {
            parentId: parentId || null,
            code,
            name: 'หมวดวิชาใหม่',
            requiredCredits: 0,
            displayOrder: siblings.length + 1,
        }, confirmImpact), 'เพิ่มหมวดวิชาแล้ว');
    }, [categories, commitCurriculumMutation, selectedCategory, selectedCourse]);

    const handleRenameCategory = useCallback(async (id, updates) => {
        if (!selectedCourse) return null;
        const current = findById(categories, id);
        if (!current) return null;

        const payload = typeof updates === 'string' ? { nameTh: updates } : updates;
        return commitCurriculumMutation((confirmImpact) => updateCurriculumCategory(selectedCourse.curriculumId, id, {
            parentId: Object.prototype.hasOwnProperty.call(payload, 'parentId') ? payload.parentId : current.parentId,
            code: payload.code ?? current.code,
            nameTh: payload.nameTh ?? payload.name ?? current.name,
            nameEn: payload.nameEn ?? current.nameEn,
            requiredCredits: payload.requiredCredits ?? current.requiredCredits,
            displayOrder: payload.displayOrder ?? current.displayOrder,
        }, confirmImpact), 'บันทึกหมวดวิชาแล้ว');
    }, [categories, commitCurriculumMutation, selectedCourse]);

    const handleRequestDeleteCategory = useCallback(async (cat) => {
        if (!selectedCourse || !cat?.id) return;
        setError('');
        setErrorDebug('');
        try {
            const preview = await getDeleteCurriculumCategoryPreview(selectedCourse.curriculumId, cat.id);
            setDeletingCategory({ ...cat, deletePreview: preview });
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage);
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum delete preview error:', err);
        }
    }, [selectedCourse]);

    const handleConfirmDeleteCategory = useCallback(async () => {
        if (!deletingCategory) return;
        await commitCurriculumMutation(() => deleteCurriculumCategory(selectedCourse.curriculumId, deletingCategory.id, true), 'ลบหมวดวิชาแล้ว');
        setDeletingCategory(null);
    }, [commitCurriculumMutation, deletingCategory, selectedCourse]);


    const handleAddCourse = useCallback(async (data) => {
        if (!selectedCourse || !selectedCategory) return null;
        const displayOrder = (coursesByCategory[selectedCategory.id] || []).length + 1;
        return commitCurriculumMutation((confirmImpact) => createCurriculumCourse(selectedCourse.curriculumId, selectedCategory.id, {
            ...data,
            displayOrder,
        }, confirmImpact), 'เพิ่มรายวิชาสำเร็จ');
    }, [commitCurriculumMutation, coursesByCategory, selectedCategory, selectedCourse]);

    const handleUpdateCourse = useCallback(async (updatedCourse) => {
        if (!selectedCourse || !updatedCourse?.courseId) return null;
        return commitCurriculumMutation((confirmImpact) => updateCurriculumCourseDetail(selectedCourse.curriculumId, updatedCourse.courseId, {
            code: updatedCourse.code,
            nameTh: updatedCourse.nameTh,
            nameEn: updatedCourse.nameEn,
            credits: updatedCourse.credits,
            description: updatedCourse.description,
        }, confirmImpact), 'บันทึกรายวิชาสำเร็จ');
    }, [commitCurriculumMutation, selectedCourse]);

    const handleValidateCourseBeforeSave = useCallback((nextCourse, allCourses) => {
        const issues = getDuplicateCourseIssues(nextCourse, allCourses);
        if (issues.length > 0) {
            setCourseDuplicateWarning({ issues, course: nextCourse });
            return false;
        }
        setCourseDuplicateWarning(null);
        return true;
    }, []);

    const handleRequestDeleteCourseInEditor = useCallback((course) => {
        if (!selectedCourse || !course?.curriculumCourseId) return false;
        setCourseDeleteConfirmation({
            mode: 'single',
            courses: [course],
        });
        return false;
    }, [selectedCourse]);

    const handleRequestBulkDeleteCoursesInEditor = useCallback((selectedCourses) => {
        if (!selectedCourse || !selectedCourses?.length) return false;
        setCourseDeleteConfirmation({
            mode: 'bulk',
            courses: selectedCourses,
        });
        return false;
    }, [selectedCourse]);

    const handleConfirmDeleteCourseInEditor = useCallback(async (course, confirmImpact = false) => {
        if (!selectedCourse || !course?.curriculumCourseId) return false;
        setOperationLoading(true);
        setError('');
        setErrorDebug('');
        setSuccess('');

        try {
            const detail = await deleteCurriculumCoursePlacement(
                selectedCourse.curriculumId,
                course.curriculumCourseId,
                confirmImpact,
            );
            setSelectedCourse(detail);
            setSuccess('ถอดรายวิชาแล้ว');
            setCourseDeleteConfirmation(null);
            setCourseDeleteImpactConfirmation(null);
            await loadCurriculums();
            return true;
        } catch (err) {
            const needsConfirmation = err?.status === 409 && err?.code === 'CONFIRMATION_REQUIRED' && !confirmImpact;
            if (needsConfirmation) {
                setCourseDeleteConfirmation(null);
                setCourseDeleteImpactConfirmation({
                    mode: 'single',
                    courses: [course],
                    error: err,
                });
                return false;
            }

            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage);
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum delete course error:', err);
            return false;
        } finally {
            setOperationLoading(false);
        }
    }, [loadCurriculums, selectedCourse]);

    const handleConfirmBulkDeleteCoursesInEditor = useCallback(async (selectedCourses, confirmImpact = false, resumeIndex = 0) => {
        if (!selectedCourse || !selectedCourses?.length) return false;
        let lastDetail = null;
        setOperationLoading(true);
        setError('');
        setErrorDebug('');
        setSuccess('');

        try {
            for (let index = resumeIndex; index < selectedCourses.length; index += 1) {
                const course = selectedCourses[index];
                if (!course?.curriculumCourseId) continue;
                try {
                    lastDetail = await deleteCurriculumCoursePlacement(
                        selectedCourse.curriculumId,
                        course.curriculumCourseId,
                        confirmImpact,
                    );
                } catch (err) {
                    const needsConfirmation = err?.status === 409 && err?.code === 'CONFIRMATION_REQUIRED' && !confirmImpact;
                    if (needsConfirmation) {
                        setCourseDeleteConfirmation(null);
                        setCourseDeleteImpactConfirmation({
                            mode: 'bulk',
                            courses: selectedCourses,
                            resumeIndex: index,
                            error: err,
                        });
                        return false;
                    }
                    throw err;
                }
            }

            if (lastDetail) {
                setSelectedCourse(lastDetail);
            }
            setSuccess(`ถอดรายวิชาแล้ว ${selectedCourses.length} วิชา`);
            setCourseDeleteConfirmation(null);
            setCourseDeleteImpactConfirmation(null);
            await loadCurriculums();
            return true;
        } catch (err) {
            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage);
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum bulk delete course error:', err);
            return false;
        } finally {
            setOperationLoading(false);
        }
    }, [loadCurriculums, selectedCourse]);

    const handleCategoryDragStart = useCallback((event, category) => {
        if (operationLoading) return;
        event.stopPropagation();
        setDraggedCategoryId(category.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(category.id));
    }, [operationLoading]);

    const handleCategoryDragOver = useCallback((event, targetCategory) => {
        const draggedInfo = draggedCategoryId ? findCategoryInfo(categories, draggedCategoryId) : null;
        const draggedCategory = draggedInfo?.category;
        if (!draggedCategory) return;

        if (draggedCategory.id === targetCategory.id || categoryContains(draggedCategory, targetCategory.id)) {
            event.stopPropagation();
            setDropTargetCategoryId(current => current === targetCategory.id ? null : current);
            return;
        }

        const targetInfo = findCategoryInfo(categories, targetCategory.id);
        const nextDepth = (targetInfo?.depth ?? 0) + 1 + getCategorySubtreeDepth(draggedCategory);
        if (nextDepth > 3) {
            event.stopPropagation();
            setDropTargetCategoryId(current => current === targetCategory.id ? null : current);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId(targetCategory.id);
    }, [categories, draggedCategoryId]);

    const handleCategoryDrop = useCallback(async (event, targetCategory) => {
        event.preventDefault();
        event.stopPropagation();
        if (!selectedCourse || !draggedCategoryId || draggedCategoryId === targetCategory.id) return;

        const draggedInfo = findCategoryInfo(categories, draggedCategoryId);
        const draggedCategory = draggedInfo?.category;
        if (!draggedCategory || categoryContains(draggedCategory, targetCategory.id)) return;

        const targetInfo = findCategoryInfo(categories, targetCategory.id);
        const nextDepth = (targetInfo?.depth ?? 0) + 1 + getCategorySubtreeDepth(draggedCategory);
        if (nextDepth > 3) return;

        const displayOrder = (targetCategory.children || []).length + 1;
        await handleRenameCategory(draggedCategoryId, {
            parentId: targetCategory.id,
            displayOrder,
        });
        setDraggedCategoryId(null);
        setDropTargetCategoryId(null);
    }, [categories, draggedCategoryId, handleRenameCategory, selectedCourse]);

    const handleCategoryRootDragOver = useCallback((event) => {
        const draggedInfo = draggedCategoryId ? findCategoryInfo(categories, draggedCategoryId) : null;
        if (!draggedInfo?.category) return;
        if (getCategorySubtreeDepth(draggedInfo.category) > 3) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId('root');
    }, [categories, draggedCategoryId]);

    const handleCategoryRootDrop = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedCourse || !draggedCategoryId) return;

        const displayOrder = categories.filter(category => category.id !== draggedCategoryId).length + 1;
        await handleRenameCategory(draggedCategoryId, {
            parentId: null,
            displayOrder,
        });
        setDraggedCategoryId(null);
        setDropTargetCategoryId(null);
    }, [categories, draggedCategoryId, handleRenameCategory, selectedCourse]);

    const handleCategoryDragEnd = useCallback(() => {
        setDraggedCategoryId(null);
        setDropTargetCategoryId(null);
    }, []);

    const handleCategoryDragLeave = useCallback((event, category) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setDropTargetCategoryId(current => current === category.id ? null : current);
    }, []);

    const handleCourseDragStart = useCallback((event, course) => {
        if (operationLoading) return;
        event.stopPropagation();
        setDraggedCourseId(course.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(course.id));
    }, [operationLoading]);

    const handleCourseCategoryDragOver = useCallback((event, targetCategory) => {
        if (!draggedCourseId) return;
        if (targetCategory.children?.length) {
            event.stopPropagation();
            setDropTargetCategoryId(current => current === targetCategory.id ? null : current);
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId(targetCategory.id);
    }, [draggedCourseId]);

    const handleCourseCategoryDrop = useCallback(async (event, targetCategory) => {
        if (!selectedCourse || !draggedCourseId || targetCategory.children?.length) return;
        event.preventDefault();
        event.stopPropagation();

        const sourceCategoryId = findCourseOwnerId(draggedCourseId, coursesByCategory);
        const movingCourse = sourceCategoryId
            ? (coursesByCategory[sourceCategoryId] || []).find(course => course.id === draggedCourseId)
            : null;
        if (!movingCourse?.curriculumCourseId) return;

        const displayOrder = (coursesByCategory[targetCategory.id] || []).length + 1;
        await commitCurriculumMutation((confirmImpact) => updateCurriculumCoursePlacement(selectedCourse.curriculumId, movingCourse.curriculumCourseId, {
            categoryId: targetCategory.id,
            displayOrder,
        }, confirmImpact), 'ย้ายรายวิชาสำเร็จ');
        setSelectedCategory(targetCategory);
        setShowAllCourses(false);
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
    }, [commitCurriculumMutation, coursesByCategory, draggedCourseId, selectedCourse]);

    const handleMoveCourseInEditor = useCallback(async ({ draggedCourseId: movingCourseId, targetCategory, beforeCourseId = null }) => {
        if (!selectedCourse || !movingCourseId || !targetCategory || targetCategory.children?.length) return null;

        const sourceCategoryId = findCourseOwnerId(movingCourseId, coursesByCategory);
        const movingCourse = sourceCategoryId
            ? (coursesByCategory[sourceCategoryId] || []).find(course => String(course.id) === String(movingCourseId))
            : null;
        if (!movingCourse?.curriculumCourseId) return null;

        const targetList = coursesByCategory[targetCategory.id] || [];
        const targetIndex = beforeCourseId
            ? targetList.findIndex(course => String(course.id) === String(beforeCourseId))
            : -1;
        const displayOrder = targetIndex >= 0 ? targetIndex + 1 : targetList.length + 1;

        const detail = await commitCurriculumMutation((confirmImpact) => updateCurriculumCoursePlacement(selectedCourse.curriculumId, movingCourse.curriculumCourseId, {
            categoryId: targetCategory.id,
            displayOrder,
        }, confirmImpact), 'ย้ายรายวิชาสำเร็จ');
        setSelectedCategory(targetCategory);
        setShowAllCourses(false);
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
        return detail;
    }, [commitCurriculumMutation, coursesByCategory, selectedCourse]);

    const handleCourseDragEnd = useCallback(() => {
        setDraggedCourseId(null);
        setDropTargetCategoryId(null);
    }, []);

    const handleChangeStatus = useCallback(async (nextStatus) => {
        if (!selectedCourse) return null;
        return commitCurriculumMutation((confirmImpact) => updateCurriculumStatus(selectedCourse.curriculumId, nextStatus, confirmImpact), 'อัปเดตสถานะหลักสูตรแล้ว');
    }, [commitCurriculumMutation, selectedCourse]);

    const handleSaveMetadata = useCallback(async (form, confirmImpact = false) => {
        if (!selectedCourse || operationLoading) return false;

        setOperationLoading(true);
        setError('');
        setErrorDebug('');
        setSuccess('');
        setMetadataFieldErrors({});

        try {
            const detail = await updateCurriculumMetadata(selectedCourse.curriculumId, form, confirmImpact);
            setSelectedCourse(detail);
            setMetadataImpactConfirmation(null);
			setMetadataResetVersion(current => current + 1);
            setSuccess('บันทึกข้อมูลหลักสูตรแล้ว');
            await loadCurriculums();
            return true;
        } catch (err) {
            const needsConfirmation = err?.status === 409 && err?.code === 'CONFIRMATION_REQUIRED' && !confirmImpact;
            if (needsConfirmation) {
                setMetadataImpactConfirmation({
                    form,
                    affectedTemplates: err?.payload?.data?.affected_templates || [],
                });
                return false;
            }

            const message = err?.message || err?.payload?.error?.message || '';
            if (err?.code === 'DUPLICATE' && message === 'curriculum code already exists in this major') {
                setMetadataFieldErrors({ code: 'รหัสหลักสูตรนี้มีอยู่แล้วในสาขานี้' });
                return false;
            }
            if (err?.code === 'DUPLICATE' && message === 'curriculum name already exists in this major and effective year') {
                setMetadataFieldErrors({ nameTh: 'มีชื่อหลักสูตรนี้อยู่แล้วในสาขาและปีการศึกษาที่เลือก' });
                return false;
            }

            const mapped = mapCurriculumError(err);
            setError(mapped.userMessage || 'ไม่สามารถบันทึกข้อมูลหลักสูตรได้');
            setErrorDebug(mapped.debugMessage);
            console.debug('Curriculum metadata update error:', err);
            return false;
        } finally {
            setOperationLoading(false);
        }
    }, [loadCurriculums, operationLoading, selectedCourse]);

    const handleMetadataFieldChange = useCallback((field) => {
        setMetadataFieldErrors(current => {
            if (!current[field]) return current;
            const next = { ...current };
            delete next[field];
            return next;
        });
    }, []);

    const handleDetailTabChange = useCallback((nextTab) => {
        if (nextTab === detailTab) return;
        if (metadataEditState.dirty) {
            setDiscardConfirmation({ action: 'tab', nextTab });
            return;
        }
        setDetailTab(nextTab);
    }, [detailTab, metadataEditState.dirty]);

    const handleRequestChangeStatus = useCallback((nextStatus) => {
        if (metadataEditState.dirty) {
            setDiscardConfirmation({ action: 'status', nextStatus });
            return;
        }
        handleChangeStatus(nextStatus);
    }, [handleChangeStatus, metadataEditState.dirty]);

    const handleConfirmDiscard = useCallback(() => {
        const pending = discardConfirmation;
        setDiscardConfirmation(null);
        setMetadataResetVersion(current => current + 1);
        if (!pending) return;
        if (pending.action === 'list') {
            returnToList();
            return;
        }
        if (pending.action === 'tab') {
            setDetailTab(pending.nextTab);
            return;
        }
        if (pending.action === 'status') {
            handleChangeStatus(pending.nextStatus);
        }
    }, [discardConfirmation, handleChangeStatus, returnToList]);

    const statusAction = selectedCourse ? getStatusAction(selectedCourse.status) : null;

    // ============================================================
    // Render
    // ============================================================
    return (
        <>
            <ToastNotifications
                success={toast.success}
                error={toast.error}
                errorDebug={toast.errorDebug}
                onCloseSuccess={() => setToast(current => ({ ...current, success: '' }))}
                onCloseError={() => {
                    setToast(current => ({ ...current, error: '', errorDebug: '' }));
                }}
            />

            {/* หน้าแรก รวมหลักสูตรทั้งหมด */}
            {view === 'list' ? (
                <div className="course-list-page">
                    {/* Header */}
                    <div className="course-list-header">
                        <div className="course-list-header__left">
                            <h1 className="course-list-header__title">จัดการหลักสูตร</h1>
                            <p className="course-list-header__subtitle">สร้างและจัดการหลักสูตรสำหรับนักศึกษา</p>
                        </div>
                        <div className="course-list-header__actions">
                            <button className="course-btn course-btn--ghost">
                                <Upload size={16} /> Import
                            </button>
                            <button className="course-btn course-btn--primary" onClick={handleCreateCourse}>
                                <Plus size={16} /> สร้างหลักสูตร
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="course-stats-row">
                        <div className="course-stat-card">
                            <div className="course-stat-card__icon">
                                <BookOpen size={22} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{totalCourses}</span>
                                <span className="course-stat-card__label">หลักสูตรทั้งหมด</span>
                            </div>
                        </div>
                        <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--courses">
                            <BookOpen size={20} />
                        </div>
                        <div className="course-stat-card__content">
                            <span className="course-stat-card__value">{activeCourses}</span>
                            <span className="course-stat-card__label">หลักสูตร</span>
                        </div>
                    </div>
                    <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--categories">
                            <Layers size={20} />
                        </div>
                        <div className="course-stat-card__content">
                            <span className="course-stat-card__value">{totalTemplates}</span>
                            <span className="course-stat-card__label">หมวดวิชา</span>
                        </div>
                    </div>
                    <div className="course-stat-card">
                        <div className="course-stat-card__icon course-stat-card__icon--credits">
                                <Layers size={22} />
                            </div>
                            <div className="course-stat-card__content">
                                <span className="course-stat-card__value">{totalCurriculumCredits}</span>
                                <span className="course-stat-card__label">หมวดวิชาทั้งหมด</span>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="course-search-wrap">
                        <Search size={16} className="course-search-icon" />
                        <input
                            className="cfm-input course-search-input"
                            type="text"
                            placeholder="ค้นหาหลักสูตร..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Course Grid */}
                    {loading ? (
                        <div className="course-loading">
                            <div className="course-spinner" />
                        </div>
                    ) : filteredCourses.length > 0 ? (
                        <div className="course-grid">
                            {filteredCourses.map(course => (
                                <CourseCard
                                    key={course.id}
                                    course={course}
                                    onOpen={handleOpenCourse}
                                    onDuplicate={handleDuplicateCourse}
                                    onDelete={handleDeleteCourse}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState onCreate={handleCreateCourse} />
                    )}
                </div>
            ) : view === 'editor' && selectedCourse ? (
                <div className="course-editor-page">
                    {/* Editor View */}
                    {/* หน้ารายละเอียดหลักสูตร */}
                    <div className="course-editor-header">
                        <div className="course-editor-header__left">
                            <button className="course-btn-back" onClick={handleBackToList}>
                                <ArrowLeft size={16} /> กลับ
                            </button>
                            <div className='course-editor-header__title'>
                                <h1>{selectedCourse.nameTh}</h1>
                                <p className="course-editor-header__subtitle">{selectedCourse.nameEn ? `${selectedCourse.nameEn} · ` : ''}ปี {selectedCourse.year}</p>
                            </div>
                        </div>
                        <div className="course-editor-header__actions">
                            <span className={`course-status-badge course-status-badge--${selectedCourse.status}`}>
                                {STATUS_LABELS[selectedCourse.status] || selectedCourse.status}
                            </span>
                            {statusAction && (
                                <button
                                    className={`course-btn ${selectedCourse.status === 'active' ? 'course-btn--danger' : 'course-btn--primary'}`}
                                    onClick={() => handleRequestChangeStatus(statusAction.nextStatus)}
                                    disabled={operationLoading}
                                >
                                    {statusAction.label}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="curriculum-detail-tabs" role="tablist" aria-label="รายละเอียดหลักสูตร">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={detailTab === 'structure'}
                            className={`curriculum-detail-tabs__tab ${detailTab === 'structure' ? 'curriculum-detail-tabs__tab--active' : ''}`}
                            onClick={() => handleDetailTabChange('structure')}
                        >
                            {t('curriculum_detail_tab_structure')}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={detailTab === 'metadata'}
                            className={`curriculum-detail-tabs__tab ${detailTab === 'metadata' ? 'curriculum-detail-tabs__tab--active' : ''}`}
                            onClick={() => handleDetailTabChange('metadata')}
                        >
                            {t('curriculum_detail_tab_metadata')}
                        </button>
                    </div>

                    {detailTab === 'structure' ? (
                        <>
                    {/* Category Tree and Detail Panel - Side by Side */}
                    <div className="course-editor-panels">
                        <div className="course-editor-panels__sidebar">
                            <CurriculumStructureSidebar
                                categories={categories}
                                coursesByCategory={coursesByCategory}
                                selectedCategoryId={selectedCategory?.id}
                                showAllCourses={showAllCourses}
                                title="โครงสร้างหลักสูตร"
                                addLabel="เพิ่มหมวด"
                                emptyText="ยังไม่มีหมวดวิชา"
                                showAllOption
                                disabled={operationLoading}
                                canEdit
                                maxDepth={3}
                                addDisabled={selectedCategory ? getCategoryDepth(selectedCategory, categories) >= 3 : false}
                                clearSelectionDisabled={operationLoading || isCourseEditorEditing}
                                onRequestClearSelection={handleClearCurriculumSelection}
                                draggingCategoryId={draggedCategoryId}
                                draggedCourseId={draggedCourseId}
                                dropTargetCategoryId={dropTargetCategoryId}
                                onSelectCategory={handleSelectCategory}
                                onSelectAllCourses={handleSelectAllCourses}
                                onAddCategory={() => handleAddCategory()}
                                onAddChildCategory={handleAddCategory}
                                onRenameCategory={handleRenameCategory}
                                showRenameAction={false}
                                headerActions={(
                                    <button
                                        type="button"
                                        className="course-btn course-btn--ghost course-btn--sm"
                                        onClick={() => setShowStructureImport(true)}
                                        disabled={operationLoading}
                                    >
                                        <Upload size={12} /> {language === 'en' ? 'Import courses' : 'นำเข้ารายวิชา'}
                                    </button>
                                )}
                                onDeleteCategory={handleRequestDeleteCategory}
                                onCategoryRootDragOver={handleCategoryRootDragOver}
                                onCategoryRootDrop={handleCategoryRootDrop}
                                onCategoryDragStart={handleCategoryDragStart}
                                onCategoryDragOver={handleCategoryDragOver}
                                onCategoryDrop={handleCategoryDrop}
                                onCategoryDragEnd={handleCategoryDragEnd}
                                onCategoryDragLeave={handleCategoryDragLeave}
                                onCourseCategoryDragOver={handleCourseCategoryDragOver}
                                onCourseCategoryDrop={handleCourseCategoryDrop}
                                onCourseDragStart={handleCourseDragStart}
                                onCourseDragEnd={handleCourseDragEnd}
                            />
                        </div>

                        {/* Category Detail Panel */}
                        <div className="course-editor-panels__content">
                            <CurriculumCourseEditorPanel
                                key={`${showAllCourses ? 'all' : selectedCategory?.id || 'none'}:${selectedCategory?.name || ''}:${selectedCategory?.requiredCredits ?? 0}`}
                                category={showAllCourses ? { id: 'all', code: '', name: 'วิชาทั้งหมดในหลักสูตร' } : selectedCategory}
                                courses={getDisplayCourses(categories, selectedCategory, showAllCourses)}
                                allCourses={getDisplayCourses(categories, null, true)}
                                categoryTotalCredits={showAllCourses ? selectedCourse.stats?.totalCredits ?? 0 : getDisplayCourses(categories, selectedCategory, false).reduce((sum, course) => sum + (Number(course.credits) || 0), 0)}
                                isLeafCategory={Boolean(selectedCategory && !selectedCategory.children?.length)}
                                isAllCoursesView={showAllCourses}
                                draggedCourseId={draggedCourseId}
                                onRenameCategory={selectedCategory ? handleRenameCategory : () => { }}
                                allowCategoryCodeEdit
                                onDeleteCategory={selectedCategory ? handleRequestDeleteCategory : () => { }}
                                onAddCourse={handleAddCourse}
                                onUpdateCourse={handleUpdateCourse}
                                onDeleteCourse={handleRequestDeleteCourseInEditor}
                                onBulkDeleteCourses={handleRequestBulkDeleteCoursesInEditor}
                                onMoveCourse={handleMoveCourseInEditor}
                                onValidateCourse={handleValidateCourseBeforeSave}
                                onCourseDragStart={handleCourseDragStart}
                                onCourseDragEnd={handleCourseDragEnd}
                                onEditingStateChange={setIsCourseEditorEditing}
                                canEdit={Boolean(selectedCategory) && !showAllCourses}
                                disabled={operationLoading}
                            />
                        </div>
                    </div>
                        </>
                    ) : (
                        <CurriculumMetadataPanel
                            curriculum={selectedCourse}
                            majors={majorOptions}
                            faculties={faculties}
                            isAdmin={isAdmin}
                            disabled={operationLoading}
                            locked={selectedCourse.status === 'active' && selectedCourse.activeTemplateCount > 0}
                            activeTemplateCount={selectedCourse.activeTemplateCount}
                            fieldErrors={metadataFieldErrors}
                            resetVersion={metadataResetVersion}
                            onSave={handleSaveMetadata}
                            onFieldChange={handleMetadataFieldChange}
                            onEditingStateChange={setMetadataEditState}
                            onManageStructure={() => handleDetailTabChange('structure')}
                        />
                    )}
                </div>
            ) : null}

            {/* Modals */}
            <DuplicateCourseWarningModal
                open={Boolean(courseDuplicateWarning)}
                issues={courseDuplicateWarning?.issues || []}
                onClose={() => setCourseDuplicateWarning(null)}
            />

            <CurriculumStructureImportModal
                open={showStructureImport}
                onClose={() => setShowStructureImport(false)}
                mode="persisted"
                curriculumId={selectedCourse?.curriculumId}
                categories={categories}
                coursesByCategory={coursesByCategory}
                language={language}
                disabled={operationLoading}
                onPreview={previewCurriculumStructureImport}
                onImport={handleCommitStructureImport}
            />

            {duplicatingCourse && (
                <DuplicateCurriculumModal
                    source={duplicatingCourse}
                    form={duplicateForm}
                    majors={majorOptions}
                    loading={operationLoading}
                    onChange={handleDuplicateFormChange}
                    onClose={() => setDuplicatingCourse(null)}
                    onSubmit={handleConfirmDuplicateCourse}
                />
            )}

            <ConfirmActionModal
                open={Boolean(courseDeleteConfirmation)}
                title={courseDeleteConfirmation?.mode === 'bulk' ? t('confirm_delete_courses') : t('confirm_delete_course')}
                message={courseDeleteConfirmation?.mode === 'bulk'
                    ? language === 'th'
                        ? `${t('confirm_delete_courses')} (${courseDeleteConfirmation.courses.length} วิชา)?`
                        : `${t('confirm_delete_courses')} (${courseDeleteConfirmation.courses.length} courses)?`
                    : `${t('confirm_delete_course')} "${courseDeleteConfirmation?.courses?.[0]?.code || courseDeleteConfirmation?.courses?.[0]?.nameTh || ''}"?`}
                hint={t('delete_course_irreversible_hint')}
                confirmLabel={t('confirm_action')}
                cancelLabel={t('curriculum_cancel')}
                variant="danger"
                loading={operationLoading}
                onConfirm={() => {
                    const pending = courseDeleteConfirmation;
                    if (!pending) return;
                    if (pending.mode === 'bulk') {
                        handleConfirmBulkDeleteCoursesInEditor(pending.courses);
                        return;
                    }
                    handleConfirmDeleteCourseInEditor(pending.courses[0]);
                }}
                onCancel={() => !operationLoading && setCourseDeleteConfirmation(null)}
            />

            <ConfirmActionModal
                open={Boolean(courseDeleteImpactConfirmation)}
                title={t('course_delete_impact_title')}
                message={courseDeleteImpactConfirmation?.error ? buildConfirmationMessage(courseDeleteImpactConfirmation.error) : ''}
                hint={t('course_delete_impact_hint')}
                confirmLabel={t('confirm_action')}
                cancelLabel={t('curriculum_cancel')}
                variant="warning"
                loading={operationLoading}
                onConfirm={() => {
                    const pending = courseDeleteImpactConfirmation;
                    if (!pending) return;
                    if (pending.mode === 'bulk') {
                        handleConfirmBulkDeleteCoursesInEditor(
                            pending.courses,
                            true,
                            pending.resumeIndex || 0,
                        );
                        return;
                    }
                    handleConfirmDeleteCourseInEditor(pending.courses[0], true);
                }}
                onCancel={() => !operationLoading && setCourseDeleteImpactConfirmation(null)}
            />

            <ConfirmActionModal
                open={Boolean(deletingCourse)}
                title="ลบหลักสูตร"
                message={<>ยืนยันการลบหลักสูตร <strong>{deletingCourse?.nameTh}</strong> หรือไม่?</>}
                hint="ระบบจะลบแบบ Soft delete และซ่อนออกจากรายการใช้งานปกติ"
                confirmLabel={operationLoading ? 'กำลังลบ...' : 'ลบหลักสูตร'}
                variant="danger"
                loading={operationLoading}
                onConfirm={handleConfirmDeleteCourse}
                onCancel={() => !operationLoading && setDeletingCourse(null)}
            />

            <ConfirmActionModal
                open={Boolean(deletingCategory)}
                title="ลบหมวดวิชา"
                message={<>ยืนยันการลบหมวดวิชา <strong>{deletingCategory ? `${deletingCategory.code} ${deletingCategory.name || ''}` : ''}</strong> หรือไม่?</>}
                hint="รายวิชาในหมวดนี้จะถูกย้ายตามกฎของระบบก่อนลบหมวด"
                confirmLabel={operationLoading ? 'กำลังลบ...' : 'ลบหมวดวิชา'}
                variant="danger"
                loading={operationLoading}
                onConfirm={handleConfirmDeleteCategory}
                onCancel={() => !operationLoading && setDeletingCategory(null)}
            />

            <ConfirmActionModal
                open={Boolean(metadataImpactConfirmation)}
                title="ยืนยันการแก้ไขข้อมูลหลักสูตร"
                message="หลักสูตรที่ปิดใช้งานนี้มี Template เชื่อมอยู่ การแก้ไขข้อมูลอาจทำให้ต้องตรวจทาน Template ที่ได้รับผลกระทบ"
                hint="ระบบจะบันทึกข้อมูลเมื่อคุณยืนยันเท่านั้น"
                impact={(
                    <ul className="curriculum-metadata-impact-list">
                        {(metadataImpactConfirmation?.affectedTemplates || []).map(template => (
                            <li key={template.curriculum_template_id || template.template_id} className={`curriculum-metadata-impact-list__item curriculum-metadata-impact-list__item--${template.severity || 'warning'}`}>
                                <strong>{template.name || template.code || 'Template'}</strong>
                                {template.cohort_year_be ? <span>รุ่น {template.cohort_year_be}</span> : null}
                                <span>{template.severity === 'critical' ? 'กำลังใช้งาน' : 'ต้องตรวจทาน'}</span>
                            </li>
                        ))}
                    </ul>
                )}
                confirmLabel="ยืนยันและบันทึก"
                variant="warning"
                size="md"
                loading={operationLoading}
                onConfirm={() => metadataImpactConfirmation && handleSaveMetadata(metadataImpactConfirmation.form, true)}
                onCancel={() => !operationLoading && setMetadataImpactConfirmation(null)}
            />

            <ConfirmActionModal
                open={Boolean(discardConfirmation)}
                title="ยกเลิกการแก้ไขข้อมูลหลักสูตร"
                message="มีข้อมูลที่ยังไม่ได้บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?"
                hint="ข้อมูลที่กรอกไว้ในแบบฟอร์มจะไม่ถูกบันทึก"
                confirmLabel="ละทิ้งการแก้ไข"
                variant="warning"
                onConfirm={handleConfirmDiscard}
                onCancel={() => setDiscardConfirmation(null)}
            />
        </>
    );
}
