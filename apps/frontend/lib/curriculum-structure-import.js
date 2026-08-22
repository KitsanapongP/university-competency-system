const CATEGORY_LEVELS = [1, 2, 3, 4];

export const CURRICULUM_STRUCTURE_IMPORT_HEADERS = [
    ...CATEGORY_LEVELS.flatMap(level => [
        `หมวดวิชาระดับ ${level}`,
        `ชื่อหมวดวิชาระดับ ${level} (ไทย)`,
    ]),
    'รหัสวิชา',
    'ชื่อวิชา (ไทย)',
    'ชื่อวิชา (อังกฤษ)',
    'หน่วยกิต',
    'ประเภทวิชา',
];

const categoryCodePattern = /^\d+(?:\.\d+){0,3}$/;

function normalize(value) {
    return String(value ?? '').trim();
}

function key(value) {
    return normalize(value).toLocaleLowerCase();
}

function issue(rowNumber, field, message, severity = 'error') {
    return { row_number: rowNumber, field, message, severity };
}

function getWorkbookModule(module) {
    return module.default ?? module;
}

export async function downloadCurriculumStructureTemplate() {
    const XLSX = getWorkbookModule(await import('xlsx'));
    const sample = [
        '1', 'หมวดศึกษาทั่วไป',
        '1.1', 'หมวดภาษา',
        '', '',
        '', '',
        'EX1001', 'ตัวอย่างรายวิชา', 'Sample Course', 3, 'วิชาบังคับ',
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([CURRICULUM_STRUCTURE_IMPORT_HEADERS, sample]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายวิชาหลักสูตร');
    XLSX.writeFile(workbook, 'curriculum-structure-import-template.xlsx');
}

export async function parseCurriculumStructureWorkbook(file) {
    const XLSX = getWorkbookModule(await import('xlsx'));
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
        return { rows: [], issues: [issue(0, 'file', 'ไม่พบแผ่นงานในไฟล์ Excel')] };
    }

    const values = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' });
    const headers = (values[0] || []).map(normalize);
    const missingHeaders = CURRICULUM_STRUCTURE_IMPORT_HEADERS.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
        return {
            rows: [],
            issues: [issue(1, 'header', `ไม่พบหัวตาราง: ${missingHeaders.join(', ')}`)],
        };
    }

    const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
    const rows = [];
    const issues = [];

    values.slice(1).forEach((line, offset) => {
        const rowNumber = offset + 2;
        const getCell = header => normalize(line[indexes[header]]);
        const categories = CATEGORY_LEVELS.map(level => ({
            code: getCell(`หมวดวิชาระดับ ${level}`),
            name_th: getCell(`ชื่อหมวดวิชาระดับ ${level} (ไทย)`),
        }));
        const courseCode = getCell('รหัสวิชา');
        const courseNameTh = getCell('ชื่อวิชา (ไทย)');
        const courseNameEn = getCell('ชื่อวิชา (อังกฤษ)');
        const creditValue = getCell('หน่วยกิต');
        const courseType = getCell('ประเภทวิชา');
        const hasValue = [...categories.flatMap(category => [category.code, category.name_th]), courseCode, courseNameTh, courseNameEn, creditValue, courseType]
            .some(Boolean);
        if (!hasValue) return;

        const credits = Number(creditValue);
        if (!creditValue || !Number.isFinite(credits) || !Number.isInteger(credits) || credits < 0) {
            issues.push(issue(rowNumber, 'credits', 'หน่วยกิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป'));
        }
        const normalizedCourseType = courseType.toLocaleLowerCase();
        const requiredCourseTypes = new Set(['วิชาบังคับ', 'บังคับ', 'required', 'core']);
        const electiveCourseTypes = new Set(['วิชาเลือก', 'เลือก', 'elective']);
        let isRequired = null;
        if (requiredCourseTypes.has(normalizedCourseType)) {
            isRequired = true;
        } else if (electiveCourseTypes.has(normalizedCourseType)) {
            isRequired = false;
        } else {
            issues.push(issue(rowNumber, 'course_type', 'ประเภทวิชาต้องเป็นวิชาบังคับหรือวิชาเลือก'));
        }
        rows.push({
            row_number: rowNumber,
            categories,
            course_code: courseCode,
            course_name_th: courseNameTh,
            course_name_en: courseNameEn || null,
            credits: Number.isFinite(credits) ? credits : -1,
            is_required: isRequired,
        });
    });

    if (rows.length === 0 && issues.length === 0) {
        issues.push(issue(0, 'file', 'ไฟล์นำเข้าไม่มีรายวิชา'));
    }
    return { rows, issues };
}

