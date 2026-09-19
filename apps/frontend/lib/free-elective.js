import { apiFetch } from './api';

export const FREE_ELECTIVE_GRADE_SCHEMES = [
    {
        value: 'letter',
        labelTh: 'เกรดตัวอักษร',
        labelEn: 'Letter grades',
    },
    {
        value: 'satisfactory',
        labelTh: 'ผ่าน / ไม่ผ่าน',
        labelEn: 'Satisfactory / Unsatisfactory',
    },
];

export const FREE_ELECTIVE_GRADE_OPTIONS = {
    letter: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'I'],
    satisfactory: ['S', 'U', 'W', 'I'],
};

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function toNullableNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    return toNumber(value, null);
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function getEntityId(item, keys) {
    for (const key of keys) {
        const value = item?.[key];
        const numericValue = Number(value);
        if (Number.isSafeInteger(numericValue) && numericValue > 0) {
            return value;
        }
    }

    return null;
}

function buildQuery(filters = {}) {
    const query = new URLSearchParams();
    const mappings = {
        facultyId: 'faculty_id',
        majorId: 'major_id',
        curriculumId: 'curriculum_id',
        entryYearBE: 'entry_year_be',
        academicYearBE: 'academic_year_be',
        semester: 'semester',
        status: 'status',
    };

    Object.entries(mappings).forEach(([key, queryKey]) => {
        const value = filters[key];
        if (value !== undefined && value !== null && value !== '') {
            query.set(queryKey, String(value));
        }
    });

    const encoded = query.toString();
    return encoded ? `?${encoded}` : '';
}

export function getFreeElectiveGradeOptions(scheme) {
    return FREE_ELECTIVE_GRADE_OPTIONS[scheme] || [];
}

