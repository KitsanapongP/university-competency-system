import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

function toBool(value, fallback = true) {
    return typeof value === 'boolean' ? value : fallback;
}

function buildQuery(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });

    const text = query.toString();
    return text ? `?${text}` : '';
}

export function mapFacultyOption(faculty) {
    return {
        facultyId: faculty.faculty_id,
        code: faculty.code || '',
        nameTh: faculty.name_th || '',
        nameEn: faculty.name_en || '',
    };
}

export function mapDepartmentOption(department) {
    return {
        departmentId: department.department_id,
        facultyId: department.faculty_id,
        code: department.code || '',
        nameTh: department.name_th || '',
        nameEn: department.name_en || '',
        isActive: department.is_active ?? true,
    };
}

export function mapMajorOption(major) {
    return {
        majorId: major.major_id,
        departmentId: major.department_id,
        facultyId: major.faculty_id,
        code: major.code || '',
        nameTh: major.name_th || '',
        nameEn: major.name_en || '',
        degreeLevel: major.degree_level || '',
        isActive: major.is_active ?? true,
        curriculumCount: major.curriculum_count || 0,
        departmentNameTh: major.department_name_th || '',
        departmentNameEn: major.department_name_en || '',
        facultyNameTh: major.faculty_name_th || '',
        facultyNameEn: major.faculty_name_en || '',
        createdAt: major.created_at,
        updatedAt: major.updated_at,
    };
}

export async function fetchMajorFaculties() {
    const response = await apiFetch('/api/v1/faculties');
    return unwrapData(response, []).map(mapFacultyOption);
}

export async function fetchDepartments(filters = {}) {
    const query = buildQuery({
        faculty_id: filters.facultyId,
    });
    const response = await apiFetch(`/api/v1/departments${query}`);
    return unwrapData(response, []).map(mapDepartmentOption);
}

export async function fetchMajorsForManagement(filters = {}) {
    const query = buildQuery({
        include_inactive: filters.includeInactive ?? true,
        faculty_id: filters.facultyId,
        department_id: filters.departmentId,
    });
    const response = await apiFetch(`/api/v1/majors${query}`);
    return unwrapData(response, []).map(mapMajorOption);
}

function majorPayload(form) {
    return {
        department_id: Number(form.departmentId) || 0,
        code: String(form.code || '').trim(),
        name_th: String(form.nameTh || '').trim(),
        name_en: toNullableString(form.nameEn),
        degree_level: String(form.degreeLevel || '').trim(),
        is_active: toBool(form.isActive, true),
    };
}

export async function createMajor(form) {
    const response = await apiFetch('/api/v1/majors', {
        method: 'POST',
        body: JSON.stringify(majorPayload(form)),
    });

    return mapMajorOption(unwrapData(response, null));
}

export async function updateMajor(majorId, form) {
    const response = await apiFetch(`/api/v1/majors/${majorId}`, {
        method: 'PATCH',
        body: JSON.stringify(majorPayload(form)),
    });

    return mapMajorOption(unwrapData(response, null));
}

export async function updateMajorStatus(majorId, isActive) {
    const response = await apiFetch(`/api/v1/majors/${majorId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: Boolean(isActive) }),
    });

    return mapMajorOption(unwrapData(response, null));
}
