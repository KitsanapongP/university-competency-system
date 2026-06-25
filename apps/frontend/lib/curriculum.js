import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

function toNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function mapCourseRow(course) {
    return {
        id: course.curriculum_course_id ?? course.course_id,
        curriculumCourseId: course.curriculum_course_id,
        courseId: course.course_id,
        categoryId: course.category_id,
        code: course.code || '',
        nameTh: course.name_th || '',
        nameEn: course.name_en || '',
        credits: course.credits || 0,
        description: course.description || '',
        isCoreCourse: course.is_required ?? true,
        isLocked: course.is_locked ?? false,
        isActive: course.is_active ?? true,
        displayOrder: course.display_order || 0,
    };
}

function mapCategoryNode(category) {
    return {
        id: category.category_id,
        categoryId: category.category_id,
        curriculumId: category.curriculum_id,
        parentId: category.parent_id,
        code: category.code || '',
        name: category.name_th || '',
        nameEn: category.name_en || '',
        requiredCredits: category.required_credits || 0,
        displayOrder: category.display_order || 0,
        isActive: category.is_active ?? true,
        children: (category.children || []).map(mapCategoryNode),
        courses: (category.courses || []).map(mapCourseRow),
    };
}

function buildCoursesByCategory(categories) {
    const result = {};
    const walk = (nodes) => {
        for (const node of nodes || []) {
            result[node.id] = node.courses || [];
            if (node.children?.length) walk(node.children);
        }
    };
    walk(categories);
    return result;
}

export function mapApiCurriculum(curriculum) {
    if (!curriculum) {
        return null;
    }

    const categories = (curriculum.categories || []).map(mapCategoryNode);
    const totalCategories = curriculum.category_count ?? countCategories(categories);

    return {
        id: curriculum.curriculum_id,
        curriculumId: curriculum.curriculum_id,
        majorId: curriculum.major_id,
        code: curriculum.curriculum_code || '',
        nameTh: curriculum.curriculum_name_th || '',
        nameEn: curriculum.curriculum_name_en || '',
        year: curriculum.effective_year_be,
        degreeName: curriculum.major_name_th || `Major ID ${curriculum.major_id}`,
        degreeNameEn: curriculum.major_name_en || '',
        status: curriculum.status || 'draft',
        isActive: curriculum.is_active ?? curriculum.status === 'active',
        templateCount: curriculum.template_count || 0,
        categories,
        coursesByCategory: buildCoursesByCategory(categories),
        stats: {
            totalCourses: curriculum.course_count || 0,
            totalCategories,
            totalCredits: curriculum.total_credits || 0,
        },
        createdAt: curriculum.created_at,
        updatedAt: curriculum.updated_at,
    };
}

function countCategories(categories) {
    return (categories || []).reduce((sum, category) => {
        return sum + 1 + countCategories(category.children || []);
    }, 0);
}

export async function fetchCurriculums() {
    const response = await apiFetch('/api/v1/curricula/');
    return unwrapData(response, []).map(mapApiCurriculum);
}

function mapFacultyOption(faculty) {
    return {
        facultyId: faculty.faculty_id,
        code: faculty.code || '',
        nameTh: faculty.name_th || '',
        nameEn: faculty.name_en || '',
    };
}

export async function fetchFaculties() {
    const response = await apiFetch('/api/v1/faculties');
    return unwrapData(response, []).map(mapFacultyOption);
}

function mapMajorOption(major) {
    return {
        majorId: major.major_id,
        departmentId: major.department_id,
        facultyId: major.faculty_id,
        code: major.code || '',
        nameTh: major.name_th || '',
        nameEn: major.name_en || '',
        degreeLevel: major.degree_level || '',
        departmentNameTh: major.department_name_th || '',
        departmentNameEn: major.department_name_en || '',
        facultyNameTh: major.faculty_name_th || '',
        facultyNameEn: major.faculty_name_en || '',
    };
}

export async function fetchMajors() {
    const response = await apiFetch('/api/v1/majors');
    return unwrapData(response, []).map(mapMajorOption);
}