export function mapFreeElectiveCourse(item) {
    if (!item) {
        return null;
    }

    return {
        id: item.free_elective_course_id,
        freeElectiveCourseId: item.free_elective_course_id,
        facultyId: item.faculty_id,
        facultyNameTh: item.faculty_name_th || '',
        facultyNameEn: item.faculty_name_en || '',
        code: item.code || '',
        nameTh: item.name_th || '',
        nameEn: item.name_en || '',
        description: item.description || '',
        credits: toNumber(item.credits),
        gradeScheme: item.grade_scheme || 'letter',
        isActive: item.is_active ?? true,
        offeringCount: toNumber(item.offering_count),
        activeOfferingCount: toNumber(item.active_offering_count),
        finalizedOfferingCount: toNumber(item.finalized_offering_count),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapFreeElectiveOffering(item) {
    if (!item) {
        return null;
    }

    return {
        id: item.offering_id,
        offeringId: item.offering_id,
        freeElectiveCourseId: item.free_elective_course_id,
        courseCode: item.course_code || '',
        courseNameTh: item.course_name_th || '',
        courseNameEn: item.course_name_en || '',
        facultyId: item.faculty_id,
        facultyNameTh: item.faculty_name_th || '',
        facultyNameEn: item.faculty_name_en || '',
        gradeScheme: item.grade_scheme || 'letter',
        academicYearBE: toNumber(item.academic_year_be),
        semester: toNumber(item.semester),
        sectionNo: item.section_no || '',
        capacity: toNullableNumber(item.capacity),
        status: item.status || 'draft',
        scoresRecalculationRequired: item.scores_recalculation_required ?? false,
        finalizedAt: item.finalized_at || null,
        studentCount: toNumber(item.student_count),
        gradedStudentCount: toNumber(item.graded_student_count),
        competencyCount: toNumber(item.competency_count),
        weightTotal: toNumber(item.weight_total),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapFreeElectiveReadiness(item) {
    return {
        ready: item?.ready ?? false,
        competencyMapped: item?.competency_mapped ?? false,
        weightsValid: item?.weights_valid ?? false,
        studentsAdded: item?.students_added ?? false,
        gradesComplete: item?.grades_complete ?? false,
        codes: Array.isArray(item?.codes) ? item.codes : [],
        messagesTh: Array.isArray(item?.messages_th) ? item.messages_th : [],
        messagesEn: Array.isArray(item?.messages_en) ? item.messages_en : [],
    };
}

export function mapFreeElectiveCompetency(item) {
    return {
        id: item.offering_competency_id,
        offeringCompetencyId: item.offering_competency_id,
        offeringId: item.offering_id,
        competencyId: item.competency_id,
        code: item.code || '',
        nameTh: item.name_th || '',
        nameEn: item.name_en || '',
        weightPercent: toNumber(item.weight_percent),
        displayOrder: toNumber(item.display_order),
    };
}

export function mapFreeElectiveEnrollment(item) {
    if (!item) {
        return null;
    }

    return {
        id: item.offering_enrollment_id,
        offeringEnrollmentId: item.offering_enrollment_id,
        offeringId: item.offering_id,
        enrollmentId: item.enrollment_id,
        enrollmentCurriculumId: item.enrollment_curriculum_id,
        studentCode: item.student_code || '',
        studentNameTh: item.student_name_th || '',
        studentNameEn: item.student_name_en || '',
        curriculumId: item.curriculum_id,
        curriculumNameTh: item.curriculum_name_th || '',
        curriculumNameEn: item.curriculum_name_en || '',
        cohortId: item.cohort_id,
        entryYearBE: toNumber(item.entry_year_be),
        enrollmentStatus: item.enrollment_status || '',
        status: item.status || 'enrolled',
        grade: item.grade || '',
        gradeSource: item.grade_source || '',
        isBestGrade: item.is_best_grade ?? false,
        gradeRecordId: item.grade_record_id || null,
        updatedAt: item.updated_at || null,
    };
}

export function mapFreeElectiveStudentGroup(item) {
    return {
        id: item.cohort_id,
        cohortId: item.cohort_id,
        facultyId: item.faculty_id,
        facultyNameTh: item.faculty_name_th || '',
        facultyNameEn: item.faculty_name_en || '',
        majorId: item.major_id,
        majorNameTh: item.major_name_th || '',
        majorNameEn: item.major_name_en || '',
        curriculumId: item.curriculum_id,
        curriculumNameTh: item.curriculum_name_th || '',
        curriculumNameEn: item.curriculum_name_en || '',
        entryYearBE: toNumber(item.entry_year_be),
        studentCount: toNumber(item.student_count),
        selectedCount: toNumber(item.selected_count),
    };
}

export function mapFreeElectiveStudent(item) {
    return {
        id: item.enrollment_id,
        enrollmentId: item.enrollment_id,
        enrollmentCurriculumId: item.enrollment_curriculum_id,
        facultyId: item.faculty_id,
        studentCode: item.student_code || '',
        studentNameTh: item.student_name_th || '',
        studentNameEn: item.student_name_en || '',
        curriculumId: item.curriculum_id,
        curriculumNameTh: item.curriculum_name_th || '',
        curriculumNameEn: item.curriculum_name_en || '',
        entryYearBE: toNumber(item.entry_year_be),
    };
}

export function mapFreeElectiveStudentCourse(item) {
    return {
        offeringEnrollmentId: item.offering_enrollment_id,
        offeringId: item.offering_id,
        courseCode: item.course_code || '',
        courseNameTh: item.course_name_th || '',
        courseNameEn: item.course_name_en || '',
        academicYearBE: toNumber(item.academic_year_be),
        semester: toNumber(item.semester),
        sectionNo: item.section_no || '',
        offeringStatus: item.offering_status || '',
        gradeScheme: item.grade_scheme || 'letter',
        grade: item.grade || '',
        gradeSource: item.grade_source || '',
        isBestGrade: item.is_best_grade ?? false,
        status: item.status || '',
    };
}

export function mapFreeElectiveStudentDetail(item) {
    return {
        student: mapFreeElectiveStudent(item?.student),
        courses: (item?.courses || []).map(mapFreeElectiveStudentCourse),
    };
}

export function mapFreeElectiveRoundCourse(item) {
    if (!item) {
        return null;
    }

    const roundCourseId = getEntityId(item, [
        'round_course_id',
        'roundCourseId',
        'id',
    ]);
    const roundId = getEntityId(item, ['round_id', 'roundId']);
    const freeElectiveCourseId = getEntityId(item, [
        'free_elective_course_id',
        'freeElectiveCourseId',
    ]);

    return {
        id: roundCourseId,
        roundCourseId,
        roundId,
        freeElectiveCourseId,
        courseCode: item.course_code || '',
        courseNameTh: item.course_name_th || '',
        courseNameEn: item.course_name_en || '',
        description: item.description || '',
        credits: toNumber(item.credits),
        gradeScheme: item.grade_scheme || 'letter',
        displayOrder: toNumber(item.display_order),
        studentCount: toNumber(item.student_count),
        gradedStudentCount: toNumber(item.graded_student_count),
        competencies: (item.competencies || []).map((competency) => {
            const roundCourseCompetencyId = getEntityId(competency, [
                'round_course_competency_id',
                'roundCourseCompetencyId',
                'id',
            ]);

            return {
                id: roundCourseCompetencyId,
                roundCourseCompetencyId,
                roundCourseId: getEntityId(competency, [
                    'round_course_id',
                    'roundCourseId',
                ]),
                competencyId: getEntityId(competency, [
                    'competency_id',
                    'competencyId',
                ]),
                code: competency.code || '',
                nameTh: competency.name_th || '',
                nameEn: competency.name_en || '',
                weightPercent: toNumber(competency.weight_percent),
                displayOrder: toNumber(competency.display_order),
            };
        }),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapFreeElectiveRound(item) {
    if (!item) {
        return null;
    }

    return {
        id: item.round_id,
        roundId: item.round_id,
        facultyId: item.faculty_id,
        facultyNameTh: item.faculty_name_th || '',
        facultyNameEn: item.faculty_name_en || '',
        academicYearBE: toNumber(item.academic_year_be),
        semester: toNumber(item.semester),
        status: item.status || 'draft',
        scoresRecalculationRequired: item.scores_recalculation_required ?? false,
        finalizedAt: item.finalized_at || null,
        courseCount: toNumber(item.course_count),
        learnerCount: toNumber(item.learner_count),
        gradeCount: toNumber(item.grade_count),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapFreeElectiveRoundDetail(item) {
    return {
        round: mapFreeElectiveRound(item?.round),
        courses: (item?.courses || []).map(mapFreeElectiveRoundCourse),
    };
}

export function mapFreeElectiveRoundEnrollment(item) {
    if (!item) {
        return null;
    }

    return {
        id: item.round_course_enrollment_id,
        roundCourseEnrollmentId: item.round_course_enrollment_id,
        roundCourseId: item.round_course_id,
        enrollmentId: item.enrollment_id,
        enrollmentCurriculumId: item.enrollment_curriculum_id,
        studentCode: item.student_code || '',
        studentNameTh: item.student_name_th || '',
        studentNameEn: item.student_name_en || '',
        curriculumId: item.curriculum_id,
        curriculumNameTh: item.curriculum_name_th || '',
        curriculumNameEn: item.curriculum_name_en || '',
        cohortId: item.cohort_id,
        entryYearBE: toNumber(item.entry_year_be),
        enrollmentStatus: item.enrollment_status || '',
        status: item.status || 'enrolled',
        grade: item.grade || '',
        gradeSource: item.grade_source || '',
        isBestGrade: item.is_best_grade ?? false,
        gradeRecordId: item.grade_record_id || null,
        updatedAt: item.updated_at || null,
    };
}

export function mapFreeElectiveRoundCourseDetail(item) {
    return {
        course: mapFreeElectiveRoundCourse(item?.course),
        allowedGrades: Array.isArray(item?.allowed_grades) ? item.allowed_grades : [],
        enrollments: (item?.enrollments || []).map(mapFreeElectiveRoundEnrollment),
    };
}

function roundCoursePayload(course) {
    return {
        round_course_id: toNumber(course.roundCourseId || course.id),
        free_elective_course_id: toNumber(
            course.freeElectiveCourseId || course.free_elective_course_id,
        ),
        course_code: String(course.courseCode || '').trim(),
        course_name_th: String(course.courseNameTh || '').trim(),
        course_name_en: toNullableString(course.courseNameEn),
        description: toNullableString(course.description),
        credits: toNumber(course.credits),
        grade_scheme: course.gradeScheme || '',
        competencies: (course.competencies || []).map((item) => ({
            competency_id: toNumber(item.competencyId),
            weight_percent: toNumber(item.weightPercent),
        })),
    };
}

function roundPayload(form) {
    return {
        faculty_id: toNumber(form.facultyId),
        academic_year_be: toNumber(form.academicYearBE),
        semester: toNumber(form.semester),
        courses: (form.courses || []).map(roundCoursePayload),
    };
}

export async function fetchFreeElectiveRounds(filters = {}) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds${buildQuery(filters)}`,
    );
    return unwrapData(response, []).map(mapFreeElectiveRound);
}

export async function fetchFreeElectiveRound(roundId) {
    const response = await apiFetch(`/api/v1/free-electives/rounds/${roundId}`);
    return mapFreeElectiveRoundDetail(unwrapData(response, null));
}

export async function previewFreeElectiveRound(form) {
    const response = await apiFetch('/api/v1/free-electives/rounds/preview', {
        method: 'POST',
        body: JSON.stringify(roundPayload(form)),
    });
    return unwrapData(response, null);
}

export async function createFreeElectiveRound(form) {
    const response = await apiFetch('/api/v1/free-electives/rounds', {
        method: 'POST',
        body: JSON.stringify(roundPayload(form)),
    });
    return mapFreeElectiveRoundDetail(unwrapData(response, null));
}

export async function duplicateFreeElectiveRound(roundId, form) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/duplicate`,
        {
            method: 'POST',
            body: JSON.stringify({
                academic_year_be: toNumber(form.academicYearBE),
                semester: toNumber(form.semester),
            }),
        },
    );
    return mapFreeElectiveRoundDetail(unwrapData(response, null));
}

export async function updateFreeElectiveRoundStatus(roundId, status) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/status`,
        {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        },
    );
    return mapFreeElectiveRoundDetail(unwrapData(response, null));
}

function roundCourseMappingPayload(competencies) {
    return (competencies || []).map((item) => ({
        competency_id: toNumber(item.competencyId || item.competency_id),
        weight_percent: toNumber(item.weightPercent ?? item.weight_percent),
    }));
}

export async function fetchFreeElectiveRoundCourse(roundId, roundCourseId) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}`,
    );
    return mapFreeElectiveRoundCourseDetail(unwrapData(response, null));
}

export async function addFreeElectiveRoundCourse(roundId, courseId, competencies) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses`,
        {
            method: 'POST',
            body: JSON.stringify({
                free_elective_course_id: toNumber(courseId),
                competencies: roundCourseMappingPayload(competencies),
            }),
        },
    );
    return mapFreeElectiveRoundCourse(unwrapData(response, null));
}

export async function replaceFreeElectiveRoundCourseCompetencies(
    roundId,
    roundCourseId,
    competencies,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}/competencies`,
        {
            method: 'PUT',
            body: JSON.stringify({
                competencies: roundCourseMappingPayload(competencies),
            }),
        },
    );
    return mapFreeElectiveRoundCourseDetail(unwrapData(response, null));
}

export async function deleteFreeElectiveRoundCourse(roundId, roundCourseId) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}`,
        { method: 'DELETE' },
    );
    return unwrapData(response, null);
}

export async function fetchFreeElectiveRoundCourseLearners(
    roundId,
    roundCourseId,
    search = '',
) {
    const query = new URLSearchParams();
    if (search.trim()) {
        query.set('search', search.trim());
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}/learners${suffix}`,
    );
    return unwrapData(response, []).map(mapFreeElectiveStudent);
}

