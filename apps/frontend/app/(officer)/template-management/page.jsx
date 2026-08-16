'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft, CalendarDays, BookOpenCheck, RefreshCw, Settings, Settings2, SlidersHorizontal, BarChart3, Files } from 'lucide-react';
import { fetchTemplates, deleteTemplate, updateTemplateStatus, updateTemplateName, fetchTemplateItems, fetchTemplateStructure, fetchTemplateCompetencies, updateTemplateCompetencies, createTemplate, saveTemplateItems } from '../../../lib/template';
import { fetchCompetencies } from '../../../lib/competency';
import { fetchCurriculumDetail } from '../../../lib/curriculum';
import { useLanguage } from '../../../providers/LanguageContext';
import TemplateStructureWorkspace from './components/TemplateStructureWorkspace';
import CompetencyOverview   from './components/CompetencyOverview';
import TemplateFormModal    from './components/TemplateFormModal';
import ConfirmDeleteModal   from './components/ConfirmDeleteModal';
import TemplateCompetencyManagerModal from './components/TemplateCompetencyManagerModal';
import ConfirmActionModal from '../../../components/ui/ConfirmActionModal';
import ToastNotifications from '../../../components/ui/ToastNotifications';
import AlertModal           from './components/AlertModal';
import './TemplateManagement.css';
import '../curriculum-management/CourseLayout.css';
import '../curriculum-management/CourseEditor.css';
import '../curriculum-management/CurriculumCourseEditorPanel.css';
import '../curriculum-management/CurriculumStructureSidebar.css';