export async function fetchCurriculumDetail(curriculumId) {
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}`);
    return mapApiCurriculum(unwrapData(response, null));
}

function categoryPayload(category, coursesByCategory, index = 0) {
    const nameTh = toNullableString(category.name);
    const courses = (coursesByCategory[category.id] || [])
        .filter(course => toNullableString(course.code) || toNullableString(course.nameTh))
        .map((course, courseIndex) => {
            const code = toNullableString(course.code);
            const name = toNullableString(course.nameTh);

            if (!code || !name) {
                throw new Error('กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบทุกแถว');
            }

            return {
                course_id: toNumber(course.courseId, 0),
                code,
                name_th: name,
                name_en: toNullableString(course.nameEn),
                credits: toNumber(course.credits, 0),
                description: toNullableString(course.description),
                is_required: course.isCoreCourse ?? true,
                display_order: courseIndex + 1,
            };
        });

    if (!nameTh) {
        throw new Error('กรุณากรอกชื่อหมวดวิชาให้ครบ');
    }

    return {
        code: toNullableString(category.code),
        name_th: nameTh,
        name_en: toNullableString(category.nameEn),
        required_credits: toNumber(category.requiredCredits, 0),
        display_order: index + 1,
        courses,
        children: (category.children || []).map((child, childIndex) => categoryPayload(child, coursesByCategory, childIndex)),
    };
}

export function mapCurriculumFormToPayload(form) {
    const majorId = toNumber(form.majorId, 0);
    const curriculumCode = toNullableString(form.code);
    const curriculumNameTh = toNullableString(form.nameTh);
    const effectiveYearBE = toNumber(form.year, 0);

    if (!majorId) {
        throw new Error('กรุณาเลือกสาขาของหลักสูตร');
    }
    if (!curriculumCode) {
        throw new Error('กรุณากรอกรหัสหลักสูตร');
    }
    if (!curriculumNameTh) {
        throw new Error('กรุณากรอกชื่อหลักสูตรภาษาไทย');
    }
    if (!effectiveYearBE) {
        throw new Error('กรุณากรอกปีการศึกษาของหลักสูตร');
    }

    const coursesByCategory = form.coursesByCategory || {};

    return {
        major_id: majorId,
        curriculum_code: curriculumCode,
        curriculum_name_th: curriculumNameTh,
        curriculum_name_en: toNullableString(form.nameEn),
        effective_year_be: effectiveYearBE,
        categories: (form.categories || []).map((category, index) => categoryPayload(category, coursesByCategory, index)),
    };
}

export async function createCurriculumFromForm(form) {
    const payload = mapCurriculumFormToPayload(form);
    const response = await apiFetch('/api/v1/curricula/', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    return mapApiCurriculum(unwrapData(response, null));
}

export async function duplicateCurriculum(curriculumId, payload) {
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({
            major_id: toNumber(payload.majorId, 0),
            curriculum_code: toNullableString(payload.code),
            curriculum_name_th: toNullableString(payload.nameTh),
            curriculum_name_en: toNullableString(payload.nameEn),
            effective_year_be: toNumber(payload.year, 0),
        }),
    });

    return mapApiCurriculum(unwrapData(response, null));
}

function toMutationResult(response) {
    return mapApiCurriculum(unwrapData(response, null));
}

function nullableNumber(value) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
}

function boolValue(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

export async function updateCurriculumStatus(curriculumId, status, confirmImpact = false) {
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
            status,
            confirm_impact: confirmImpact,
        }),
    });

    return toMutationResult(response);
}

export async function deleteCurriculum(curriculumId) {
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}`, {
        method: 'DELETE',
    });

    return unwrapData(response, null);
}

