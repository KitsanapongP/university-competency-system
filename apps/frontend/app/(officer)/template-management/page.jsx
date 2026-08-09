'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft, CalendarDays, BookOpenCheck, Settings, SlidersHorizontal, BarChart3, Files } from 'lucide-react';
import { fetchTemplates, deleteTemplate, updateTemplateStatus, updateTemplateName, fetchTemplateItems, fetchTemplateStructure, createTemplate, saveTemplateItems } from '../../../lib/template';
import { fetchCompetencies } from '../../../lib/competency';
import { fetchCurriculumDetail } from '../../../lib/curriculum';
import CategoryCoursePanel  from './components/CategoryCoursePanel';
import CompetencyOverview   from './components/CompetencyOverview';
import TemplateFormModal    from './components/TemplateFormModal';
import ConfirmDeleteModal   from './components/ConfirmDeleteModal';
import './TemplateManagement.css';

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
    return recodeSiblings(
        cats.filter(c => c.id !== id)
            .map(c => ({ ...c, children: removeCategory(c.children || [], id) }))
    );
}
function recodeSiblings(cats, parentCode = '') {
    return cats.map((c, i) => {
        const code = parentCode ? `${parentCode}.${i + 1}` : `${i + 1}`;
        return { ...c, code, children: c.children?.length ? recodeSiblings(c.children, code) : c.children };
    });
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
    return parentCode ? `${parentCode}.${siblings.length + 1}` : `${siblings.length + 1}`;
}
function getDepthFromCode(code) { return code ? code.split('.').length - 1 : 0; }

