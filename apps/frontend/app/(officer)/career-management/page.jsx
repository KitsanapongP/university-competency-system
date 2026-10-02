'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BriefcaseBusiness, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Upload } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import { useLanguage } from '../../../providers/LanguageContext';
import { fetchFaculties, fetchCurriculums } from '../../../lib/curriculum';
import { fetchCompetenciesForManagement } from '../../../lib/competency-management';
import {
    createCareerPathDraft,
    deactivateCareerPaths,
    deleteCareerPath,
    fetchCareerPaths,
    getCareerPath,
    publishCareerPaths,
    updateCareerPathDraft,
} from '../../../lib/career-paths';
import { careerPathName } from '../../../lib/career-paths.mjs';
import { officerText } from '../officer-labels';
import CareerPathFormModal from './components/CareerPathFormModal';
import CareerPathImportModal from './components/CareerPathImportModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import './CareerManagement.css';

const PAGE_SIZE = 20;
const NO_CURRICULUM_FILTER = 'none';

function statusLabel(language, status) {
    const labels = {
        draft: ['ฉบับร่าง', 'Draft'],
        active: ['เปิดใช้งาน', 'Active'],
        inactive: ['ปิดใช้งาน', 'Inactive'],
    };
    const [thai, english] = labels[status] || [status || '-', status || '-'];
    return officerText(language, thai, english);
}

function facultyName(faculties, facultyId, language) {
    const faculty = faculties.find((item) => String(item.facultyId) === String(facultyId));
    return language === 'en' ? faculty?.nameEn || faculty?.nameTh || '-' : faculty?.nameTh || faculty?.nameEn || '-';
}

function curriculumLabel(curriculum, faculties, language, includeFaculty) {
    const name = language === 'en' ? curriculum.nameEn || curriculum.nameTh : curriculum.nameTh || curriculum.nameEn;
    const degreeName = language === 'en' ? curriculum.degreeNameEn || curriculum.degreeName : curriculum.degreeName || curriculum.degreeNameEn;
    const details = [degreeName, curriculum.year].filter(Boolean).join(' · ');
    const faculty = includeFaculty ? facultyName(faculties, curriculum.facultyId, language) : '';
    return [name, details, faculty].filter(Boolean).join(' · ');
}