const COMPETENCY_COLORS = ['#ec4899', '#3b82f6', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#f97316'];

function stableCompetencyColor(competency) {
    const source = String(competency.competency_id || competency.id || competency.code || 'competency');
    const hash = [...source].reduce((sum, character) => ((sum * 31) + character.charCodeAt(0)) >>> 0, 0);
    return COMPETENCY_COLORS[hash % COMPETENCY_COLORS.length];
}

function normalizeCompetencies(competencies) {
    return (Array.isArray(competencies) ? competencies : [])
        .filter(competency => competency.is_active ?? competency.isActive ?? true)
        .map((competency, index) => {
            const id = competency.id || competency.competency_id;
            const code = competency.code || `comp_${index}`;
            const nameTh = competency.name_th || competency.nameTh || competency.name || '';
            const nameEn = competency.name_en || competency.nameEn || '';

            return {
                id,
                code,
                name: nameTh,
                nameTh,
                nameEn,
                color: stableCompetencyColor({ ...competency, id, code }),
            };
        });
}

// ============================================================
// Pure helpers
// ============================================================
function insertChild(cats, parentId, newChild) {
    return cats.map(c => {
        if (c.id === parentId) return { ...c, children: [...(c.children || []), newChild] };
        if (c.children?.length) return { ...c, children: insertChild(c.children, parentId, newChild) };
        return c;
    });
}
function renameCategory(cats, id, name) {
    return cats.map(c => {
        if (c.id === id) return { ...c, name, isNew: false };
        if (c.children?.length) return { ...c, children: renameCategory(c.children, id, name) };
        return c;
    });
}
function removeCategory(cats, id) {
    return cats
        .filter(c => c.id !== id)
        .map(c => ({ ...c, children: removeCategory(c.children || [], id) }));
}
function findById(cats, id) {
    for (const c of cats) {
        if (c.id === id) return c;
        const f = findById(c.children || [], id);
        if (f) return f;
    }
    return null;
}
function collectIds(cat) { return [cat.id, ...(cat.children || []).flatMap(collectIds)]; }
function isDescendantOf(node, id) { return (node.children || []).some(c => c.id === id || isDescendantOf(c, id)); }
function getDirectChildren(cats, parentId) {
    if (!parentId) return cats;
    return findById(cats, parentId)?.children || [];
}
function getNextCode(parentCode, siblings) {
    const nextIndex = (siblings || []).reduce((highest, sibling) => {
        const segment = Number(String(sibling.code || '').split('.').pop());
        return Number.isFinite(segment) ? Math.max(highest, segment) : highest;
    }, 0) + 1;
    return parentCode ? `${parentCode}.${nextIndex}` : `${nextIndex}`;
}
function getDepthFromCode(code) { return code ? code.split('.').length - 1 : 0; }
function getSubtreeDepth(category) {
    if (!category?.children?.length) return 0;
    return Math.max(...category.children.map(child => 1 + getSubtreeDepth(child)));
}
function recodeCategorySubtree(category, code) {
    return {
        ...category,
        code,
        children: (category.children || []).map((child, index) => (
            recodeCategorySubtree(child, `${code}.${index + 1}`)
        )),
    };
}
function moveCategory(cats, categoryId, targetParentId = null) {
    const moving = findById(cats, categoryId);
    if (!moving) return cats;

    const withoutMoving = removeCategory(cats, categoryId);
    if (!targetParentId) {
        const nextCode = getNextCode('', withoutMoving);
        return [...withoutMoving, recodeCategorySubtree(moving, nextCode)];
    }

    const targetParent = findById(withoutMoving, targetParentId);
    if (!targetParent) return cats;
    const siblings = targetParent.children || [];
    const moved = recodeCategorySubtree(moving, getNextCode(targetParent.code, siblings));
    return insertChild(withoutMoving, targetParentId, moved);
}
function moveCourseToCategory(coursesByCategory, course, targetCategoryId, beforeCourseId = null) {
    const sourceCategoryId = course?.ownerCategoryId;
    if (!course?.id || !sourceCategoryId || !targetCategoryId) return coursesByCategory;

    const next = { ...coursesByCategory };
    const sourceCourses = [...(next[sourceCategoryId] || [])].filter(item => item.id !== course.id);
    const targetCourses = sourceCategoryId === targetCategoryId
        ? sourceCourses
        : [...(next[targetCategoryId] || [])].filter(item => item.id !== course.id);
    const insertionIndex = beforeCourseId
        ? Math.max(0, targetCourses.findIndex(item => item.id === beforeCourseId))
        : targetCourses.length;

    targetCourses.splice(insertionIndex, 0, { ...course, ownerCategoryId: undefined });
    next[sourceCategoryId] = sourceCourses;
    next[targetCategoryId] = targetCourses;
    return next;
}

// ============================================================
// TemplateCard — การ์ดแสดงใน list view
// ============================================================
function TemplateCard({ template, courseCount, onOpen, onDelete }) {
    const courseMasterDisplay = template.masterData
        ? `${template.masterData.name || template.masterData.nameTh || template.masterData.curriculum_name_th || ''}`
        : null;
    
    return (
        <div className="tpl-card" onClick={() => onOpen(template)}>
            <div className="tpl-card__icon">
                <BookOpenCheck size={28} />
            </div>
            <div className="tpl-card__body">
                <span className="tpl-card__name">{template.name}</span>
                <div className="tpl-card__meta">
                    {courseMasterDisplay ? (
                        <>
                            <span>หลักสูตร: {courseMasterDisplay}</span>
                        </>
                    ) : null}
                    <span> มีทั้งหมด {courseCount} วิชา</span>
                </div>
            </div>
            <button
                className="icon-btn icon-btn--danger tpl-card__delete"
                title="ลบ Template"
                onClick={e => { e.stopPropagation(); onDelete(template); }}
            >
                <Trash2 size={15}/>
            </button>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================
export default function TemplateManagementPage() {
    const { language } = useLanguage();
    // ── view: 'list' | 'editor' ──
    const [view, setView] = useState('list');
    const [editorTab, setEditorTab] = useState('setup'); // 'setup' | 'weight' | 'overview'
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleVal,     setTitleVal]     = useState('');

    const [templates,    setTemplates]    = useState([]);
    const [allCompetencies, setAllCompetencies] = useState([]);
    const [competenciesByTemplate, setCompetenciesByTemplate] = useState({});
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateStatus, setTemplateStatus] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [draggingCategoryId, setDraggingCategoryId] = useState(null);
    const [draggedTemplateCourse, setDraggedTemplateCourse] = useState(null);
    const [dropTargetCategoryId, setDropTargetCategoryId] = useState(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [deletingTemplate,  setDeletingTemplate]  = useState(null);
    const [deletingCategory,  setDeletingCategory]  = useState(null);
    const [deletingCourse,    setDeletingCourse]    = useState(null);
    const [deletingCourses,   setDeletingCourses]   = useState(null);
    const [showCompetencyManager, setShowCompetencyManager] = useState(false);
    const [competencyManagerState, setCompetencyManagerState] = useState(null);
    const [competencyManagerLoading, setCompetencyManagerLoading] = useState(false);
    const [competencyManagerSaving, setCompetencyManagerSaving] = useState(false);
    const [competencyRemovalConfirmation, setCompetencyRemovalConfirmation] = useState(null);
    const [toast, setToast] = useState({ success: '', error: '', errorDebug: '' });

    // AlertModal state (replaces native browser alert)
    const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', details: '', type: 'warning' });
    const showAlert = useCallback((message, { title, details, type = 'warning' } = {}) => {
        setAlertModal({ open: true, title: title || '', message, details: details || '', type });
    }, []);
    const closeAlert = useCallback(() => {
        setAlertModal(prev => ({ ...prev, open: false }));
    }, []);

    const [categoriesByTemplate, setCategoriesByTemplate] = useState({});
    const [coursesByTemplate,  setCoursesByTemplate]  = useState({});
    const [weightsByTemplate,  setWeightsByTemplate]  = useState({});

    const idRef       = useRef(50000);
    const courseIdRef    = useRef(50000);
    const saveTimeoutRef = useRef(null);
    const toastTimeoutRef = useRef(null);

    const loadCompetencies = useCallback(async () => {
        const competencyData = await fetchCompetencies();
        const mappedCompetencies = normalizeCompetencies(competencyData);
        setAllCompetencies(mappedCompetencies);
        return mappedCompetencies;
    }, []);

    const showTemplateToast = useCallback((type, message, debug = '') => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToast(type === 'success'
            ? { success: message, error: '', errorDebug: '' }
            : { success: '', error: message, errorDebug: debug || message });
        toastTimeoutRef.current = setTimeout(() => {
            setToast(current => type === 'success'
                ? { ...current, success: '' }
                : { ...current, error: '', errorDebug: '' });
        }, 5000);
    }, []);

    const templateCompetencyMessage = useCallback((error) => {
        const messages = {
            TEMPLATE_ACTIVE: {
                th: 'Template นี้เปิดใช้งานอยู่ จึงไม่สามารถเปลี่ยนสมรรถนะได้',
                en: 'This template is active, so its competencies cannot be changed.',
            },
            TEMPLATE_COMPETENCIES_LOCKED_BY_SCORES: {
                th: 'Template นี้มีคะแนนรายวิชาของผู้เรียนแล้ว จึงไม่สามารถเปลี่ยนสมรรถนะได้',
                en: 'This template already has learner course scores, so its competencies cannot be changed.',
            },
            FORBIDDEN: {
                th: 'คุณไม่มีสิทธิ์จัดการสมรรถนะของ Template นี้',
                en: 'You do not have permission to manage this template’s competencies.',
            },
            BAD_REQUEST: {
                th: 'สมรรถนะที่เลือกบางรายการไม่พร้อมใช้งานแล้ว กรุณาโหลดข้อมูลใหม่',
                en: 'One or more selected competencies are no longer available. Refresh and try again.',
            },
        };
        return messages[error?.code]?.[language] || error?.message || (language === 'th' ? 'ไม่สามารถจัดการสมรรถนะได้' : 'Unable to manage competencies.');
    }, [language]);
    const pendingSaveFnRef = useRef(null);

    // Flush pending auto-save on component unmount (e.g. navbar navigation)
    // and on browser tab close/refresh
    useEffect(() => {
        const flushPendingSave = () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            if (pendingSaveFnRef.current) {
                pendingSaveFnRef.current();
                pendingSaveFnRef.current = null;
            }
        };

        const handleBeforeUnload = () => {
            flushPendingSave();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            flushPendingSave();
        };
    }, []);

    useEffect(() => {
        async function loadData() {
            try {
                const [tmplData] = await Promise.all([
                    fetchTemplates(),
                    loadCompetencies()
                ]);

                const actualTmplData = Array.isArray(tmplData) ? tmplData : (tmplData?.data || []);
                if (Array.isArray(actualTmplData)) {
                    const mapped = actualTmplData.map(t => ({
                        ...t,
                        id: t.template_id || t.id,
                        isActive: t.is_active !== undefined ? t.is_active : (t.isActive !== undefined ? t.isActive : false),
                        totalCourseCount: t.total_course_count !== undefined ? t.total_course_count : (t.TotalCourseCount !== undefined ? t.TotalCourseCount : (t.mapped_course_count || 0)),
                        masterData: t.curriculum_name_th ? { id: t.curriculum_id, name: t.curriculum_name_th, code: t.curriculum_code } : t.masterData,
                    }));
                    setTemplates(mapped);
                }
            } catch (err) {
                console.error('Failed to fetch templates or competencies:', err);
            }
        }
        loadData();
    }, [loadCompetencies]);

    // ── Derived ──
    const currentCategories      = selectedTemplate ? (categoriesByTemplate[selectedTemplate.id] || []) : [];
    const currentCoursesByCat    = selectedTemplate ? (coursesByTemplate[selectedTemplate.id] || {}) : {};
    const currentWeightsByCourse = selectedTemplate ? (weightsByTemplate[selectedTemplate.id] || {}) : {};
    const currentCompetencies    = useMemo(() => selectedTemplate ? (competenciesByTemplate[selectedTemplate.id] || []) : [], [selectedTemplate, competenciesByTemplate]);

    const updateCurrentCategories = useCallback((updater) => {
        if (!selectedTemplate) return;
        setCategoriesByTemplate(prev => ({
            ...prev,
            [selectedTemplate.id]: typeof updater === 'function'
                ? updater(prev[selectedTemplate.id] || []) : updater,
        }));
    }, [selectedTemplate]);

    const updateCurrentCourses = useCallback((updater) => {
        if (!selectedTemplate) return;
        setCoursesByTemplate(prev => ({
            ...prev,
            [selectedTemplate.id]: typeof updater === 'function'
                ? updater(prev[selectedTemplate.id] || {}) : updater,
        }));
    }, [selectedTemplate]);

    const courseCountMap = useMemo(() => {
        const m = {};
        templates.forEach(t => {
            const loadedCount = Object.values(coursesByTemplate[t.id] || {}).reduce((s, a) => s + a.length, 0);
            m[t.id] = loadedCount > 0 ? loadedCount : (t.totalCourseCount !== undefined ? t.totalCourseCount : (t.TotalCourseCount || 0));
        });
        return m;
    }, [templates, coursesByTemplate]);

    useEffect(() => {
        if (!selectedTemplate) return;
        const id = selectedTemplate.id;
        if (categoriesByTemplate[id] && categoriesByTemplate[id].length > 0) return;

        let active = true;
        const masterId = selectedTemplate.masterData?.id;

        Promise.all([
            masterId ? fetchCurriculumDetail(masterId) : Promise.resolve(null),
            fetchTemplateStructure(id)
        ])
            .then(([detail, struct]) => {
                if (!active) return;
                const courseMap = {};
                function convertCats(cats, courseMap) {
                    return (cats || []).map((cat, i) => {
                        const stableId = typeof cat.id === 'number' && cat.id < 5000 ? cat.id : (typeof cat.category_id === 'number' && cat.category_id < 5000 ? cat.category_id : ++idRef.current);
                        const converted = {
                            id: stableId,
                            code: cat.code,
                            name: cat.name || cat.nameTh || '',
                            requiredCredits: cat.requiredCredits || 0,
                            children: convertCats(cat.children || [], courseMap),
                            isNew: false,
                            fromMaster: true,
                        };
                        if (cat.courses?.length) {
                            courseMap[stableId] = cat.courses.map(c => ({
                                id: c.courseId || c.course_id || c.id || ++courseIdRef.current,
                                courseId: c.courseId || c.course_id || c.id || courseIdRef.current,
                                code: c.code,
                                nameTh: c.nameTh || c.name || '',
                                nameEn: c.nameEn || '',
                                credits: c.credits || 0,
                                fromMaster: true,
                                isCoreCourse: c.isCoreCourse || false,
                            }));
                        }
                        return converted;
                    });
                }
                const cats = detail && detail.categories ? convertCats(detail.categories, courseMap) : [];

                // The save API recreates Additional records in one transaction. Keep a
                // local ID for every loaded Additional record so parent/course/weight
                // references can be remapped to the newly inserted database IDs.
                const customCategoryIds = new Map();
                const customCourseIds = new Map();
                const customCategories = struct?.custom_categories || [];

                customCategories.forEach(category => {
                    const serverId = category.template_category_id || category.id;
                    if (serverId) customCategoryIds.set(serverId, ++idRef.current);
                });

                customCategories.forEach(category => {
                    const serverId = category.template_category_id || category.id;
                    const newCat = {
                        id: customCategoryIds.get(serverId) || ++idRef.current,
                        code: category.code || '',
                        name: category.name || '',
                        requiredCredits: 0,
                        children: [],
                        isNew: false,
                        fromMaster: false,
                    };
                    const parentTargetId = category.curriculum_parent_id
                        || customCategoryIds.get(category.parent_id)
                        || null;
                    if (parentTargetId) {
                        function attach(list) {
                            for (const item of list) {
                                if (item.id === parentTargetId) {
                                    item.children = [...(item.children || []), newCat];
                                    return true;
                                }
                                if (item.children?.length && attach(item.children)) return true;
                            }
                            return false;
                        }
                        if (!attach(cats)) cats.push(newCat);
                    } else {
                        cats.push(newCat);
                    }
                });

                // Merge Additional courses using the same local-ID policy.
                (struct?.custom_courses || []).forEach(course => {
                    const serverCourseId = course.template_course_id || course.id;
                    const localCourseId = ++courseIdRef.current;
                    if (serverCourseId) customCourseIds.set(serverCourseId, localCourseId);
                    const targetCatId = course.template_category_id
                        ? customCategoryIds.get(course.template_category_id)
                        : course.curriculum_category_id;
                    if (!targetCatId) return;

                    if (!courseMap[targetCatId]) courseMap[targetCatId] = [];
                    courseMap[targetCatId].push({
                        id: localCourseId,
                        courseId: localCourseId,
                        code: course.code,
                        nameTh: course.name_th || course.nameTh || '',
                        nameEn: course.name_en || course.nameEn || '',
                        credits: course.credits || 0,
                        fromMaster: false,
                        isCoreCourse: false,
                    });
                });

                const validCourseIds = new Set();
                Object.values(courseMap).forEach(arr => {
                    (arr || []).forEach(c => validCourseIds.add(c.id));
                });

                // Merge saved weights from struct.items
                const weightMap = {};
                if (struct && struct.items) {
                    struct.items.forEach(it => {
                        if (it.course_id && it.competency_id && it.weight !== null && it.weight !== undefined) {
                            const courseId = customCourseIds.get(it.course_id) || it.course_id;
                            if (!validCourseIds.has(courseId)) return;
                            if (!weightMap[courseId]) weightMap[courseId] = {};
                            weightMap[courseId][it.competency_id] = it.weight;
                        }
                    });
                }

                const tplComps = (struct && struct.competencies && struct.competencies.length > 0)
                    ? struct.competencies.map((sc, idx) => {
                        const master = allCompetencies.find(c => c.id === (sc.id || sc.competency_id));
                        return master || {
                            id: sc.id || sc.competency_id,
                            code: sc.code || `comp_${idx}`,
                            name: sc.name_th || sc.name || '',
                            color: ['#ec4899','#3b82f6','#06b6d4','#f59e0b','#10b981','#8b5cf6','#ef4444','#f97316'][idx % 8],
                        };
                    })
                    : [];

                setCategoriesByTemplate(p => ({ ...p, [id]: cats }));
                setCoursesByTemplate(p => ({ ...p, [id]: courseMap }));
                setWeightsByTemplate(p => ({ ...p, [id]: weightMap }));
                setCompetenciesByTemplate(p => ({ ...p, [id]: tplComps }));
            })
            .catch(err => console.error('Failed to load template structure:', err));

        return () => { active = false; };
    }, [selectedTemplate, categoriesByTemplate, allCompetencies]);

    // ============================================================
    // Template handlers
    // ============================================================
    const handleOpenTemplate = useCallback((t) => {
        setSelectedTemplate(t);
        setSelectedCategory(null);
        setShowAllCourses(true);
        setDraggingCategoryId(null);
        setDraggedTemplateCourse(null);
        setDropTargetCategoryId(null);
        setTemplateStatus(t.isActive ?? false);
        setView('editor');
    }, []);

    const handleBackToList = useCallback(() => {
        // Flush any pending auto-save before leaving the editor
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        if (pendingSaveFnRef.current) {
            pendingSaveFnRef.current();
            pendingSaveFnRef.current = null;
        }
        setView('list');
        setSelectedTemplate(null);
        setSelectedCategory(null);
        setShowAllCourses(false);
        setDraggingCategoryId(null);
        setDraggedTemplateCourse(null);
        setDropTargetCategoryId(null);
    }, []);

    const handleRequestDeleteTemplate = useCallback((t) => setDeletingTemplate(t), []);

    const handleSaveTitle = useCallback(async () => {
        const trimmed = titleVal.trim();
        if (trimmed && selectedTemplate && trimmed !== selectedTemplate.name) {
            try {
                await updateTemplateName(selectedTemplate.id, trimmed);
                setTemplates(p => p.map(t => t.id === selectedTemplate.id ? { ...t, name: trimmed } : t));
                setSelectedTemplate(p => ({ ...p, name: trimmed }));
            } catch (err) {
                showAlert('ไม่สามารถเปลี่ยนชื่อแบบแผนการประเมินได้: ' + (err.message || 'เกิดข้อผิดพลาด'), { type: 'error', title: 'เกิดข้อผิดพลาด' });
            }
        }
        setEditingTitle(false);
    }, [titleVal, selectedTemplate]);

    const handleConfirmDeleteTemplate  = useCallback(async () => {
        if (!deletingTemplate) return;
        const id = deletingTemplate.id;
        try {
            await deleteTemplate(id);
            setTemplates(p => p.filter(t => t.id !== id));
            setCategoriesByTemplate(p => { const n = { ...p }; delete n[id]; return n; });
            setCoursesByTemplate(p => { const n = { ...p }; delete n[id]; return n; });
            setWeightsByTemplate(p => { const n = { ...p }; delete n[id]; return n; });
            if (selectedTemplate?.id === id) handleBackToList();
            setDeletingTemplate(null);
        } catch (err) {
            showAlert(err.message || 'ไม่สามารถลบแบบแผนการประเมินได้', { type: 'error', title: 'ไม่สามารถลบได้' });
            setDeletingTemplate(null);
        }
    }, [deletingTemplate, selectedTemplate, handleBackToList]);

    const handleSaveTemplate = useCallback(async ({ name, masterData, competencyIds }) => {
        let createdId = null;
        let actualCreated = null;
        try {
            const payload = {
                name,
                curriculum_id: masterData?.id,
                competency_ids: competencyIds || [],
            };
            const created = await createTemplate(payload);
            actualCreated = created?.data || created;
            createdId = actualCreated?.template_id || actualCreated?.id || null;
            if (!createdId) throw new Error('template creation returned no template id');
        } catch (err) {
            console.error('Create template API failed:', err);
            showAlert(err.message || 'Unable to create assessment plan.', { type: 'error', title: 'Assessment plan was not created' });
            return;
        }

        const id = createdId;
        const newTemplate = { 
            id, 
            name, 
            totalCourseCount: actualCreated?.total_course_count || actualCreated?.TotalCourseCount || (masterData?.total_courses || masterData?.course_count || 0),
            masterData: masterData ? { ...masterData, name: masterData.name || masterData.nameTh || masterData.curriculum_name_th || '' } : null,
            isActive: typeof actualCreated?.is_active === 'boolean' ? actualCreated.is_active : (typeof actualCreated?.isActive === 'boolean' ? actualCreated.isActive : false)
        };
        setTemplates(p => [...p, newTemplate]);

        // ถ้ามี masterData → แปลง categories และ courses จาก master
        if (masterData) {
            let currentMaster = masterData;
            if (!currentMaster.categories || currentMaster.categories.length === 0) {
                try {
                    const detail = await fetchCurriculumDetail(currentMaster.id);
                    if (detail) {
                        currentMaster = { ...currentMaster, ...detail, name: detail.nameTh || detail.name || currentMaster.nameTh };
                    }
                } catch (err) {
                    console.error('Failed to fetch detail in save:', err);
                }
            }
            // แปลง master categories → format ที่ใช้ใน app
            function convertCats(cats, courseMap) {
                return (cats || []).map((cat, i) => {
                    const stableId = typeof cat.id === 'number' && cat.id < 5000 ? cat.id : (typeof cat.category_id === 'number' && cat.category_id < 5000 ? cat.category_id : ++idRef.current);
                    const converted = {
                        id: stableId,
                        code: cat.code,
                        name: cat.name || cat.nameTh || '',
                        requiredCredits: cat.requiredCredits || 0,
                        children: convertCats(cat.children || [], courseMap),
                        isNew: false,
                        fromMaster: true,  // ← mark ว่ามาจาก master
                    };
                    if (cat.courses?.length) {
                        courseMap[stableId] = cat.courses.map(c => ({
                            id: c.courseId || c.course_id || c.id || ++courseIdRef.current,
                            courseId: c.courseId || c.course_id || c.id || courseIdRef.current,
                            code: c.code,
                            nameTh: c.nameTh || c.name || '',
                            nameEn: c.nameEn || '',
                            credits: c.credits || 0,
                            fromMaster: true,
                            isCoreCourse: c.isCoreCourse || false,
                        }));
                    }
                    return converted;
                });
            }
            const courseMap = {};
            const cats = convertCats(currentMaster.categories, courseMap);
            setCategoriesByTemplate(p => ({ ...p, [id]: cats }));
            setCoursesByTemplate(p => ({ ...p, [id]: courseMap }));
        } else {
            setCategoriesByTemplate(p => ({ ...p, [id]: [] }));
        }

        // set competencies ที่เลือก
        if (competencyIds?.length) {
            setAllCompetencies(prev => {
                const kept = prev.filter(c => competencyIds.includes(c.id));
                setCompetenciesByTemplate(p => ({ ...p, [id]: kept }));
                return prev;
            });
        }

        setShowTemplateModal(false);
        setSelectedTemplate(newTemplate);
        setSelectedCategory(null);
        setShowAllCourses(true);
        setView('editor');
    }, [showAlert]);

    // ============================================================
    // Auto Save Helper
    // ============================================================
    const triggerAutoSaveToAPI = useCallback((tplId, nextCats, nextCoursesMap, nextWeightsMap) => {
        if (!tplId) return;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        const executeSave = () => {
            const activeCourseIds = new Set();
            Object.values(nextCoursesMap || {}).forEach(arr => {
                (arr || []).forEach(c => {
                    if (c && c.id) activeCourseIds.add(c.id);
                });
            });

            const items = [];
            Object.entries(nextWeightsMap || {}).forEach(([cIdStr, compMap]) => {
                const cId = Number(cIdStr);
                if (!activeCourseIds.has(cId)) return;
                let isCustom = false;
                Object.values(nextCoursesMap || {}).forEach(arr => {
                    (arr || []).forEach(c => {
                        if (c.id === cId && !c.fromMaster) isCustom = true;
                    });
                });
                Object.entries(compMap || {}).forEach(([cpId, w]) => {
                    if (Number(w) > 0) {
                        items.push({
                            course_id: cId || 0,
                            competency_id: Number(cpId) || 0,
                            weight: Number(w) || 0,
                            is_custom_course: isCustom
                        });
                    }
                });
            });

            const custom_categories = [];
            function traverseCats(arr, parentId = null, isParentMaster = true) {
                (arr || []).forEach(c => {
                    if (!c.fromMaster) {
                        const isCurriParent = parentId !== null && (isParentMaster || parentId < 50000);
                        custom_categories.push({
                            template_category_id: typeof c.id === 'number' ? c.id : 0,
                            curriculum_parent_id: isCurriParent ? parentId : null,
                            parent_id: (parentId !== null && !isCurriParent) ? parentId : null,
                            code: c.code || '',
                            name: c.name || '',
                            display_order: custom_categories.length + 1,
                            is_active: true
                        });
                    }
                    traverseCats(c.children || [], typeof c.id === 'number' ? c.id : null, c.fromMaster);
                });
            }
            traverseCats(nextCats || [], null, true);

            const custom_courses = [];
            Object.entries(nextCoursesMap || {}).forEach(([catIdStr, arr]) => {
                const catId = Number(catIdStr);
                const cat = findById(nextCats || [], catId);
                const isCatMaster = cat?.fromMaster ?? true;
                (arr || []).forEach((c, idx) => {
                    if (!c.fromMaster && c.code && (c.nameTh || c.name)) {
                        custom_courses.push({
                            template_course_id: typeof c.id === 'number' ? c.id : 0,
                            curriculum_category_id: isCatMaster ? catId : null,
                            template_category_id: !isCatMaster ? catId : null,
                            code: c.code || '',
                            name_th: c.nameTh || c.name || '',
                            name_en: c.nameEn || '',
                            credits: Number(c.credits) || 3,
                            display_order: idx + 1,
                            is_active: true
                        });
                    }
                });
            });

            saveTemplateItems(tplId, { items, custom_categories, custom_courses }).catch(err => {
                console.warn('Cannot auto-save or API notice:', err.message || err);
            });
        };

        pendingSaveFnRef.current = executeSave;
        saveTimeoutRef.current = setTimeout(() => {
            executeSave();
            pendingSaveFnRef.current = null;
        }, 500);
    }, [selectedTemplate]);

    // ============================================================
    // Category handlers
    // ============================================================
    const handleSelectCategory = useCallback((cat) => {
        setShowAllCourses(false);
        setSelectedCategory(cat);
    }, []);

    const loadTemplateCompetencyManager = useCallback(async (templateID) => {
        if (!templateID) return null;
        setCompetencyManagerLoading(true);
        try {
            const [managerData] = await Promise.all([
                fetchTemplateCompetencies(templateID),
                loadCompetencies(),
            ]);
            setCompetencyManagerState(managerData);
            return managerData;
        } catch (error) {
            showTemplateToast('error', templateCompetencyMessage(error), error.message);
            return null;
        } finally {
            setCompetencyManagerLoading(false);
        }
    }, [loadCompetencies, showTemplateToast, templateCompetencyMessage]);

    const handleOpenCompetencyManager = useCallback(async () => {
        if (!selectedTemplate) return;
        setCompetencyManagerState(null);
        setShowCompetencyManager(true);
        const managerData = await loadTemplateCompetencyManager(selectedTemplate.id);
        if (!managerData) setShowCompetencyManager(false);
    }, [selectedTemplate, loadTemplateCompetencyManager]);

    const refreshTemplateStructure = useCallback((templateID) => {
        setCategoriesByTemplate(current => {
            const next = { ...current };
            delete next[templateID];
            return next;
        });
    }, []);

    const handleReloadEditor = useCallback(async () => {
        if (!selectedTemplate) return;

        refreshTemplateStructure(selectedTemplate.id);
        try {
            await loadCompetencies();
            showTemplateToast('success', language === 'th' ? 'โหลดข้อมูลแบบแผนการประเมินใหม่แล้ว' : 'Assessment plan data reloaded.');
        } catch (error) {
            showTemplateToast('error', language === 'th' ? 'โหลดข้อมูลแบบแผนการประเมินไม่สำเร็จ' : 'Unable to reload assessment plan data.', error?.message);
        }
    }, [language, loadCompetencies, refreshTemplateStructure, selectedTemplate, showTemplateToast]);

    const applyTemplateCompetencySelection = useCallback(async (competencyIds, confirmRemoval = false) => {
        if (!selectedTemplate) return;
        setCompetencyManagerSaving(true);
        try {
            const result = await updateTemplateCompetencies(selectedTemplate.id, {
                competency_ids: competencyIds,
                confirm_removal: confirmRemoval,
            });
            const updatedCompetencies = normalizeCompetencies(result?.competencies || []);
            setCompetenciesByTemplate(current => ({ ...current, [selectedTemplate.id]: updatedCompetencies }));
            refreshTemplateStructure(selectedTemplate.id);
            setCompetencyRemovalConfirmation(null);
            setShowCompetencyManager(false);
            showTemplateToast('success', language === 'th' ? 'บันทึกสมรรถนะของแบบแผนการประเมินแล้ว' : 'Assessment plan competencies saved.');
        } catch (error) {
            if (error?.code === 'CONFIRMATION_REQUIRED') {
                setCompetencyRemovalConfirmation({
                    competencyIds,
                    impacts: error?.payload?.error?.data?.removed_competencies || [],
                });
                return;
            }
            showTemplateToast('error', templateCompetencyMessage(error), error.message);
        } finally {
            setCompetencyManagerSaving(false);
        }
    }, [language, refreshTemplateStructure, selectedTemplate, showTemplateToast, templateCompetencyMessage]);

    const handleSaveTemplateCompetencies = useCallback((competencyIds) => {
        applyTemplateCompetencySelection(competencyIds);
    }, [applyTemplateCompetencySelection]);

    const handleConfirmCompetencyRemoval = useCallback(() => {
        if (!competencyRemovalConfirmation) return;
        applyTemplateCompetencySelection(competencyRemovalConfirmation.competencyIds, true);
    }, [applyTemplateCompetencySelection, competencyRemovalConfirmation]);
    const handleSelectAllCourses = useCallback(() => {
        setSelectedCategory(null);
        setShowAllCourses(true);
    }, []);
    const handleDeselectCategory = useCallback(() => {
        setSelectedCategory(null);
        setShowAllCourses(false);
    }, []);

    // parentId = null → เพิ่มที่ root, parentId = id → เพิ่มเป็นลูกของ parent
    const handleCreateCategory = useCallback((parentId = selectedCategory?.id ?? null) => {
        if (!selectedTemplate) return;
        if (selectedTemplate.isActive) {
            showAlert('ไม่สามารถเพิ่มหมวดวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active)', { type: 'warning', title: 'Template อยู่ในสถานะ Active', details: 'กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข' });
            return;
        }
        const newId = ++idRef.current;
        if (!parentId) {
            // เพิ่มที่ root level
            const code = getNextCode('', getDirectChildren(currentCategories, null));
            const newCat = { id: newId, code, name: '', requiredCredits: 0, children: [], isNew: true, fromMaster: false };
            const nextCats = [...currentCategories, newCat];
            updateCurrentCategories(nextCats);
            setSelectedCategory(newCat);
            triggerAutoSaveToAPI(selectedTemplate.id, nextCats, currentCoursesByCat, currentWeightsByCourse);
        } else {
            const parent = findById(currentCategories, parentId);
            if (!parent) return;
            if (getDepthFromCode(parent.code) >= 3) {
                showAlert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 4 ระดับได้', { type: 'info', title: 'ถึงระดับสูงสุดแล้ว' }); return;
            }
            // ถ้า parent มาจาก Master และมีวิชาอยู่แล้ว → ห้ามสร้างหมวดย่อย
            const parentCourses = currentCoursesByCat[parentId] || [];
            if (parent.fromMaster && parentCourses.length > 0) {
                showAlert(`หมวด "${parent.code} ${parent.name}" มีรายวิชาอยู่แล้ว ไม่สามารถสร้างหมวดย่อยได้`, { type: 'warning', title: 'ไม่สามารถสร้างหมวดย่อยได้' });
                return;
            }
            const code = getNextCode(parent.code, getDirectChildren(currentCategories, parentId));
            const newCat = { id: newId, code, name: '', requiredCredits: 0, children: [], isNew: true, fromMaster: false };
            let nextCoursesMap = currentCoursesByCat;
            const nextCats = insertChild(currentCategories, parentId, newCat);
            updateCurrentCategories(nextCats);
            setSelectedCategory(newCat);
            triggerAutoSaveToAPI(selectedTemplate.id, nextCats, nextCoursesMap, currentWeightsByCourse);
        }
    }, [selectedCategory, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCategories, selectedTemplate, triggerAutoSaveToAPI]);

    const handleRenameCategory = useCallback((id, name) => {
        if (!selectedTemplate) return;
        const nextCats = renameCategory(currentCategories, id, name || 'หมวดใหม่');
        updateCurrentCategories(nextCats);
        triggerAutoSaveToAPI(selectedTemplate.id, nextCats, currentCoursesByCat, currentWeightsByCourse);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCategories, triggerAutoSaveToAPI]);

    const clearStructureDragState = useCallback(() => {
        setDraggingCategoryId(null);
        setDraggedTemplateCourse(null);
        setDropTargetCategoryId(null);
    }, []);

    const canMoveTemplateCategory = useCallback((targetCategory = null) => {
        if (!draggingCategoryId || !selectedTemplate || selectedTemplate.isActive) return false;
        const movingCategory = findById(currentCategories, draggingCategoryId);
        if (!movingCategory || movingCategory.fromMaster) return false;
        if (!targetCategory) return true;
        if (targetCategory.id === movingCategory.id || isDescendantOf(movingCategory, targetCategory.id)) return false;
        if ((currentCoursesByCat[targetCategory.id] || []).length > 0) return false;
        return getDepthFromCode(targetCategory.code) + 1 + getSubtreeDepth(movingCategory) <= 3;
    }, [draggingCategoryId, selectedTemplate, currentCategories, currentCoursesByCat]);

    const handleTemplateCategoryDragStart = useCallback((event, category) => {
        if (category?.fromMaster || selectedTemplate?.isActive) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(category.id));
        setDraggingCategoryId(category.id);
        setDraggedTemplateCourse(null);
        setDropTargetCategoryId(null);
    }, [selectedTemplate]);

    const handleTemplateCategoryDragOver = useCallback((event, targetCategory) => {
        if (!canMoveTemplateCategory(targetCategory)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId(targetCategory.id);
    }, [canMoveTemplateCategory]);

    const handleTemplateCategoryRootDragOver = useCallback((event) => {
        if (!canMoveTemplateCategory()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId('root');
    }, [canMoveTemplateCategory]);

    const commitTemplateCategoryMove = useCallback((targetCategory = null) => {
        if (!canMoveTemplateCategory(targetCategory)) {
            clearStructureDragState();
            return;
        }
        const nextCategories = moveCategory(currentCategories, draggingCategoryId, targetCategory?.id ?? null);
        updateCurrentCategories(nextCategories);
        setSelectedCategory(current => current ? findById(nextCategories, current.id) || null : null);
        triggerAutoSaveToAPI(selectedTemplate.id, nextCategories, currentCoursesByCat, currentWeightsByCourse);
        clearStructureDragState();
    }, [
        canMoveTemplateCategory,
        clearStructureDragState,
        currentCategories,
        currentCoursesByCat,
        currentWeightsByCourse,
        draggingCategoryId,
        selectedTemplate,
        triggerAutoSaveToAPI,
        updateCurrentCategories,
    ]);

    const handleTemplateCategoryDrop = useCallback((event, targetCategory) => {
        event.preventDefault();
        commitTemplateCategoryMove(targetCategory);
    }, [commitTemplateCategoryMove]);

    const handleTemplateCategoryRootDrop = useCallback((event) => {
        event.preventDefault();
        commitTemplateCategoryMove(null);
    }, [commitTemplateCategoryMove]);

    const handleTemplateCourseDragStart = useCallback((event, course) => {
        if (course?.fromMaster || selectedTemplate?.isActive) return;
        event?.dataTransfer?.setData('text/plain', String(course.id));
        if (event?.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        setDraggedTemplateCourse(course);
        setDraggingCategoryId(null);
        setDropTargetCategoryId(null);
    }, [selectedTemplate]);

    const moveTemplateCourse = useCallback((targetCategory, beforeCourseId = null) => {
        if (!draggedTemplateCourse || selectedTemplate?.isActive || !targetCategory) {
            clearStructureDragState();
            return;
        }
        if (draggedTemplateCourse.fromMaster || (targetCategory.children || []).length > 0) {
            clearStructureDragState();
            return;
        }
        const nextCourses = moveCourseToCategory(
            currentCoursesByCat,
            draggedTemplateCourse,
            targetCategory.id,
            beforeCourseId,
        );
        updateCurrentCourses(nextCourses);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCourses, currentWeightsByCourse);
        clearStructureDragState();
    }, [
        clearStructureDragState,
        currentCategories,
        currentCoursesByCat,
        currentWeightsByCourse,
        draggedTemplateCourse,
        selectedTemplate,
        triggerAutoSaveToAPI,
        updateCurrentCourses,
    ]);

    const handleTemplateCourseCategoryDragOver = useCallback((event, targetCategory) => {
        if (!draggedTemplateCourse || selectedTemplate?.isActive || (targetCategory.children || []).length > 0) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetCategoryId(targetCategory.id);
    }, [draggedTemplateCourse, selectedTemplate]);

    const handleTemplateCourseCategoryDrop = useCallback((event, targetCategory) => {
        event.preventDefault();
        moveTemplateCourse(targetCategory);
    }, [moveTemplateCourse]);

    const handleTemplateCourseMove = useCallback(({ targetCategory, beforeCourseId }) => {
        moveTemplateCourse(targetCategory, beforeCourseId);
    }, [moveTemplateCourse]);

    const handleRequestDeleteCategory = useCallback((cat) => {
        if (selectedTemplate?.isActive) {
            showAlert('ไม่สามารถลบหมวดวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active)', { type: 'warning', title: 'Template อยู่ในสถานะ Active', details: 'กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข' });
            return;
        }
        setDeletingCategory(cat);
    }, [selectedTemplate]);
    const handleConfirmDeleteCategory  = useCallback(() => {
        if (!deletingCategory || !selectedTemplate || selectedTemplate.isActive) return;
        const ids = collectIds(deletingCategory);
        const nextCoursesMap = { ...currentCoursesByCat };
        const nextWeightsMap = { ...currentWeightsByCourse };
        ids.forEach(id => {
            const courses = nextCoursesMap[id] || [];
            courses.forEach(c => delete nextWeightsMap[c.id]);
            delete nextCoursesMap[id];
        });
        setCoursesByTemplate(p => ({ ...p, [selectedTemplate.id]: nextCoursesMap }));
        setWeightsByTemplate(p => ({ ...p, [selectedTemplate.id]: nextWeightsMap }));
        const nextCats = removeCategory(currentCategories, deletingCategory.id);
        updateCurrentCategories(nextCats);
        if (selectedCategory?.id === deletingCategory.id || isDescendantOf(deletingCategory, selectedCategory?.id)) {
            setSelectedCategory(null);
        }
        setDeletingCategory(null);
        triggerAutoSaveToAPI(selectedTemplate.id, nextCats, nextCoursesMap, nextWeightsMap);
    }, [deletingCategory, selectedTemplate, selectedCategory, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCategories, triggerAutoSaveToAPI]);

    // ============================================================
    // Course handlers
    // ============================================================
    const handleAddCourse = useCallback((catId, data) => {
        if (!selectedTemplate) return;
        if (selectedTemplate.isActive) {
            showAlert('ไม่สามารถเพิ่มรายวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active)', { type: 'warning', title: 'Template อยู่ในสถานะ Active', details: 'กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข' });
            return;
        }
        const course = { id: ++courseIdRef.current, ...data, fromMaster: false };
        const nextCoursesMap = { ...currentCoursesByCat, [catId]: [...(currentCoursesByCat[catId] || []), course] };
        updateCurrentCourses(nextCoursesMap);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, currentWeightsByCourse);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCourses, triggerAutoSaveToAPI]);

    const handleUpdateCourse = useCallback((catId, updatedCourse) => {
        if (!selectedTemplate || selectedTemplate.isActive || updatedCourse?.fromMaster) return false;
        const nextCoursesMap = {
            ...currentCoursesByCat,
            [catId]: (currentCoursesByCat[catId] || []).map(c => c.id === updatedCourse.id ? updatedCourse : c),
        };
        updateCurrentCourses(nextCoursesMap);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, currentWeightsByCourse);
        return true;
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCourses, triggerAutoSaveToAPI]);

    const handleRequestDeleteCourse = useCallback((catId, course) => {
        if (course?.fromMaster) return;
        if (selectedTemplate?.isActive) {
            showAlert('ไม่สามารถลบรายวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active)', { type: 'warning', title: 'Template อยู่ในสถานะ Active', details: 'กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข' });
            return;
        }
        setDeletingCourse({ ...course, _catId: catId });
    }, [selectedTemplate]);

    const handleBulkDeleteTemplateCourses = useCallback((catId, courses) => {
        if (!selectedTemplate || selectedTemplate.isActive || !courses?.length) return false;
        const deletingIds = new Set(courses.filter(course => !course.fromMaster).map(course => course.id));
        if (!deletingIds.size) return false;

        const nextCoursesMap = {
            ...currentCoursesByCat,
            [catId]: (currentCoursesByCat[catId] || []).filter(course => !deletingIds.has(course.id)),
        };
        const nextWeightsMap = { ...currentWeightsByCourse };
        deletingIds.forEach(courseId => delete nextWeightsMap[courseId]);

        updateCurrentCourses(nextCoursesMap);
        setWeightsByTemplate(previous => ({ ...previous, [selectedTemplate.id]: nextWeightsMap }));
        setDeletingCourses(null);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, nextWeightsMap);
        return true;
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, triggerAutoSaveToAPI, updateCurrentCourses]);

    const handleRequestBulkDeleteTemplateCourses = useCallback((catId, courses) => {
        if (!selectedTemplate || selectedTemplate.isActive || !courses?.length) return false;
        const deletableCourses = courses.filter(course => !course.fromMaster);
        if (!deletableCourses.length) return false;
        setDeletingCourses({ catId, courses: deletableCourses });
        return false;
    }, [selectedTemplate]);

    const validateTemplateCourseBeforeSave = useCallback((candidate) => {
        const candidateCode = String(candidate?.code || '').trim().toLowerCase();
        if (!candidateCode) return true;
        const duplicate = Object.values(currentCoursesByCat)
            .flat()
            .find(course => (
                String(course.id) !== String(candidate.id)
                && String(course.code || '').trim().toLowerCase() === candidateCode
            ));
        if (!duplicate) return true;

        alert(`ไม่สามารถบันทึกรายวิชาได้ เพราะมีรหัสวิชา ${candidate.code} อยู่ใน Template นี้แล้ว`);
        return false;
    }, [currentCoursesByCat]);

    const handleConfirmDeleteCourse = useCallback(() => {
        if (!deletingCourse || !selectedTemplate || selectedTemplate.isActive) return;
        const catId = deletingCourse._catId;
        const nextCoursesMap = { ...currentCoursesByCat, [catId]: (currentCoursesByCat[catId] || []).filter(c => c.id !== deletingCourse.id) };
        updateCurrentCourses(nextCoursesMap);
        const nextWeightsMap = { ...currentWeightsByCourse };
        delete nextWeightsMap[deletingCourse.id];
        setWeightsByTemplate(p => ({ ...p, [selectedTemplate.id]: nextWeightsMap }));
        setDeletingCourse(null);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, nextWeightsMap);
    }, [deletingCourse, selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCourses, triggerAutoSaveToAPI]);

    // ============================================================
    // Competency / Weight handlers
    // ============================================================
    const handleSetWeight = useCallback((courseId, compId, weight) => {
        if (!selectedTemplate) return;
        const course = { ...(currentWeightsByCourse[courseId] || {}), [compId]: weight };
        const nextWeightsMap = { ...currentWeightsByCourse, [courseId]: course };
        setWeightsByTemplate(p => ({ ...p, [selectedTemplate.id]: nextWeightsMap }));
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, currentCoursesByCat, nextWeightsMap);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, triggerAutoSaveToAPI]);

    const handleToggleTemplateStatus = useCallback(async (newStatus) => {
        if (!selectedTemplate) return;

        // Validate before activating: every course must have at least one competency weight
        if (newStatus === true) {
            const tplId = selectedTemplate.id;
            const coursesMap = coursesByTemplate[tplId] || {};
            const weightsMap = weightsByTemplate[tplId] || {};
            const comps = competenciesByTemplate[tplId] || [];

            const allCourses = Object.values(coursesMap).flat();
            if (allCourses.length === 0) {
                showAlert('ไม่สามารถเปิดใช้งานได้เนื่องจาก Template ยังไม่มีรายวิชา', { type: 'error', title: 'ไม่สามารถเปิดใช้งานได้' });
                return;
            }
            if (comps.length === 0) {
                showAlert('ไม่สามารถเปิดใช้งานได้เนื่องจาก Template ยังไม่มีสมรรถนะ', { type: 'error', title: 'ไม่สามารถเปิดใช้งานได้' });
                return;
            }

            const coursesWithoutComp = allCourses.filter(c => {
                const courseWeights = weightsMap[c.id] || {};
                return !comps.some(comp => (Number(courseWeights[comp.id]) || 0) > 0);
            });

            if (coursesWithoutComp.length > 0) {
                const maxShow = 5;
                const names = coursesWithoutComp
                    .slice(0, maxShow)
                    .map(c => `  - ${c.code || '(ไม่มีรหัส)'} ${c.nameTh || c.name || ''}`)
                    .join('\n');
                const extra = coursesWithoutComp.length > maxShow
                    ? `\n  ... และอีก ${coursesWithoutComp.length - maxShow} วิชา`
                    : '';
                showAlert(
                    `ไม่สามารถเปิดใช้งานได้: มี ${coursesWithoutComp.length} วิชาที่ยังไม่ได้กำหนดค่าน้ำหนักสมรรถนะ`,
                    {
                        type: 'error',
                        title: 'ไม่สามารถเปิดใช้งานได้',
                        details: `วิชาที่ยังไม่ผูกสมรรถนะ:\n${names}${extra}\n\nกรุณาไปที่แท็บ "ใส่น้ำหนักสมรรถนะ" เพื่อกำหนดค่าให้ครบทุกวิชา`
                    }
                );
                return;
            }
        }

        try {
            await updateTemplateStatus(selectedTemplate.id, newStatus ? 'Active' : 'Inactive');
            setTemplateStatus(newStatus);
            setTemplates(p => p.map(t => 
                t.id === selectedTemplate.id ? { ...t, isActive: newStatus } : t
            ));
            setSelectedTemplate(p => ({ ...p, isActive: newStatus }));
        } catch (err) {
            showAlert(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ', { type: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    }, [selectedTemplate, coursesByTemplate, weightsByTemplate, competenciesByTemplate]);

    // ============================================================
    // Render
    // ============================================================

    // ── List View ──
    if (view === 'list') {
        return (
            <div className="tm-page">
                    {/* Header */}
                    <div className="tm-header">
                        <div>
                            <h1 className="tm-header__title">จัดการแบบแผนการประเมิน</h1>
                            <p className="tpl-list-view__sub">เลือกแบบแผนการประเมินที่ต้องการแก้ไข หรือสร้างแบบแผนใหม่</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn--primary" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={15}/> สร้างแบบแผนใหม่
                            </button>
                        </div>
                    </div>

                    {/* Cards */}
                    {templates.length === 0 ? (
                        <div className="tpl-list-view__empty">
                            <BookOpenCheck size={48} opacity={0.2}/>
                            <p>ยังไม่มีแบบแผนการประเมิน — กดปุ่ม &quot;สร้างแบบแผนใหม่&quot; เพื่อเริ่ม</p>
                            <button className="btn btn--primary" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={15}/> สร้างแบบแผนใหม่
                            </button>
                        </div>
                    ) : (
                        <div className="tpl-card-grid">
                            {templates.map(t => (
                                <TemplateCard
                                    key={t.id}
                                    template={t}
                                    courseCount={courseCountMap[t.id] ?? 0}
                                    onOpen={handleOpenTemplate}
                                    onDelete={handleRequestDeleteTemplate}
                                />
                            ))}
                            {/* + Create card */}
                            <div className="tpl-card tpl-card--create" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={28} opacity={0.4}/>
                                <span>สร้างแบบแผนใหม่</span>
                            </div>
                        </div>
                    )}

                {/* Modals */}
                {showTemplateModal && (
                    <TemplateFormModal
                        onClose={() => setShowTemplateModal(false)}
                        onSave={handleSaveTemplate}
                        allCompetencies={allCompetencies}
                        onRefreshCompetencies={loadCompetencies}
                    />
                )}
                {deletingTemplate && (
                    <ConfirmDeleteModal
                        category={{ code:'', name: deletingTemplate.name }}
                        label="Template"
                        onConfirm={handleConfirmDeleteTemplate}
                        onCancel={() => setDeletingTemplate(null)}
                    />
                )}
                <ToastNotifications
                    success={toast.success}
                    error={toast.error}
                    errorDebug={toast.errorDebug}
                    onCloseSuccess={() => setToast(current => ({ ...current, success: '' }))}
                    onCloseError={() => setToast(current => ({ ...current, error: '', errorDebug: '' }))}
                />
                <AlertModal
                    open={alertModal.open}
                    title={alertModal.title}
                    message={alertModal.message}
                    details={alertModal.details}
                    type={alertModal.type}
                    onClose={closeAlert}
                />
            </div>
        );
    }

    const editorCopy = language === 'en'
        ? {
            back: 'All assessment plans',
            reload: 'Reload',
            manageCompetencies: 'Manage competencies',
            fallbackCurriculum: 'Curriculum is not assigned',
            setup: 'Course setup',
            weight: 'Competency weights',
            overview: 'Competency overview',
        }
        : {
            back: 'แบบแผนการประเมินทั้งหมด',
            reload: 'โหลดใหม่',
            manageCompetencies: 'จัดการสมรรถนะ',
            fallbackCurriculum: 'ยังไม่กำหนดหลักสูตร',
            setup: 'ตั้งค่าวิชา',
            weight: 'ใส่น้ำหนักสมรรถนะ',
            overview: 'ภาพรวมสมรรถนะ',
        };

    // ── Editor View ──
    return (
        <div className="tm-page tm-page--editor">
            <div className="editor-topbar">
                <div className="editor-topbar__main">
                    <button className="btn btn--ghost btn--sm editor-topbar__back" onClick={handleBackToList}>
                        <ArrowLeft size={15}/> {editorCopy.back}
                    </button>

                    <div className="editor-topbar__identity">
                        {editingTitle ? (
                            <input
                                className="editor-topbar__title-input"
                                value={titleVal}
                                autoFocus
                                onChange={e => setTitleVal(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') setEditingTitle(false);
                                }}
                            />
                        ) : (
                            <h1
                                className="editor-topbar__title editor-topbar__title--editable"
                                title={language === 'th' ? 'ดับเบิลคลิกเพื่อแก้ไขชื่อ' : 'Double-click to edit the name'}
                                onDoubleClick={() => {
                                    setTitleVal(selectedTemplate?.name || '');
                                    setEditingTitle(true);
                                }}
                            >
                                {selectedTemplate?.name}
                            </h1>
                        )}

                        <span className="editor-topbar__subtitle">
                            {selectedTemplate?.masterData
                                ? `${selectedTemplate.masterData.name || selectedTemplate.masterData.nameTh || selectedTemplate.masterData.curriculum_name_th || ''}`
                                : editorCopy.fallbackCurriculum}
                        </span>
                    </div>
                </div>

                <div className="editor-topbar__actions">
                    <button className="btn btn--ghost btn--sm" onClick={handleReloadEditor}>
                        <RefreshCw size={15}/> {editorCopy.reload}
                    </button>
                    <button className="btn btn--primary btn--sm" onClick={handleOpenCompetencyManager}>
                        <Settings2 size={15}/> {editorCopy.manageCompetencies}
                    </button>
                </div>
            </div>

            <div className="editor-tabs">
                {[
                    { id:'setup',    label: editorCopy.setup,    icon: <Settings size={14}/> },
                    { id:'weight',   label: editorCopy.weight,   icon: <SlidersHorizontal size={14}/> },
                    { id:'overview', label: editorCopy.overview, icon: <BarChart3 size={14}/> },
                ].map(tab => (
                    <button key={tab.id}
                        className={`editor-tab ${editorTab === tab.id ? 'editor-tab--active' : ''}`}
                        aria-current={editorTab === tab.id ? 'page' : undefined}
                        onClick={() => setEditorTab(tab.id)}>
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {editorTab === 'setup' && (
                <TemplateStructureWorkspace
                    template={selectedTemplate}
                    categories={currentCategories}
                    selectedCategory={selectedCategory}
                    showAllCourses={showAllCourses}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={currentCompetencies}
                    language={language}
                    onSelectCategory={handleSelectCategory}
                    onDeselectCategory={handleDeselectCategory}
                    onSelectAllCourses={handleSelectAllCourses}
                    onCreateCategory={handleCreateCategory}
                    onRenameCategory={handleRenameCategory}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onBulkDeleteCourses={handleRequestBulkDeleteTemplateCourses}
                    onMoveCourse={handleTemplateCourseMove}
                    onValidateCourse={validateTemplateCourseBeforeSave}
                    onSetWeight={handleSetWeight}
                    draggingCategoryId={draggingCategoryId}
                    draggedCourseId={draggedTemplateCourse?.id ?? null}
                    dropTargetCategoryId={dropTargetCategoryId}
                    onCategoryRootDragOver={handleTemplateCategoryRootDragOver}
                    onCategoryRootDrop={handleTemplateCategoryRootDrop}
                    onCategoryDragStart={handleTemplateCategoryDragStart}
                    onCategoryDragOver={handleTemplateCategoryDragOver}
                    onCategoryDrop={handleTemplateCategoryDrop}
                    onCategoryDragEnd={clearStructureDragState}
                    onCategoryDragLeave={() => setDropTargetCategoryId(null)}
                    onCourseCategoryDragOver={handleTemplateCourseCategoryDragOver}
                    onCourseCategoryDrop={handleTemplateCourseCategoryDrop}
                    onCourseDragStart={handleTemplateCourseDragStart}
                    onCourseDragEnd={clearStructureDragState}
                    mode="setup"
                />
            )}

            {editorTab === 'weight' && (
                <TemplateStructureWorkspace
                    template={selectedTemplate}
                    categories={currentCategories}
                    selectedCategory={selectedCategory}
                    showAllCourses={showAllCourses}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={currentCompetencies}
                    language={language}
                    onSelectCategory={handleSelectCategory}
                    onDeselectCategory={handleDeselectCategory}
                    onSelectAllCourses={handleSelectAllCourses}
                    onCreateCategory={handleCreateCategory}
                    onRenameCategory={handleRenameCategory}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onBulkDeleteCourses={handleRequestBulkDeleteTemplateCourses}
                    onMoveCourse={handleTemplateCourseMove}
                    onValidateCourse={validateTemplateCourseBeforeSave}
                    onSetWeight={handleSetWeight}
                    draggingCategoryId={draggingCategoryId}
                    draggedCourseId={draggedTemplateCourse?.id ?? null}
                    dropTargetCategoryId={dropTargetCategoryId}
                    onCategoryRootDragOver={handleTemplateCategoryRootDragOver}
                    onCategoryRootDrop={handleTemplateCategoryRootDrop}
                    onCategoryDragStart={handleTemplateCategoryDragStart}
                    onCategoryDragOver={handleTemplateCategoryDragOver}
                    onCategoryDrop={handleTemplateCategoryDrop}
                    onCategoryDragEnd={clearStructureDragState}
                    onCategoryDragLeave={() => setDropTargetCategoryId(null)}
                    onCourseCategoryDragOver={handleTemplateCourseCategoryDragOver}
                    onCourseCategoryDrop={handleTemplateCourseCategoryDrop}
                    onCourseDragStart={handleTemplateCourseDragStart}
                    onCourseDragEnd={clearStructureDragState}
                    mode="weight"
                />
            )}

            {editorTab === 'overview' && (
                <CompetencyOverview
                    categories={currentCategories}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={currentCompetencies}
                    templateName={selectedTemplate?.name}
                    templateStatus={templateStatus}
                    academicYear={selectedTemplate?.academicYear ?? null}
                    courseMasterName={selectedTemplate?.masterData?.name ?? null}
                    courseMasterYear={selectedTemplate?.masterData?.year ?? null}
                    onToggleStatus={handleToggleTemplateStatus}
                    onDeleteTemplate={() => handleRequestDeleteTemplate(selectedTemplate)}
                />
            )}
            {/* Modals */}
            {deletingTemplate && (
                <ConfirmDeleteModal
                    category={{ code:'', name: deletingTemplate.name }}
                    label="Template"
                    onConfirm={handleConfirmDeleteTemplate}
                    onCancel={() => setDeletingTemplate(null)}
                />
            )}
            {deletingCategory && (
                <ConfirmDeleteModal
                    category={deletingCategory}
                    onConfirm={handleConfirmDeleteCategory}
                    onCancel={() => setDeletingCategory(null)}
                />
            )}
            {deletingCourse && (
                <ConfirmActionModal
                    open
                    title={language === 'th' ? 'ยืนยันการลบรายวิชา' : 'Confirm course deletion'}
                    message={language === 'th'
                        ? <>ยืนยันการลบรายวิชา <strong>{deletingCourse.code || deletingCourse.nameTh}</strong> หรือไม่?</>
                        : <>Confirm deleting course <strong>{deletingCourse.code || deletingCourse.nameTh}</strong>?</>}
                    hint={language === 'th' ? 'รายวิชาที่ลบแล้วจะไม่สามารถกู้คืนได้' : 'Deleted courses cannot be recovered.'}
                    confirmLabel={language === 'th' ? 'ยืนยันการลบ' : 'Confirm deletion'}
                    cancelLabel={language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    variant="danger"
                    onConfirm={handleConfirmDeleteCourse}
                    onCancel={() => setDeletingCourse(null)}
                />
            )}
            {deletingCourses && (
                <ConfirmActionModal
                    open
                    title={language === 'th' ? 'ยืนยันการลบรายวิชาที่เลือก' : 'Confirm deleting selected courses'}
                    message={language === 'th'
                        ? `ยืนยันการลบรายวิชาที่เลือก ${deletingCourses.courses.length} วิชาหรือไม่?`
                        : `Confirm deleting ${deletingCourses.courses.length} selected courses?`}
                    hint={language === 'th' ? 'รายวิชาที่ลบแล้วจะไม่สามารถกู้คืนได้' : 'Deleted courses cannot be recovered.'}
                    confirmLabel={language === 'th' ? 'ยืนยันการลบ' : 'Confirm deletion'}
                    cancelLabel={language === 'th' ? 'ยกเลิก' : 'Cancel'}
                    variant="danger"
                    onConfirm={() => handleBulkDeleteTemplateCourses(deletingCourses.catId, deletingCourses.courses)}
                    onCancel={() => setDeletingCourses(null)}
                />
            )}
            <TemplateCompetencyManagerModal
                open={showCompetencyManager}
                template={selectedTemplate}
                availableCompetencies={allCompetencies}
                managerState={competencyManagerState}
                loading={competencyManagerLoading}
                saving={competencyManagerSaving}
                language={language}
                onClose={() => {
                    if (!competencyManagerSaving) setShowCompetencyManager(false);
                }}
                onRefresh={() => loadTemplateCompetencyManager(selectedTemplate?.id)}
                onSave={handleSaveTemplateCompetencies}
            />
            <ConfirmActionModal
                open={Boolean(competencyRemovalConfirmation)}
                title={language === 'th' ? 'ยืนยันการถอดสมรรถนะ' : 'Confirm competency removal'}
                message={language === 'th'
                    ? 'การถอดสมรรถนะจะล้างการเชื่อมรายวิชาและน้ำหนักของสมรรถนะที่เลือก'
                    : 'Removing competencies will clear their course mappings and weights.'}
                hint={language === 'th'
                    ? 'การดำเนินการนี้ไม่ลบสมรรถนะออกจากระบบกลาง'
                    : 'This does not delete the competency from the global master list.'}
                impact={competencyRemovalConfirmation?.impacts?.length ? (
                    <ul className="template-competency-manager__impact-list">
                        {competencyRemovalConfirmation.impacts.map(impact => (
                            <li key={impact.competency_id}>
                                <strong>{impact.code}</strong> {impact.name_th} ({impact.mapping_count} {language === 'th' ? 'รายวิชา' : 'courses'})
                            </li>
                        ))}
                    </ul>
                ) : null}
                confirmLabel={language === 'th' ? 'ถอดสมรรถนะ' : 'Remove competencies'}
                cancelLabel={language === 'th' ? 'ยกเลิก' : 'Cancel'}
                variant="danger"
                loading={competencyManagerSaving}
                onConfirm={handleConfirmCompetencyRemoval}
                onCancel={() => !competencyManagerSaving && setCompetencyRemovalConfirmation(null)}
            />
            <ToastNotifications
                success={toast.success}
                error={toast.error}
                errorDebug={toast.errorDebug}
                onCloseSuccess={() => setToast(current => ({ ...current, success: '' }))}
                onCloseError={() => setToast(current => ({ ...current, error: '', errorDebug: '' }))}
            />
            <AlertModal
                open={alertModal.open}
                title={alertModal.title}
                message={alertModal.message}
                details={alertModal.details}
                type={alertModal.type}
                onClose={closeAlert}
            />
        </div>
    );
}
