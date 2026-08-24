import * as XLSX from 'xlsx';
import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function queryString(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const value = query.toString();
    return value ? `?${value}` : '';
}

function mapGrade(item) {
    return {
        courseStudentId: item.course_student_id || 0,
        enrollmentId: item.enrollment_id || 0,
        enrollmentCurriculumId: item.student_curricula_id || 0,
        studentCode: item.student_code || '',
        studentNameTh: item.student_name_th || '',
        courseId: item.course_id || 0,
        courseCode: item.course_code || '',
        courseNameTh: item.course_name_th || '',
        courseNameEn: item.course_name_en || '',
        courseType: item.course_type || 'core',
        credits: Number(item.credits || 0),
        academicYearBe: Number(item.academic_year_be || 0),
        semester: Number(item.semester || 0),
        grade: item.grade || '',
        gradeSource: item.grade_source || 'manual',
        sourceReference: item.source_reference || '',
        isBestGrade: Boolean(item.is_best_grade),
        updatedAt: item.updated_at,
    };
}

function mapCourse(item) {
    return {
        courseId: item.course_id,
        courseCode: item.course_code || '',
        courseNameTh: item.course_name_th || '',
        courseNameEn: item.course_name_en || '',
        courseType: item.course_type || 'core',
        credits: Number(item.credits || 0),
        totalStudents: Number(item.total_students || 0),
        recordedStudents: Number(item.recorded_students || 0),
    };
}

function mapStudent(item) {
    return {
        enrollmentId: item.enrollment_id,
        studentCode: item.student_code || '',
        studentNameTh: item.student_name_th || '',
        totalCourses: Number(item.total_courses || 0),
        recordedCourses: Number(item.recorded_courses || 0),
    };
}

export function mapCourseGradeOverview(item) {
    return {
        cohortId: item?.cohort_id || 0,
        courseScoresRecalculationRequired: Boolean(item?.course_scores_recalculation_required),
        courseScoresRecalculatedAt: item?.course_scores_recalculated_at || null,
        totalStudents: Number(item?.total_students || 0),
        totalCourses: Number(item?.total_courses || 0),
        recordedGrades: Number(item?.recorded_grades || 0),
        courses: (item?.courses || []).map(mapCourse),
        students: (item?.students || []).map(mapStudent),
    };
}

export function mapCourseGradeStudentDetail(item) {
    return {
        enrollmentId: item?.enrollment_id || 0,
        studentCode: item?.student_code || '',
        studentNameTh: item?.student_name_th || '',
        courseScoresRecalculationRequired: Boolean(item?.course_scores_recalculation_required),
        grades: (item?.grades || []).map(mapGrade),
    };
}

export function mapCourseGradeCourseDetail(item) {
    return {
        course: mapCourse(item?.course || {}),
        courseScoresRecalculationRequired: Boolean(item?.course_scores_recalculation_required),
        students: (item?.students || []).map(student => ({
            enrollmentId: student.enrollment_id || 0,
            studentCode: student.student_code || '',
            studentNameTh: student.student_name_th || '',
            selectedGrade: student.selected_grade ? mapGrade(student.selected_grade) : null,
            otherGrades: (student.other_grades || []).map(mapGrade),
        })),
    };
}

function gradeRowPayload(row) {
    return {
        course_student_id: Number(row.courseStudentId || 0),
        row_number: Number(row.rowNumber || 0),
        enrollment_id: Number(row.enrollmentId || 0),
        student_code: String(row.studentCode || '').trim(),
        course_id: Number(row.courseId || 0),
        course_code: String(row.courseCode || '').trim(),
        academic_year_be: Number(row.academicYearBe || 0),
        semester: Number(row.semester || 0),
        grade: String(row.grade || '').trim().toUpperCase(),
        source_reference: row.sourceReference ? String(row.sourceReference).trim() : null,
        replace: Boolean(row.replace),
    };
}