export async function fetchFreeElectiveRoundCourseEnrollments(roundId, roundCourseId) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}/enrollments`,
    );
    return unwrapData(response, []).map(mapFreeElectiveRoundEnrollment);
}

export async function addFreeElectiveRoundCourseEnrollments(
    roundId,
    roundCourseId,
    enrollments,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}/enrollments`,
        {
            method: 'POST',
            body: JSON.stringify({
                enrollments: (enrollments || []).map((item) => ({
                    enrollment_id: toNumber(item.enrollmentId || item.enrollment_id),
                    enrollment_curriculum_id: toNumber(
                        item.enrollmentCurriculumId || item.enrollment_curriculum_id,
                    ),
                })),
            }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveRoundEnrollment);
}

export async function updateFreeElectiveRoundCourseEnrollmentStatus(
    roundId,
    roundCourseId,
    roundCourseEnrollmentId,
    status,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}/enrollments/${roundCourseEnrollmentId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveRoundEnrollment);
}

export async function upsertFreeElectiveRoundCourseGrade(
    roundId,
    roundCourseId,
    roundCourseEnrollmentId,
    form,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/rounds/${roundId}/courses/${roundCourseId}/enrollments/${roundCourseEnrollmentId}/grade`,
        {
            method: 'PUT',
            body: JSON.stringify({
                grade: String(form.grade || '').trim(),
                grade_source: form.gradeSource || 'manual',
                source_reference: toNullableString(form.sourceReference),
            }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveRoundEnrollment);
}

function coursePayload(form, confirmImpact = false) {
    return {
        faculty_id: toNumber(form.facultyId),
        code: String(form.code || '').trim(),
        name_th: String(form.nameTh || '').trim(),
        name_en: toNullableString(form.nameEn),
        description: toNullableString(form.description),
        credits: toNumber(form.credits),
        grade_scheme: form.gradeScheme || '',
        is_active: form.isActive ?? true,
        confirm_impact: confirmImpact,
    };
}

function offeringPayload(form) {
    return {
        free_elective_course_id: toNumber(form.freeElectiveCourseId),
        academic_year_be: toNumber(form.academicYearBE),
        semester: toNumber(form.semester),
        section_no: String(form.sectionNo || '').trim(),
        capacity: form.capacity === '' || form.capacity === null
            ? null
            : toNumber(form.capacity),
    };
}

export async function fetchFreeElectiveCourses(filters = {}) {
    const response = await apiFetch(
        `/api/v1/free-electives/courses${buildQuery(filters)}`,
    );
    return unwrapData(response, []).map(mapFreeElectiveCourse);
}

export async function createFreeElectiveCourse(form) {
    const response = await apiFetch('/api/v1/free-electives/courses', {
        method: 'POST',
        body: JSON.stringify(coursePayload(form)),
    });
    return mapFreeElectiveCourse(unwrapData(response, null));
}

export async function updateFreeElectiveCourse(courseId, form, confirmImpact = false) {
    const response = await apiFetch(`/api/v1/free-electives/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify(coursePayload(form, confirmImpact)),
    });
    return mapFreeElectiveCourse(unwrapData(response, null));
}