export function buildCurriculumStructureImportTree(rows) {
    const roots = [];
    const nodesByPath = new Map();

    (rows || []).forEach(row => {
        let parentPath = '';
        let siblings = roots;
        let targetCategory = null;

        (row.categories || []).forEach(category => {
            const code = normalize(category.code);
            const nameTh = normalize(category.name_th);
            if (!code && !nameTh) return;

            const path = `${parentPath}/${code}`;
            let node = nodesByPath.get(path);
            if (!node) {
                node = {
                    code,
                    nameTh,
                    children: [],
                    courses: [],
                    rowNumbers: [],
                };
                nodesByPath.set(path, node);
                siblings.push(node);
            }

            const rowNumber = Number(row.row_number) || 0;
            if (rowNumber > 0 && !node.rowNumbers.includes(rowNumber)) {
                node.rowNumbers.push(rowNumber);
            }

            targetCategory = node;
            parentPath = path;
            siblings = node.children;
        });

        if (!targetCategory) return;
        targetCategory.courses.push({
            code: normalize(row.course_code),
            nameTh: normalize(row.course_name_th),
            credits: Number(row.credits) || 0,
            isRequired: row.is_required === true,
            rowNumber: Number(row.row_number) || 0,
        });
    });

    return roots;
}

function categoryMap(categories) {
    const result = new Map();
    const walk = (nodes, parentCode = '') => {
        (nodes || []).forEach(category => {
            const code = normalize(category.code);
            if (code) {
                result.set(key(code), {
                    category,
                    code,
                    nameTh: normalize(category.name),
                    parentCode,
                    hasChildren: (category.children || []).length > 0,
                });
            }
            walk(category.children, code);
        });
    };
    walk(categories);
    return result;
}

function courseCodes(coursesByCategory) {
    const result = new Set();
    Object.values(coursesByCategory || {}).flat().forEach(course => {
        if (normalize(course.code)) result.add(key(course.code));
    });
    return result;
}

function analyzeRows(rows, existingCategories, existingCourseCodes) {
    const issues = [];
    const importedCategories = new Map();
    const importedCourseCodes = new Set();
    const categoryHasChild = new Set();
    const categoryUsedByCourse = new Set();
    const usedCategoryCodes = new Set();
    const courses = [];
    let skippedCourseCount = 0;

    (rows || []).forEach(row => {
        const rowNumber = Number(row.row_number) || 0;
        const categories = row.categories || [];
        let hasGap = false;
        let sawEmpty = false;
        categories.forEach(category => {
            const empty = !normalize(category.code) && !normalize(category.name_th);
            if (empty) sawEmpty = true;
            if (!empty && sawEmpty) hasGap = true;
        });
        if (hasGap) {
            issues.push(issue(rowNumber, 'categories', 'หมวดวิชาต้องระบุเรียงต่อเนื่องจากระดับ 1'));
            return;
        }

        const activeCategories = categories.filter(category => normalize(category.code) || normalize(category.name_th));
        if (activeCategories.length === 0) {
            issues.push(issue(rowNumber, 'categories', 'ต้องระบุหมวดวิชาอย่างน้อย 1 ระดับ'));
            return;
        }

        let parentCode = '';
        let valid = true;
        activeCategories.forEach((category, index) => {
            const code = normalize(category.code);
            const nameTh = normalize(category.name_th);
            if (!categoryCodePattern.test(code)) {
                issues.push(issue(rowNumber, `category_level_${index + 1}`, 'รหัสหมวดต้องเป็นตัวเลขคั่นด้วยจุด สูงสุด 4 ระดับ'));
                valid = false;
            }
            if (!nameTh) {
                issues.push(issue(rowNumber, `category_name_level_${index + 1}`, 'ต้องระบุชื่อหมวดวิชาภาษาไทย'));
                valid = false;
            }
            if (parentCode && !code.startsWith(`${parentCode}.`)) {
                issues.push(issue(rowNumber, `category_level_${index + 1}`, 'รหัสหมวดย่อยต้องต่อจากรหัสหมวดแม่'));
                valid = false;
            }
            if (code.split('.').length !== index + 1) {
                issues.push(issue(rowNumber, `category_level_${index + 1}`, 'รหัสหมวดต้องตรงกับระดับหมวดวิชา'));
                valid = false;
            }

            const currentKey = key(code);
            const imported = importedCategories.get(currentKey);
            const existing = existingCategories.get(currentKey);
            if (imported && (imported.nameTh !== nameTh || imported.parentCode !== parentCode)) {
                issues.push(issue(rowNumber, `category_level_${index + 1}`, 'รหัสหมวดขัดแย้งกับข้อมูลในไฟล์'));
                valid = false;
            } else if (existing && (existing.nameTh !== nameTh || existing.parentCode !== parentCode)) {
                issues.push(issue(rowNumber, `category_level_${index + 1}`, 'รหัสหมวดขัดแย้งกับโครงสร้างหลักสูตรเดิม'));
                valid = false;
            } else if (!imported) {
                importedCategories.set(currentKey, { code, nameTh, parentCode, existing: Boolean(existing) });
            }
            if (parentCode) categoryHasChild.add(key(parentCode));
            parentCode = code;
        });

        const courseCode = normalize(row.course_code);
        const courseNameTh = normalize(row.course_name_th);
        if (!courseCode) {
            issues.push(issue(rowNumber, 'course_code', 'ต้องระบุรหัสวิชา'));
            valid = false;
        }
        if (!courseNameTh) {
            issues.push(issue(rowNumber, 'course_name_th', 'ต้องระบุชื่อวิชาภาษาไทย'));
            valid = false;
        }
        if (!Number.isInteger(Number(row.credits)) || Number(row.credits) < 0) {
            issues.push(issue(rowNumber, 'credits', 'หน่วยกิตต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป'));
            valid = false;
        }
        if (typeof row.is_required !== 'boolean') {
            issues.push(issue(rowNumber, 'course_type', 'ประเภทวิชาต้องเป็นวิชาบังคับหรือวิชาเลือก'));
            valid = false;
        }
        const courseKey = key(courseCode);
        const duplicateCourse = courseCode && (existingCourseCodes.has(courseKey) || importedCourseCodes.has(courseKey));
        if (duplicateCourse) {
            issues.push(issue(rowNumber, 'course_code', 'รหัสวิชานี้มีอยู่แล้วในหลักสูตร', 'warning'));
            skippedCourseCount += 1;
        }
        if (valid && !duplicateCourse) {
            importedCourseCodes.add(courseKey);
            categoryUsedByCourse.add(key(parentCode));
            markImportedCategoryPath(importedCategories, parentCode, usedCategoryCodes);
            courses.push({ ...row, categoryCode: parentCode });
        }
    });

    categoryUsedByCourse.forEach(code => {
        if (categoryHasChild.has(code) || existingCategories.get(code)?.hasChildren) {
            issues.push(issue(0, 'categories', 'เพิ่มรายวิชาได้เฉพาะหมวดวิชาที่ย่อยที่สุด'));
        }
    });

    const usedCategories = [...importedCategories.entries()]
        .filter(([categoryKey]) => usedCategoryCodes.has(categoryKey))
        .map(([, category]) => category);
    const newCategories = usedCategories.filter(category => !category.existing);
    const existingCategoryCount = usedCategories.filter(category => category.existing).length;
    return { issues, newCategories, existingCategoryCount, courses, skippedCourseCount };
}

