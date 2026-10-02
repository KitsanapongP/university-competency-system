import { apiFetch } from './api';

function unwrap(response) {
    return response?.data ?? response ?? {};
}

function mapRequirement(item = {}) {
    return {
        requirementId: Number(item.requirement_id || 0),
        criterionType: item.criterion_type || '',
        nameTh: item.name_th || '',
        nameEn: item.name_en || '',
        minimumValue: item.minimum_value == null ? '' : String(item.minimum_value),
        minimumGrade: item.minimum_grade || '',
        categoryId: item.category_id == null ? '' : String(item.category_id),
        courseId: item.course_id == null ? '' : String(item.course_id),
        displayOrder: Number(item.display_order || 0),
    };
}

function mapSet(item) {
    if (!item) return null;
    return {
        requirementSetId: Number(item.requirement_set_id || 0),
        curriculumId: Number(item.curriculum_id || 0),
        semester: Number(item.semester || 0),
        revision: Number(item.revision || 0),
        status: item.status || '',
        createdAt: item.created_at || null,
        updatedAt: item.updated_at || null,
        publishedAt: item.published_at || null,
        requirements: (item.requirements || []).map(mapRequirement),
    };
}

export async function fetchCooperativeRequirements(curriculumId, semester) {
    const response = await apiFetch(
        `/api/v1/curricula/${curriculumId}/cooperative-requirements?semester=${semester}`,
    );
    const data = unwrap(response);
    return {
        curriculumId: Number(data.curriculum_id || curriculumId),
        draft: mapSet(data.draft),
        published: mapSet(data.published),
    };
}

function serializeRequirement(item, displayOrder) {
    const minimumValue = item.minimumValue === '' || item.minimumValue == null
        ? null
        : Number(item.minimumValue);

    return {
        criterion_type: item.criterionType || '',
        name_th: String(item.nameTh || '').trim(),
        name_en: String(item.nameEn || '').trim() || null,
        minimum_value: Number.isFinite(minimumValue) ? minimumValue : null,
        minimum_grade: item.minimumGrade || null,
        category_id: item.categoryId ? Number(item.categoryId) : null,
        course_id: item.courseId ? Number(item.courseId) : null,
        display_order: displayOrder,
    };
}

export async function saveCooperativeRequirementsDraft(curriculumId, semester, requirements) {
    const payload = {
        requirements: requirements
            .filter((item) => item.criterionType)
            .map(serializeRequirement),
    };
    const response = await apiFetch(
        `/api/v1/curricula/${curriculumId}/cooperative-requirements/draft?semester=${semester}`,
        {
            method: 'PUT',
            body: JSON.stringify(payload),
        },
    );
    const data = unwrap(response);
    return {
        curriculumId: Number(data.curriculum_id || curriculumId),
        draft: mapSet(data.draft),
        published: mapSet(data.published),
    };
}

export async function publishCooperativeRequirements(curriculumId, semester) {
    const response = await apiFetch(
        `/api/v1/curricula/${curriculumId}/cooperative-requirements/publish?semester=${semester}`,
        {
            method: 'POST',
            body: JSON.stringify({}),
        },
    );
    const data = unwrap(response);
    return {
        curriculumId: Number(data.curriculum_id || curriculumId),
        draft: mapSet(data.draft),
        published: mapSet(data.published),
    };
}

export async function fetchCooperativeReadiness(semester, options = {}) {
    const response = await apiFetch(`/api/v1/learner/cooperative-readiness?semester=${semester}`, {
        signal: options.signal,
    });
    const data = unwrap(response);
    return {
        curriculumId: Number(data.curriculum_id || 0),
        entryYearBE: Number(data.entry_year_be || 0),
        targetYearBE: Number(data.target_year_be || 0),
        targetSemester: Number(data.target_semester || semester),
        requirementSetId: Number(data.requirement_set_id || 0),
        revision: Number(data.revision || 0),
        status: data.status || 'not_configured',
        passedCount: Number(data.passed_count || 0),
        requirementCount: Number(data.requirement_count || 0),
        results: (data.results || []).map((item) => ({
            requirementId: Number(item.requirement_id || 0),
            criterionType: item.criterion_type || '',
            nameTh: item.name_th || '',
            nameEn: item.name_en || '',
            status: item.status || 'missing',
            currentValue: item.current_value == null ? null : Number(item.current_value),
            requiredValue: item.required_value == null ? null : Number(item.required_value),
            currentGrade: item.current_grade || '',
            requiredGrade: item.required_grade || '',
            courseNameTh: item.course_name_th || '',
            courseNameEn: item.course_name_en || '',
            categoryNameTh: item.category_name_th || '',
            categoryNameEn: item.category_name_en || '',
            explanation: item.explanation || '',
        })),
    };
}
