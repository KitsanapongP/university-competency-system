import { apiFetch } from './api';

function unwrapData(response, fallback) {
    return response?.data ?? fallback;
}

function toNullableString(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

function toNullableNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toNullableUint(value) {
    const parsed = toNullableNumber(value);
    if (parsed === null || parsed < 0) return null;
    return Math.trunc(parsed);
}

function buildLateAt(form) {
    if (!form.latePolicyEnabled || !form.startAt || !form.lateAtTime) {
        return null;
    }

    const [datePart] = String(form.startAt).split('T');
    if (!datePart) return null;

    return `${datePart}T${form.lateAtTime}`;
}

export function mapActivitySession(item) {
    return {
        sessionId: item.session_id,
        id: item.session_id,
        activityId: item.activity_id,
        activityCode: item.activity_code || '',
        activityNameTh: item.activity_name_th || '',
        activityStatus: item.activity_status || '',
        facultyId: item.faculty_id,
        sessionNo: item.session_no || 0,
        startAt: item.start_at,
        endAt: item.end_at,
        timezone: item.timezone || 'Asia/Bangkok',
        locationName: item.location_name || '',
        locationDetail: item.location_detail || '',
        latitude: item.latitude,
        longitude: item.longitude,
        capacity: item.capacity,
        registrationRequired: Boolean(item.registration_required),
        gradingMode: item.grading_mode || 'attendance_only',
        maxRawScore: item.max_raw_score ?? 100,
        passThreshold: item.pass_threshold,
        lateGraceMinutes: item.late_grace_minutes ?? 0,
        latePenaltyFactor: item.late_penalty_factor ?? 1,
        requireCheckout: Boolean(item.require_checkout),
        minAttendanceMinutes: item.min_attendance_minutes,
        status: item.status || 'scheduled',
        isFinalized: Boolean(item.is_finalized),
        finalizedAt: item.finalized_at,
        finalizedBy: item.finalized_by,
        assignmentCount: item.assignment_count || 0,
        competencyCount: item.competency_count || 0,
        competencyPercentTotal: Number(item.competency_percent_total || 0),
        registrationCount: item.registration_count || 0,
        attendanceCount: item.attendance_count || 0,
        canEdit: item.can_edit ?? false,
        canDelete: item.can_delete ?? false,
        canFinalize: item.can_finalize ?? false,
        canCancel: item.can_cancel ?? false,
        canComplete: item.can_complete ?? false,
        assignments: (item.assignments || []).map(mapSessionAssignment),
        competencies: (item.competencies || []).map(mapSessionCompetency),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapSessionAssignment(item) {
    return {
        sessionAssignmentId: item.session_assignment_id,
        sessionId: item.session_id,
        userId: item.user_id,
        displayName: item.display_name || '',
        email: item.email || '',
        userType: item.user_type || '',
        userFacultyId: item.user_faculty_id,
        assignmentRole: item.assignment_role || 'lecturer',
        canRecordAttendance: Boolean(item.can_record_attendance),
        canGrade: Boolean(item.can_grade),
        canFinalize: Boolean(item.can_finalize),
        note: item.note || '',
        createdBy: item.created_by,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapSessionCompetency(item) {
    return {
        sessionCompetencyId: item.session_competency_id,
        sessionId: item.session_id,
        competencyId: item.competency_id,
        competencyCode: item.competency_code || '',
        competencyNameTh: item.competency_name_th || '',
        competencyNameEn: item.competency_name_en || '',
        maxPercent: Number(item.max_percent || 0),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    };
}

export function mapAssigneeOption(item) {
    return {
        userId: item.user_id,
        displayName: item.display_name || '',
        email: item.email || '',
        userType: item.user_type || '',
        facultyId: item.faculty_id,
    };
}

function sessionPayload(form) {
    return {
        start_at: form.startAt || '',
        end_at: form.endAt || '',
        timezone: form.timezone || 'Asia/Bangkok',
        location_name: toNullableString(form.locationName),
        location_detail: toNullableString(form.locationDetail),
        latitude: toNullableNumber(form.latitude),
        longitude: toNullableNumber(form.longitude),
        capacity: toNullableUint(form.capacity),
        registration_required: Boolean(form.registrationRequired),
        grading_mode: form.gradingMode || 'attendance_only',
        max_raw_score: toNullableNumber(form.maxRawScore) ?? 100,
        pass_threshold: toNullableNumber(form.passThreshold),
        late_at: buildLateAt(form),
        late_grace_minutes: form.latePolicyEnabled ? (toNullableUint(form.lateGraceMinutes) ?? 0) : 0,
        late_penalty_factor: toNullableNumber(form.latePenaltyFactor) ?? 1,
        require_checkout: Boolean(form.requireCheckout),
        min_attendance_minutes: toNullableUint(form.minAttendanceMinutes),
    };
}

function assignmentsPayload(assignments) {
    return {
        assignments: assignments.map(item => ({
            user_id: Number(item.userId) || 0,
            assignment_role: item.assignmentRole || 'lecturer',
            can_record_attendance: Boolean(item.canRecordAttendance),
            can_grade: Boolean(item.canGrade),
            can_finalize: Boolean(item.canFinalize),
            note: toNullableString(item.note),
        })),
    };
}

function competenciesPayload(competencies) {
    return {
        competencies: competencies.map(item => ({
            competency_id: Number(item.competencyId) || 0,
            max_percent: Number(item.maxPercent) || 0,
        })),
    };
}

export async function fetchActivitySessions(activityId) {
    const response = await apiFetch(`/api/v1/activities/${activityId}/sessions`);
    return unwrapData(response, []).map(mapActivitySession);
}

export async function createActivitySession(activityId, form) {
    const response = await apiFetch(`/api/v1/activities/${activityId}/sessions`, {
        method: 'POST',
        body: JSON.stringify(sessionPayload(form)),
    });
    return mapActivitySession(unwrapData(response, null));
}

export async function fetchActivitySession(sessionId) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}`);
    return mapActivitySession(unwrapData(response, null));
}

export async function updateActivitySession(sessionId, form) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(sessionPayload(form)),
    });
    return mapActivitySession(unwrapData(response, null));
}

export async function updateActivitySessionStatus(sessionId, status) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
    return mapActivitySession(unwrapData(response, null));
}

export async function finalizeActivitySession(sessionId) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}/finalize`, {
        method: 'PATCH',
        body: JSON.stringify({}),
    });
    return mapActivitySession(unwrapData(response, null));
}

export async function deleteActivitySession(sessionId) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
    });
    return unwrapData(response, null);
}

export async function replaceSessionAssignments(sessionId, assignments) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}/assignments`, {
        method: 'PUT',
        body: JSON.stringify(assignmentsPayload(assignments)),
    });
    return unwrapData(response, []).map(mapSessionAssignment);
}

export async function replaceSessionCompetencies(sessionId, competencies) {
    const response = await apiFetch(`/api/v1/sessions/${sessionId}/competencies`, {
        method: 'PUT',
        body: JSON.stringify(competenciesPayload(competencies)),
    });
    return unwrapData(response, []).map(mapSessionCompetency);
}

export async function fetchSessionAssigneeOptions(activityId) {
    const response = await apiFetch(`/api/v1/activities/${activityId}/session-assignee-options`);
    return unwrapData(response, []).map(mapAssigneeOption);
}