export async function fetchFreeElectiveOfferings(filters = {}) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings${buildQuery(filters)}`,
    );
    return unwrapData(response, []).map(mapFreeElectiveOffering);
}

export async function createFreeElectiveOffering(form) {
    const response = await apiFetch('/api/v1/free-electives/offerings', {
        method: 'POST',
        body: JSON.stringify(offeringPayload(form)),
    });
    return mapFreeElectiveOffering(unwrapData(response, null));
}

export async function fetchFreeElectiveOffering(offeringId) {
    const response = await apiFetch(`/api/v1/free-electives/offerings/${offeringId}`);
    return mapFreeElectiveOffering(unwrapData(response, null));
}

export async function updateFreeElectiveOfferingStatus(offeringId, status) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/status`,
        {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        },
    );
    return mapFreeElectiveOffering(unwrapData(response, null));
}

export async function finalizeFreeElectiveOffering(offeringId) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/finalize`,
        { method: 'POST' },
    );
    return mapFreeElectiveOffering(unwrapData(response, null));
}

export async function fetchFreeElectiveReadiness(offeringId) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/readiness`,
    );
    return mapFreeElectiveReadiness(unwrapData(response, null));
}

export async function fetchOfferingCompetencies(offeringId) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/competencies`,
    );
    return unwrapData(response, []).map(mapFreeElectiveCompetency);
}

export async function replaceOfferingCompetencies(offeringId, competencies) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/competencies`,
        {
            method: 'PUT',
            body: JSON.stringify({
                competencies: competencies.map((item) => ({
                    competency_id: toNumber(item.competencyId),
                    weight_percent: toNumber(item.weightPercent),
                })),
            }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveCompetency);
}