export async function createCurriculumCategory(curriculumId, category, confirmImpact = false) {
    const payload = {
        parent_id: category.parentId ?? null,
        code: toNullableString(category.code),
        name_th: String(category.nameTh || category.name || '').trim(),
        name_en: toNullableString(category.nameEn),
        required_credits: toNumber(category.requiredCredits, 0),
        display_order: toNumber(category.displayOrder, 0),
        confirm_impact: confirmImpact,
    };

    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/categories`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    return toMutationResult(response);
}

export async function updateCurriculumCategory(curriculumId, categoryId, category, confirmImpact = false) {
    const payload = {
        confirm_impact: confirmImpact,
    };

    if (Object.prototype.hasOwnProperty.call(category, 'parentId')) {
        payload.parent_id = category.parentId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(category, 'code')) {
        payload.code = toNullableString(category.code);
    }
    if (Object.prototype.hasOwnProperty.call(category, 'nameTh') || Object.prototype.hasOwnProperty.call(category, 'name')) {
        payload.name_th = toNullableString(category.nameTh || category.name);
    }
    if (Object.prototype.hasOwnProperty.call(category, 'nameEn')) {
        payload.name_en = toNullableString(category.nameEn);
    }
    if (Object.prototype.hasOwnProperty.call(category, 'requiredCredits')) {
        payload.required_credits = nullableNumber(category.requiredCredits);
    }
    if (Object.prototype.hasOwnProperty.call(category, 'displayOrder')) {
        payload.display_order = nullableNumber(category.displayOrder);
    }

    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });

    return toMutationResult(response);
}

export async function getDeleteCurriculumCategoryPreview(curriculumId, categoryId) {
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/categories/${categoryId}/delete-preview`);
    return unwrapData(response, null);
}

export async function deleteCurriculumCategory(curriculumId, categoryId, confirmImpact = false) {
    const query = confirmImpact ? '?confirm_impact=true' : '';
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/categories/${categoryId}${query}`, {
        method: 'DELETE',
    });

    return toMutationResult(response);
}

export async function createCurriculumCourse(curriculumId, categoryId, course, confirmImpact = false) {
    const payload = {
        code: String(course.code || '').trim(),
        name_th: String(course.nameTh || '').trim(),
        name_en: toNullableString(course.nameEn),
        credits: toNumber(course.credits, 0),
        description: toNullableString(course.description),
        is_required: boolValue(course.isCoreCourse, true),
        display_order: toNumber(course.displayOrder, 0),
        confirm_impact: confirmImpact,
    };

    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/categories/${categoryId}/courses`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    return toMutationResult(response);
}

export async function updateCurriculumCourseDetail(curriculumId, courseId, course, confirmImpact = false) {
    const payload = {
        confirm_impact: confirmImpact,
    };

    if (Object.prototype.hasOwnProperty.call(course, 'code')) {
        payload.code = toNullableString(course.code);
    }
    if (Object.prototype.hasOwnProperty.call(course, 'nameTh')) {
        payload.name_th = toNullableString(course.nameTh);
    }
    if (Object.prototype.hasOwnProperty.call(course, 'nameEn')) {
        payload.name_en = toNullableString(course.nameEn);
    }
    if (Object.prototype.hasOwnProperty.call(course, 'credits')) {
        payload.credits = nullableNumber(course.credits);
    }
    if (Object.prototype.hasOwnProperty.call(course, 'description')) {
        payload.description = toNullableString(course.description);
    }

    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });

    return toMutationResult(response);
}

export async function updateCurriculumCoursePlacement(curriculumId, curriculumCourseId, placement, confirmImpact = false) {
    const payload = {
        confirm_impact: confirmImpact,
    };

    if (Object.prototype.hasOwnProperty.call(placement, 'categoryId')) {
        payload.category_id = placement.categoryId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(placement, 'isCoreCourse')) {
        payload.is_required = boolValue(placement.isCoreCourse, true);
    }
    if (Object.prototype.hasOwnProperty.call(placement, 'isLocked')) {
        payload.is_locked = boolValue(placement.isLocked, false);
    }
    if (Object.prototype.hasOwnProperty.call(placement, 'displayOrder')) {
        payload.display_order = nullableNumber(placement.displayOrder);
    }

    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/curriculum-courses/${curriculumCourseId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });

    return toMutationResult(response);
}

export async function deleteCurriculumCoursePlacement(curriculumId, curriculumCourseId, confirmImpact = false) {
    const query = confirmImpact ? '?confirm_impact=true' : '';
    const response = await apiFetch(`/api/v1/curricula/${curriculumId}/curriculum-courses/${curriculumCourseId}${query}`, {
        method: 'DELETE',
    });

    return toMutationResult(response);
}