export default function CareerManagementPage() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const isAdmin = user?.roles?.includes('admin');
    const userFacultyId = user?.faculty_id ? String(user.faculty_id) : '';

    const [faculties, setFaculties] = useState([]);
    const [curriculums, setCurriculums] = useState([]);
    const [competencies, setCompetencies] = useState([]);
    const [lookupsLoading, setLookupsLoading] = useState(true);
    const [lookupsError, setLookupsError] = useState('');
    const [facultyId, setFacultyId] = useState(userFacultyId);
    const [curriculumFilter, setCurriculumFilter] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [page, setPage] = useState(1);
    const [result, setResult] = useState({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
    const [loading, setLoading] = useState(true);
    const [refreshIndex, setRefreshIndex] = useState(0);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [formOpen, setFormOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [formItem, setFormItem] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [confirmation, setConfirmation] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let active = true;
        async function loadLookups() {
            setLookupsLoading(true);
            setLookupsError('');
            try {
                const [nextFaculties, nextCurriculums, nextCompetencies] = await Promise.all([
                    fetchFaculties(),
                    fetchCurriculums(),
                    fetchCompetenciesForManagement(),
                ]);
                if (!active) return;
                setFaculties(nextFaculties || []);
                setCurriculums(nextCurriculums || []);
                setCompetencies((nextCompetencies || []).map((item) => ({
                    id: Number(item.competencyId),
                    code: item.code,
                    nameTh: item.nameTh,
                    nameEn: item.nameEn,
                })));
                if (!isAdmin) {
                    const scoped = userFacultyId || (nextFaculties?.length === 1 ? String(nextFaculties[0].facultyId) : '');
                    setFacultyId(scoped);
                    if (!scoped) setLookupsError(officerText(language, 'ไม่พบข้อมูลคณะที่ผูกกับบัญชีเจ้าหน้าที่ จึงไม่สามารถโหลดรายการสายงานได้', 'No faculty is linked to this officer account, so career paths cannot be loaded.'));
                }
            } catch {
                if (active) setLookupsError(officerText(language, 'ไม่สามารถโหลดตัวเลือกคณะ หลักสูตร หรือสมรรถนะได้', 'Unable to load faculty, curriculum, or competency options.'));
            } finally {
                if (active) setLookupsLoading(false);
            }
        }
        loadLookups();
        return () => { active = false; };
    }, [isAdmin, language, userFacultyId]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const availableCurriculums = useMemo(() => curriculums.filter((item) => {
        return !facultyId || String(item.facultyId) === String(facultyId);
    }), [curriculums, facultyId]);

    useEffect(() => {
        if (lookupsLoading || lookupsError || (!isAdmin && !facultyId)) return undefined;
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        const filters = {
            page,
            page_size: PAGE_SIZE,
            search,
            status,
            sort_by: sortBy,
            sort_order: sortOrder,
            language,
            ...(curriculumFilter && curriculumFilter !== NO_CURRICULUM_FILTER ? { curriculum_id: curriculumFilter } : {}),
            ...(curriculumFilter === NO_CURRICULUM_FILTER ? { without_curriculum: true } : {}),
            ...(facultyId ? { faculty_id: facultyId } : {}),
        };
        fetchCareerPaths(filters, { signal: controller.signal })
            .then((data) => {
                if (active) {
                    setResult(data);
                    setSelectedIds((current) => current.filter((id) => data.items.some((item) => item.id === id)));
                }
            })
            .catch((error) => {
                if (active && error.name !== 'AbortError') {
                    setFeedback({ type: 'error', message: officerText(language, 'ไม่สามารถโหลดรายการสายงานได้', 'Unable to load career paths.') });
                }
            })
            .finally(() => { if (active) setLoading(false); });
        return () => {
            active = false;
            controller.abort();
        };
    }, [curriculumFilter, facultyId, isAdmin, language, lookupsError, lookupsLoading, page, refreshIndex, search, sortBy, sortOrder, status]);

    const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
    const allCurrentSelected = result.items.length > 0 && result.items.every((item) => selectedIds.includes(item.id));

    const openCreate = () => {
        setFormItem(null);
        setFormOpen(true);
    };

    const openEdit = async (item) => {
        setFormLoading(true);
        setFeedback({ type: '', message: '' });
        try {
            setFormItem(await getCareerPath(item.id));
            setFormOpen(true);
        } catch {
            setFeedback({ type: 'error', message: officerText(language, 'ไม่สามารถโหลดรายละเอียดสายงานได้', 'Unable to load career path details.') });
        } finally {
            setFormLoading(false);
        }
    };

    const saveDraft = async (form) => {
        setFormLoading(true);
        try {
            if (formItem) {
                await updateCareerPathDraft(formItem.id, formItem.draftVersion?.id || 0, form);
            } else {
                await createCareerPathDraft(form);
            }
            setFormOpen(false);
            setFormItem(null);
            setFeedback({ type: 'success', message: officerText(language, 'บันทึกร่างสายงานแล้ว', 'Career path draft saved.') });
            setRefreshIndex((value) => value + 1);
        } finally {
            setFormLoading(false);
        }
    };

    const confirmAction = useCallback(async () => {
        if (!confirmation) return;
        setActionLoading(true);
        try {
            if (confirmation.type === 'publish') await publishCareerPaths(confirmation.ids);
            if (confirmation.type === 'deactivate') await deactivateCareerPaths(confirmation.ids);
            if (confirmation.type === 'delete') await deleteCareerPath(confirmation.ids[0]);
            const messages = {
                publish: officerText(language, 'เปิดใช้งานสายงานแล้ว', 'Career paths published.'),
                deactivate: officerText(language, 'ปิดใช้งานสายงานแล้ว', 'Career paths deactivated.'),
                delete: officerText(language, 'ลบสายงานแล้ว', 'Career path deleted.'),
            };
            setFeedback({ type: 'success', message: messages[confirmation.type] });
            setSelectedIds([]);
            setConfirmation(null);
            setRefreshIndex((value) => value + 1);
        } catch (error) {
            const message = error?.status === 409
                ? officerText(language, 'ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่ก่อนดำเนินการ', 'Records changed. Reload the list before continuing.')
                : officerText(language, 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบความครบถ้วนของรายการแล้วลองใหม่', 'The action failed. Check the selected records and try again.');
            setFeedback({ type: 'error', message });
        } finally {
            setActionLoading(false);
        }
    }, [confirmation, language]);

    const confirmationCopy = useMemo(() => {
        if (!confirmation) return null;
        const selected = confirmation.ids.map((id) => result.items.find((item) => item.id === id)).filter(Boolean);
        const names = selected.map((item) => careerPathName(item, language)).join(', ');
        if (confirmation.type === 'publish') return {
            title: officerText(language, 'ยืนยันเปิดใช้งานสายงาน', 'Publish career paths'),
            message: officerText(language, `ต้องการเปิดใช้งาน ${selected.length} รายการหรือไม่`, `Publish ${selected.length} selected item(s)?`),
            hint: officerText(language, `รายการ: ${names}`, `Selected: ${names}`),
            variant: 'warning',
            confirm: officerText(language, 'เปิดใช้งาน', 'Publish'),
        };
        if (confirmation.type === 'deactivate') return {
            title: officerText(language, 'ยืนยันปิดใช้งานสายงาน', 'Deactivate career paths'),
            message: officerText(language, `ต้องการปิดใช้งาน ${selected.length} รายการหรือไม่`, `Deactivate ${selected.length} selected item(s)?`),
            hint: officerText(language, `รายการ: ${names}`, `Selected: ${names}`),
            variant: 'warning',
            confirm: officerText(language, 'ปิดใช้งาน', 'Deactivate'),
        };
        return {
            title: officerText(language, 'ยืนยันลบสายงาน', 'Delete career path'),
            message: officerText(language, `ต้องการลบสายงาน “${names}” ใช่หรือไม่`, `Delete “${names}”?`),
            hint: officerText(language, 'ระบบจะซ่อนรายการนี้จากการใช้งาน แต่ไม่ลบประวัติรายงานที่สร้างไว้', 'This hides the career path from use; existing reports are retained.'),
            variant: 'danger',
            confirm: officerText(language, 'ลบสายงาน', 'Delete'),
        };
    }, [confirmation, language, result.items]);

    const toggleSelection = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    const togglePageSelection = () => setSelectedIds((current) => allCurrentSelected
        ? current.filter((id) => !result.items.some((item) => item.id === id))
        : [...new Set([...current, ...result.items.map((item) => item.id)])]);

    const selectFaculty = (event) => {
        setFacultyId(event.target.value);
        setCurriculumFilter('');
        setPage(1);
        setSelectedIds([]);
    };

    const updateSort = (key) => {
        setPage(1);
        setSelectedIds([]);
        if (sortBy === key) {
            setSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortOrder('asc');
    };

    const renderSortHeader = (key, label, disabled = false) => {
        const active = sortBy === key;
        const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;
        const nextDirection = active && sortOrder === 'asc' ? 'desc' : 'asc';
        const directionLabel = nextDirection === 'asc'
            ? officerText(language, 'น้อยไปมาก', 'ascending')
            : officerText(language, 'มากไปน้อย', 'descending');
        return (
            <th aria-sort={active ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}>
                <button
                    type="button"
                    className="career-management__sort-button"
                    onClick={() => updateSort(key)}
                    disabled={disabled}
                    aria-label={officerText(language, `เรียงตาม${label} ${directionLabel}`, `Sort by ${label} ${directionLabel}`)}
                >
                    <span>{label}</span>
                    <Icon size={14} aria-hidden="true" />
                </button>
            </th>
        );
    };

    return (
        <main className="ui-page career-management">
            <header className="ui-page__header">
                <div className="ui-page__heading">
                    <p className="ui-page__eyebrow"><BriefcaseBusiness size={15} /> {officerText(language, 'จัดการข้อมูลสหกิจศึกษา', 'Cooperative education')}</p>
                    <h1 className="ui-page__title">{officerText(language, 'สายงานสหกิจศึกษา', 'Co-op career paths')}</h1>
                    <p className="ui-page__subtitle">{officerText(language, 'จัดการรายการสายงานที่ใช้ประกอบการวิเคราะห์และคำแนะนำสำหรับผู้เรียน', 'Manage the reviewed career paths used to support learner analysis and recommendations.')}</p>
                </div>
                <div className="ui-page__actions">
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => setRefreshIndex((value) => value + 1)} disabled={loading || lookupsLoading}>
                        <RefreshCw size={16} /> {officerText(language, 'โหลดใหม่', 'Refresh')}
                    </button>
                    <button type="button" className="ui-button ui-button--primary" onClick={openCreate} disabled={lookupsLoading || Boolean(lookupsError)}>
                        <Plus size={16} /> {officerText(language, 'เพิ่มสายงาน', 'Add career path')}
                    </button>
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => setImportOpen(true)} disabled={lookupsLoading || Boolean(lookupsError) || !facultyId}>
                        <Upload size={16} /> {officerText(language, 'นำเข้า', 'Import')}
                    </button>
                </div>
            </header>

            {feedback.message && <div className={`career-feedback career-feedback--${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}
            {lookupsError && <div className="career-feedback career-feedback--error" role="alert">{lookupsError}</div>}

            <section className={`ui-panel career-management__filters ${isAdmin ? 'career-management__filters--admin' : 'career-management__filters--officer'}`} aria-label={officerText(language, 'ตัวกรองรายการสายงาน', 'Career path filters')}>
                {isAdmin && (
                    <label className="ui-field">
                        <span>{officerText(language, 'คณะ', 'Faculty')}</span>
                        <select className="ui-select" value={facultyId} onChange={selectFaculty} disabled={lookupsLoading}>
                            <option value="">{officerText(language, 'ทุกคณะ', 'All faculties')}</option>
                            {faculties.map((item) => <option key={item.facultyId} value={item.facultyId}>{language === 'en' ? item.nameEn || item.nameTh : item.nameTh || item.nameEn}</option>)}
                        </select>
                    </label>
                )}
                {!isAdmin && <div className="career-management__scope">{officerText(language, 'จำกัดข้อมูลเฉพาะคณะของบัญชีนี้', 'Limited to this account’s faculty')}</div>}
                <label className="ui-field">
                    <span>{officerText(language, 'สถานะ', 'Status')}</span>
                    <select className="ui-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelectedIds([]); }}>
                        <option value="">{officerText(language, 'ทุกสถานะ', 'All statuses')}</option>
                        <option value="draft">{statusLabel(language, 'draft')}</option>
                        <option value="active">{statusLabel(language, 'active')}</option>
                        <option value="inactive">{statusLabel(language, 'inactive')}</option>
                    </select>
                </label>
                <label className="ui-field">
                    <span>{officerText(language, 'หลักสูตร', 'Curriculum')}</span>
                    <select className="ui-select" value={curriculumFilter} onChange={(event) => { setCurriculumFilter(event.target.value); setPage(1); setSelectedIds([]); }} disabled={lookupsLoading}>
                        <option value="">{officerText(language, 'ทุกหลักสูตร', 'All curricula')}</option>
                        {availableCurriculums.map((item) => (
                            <option key={item.curriculumId} value={item.curriculumId}>
                                {curriculumLabel(item, faculties, language, isAdmin && !facultyId)}
                            </option>
                        ))}
                        <option value={NO_CURRICULUM_FILTER}>{officerText(language, 'ไม่มีหลักสูตร', 'No curriculum')}</option>
                    </select>
                </label>
                <label className="ui-field career-management__search">
                    <span>{officerText(language, 'ค้นหา', 'Search')}</span>
                    <span className="career-management__search-control"><Search size={16} aria-hidden="true" /><input className="ui-input" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setSelectedIds([]); }} placeholder={officerText(language, 'ชื่อหรือรหัสสายงาน', 'Name or code')} /></span>
                </label>
            </section>

            {selectedIds.length > 0 && (
                <section className="career-management__bulk" aria-label={officerText(language, 'การจัดการรายการที่เลือก', 'Selected career path actions')}>
                    <span>{officerText(language, `เลือก ${selectedIds.length} รายการ`, `${selectedIds.length} selected`)}</span>
                    <button type="button" className="ui-button ui-button--primary" onClick={() => setConfirmation({ type: 'publish', ids: selectedIds })}>
                        {officerText(language, 'เปิดใช้งาน', 'Publish')}
                    </button>
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => setConfirmation({ type: 'deactivate', ids: selectedIds })}>
                        {officerText(language, 'ปิดใช้งาน', 'Deactivate')}
                    </button>
                    <button type="button" className="ui-button ui-button--secondary" onClick={() => setSelectedIds([])}>
                        {officerText(language, 'ล้างการเลือก', 'Clear selection')}
                    </button>
                </section>
            )}

            <section className="ui-panel career-management__table-panel">
                <div className="ui-panel__heading">
                    <div>
                        <h2>{officerText(language, 'รายการสายงาน', 'Career paths')}</h2>
                        <p>{officerText(language, `${result.total} รายการ`, `${result.total} item(s)`)}</p>
                    </div>
                </div>
                <div className="career-management__table-wrap">
                    <table className="career-management__table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" aria-label={officerText(language, 'เลือกทั้งหมดในหน้านี้', 'Select all on this page')} checked={allCurrentSelected} onChange={togglePageSelection} disabled={!result.items.length} /></th>
                                {renderSortHeader('name', officerText(language, 'สายงาน', 'Career path'))}
                                {isAdmin ? renderSortHeader('faculty', officerText(language, 'คณะ', 'Faculty')) : <th>{officerText(language, 'คณะ', 'Faculty')}</th>}
                                <th>{officerText(language, 'ฉบับใช้งาน', 'Published')}</th>
                                <th>{officerText(language, 'ฉบับร่าง', 'Draft')}</th>
                                <th>{officerText(language, 'การดำเนินการ', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading || lookupsLoading ? (
                                <tr><td colSpan="6" className="career-management__state">{officerText(language, 'กำลังโหลดรายการ...', 'Loading career paths...')}</td></tr>
                            ) : result.items.length === 0 ? (
                                <tr><td colSpan="6" className="career-management__state">{officerText(language, 'ไม่พบรายการสายงาน', 'No career paths found.')}</td></tr>
                            ) : result.items.map((item) => (
                                <tr key={item.id}>
                                    <td><input type="checkbox" aria-label={officerText(language, `เลือกรายการ ${careerPathName(item, language)}`, `Select ${careerPathName(item, language)}`)} checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} /></td>
                                    <td><strong>{careerPathName(item, language)}</strong><small>{item.code}</small></td>
                                    <td>{facultyName(faculties, item.facultyId, language)}</td>
                                    <td>{item.publishedRevision ? <span className={`career-status ${item.status === 'active' ? 'career-status--active' : ''}`}>{statusLabel(language, item.status)} · v{item.publishedRevision}</span> : <span className="career-status">{officerText(language, 'ยังไม่เปิดใช้งาน', 'Not published')}</span>}</td>
                                    <td>{item.draftRevision ? <span className="career-status career-status--draft">{statusLabel(language, 'draft')} · v{item.draftRevision}</span> : <span className="career-status">-</span>}</td>
                                    <td className="career-management__row-actions">
                                        <button type="button" className="ui-button ui-button--secondary" onClick={() => openEdit(item)} disabled={formLoading}>{officerText(language, 'จัดการร่าง', 'Manage draft')}</button>
                                        <button type="button" className="career-management__delete" onClick={() => setConfirmation({ type: 'delete', ids: [item.id] })}>{officerText(language, 'ลบ', 'Delete')}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <footer className="career-management__pagination">
                    <span>{officerText(language, `หน้า ${page} จาก ${pageCount}`, `Page ${page} of ${pageCount}`)}</span>
                    <div>
                        <button type="button" className="ui-icon-button" aria-label={officerText(language, 'หน้าก่อนหน้า', 'Previous page')} onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}><ChevronLeft size={18} /></button>
                        <button type="button" className="ui-icon-button" aria-label={officerText(language, 'หน้าถัดไป', 'Next page')} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page >= pageCount || loading}><ChevronRight size={18} /></button>
                    </div>
                </footer>
            </section>

            {formOpen && (
                <CareerPathFormModal
                    open
                    careerPath={formItem}
                    faculties={faculties}
                    curriculums={curriculums}
                    competencies={competencies}
                    facultyId={facultyId || userFacultyId}
                    isAdmin={isAdmin}
                    language={language}
                    submitting={formLoading}
                    onClose={() => { if (!formLoading) setFormOpen(false); }}
                    onSave={saveDraft}
                />
            )}

            {importOpen && (
                <CareerPathImportModal
                    open
                    facultyId={facultyId}
                    curriculums={curriculums.filter((item) => String(item.facultyId) === String(facultyId))}
                    competencies={competencies}
                    language={language}
                    onClose={() => setImportOpen(false)}
                    onComplete={() => {
                        setImportOpen(false);
                        setFeedback({ type: 'success', message: officerText(language, 'นำเข้ารายการฉบับร่างแล้ว', 'Selected drafts have been imported.') });
                        setRefreshIndex((value) => value + 1);
                    }}
                />
            )}

            <ConfirmActionModal
                open={Boolean(confirmation)}
                title={confirmationCopy?.title}
                message={confirmationCopy?.message}
                hint={confirmationCopy?.hint}
                variant={confirmationCopy?.variant || 'warning'}
                confirmLabel={confirmationCopy?.confirm}
                cancelLabel={officerText(language, 'ยกเลิก', 'Cancel')}
                loading={actionLoading}
                onCancel={() => setConfirmation(null)}
                onConfirm={confirmAction}
            />
        </main>
    );
}