function markImportedCategoryPath(categoriesByCode, categoryCode, usedCategoryCodes) {
    let currentCode = normalize(categoryCode);
    while (currentCode) {
        const currentKey = key(currentCode);
        if (usedCategoryCodes.has(currentKey)) return;
        usedCategoryCodes.add(currentKey);
        currentCode = categoriesByCode.get(currentKey)?.parentCode || '';
    }
}

export function previewDraftCurriculumStructureImport(categories, coursesByCategory, rows, parseIssues = []) {
    const analysis = analyzeRows(rows, categoryMap(categories), courseCodes(coursesByCategory));
    const issues = [...parseIssues, ...analysis.issues];
    const valid = !issues.some(entry => entry.severity !== 'warning');
    return {
        valid,
        can_import: valid && analysis.courses.length > 0,
        existing_category_count: analysis.existingCategoryCount,
        new_category_count: analysis.newCategories.length,
        course_count: analysis.courses.length,
        skipped_course_count: analysis.skippedCourseCount,
        issues,
        analysis,
    };
}

function cloneCategory(category) {
    return { ...category, children: (category.children || []).map(cloneCategory) };
}

function findDraftCategoryByCode(categories, code) {
    for (const category of categories || []) {
        if (normalize(category.code) === code) return category;
        const child = findDraftCategoryByCode(category.children, code);
        if (child) return child;
    }
    return null;
}

export function applyDraftCurriculumStructureImport(categories, coursesByCategory, preview) {
    if (!preview?.valid) throw new Error('ไม่สามารถนำเข้าข้อมูลที่มีข้อผิดพลาดได้');
    const nextCategories = (categories || []).map(cloneCategory);
    const nextCourses = Object.fromEntries(Object.entries(coursesByCategory || {}).map(([id, courses]) => [id, [...courses]]));
    const usedCodes = new Set(Object.values(nextCourses).flat().map(course => key(course.code)));

    [...preview.analysis.newCategories]
        .sort((left, right) => left.code.split('.').length - right.code.split('.').length || left.code.localeCompare(right.code))
        .forEach((category, index) => {
            const id = `import_category_${Date.now()}_${index}`;
            const nextCategory = { id, code: category.code, name: category.nameTh, requiredCredits: 0, children: [] };
            if (!category.parentCode) {
                nextCategories.push(nextCategory);
            } else {
                const parent = findDraftCategoryByCode(nextCategories, category.parentCode);
                parent?.children.push(nextCategory);
            }
            nextCourses[id] = [];
        });

    preview.analysis.courses.forEach((row, index) => {
        const category = findDraftCategoryByCode(nextCategories, row.categoryCode);
        const courseCode = normalize(row.course_code);
        if (!category || usedCodes.has(key(courseCode))) return;
        usedCodes.add(key(courseCode));
        nextCourses[category.id] = [
            ...(nextCourses[category.id] || []),
            {
                id: `import_course_${Date.now()}_${index}`,
                code: courseCode,
                nameTh: normalize(row.course_name_th),
                nameEn: normalize(row.course_name_en),
                credits: Number(row.credits),
                isCoreCourse: row.is_required === true,
            },
        ];
    });
    return { categories: nextCategories, coursesByCategory: nextCourses };
}