export async function copyPreviousOfferingCompetencies(offeringId) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/competencies/copy-previous`,
        { method: 'POST' },
    );
    return unwrapData(response, []).map(mapFreeElectiveCompetency);
}

export async function fetchOfferingEnrollments(offeringId) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/enrollments`,
    );
    return unwrapData(response, []).map(mapFreeElectiveEnrollment);
}

export async function addOfferingEnrollments(offeringId, enrollments) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/enrollments`,
        {
            method: 'POST',
            body: JSON.stringify({
                enrollments: enrollments.map((item) => ({
                    enrollment_id: toNumber(item.enrollmentId),
                    enrollment_curriculum_id: toNumber(item.enrollmentCurriculumId),
                })),
            }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveEnrollment);
}

export async function updateOfferingEnrollmentStatus(
    offeringId,
    offeringEnrollmentId,
    status,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/enrollments/${offeringEnrollmentId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveEnrollment);
}

export async function upsertOfferingGrade(
    offeringId,
    offeringEnrollmentId,
    form,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/enrollments/${offeringEnrollmentId}/grade`,
        {
            method: 'PUT',
            body: JSON.stringify({
                grade: String(form.grade || '').trim(),
                grade_source: form.gradeSource || 'manual',
                source_reference: toNullableString(form.sourceReference),
            }),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveEnrollment);
}

