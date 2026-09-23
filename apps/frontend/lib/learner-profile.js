import { apiFetch } from './api';

function mapProfile(item = {}) {
    return {
        studentCode: item.student_code || '',
        nameTh: item.name_th || '',
        nameEn: item.name_en || '',
        entryYearBE: Number(item.entry_year_be || 0),
        facultyNameTh: item.faculty_name_th || '',
        facultyNameEn: item.faculty_name_en || '',
        majorNameTh: item.major_name_th || '',
        majorNameEn: item.major_name_en || '',
        curriculumNameTh: item.curriculum_name_th || '',
        curriculumNameEn: item.curriculum_name_en || '',
    };
}

function mapCourse(item = {}) {
    return {
        recordId: item.record_id || 0,
        courseId: Number(item.course_id || 0),
        source: item.source || 'curriculum',
        academicYearBE: Number(item.academic_year_be || 0),
        studyYear: Number(item.study_year || 0),
        semester: Number(item.semester || 0),
        courseCode: item.course_code || '',
        courseNameTh: item.course_name_th || '',
        courseNameEn: item.course_name_en || '',
        credits: Number(item.credits || 0),
        gradeScheme: item.grade_scheme || 'letter',
        grade: item.grade || '',
    };
}

function mapGradeSummary(item = {}) {
    return {
        cr: Number(item.cr || 0),
        cp: Number(item.cp || 0),
        ca: Number(item.ca || 0),
        gp: Number(item.gp || 0),
        gpa: item.gpa == null ? null : Number(item.gpa),
    };
}

function mapTermSummary(item = {}) {
    return {
        studyYear: Number(item.study_year || 0),
        academicYearBE: Number(item.academic_year_be || 0),
        semester: Number(item.semester || 0),
        term: mapGradeSummary(item.term),
        cumulative: mapGradeSummary(item.cumulative),
    };
}

export async function fetchLearnerAcademicProfile() {
    const response = await apiFetch('/api/v1/learner/academic-profile');
    const payload = response?.data || response || {};

    return {
        profile: mapProfile(payload.profile),
        courseHistory: (payload.course_history || []).map(mapCourse),
        termSummaries: (payload.term_summaries || []).map(mapTermSummary),
    };
}