// ============================================================
// TemplateCard — การ์ดแสดงใน list view
// ============================================================
function TemplateCard({ template, courseCount, onOpen, onDelete }) {
    const yearDisplay = template.academicYear 
        ? template.academicYear 
        : 'ยังไม่กำหนด';
    const courseMasterDisplay = template.masterData 
        ? `${template.masterData.name || template.masterData.nameTh || template.masterData.curriculum_name_th || ''} (${template.masterData.year || template.masterData.cohort_year_be || template.academicYear || ''})`
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
                            <span>ปีการศึกษา: {yearDisplay}</span>
                        </>
                    ) : (
                        <span> ปีการศึกษา: {yearDisplay}</span>
                    )}
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
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [deletingTemplate,  setDeletingTemplate]  = useState(null);
    const [deletingCategory,  setDeletingCategory]  = useState(null);
    const [deletingCourse,    setDeletingCourse]    = useState(null);

    const [categoriesByTemplate, setCategoriesByTemplate] = useState({});
    const [coursesByTemplate,  setCoursesByTemplate]  = useState({});
    const [weightsByTemplate,  setWeightsByTemplate]  = useState({});

    const idRef       = useRef(50000);
    const templateRef    = useRef(7000);
    const courseIdRef    = useRef(50000);
    const saveTimeoutRef = useRef(null);

    const loadCompetencies = useCallback(async () => {
        const competencyData = await fetchCompetencies();
        const mappedCompetencies = normalizeCompetencies(competencyData);
        setAllCompetencies(mappedCompetencies);
        return mappedCompetencies;
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
                        academicYear: t.cohort_year_be || t.academicYear || 2568,
                        isActive: t.is_active !== undefined ? t.is_active : (t.isActive !== undefined ? t.isActive : false),
                        totalCourseCount: t.total_course_count !== undefined ? t.total_course_count : (t.TotalCourseCount !== undefined ? t.TotalCourseCount : (t.mapped_course_count || 0)),
                        masterData: t.curriculum_name_th ? { id: t.curriculum_id, name: t.curriculum_name_th, year: t.cohort_year_be } : t.masterData,
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

    // ── Credit map ──
    const creditMap = useMemo(() => {
        const map = {};
        function calc(cat) {
            const own = (currentCoursesByCat[cat.id] || []).reduce((s, c) => s + (Number(c.credits) || 0), 0);
            const child = (cat.children || []).reduce((s, ch) => s + calc(ch), 0);
            map[cat.id] = own + child;
            return map[cat.id];
        }
        currentCategories.forEach(calc);
        return map;
    }, [currentCategories, currentCoursesByCat]);

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

                // Merge custom categories from struct
                if (struct && struct.custom_categories) {
                    struct.custom_categories.forEach(c => {
                        const cid = c.template_category_id || c.id;
                        const newCat = {
                            id: cid,
                            code: c.code || '',
                            name: c.name || '',
                            requiredCredits: 0,
                            children: [],
                            isNew: false,
                            fromMaster: false,
                        };
                        const parentTargetId = c.curriculum_parent_id || c.parent_id;
                        if (parentTargetId) {
                            function attach(list) {
                                for (let item of list) {
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
                }

                // Merge custom courses from struct
                if (struct && struct.custom_courses) {
                    struct.custom_courses.forEach(c => {
                        const targetCatId = c.template_category_id || c.curriculum_category_id;
                        if (targetCatId) {
                            if (!courseMap[targetCatId]) courseMap[targetCatId] = [];
                            courseMap[targetCatId].push({
                                id: c.template_course_id || c.id,
                                courseId: c.template_course_id || c.id,
                                code: c.code,
                                nameTh: c.name_th || c.nameTh || '',
                                nameEn: c.name_en || c.nameEn || '',
                                credits: c.credits || 0,
                                fromMaster: false,
                                isCoreCourse: false,
                            });
                        }
                    });
                }

                const validCourseIds = new Set();
                Object.values(courseMap).forEach(arr => {
                    (arr || []).forEach(c => validCourseIds.add(c.id));
                });

                // Merge saved weights from struct.items
                const weightMap = {};
                if (struct && struct.items) {
                    struct.items.forEach(it => {
                        if (it.course_id && it.competency_id && it.weight !== null && it.weight !== undefined) {
                            if (!validCourseIds.has(it.course_id)) return;
                            if (!weightMap[it.course_id]) weightMap[it.course_id] = {};
                            weightMap[it.course_id][it.competency_id] = it.weight;
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
        setTemplateStatus(t.isActive ?? true);
        setView('editor');
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedTemplate(null);
        setSelectedCategory(null);
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
                alert('ไม่สามารถเปลี่ยนชื่อ Template ได้: ' + (err.message || 'เกิดข้อผิดพลาด'));
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
            alert(err.message || 'ไม่สามารถลบ Template ได้');
            setDeletingTemplate(null);
        }
    }, [deletingTemplate, selectedTemplate, handleBackToList]);

    const handleSaveTemplate = useCallback(async ({ name, academicYear, masterData, competencyIds }) => {
        let createdId = ++templateRef.current;
        let actualCreated = null;
        try {
            const payload = {
                name,
                faculty_id: 11,
                cohort_year_be: Number(academicYear) || 2568,
                curriculum_id: masterData ? masterData.id : null,
                competency_ids: competencyIds || [],
            };
            const created = await createTemplate(payload);
            actualCreated = created?.data || created;
            if (actualCreated && (actualCreated.template_id || actualCreated.id)) createdId = actualCreated.template_id || actualCreated.id;
        } catch (err) {
            console.error('Create template API failed, falling back to local ID:', err);
        }

        const id = createdId;
        const newTemplate = { 
            id, 
            name, 
            year: academicYear || 2568, 
            academicYear,
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
        setView('editor');
    }, []);

    // ============================================================
    // Auto Save Helper
    // ============================================================
    const triggerAutoSaveToAPI = useCallback((tplId, nextCats, nextCoursesMap, nextWeightsMap) => {
        if (!tplId) return;
        const targetTpl = selectedTemplate?.id === tplId ? selectedTemplate : null;
        if (targetTpl && targetTpl.isActive) {
            console.warn('Skipping auto-save because template is Active.');
            return;
        }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
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
                            template_category_id: typeof c.id === 'number' && c.id < 50000 ? 0 : (typeof c.id === 'number' ? c.id : 0),
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
                            template_course_id: typeof c.id === 'number' && c.id < 50000 ? 0 : (typeof c.id === 'number' ? c.id : 0),
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

            const tplCompIds = (competenciesByTemplate[tplId] || []).map(c => c.id);
            saveTemplateItems(tplId, { items, custom_categories, custom_courses, competency_ids: tplCompIds }).catch(err => {
                console.warn('Cannot auto-save or API notice:', err.message || err);
            });
        }, 500);
    }, [competenciesByTemplate, selectedTemplate]);

    // ============================================================
    // Category handlers
    // ============================================================
    const handleSelectCategory = useCallback((cat) => setSelectedCategory(cat), []);
    const handleDeselectCategory = useCallback(() => setSelectedCategory(null), []);

    // parentId = null → เพิ่มที่ root, parentId = id → เพิ่มเป็นลูกของ parent
    const handleCreateCategory = useCallback((parentId = selectedCategory?.id ?? null) => {
        if (!selectedTemplate) return;
        if (selectedTemplate.isActive) {
            alert('ไม่สามารถเพิ่มหมวดวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active) กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข');
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
                alert('ไม่สามารถสร้างหมวดวิชาที่ลึกกว่า 4 ระดับได้'); return;
            }
            // ถ้า parent มาจาก Master และมีวิชาอยู่แล้ว → ห้ามสร้างหมวดย่อย
            const parentCourses = currentCoursesByCat[parentId] || [];
            if (parent.fromMaster && parentCourses.length > 0) {
                alert(`หมวด "${parent.code} ${parent.name}" มีรายวิชาอยู่แล้ว ไม่สามารถสร้างหมวดย่อยได้`);
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
        if (!selectedTemplate || selectedTemplate.isActive) return;
        const nextCats = renameCategory(currentCategories, id, name || 'หมวดใหม่');
        updateCurrentCategories(nextCats);
        triggerAutoSaveToAPI(selectedTemplate.id, nextCats, currentCoursesByCat, currentWeightsByCourse);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCategories, triggerAutoSaveToAPI]);

    const handleReorderCategories = useCallback((newCats) => {
        if (!selectedTemplate || selectedTemplate.isActive) return;
        updateCurrentCategories(newCats);
        setSelectedCategory(p => p ? findById(newCats, p.id) || null : null);
        triggerAutoSaveToAPI(selectedTemplate.id, newCats, currentCoursesByCat, currentWeightsByCourse);
    }, [selectedTemplate, currentCoursesByCat, currentWeightsByCourse, updateCurrentCategories, triggerAutoSaveToAPI]);

    const handleRequestDeleteCategory = useCallback((cat) => {
        if (selectedTemplate?.isActive) {
            alert('ไม่สามารถลบหมวดวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active) กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข');
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
            alert('ไม่สามารถเพิ่มรายวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active) กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข');
            return;
        }
        const course = { id: ++courseIdRef.current, ...data, fromMaster: false };
        const nextCoursesMap = { ...currentCoursesByCat, [catId]: [...(currentCoursesByCat[catId] || []), course] };
        updateCurrentCourses(nextCoursesMap);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, currentWeightsByCourse);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCourses, triggerAutoSaveToAPI]);

    const handleUpdateCourse = useCallback((catId, updatedCourse) => {
        if (!selectedTemplate || selectedTemplate.isActive) return;
        const nextCoursesMap = {
            ...currentCoursesByCat,
            [catId]: (currentCoursesByCat[catId] || []).map(c => c.id === updatedCourse.id ? updatedCourse : c),
        };
        updateCurrentCourses(nextCoursesMap);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, currentWeightsByCourse);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCourses, triggerAutoSaveToAPI]);

    const handleReorderCourses = useCallback((catId, fromIdx, toIdx) => {
        if (fromIdx === toIdx || !selectedTemplate || selectedTemplate.isActive) return;
        const list = [...(currentCoursesByCat[catId] || [])];
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        const nextCoursesMap = { ...currentCoursesByCat, [catId]: list };
        updateCurrentCourses(nextCoursesMap);
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, nextCoursesMap, currentWeightsByCourse);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, updateCurrentCourses, triggerAutoSaveToAPI]);

    const handleRequestDeleteCourse = useCallback((catId, course) => {
        if (selectedTemplate?.isActive) {
            alert('ไม่สามารถลบรายวิชาได้ในขณะที่ Template มีสถานะพร้อมใช้งาน (Active) กรุณาเปลี่ยนสถานะเป็นปิดใช้งานก่อนแก้ไข');
            return;
        }
        setDeletingCourse({ ...course, _catId: catId });
    }, [selectedTemplate]);

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
        if (!selectedTemplate || selectedTemplate.isActive) return;
        const course = { ...(currentWeightsByCourse[courseId] || {}), [compId]: weight };
        const nextWeightsMap = { ...currentWeightsByCourse, [courseId]: course };
        setWeightsByTemplate(p => ({ ...p, [selectedTemplate.id]: nextWeightsMap }));
        triggerAutoSaveToAPI(selectedTemplate.id, currentCategories, currentCoursesByCat, nextWeightsMap);
    }, [selectedTemplate, currentCategories, currentCoursesByCat, currentWeightsByCourse, triggerAutoSaveToAPI]);

    const handleToggleTemplateStatus = useCallback(async (newStatus) => {
        if (!selectedTemplate) return;
        try {
            await updateTemplateStatus(selectedTemplate.id, newStatus ? 'Active' : 'Inactive');
            setTemplateStatus(newStatus);
            setTemplates(p => p.map(t => 
                t.id === selectedTemplate.id ? { ...t, isActive: newStatus } : t
            ));
            setSelectedTemplate(p => ({ ...p, isActive: newStatus }));
        } catch (err) {
            alert(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
        }
    }, [selectedTemplate]);

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
                            <h1 className="tm-header__title">จัดการ Template หลักสูตร</h1>
                            <p className="tpl-list-view__sub">เลือก Template ที่ต้องการแก้ไข หรือสร้าง Template ใหม่</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn--primary" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={15}/> สร้าง Template ใหม่
                            </button>
                        </div>
                    </div>

                    {/* Cards */}
                    {templates.length === 0 ? (
                        <div className="tpl-list-view__empty">
                            <BookOpenCheck size={48} opacity={0.2}/>
                            <p>ยังไม่มี Template — กดปุ่ม &quot;สร้าง Template ใหม่&quot; เพื่อเริ่ม</p>
                            <button className="btn btn--primary" onClick={() => setShowTemplateModal(true)}>
                                <Plus size={15}/> สร้าง Template ใหม่
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
                                <span>สร้าง Template ใหม่</span>
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
            </div>
        );
    }

    // ── Editor View ──
    return (
        <div className="tm-page tm-page--editor">
            {/* Topbar */}
            <div className="editor-topbar">
                <button className="btn btn--ghost btn--sm editor-topbar__back" onClick={handleBackToList}>
                    <ArrowLeft size={15}/> Template ทั้งหมด
                </button>

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
                    <span
                        className="editor-topbar__title editor-topbar__title--editable"
                        title="Double-click เพื่อแก้ไขชื่อ"
                        onDoubleClick={() => {
                            setTitleVal(selectedTemplate?.name || '');
                            setEditingTitle(true);
                        }}
                    >
                        {selectedTemplate?.name}
                    </span>
                )}

                <span className="editor-topbar__year">
                    {selectedTemplate?.masterData 
                        ? `${selectedTemplate.masterData.name || selectedTemplate.masterData.nameTh || selectedTemplate.masterData.curriculum_name_th || ''} (${selectedTemplate.masterData.year || selectedTemplate.masterData.cohort_year_be || selectedTemplate.academicYear || ''})`
                        : selectedTemplate?.academicYear 
                            ? `ปีการศึกษา ${selectedTemplate.academicYear}`
                            : 'ยังไม่กำหนด'}
                </span>
            </div>

            {/* Tab bar */}
            <div className="editor-tabs">
                {[
                    { id:'setup',    label:'ตั้งค่าวิชา',    icon: <Settings size={14}/> },
                    { id:'weight',   label:'ใส่น้ำหนักสมรรถนะ',     icon: <SlidersHorizontal size={14}/> },
                    { id:'overview', label:'ภาพรวมสมรรถนะ', icon: <BarChart3 size={14}/> },
                ].map(tab => (
                    <button key={tab.id}
                        className={`editor-tab ${editorTab === tab.id ? 'editor-tab--active' : ''}`}
                        onClick={() => setEditorTab(tab.id)}>
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {editorTab === 'setup' && (
                <CategoryCoursePanel
                    template={selectedTemplate}
                    categories={currentCategories}
                    selectedCategory={selectedCategory}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={currentCompetencies}
                    creditMap={creditMap}
                    onSelectCategory={handleSelectCategory}
                    onDeselectCategory={handleDeselectCategory}
                    onCreateCategory={handleCreateCategory}
                    onRenameCategory={handleRenameCategory}
                    onReorderCategories={handleReorderCategories}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onReorderCourses={handleReorderCourses}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onSetWeight={handleSetWeight}
                    mode="setup"
                />
            )}

            {editorTab === 'weight' && (
                <CategoryCoursePanel
                    template={selectedTemplate}
                    categories={currentCategories}
                    selectedCategory={selectedCategory}
                    coursesByCategoryId={currentCoursesByCat}
                    weightsByCourseId={currentWeightsByCourse}
                    competencies={currentCompetencies}
                    creditMap={creditMap}
                    onSelectCategory={handleSelectCategory}
                    onDeselectCategory={handleDeselectCategory}
                    onCreateCategory={handleCreateCategory}
                    onRenameCategory={handleRenameCategory}
                    onReorderCategories={handleReorderCategories}
                    onDeleteCategory={handleRequestDeleteCategory}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onReorderCourses={handleReorderCourses}
                    onDeleteCourse={handleRequestDeleteCourse}
                    onSetWeight={handleSetWeight}
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
                <ConfirmDeleteModal
                    category={{ code: deletingCourse.code, name: deletingCourse.nameTh }}
                    label="รายวิชา"
                    onConfirm={handleConfirmDeleteCourse}
                    onCancel={() => setDeletingCourse(null)}
                />
            )}
        </div>
    );
}