function importPayload(rows, replaceExisting = false) {
    return {
        rows: rows.map((row) => ({
            row_number: toNumber(row.rowNumber),
            student_code: String(row.studentCode || '').trim(),
            grade: String(row.grade || '').trim(),
        })),
        replace_existing: replaceExisting,
    };
}

function mapImportPreview(item) {
    return {
        validRows: item?.valid_rows || [],
        existingRows: item?.existing_rows || [],
        invalidRows: item?.invalid_rows || [],
        duplicateRows: item?.duplicate_rows || [],
    };
}

export async function previewFreeElectiveGradeImport(offeringId, rows, replaceExisting = false) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/grade-imports/preview`,
        {
            method: 'POST',
            body: JSON.stringify(importPayload(rows, replaceExisting)),
        },
    );
    return mapImportPreview(unwrapData(response, null));
}

export async function commitFreeElectiveGradeImport(offeringId, rows, replaceExisting = false) {
    const response = await apiFetch(
        `/api/v1/free-electives/offerings/${offeringId}/grade-imports/commit`,
        {
            method: 'POST',
            body: JSON.stringify(importPayload(rows, replaceExisting)),
        },
    );
    return unwrapData(response, []).map(mapFreeElectiveEnrollment);
}

export async function fetchFreeElectiveStudentGroups(filters = {}) {
    const response = await apiFetch(
        `/api/v1/free-electives/student-groups${buildQuery(filters)}`,
    );
    return unwrapData(response, []).map(mapFreeElectiveStudentGroup);
}

export async function fetchFreeElectiveGroupStudents(cohortId) {
    const response = await apiFetch(
        `/api/v1/free-electives/student-groups/${cohortId}/students`,
    );
    return unwrapData(response, []).map(mapFreeElectiveStudent);
}

export async function fetchFreeElectiveStudentDetail(enrollmentId) {
    const response = await apiFetch(
        `/api/v1/free-electives/students/${enrollmentId}`,
    );
    return mapFreeElectiveStudentDetail(unwrapData(response, null));
}

export async function fetchFreeElectiveStudentAvailableOfferings(enrollmentId) {
    const response = await apiFetch(
        `/api/v1/free-electives/students/${enrollmentId}/available-offerings`,
    );
    return unwrapData(response, []).map(mapFreeElectiveOffering);
}

export async function addFreeElectiveStudentOffering(enrollmentId, offeringId) {
    const response = await apiFetch(
        `/api/v1/free-electives/students/${enrollmentId}/offerings`,
        {
            method: 'POST',
            body: JSON.stringify({ offering_id: toNumber(offeringId) }),
        },
    );
    return mapFreeElectiveStudentDetail(unwrapData(response, null));
}

export async function updateFreeElectiveStudentOfferingStatus(
    enrollmentId,
    offeringEnrollmentId,
    status,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/students/${enrollmentId}/offerings/${offeringEnrollmentId}/status`,
        {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        },
    );
    return mapFreeElectiveStudentDetail(unwrapData(response, null));
}

export async function updateFreeElectiveStudentGrade(
    enrollmentId,
    offeringEnrollmentId,
    grade,
) {
    const response = await apiFetch(
        `/api/v1/free-electives/students/${enrollmentId}/offerings/${offeringEnrollmentId}/grade`,
        {
            method: 'PUT',
            body: JSON.stringify({
                grade: String(grade || '').trim(),
                grade_source: 'manual',
            }),
        },
    );
    return mapFreeElectiveStudentDetail(unwrapData(response, null));
}

export function getFreeElectiveImpactFromError(error) {
    return error?.payload?.data || null;
}