export async function fetchCourseGradeOverview(cohortId, filters = {}) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-grades${queryString({
        search: filters.search,
        academic_year_be: filters.academicYearBe,
        semester: filters.semester,
        course_id: filters.courseId,
        status: filters.status,
    })}`);
    return mapCourseGradeOverview(unwrapData(response, {}));
}

export async function fetchStudentCourseGrades(cohortId, enrollmentId, filters = {}) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-grades/students/${enrollmentId}${queryString({
        search: filters.search,
        academic_year_be: filters.academicYearBe,
        semester: filters.semester,
        course_id: filters.courseId,
        status: filters.status,
    })}`);
    return mapCourseGradeStudentDetail(unwrapData(response, {}));
}

export async function fetchCourseGradeCourseRoster(cohortId, courseId, filters = {}) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-grades/courses/${courseId}${queryString({
        academic_year_be: filters.academicYearBe,
        semester: filters.semester,
    })}`);
    return mapCourseGradeCourseDetail(unwrapData(response, {}));
}

export async function saveCourseGrades(cohortId, rows) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-grades`, {
        method: 'PUT',
        body: JSON.stringify({ rows: rows.map(gradeRowPayload) }),
    });
    return unwrapData(response, null);
}

export async function previewCourseGradeImport(cohortId, rows) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-grade-imports/preview`, {
        method: 'POST',
        body: JSON.stringify({ rows: rows.map(gradeRowPayload) }),
    });
    return unwrapData(response, { valid_rows: [], conflicts: [], errors: [] });
}

export async function commitCourseGradeImport(cohortId, rows) {
    const response = await apiFetch(`/api/v1/student-cohorts/${cohortId}/course-grade-imports/commit`, {
        method: 'POST',
        body: JSON.stringify({ rows: rows.map(gradeRowPayload) }),
    });
    return unwrapData(response, null);
}

const COLUMN_ALIASES = {
    studentCode: ['รหัสนักศึกษา', 'student_code', 'student code'],
    courseCode: ['รหัสวิชา', 'course_code', 'course code'],
    academicYearBe: ['ปีการศึกษา', 'academic_year_be', 'academic year'],
    semester: ['ภาคเรียน', 'semester', 'term'],
    grade: ['เกรด', 'grade'],
};

function normalizedHeader(value) { return String(value ?? '').trim().toLowerCase(); }

function readCell(row, aliases) {
    const entry = Object.entries(row || {}).find(([key]) => aliases.includes(normalizedHeader(key)));
    return entry ? String(entry[1] ?? '').trim() : '';
}

export async function parseCourseGradeImportFile(file) {
    if (!file) throw new Error('กรุณาเลือกไฟล์เกรด');
    if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
    if (file.name.split('.').pop()?.toLowerCase() !== 'xlsx') throw new Error('รองรับเฉพาะไฟล์ .xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rawRows.length) throw new Error('ไม่พบข้อมูลใน Sheet 1');
    if (rawRows.length > 5000) throw new Error('นำเข้าได้ไม่เกิน 5,000 รายการต่อครั้ง');
    return rawRows.map((row, index) => ({
        rowNumber: index + 2,
        studentCode: readCell(row, COLUMN_ALIASES.studentCode),
        courseCode: readCell(row, COLUMN_ALIASES.courseCode),
        academicYearBe: Number(readCell(row, COLUMN_ALIASES.academicYearBe)) || 0,
        semester: Number(readCell(row, COLUMN_ALIASES.semester)) || 0,
        grade: readCell(row, COLUMN_ALIASES.grade).toUpperCase(),
        replace: false,
    }));
}

export function downloadCourseGradeImportTemplate() {
    const worksheet = XLSX.utils.json_to_sheet([{
        'รหัสนักศึกษา': '663040000-1',
        'รหัสวิชา': 'CP353004',
        'ปีการศึกษา': 2569,
        'ภาคเรียน': 1,
        'เกรด': 'A',
    }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grades');
    XLSX.writeFile(workbook, 'cohort-course-grade-import-template.xlsx');
}
