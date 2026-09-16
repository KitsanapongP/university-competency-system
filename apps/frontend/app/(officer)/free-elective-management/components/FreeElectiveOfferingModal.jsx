import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';

function createInitialForm(defaultCourseId) {
    return {
        freeElectiveCourseId: defaultCourseId || '',
        academicYearBE: '',
        semester: '1',
        sectionNo: '01',
        capacity: '',
    };
}

export default function FreeElectiveOfferingModal({
    open,
    courses,
    language,
    labels,
    saving,
    onClose,
    onSubmit,
}) {
    const [form, setForm] = useState(createInitialForm());

    const setField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        await onSubmit(form);
    };

    return (
        <BaseModal
            open={open}
            title={labels.offeringFormTitle}
            icon={<CalendarPlus size={18} />}
            size="md"
            onClose={onClose}
            closeDisabled={saving}
        >
            <form className="free-elective-form" onSubmit={handleSubmit}>
                <label className="free-elective-field">
                    <span>{labels.course} *</span>
                    <select
                        value={form.freeElectiveCourseId}
                        onChange={(event) => setField('freeElectiveCourseId', event.target.value)}
                        disabled={saving}
                        required
                    >
                        <option value="">{labels.selectCourse}</option>
                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.code} ·{' '}
                                {language === 'en' ? course.nameEn || course.nameTh : course.nameTh}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="free-elective-form-grid">
                    <label className="free-elective-field">
                        <span>{labels.academicYear} *</span>
                        <input
                            type="number"
                            min="2400"
                            value={form.academicYearBE}
                            onChange={(event) => setField('academicYearBE', event.target.value)}
                            placeholder={labels.yearPlaceholder}
                            disabled={saving}
                            required
                        />
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.semester} *</span>
                        <select
                            value={form.semester}
                            onChange={(event) => setField('semester', event.target.value)}
                            disabled={saving}
                            required
                        >
                            <option value="1">{labels.semesterOne}</option>
                            <option value="2">{labels.semesterTwo}</option>
                            <option value="3">{labels.semesterThree}</option>
                        </select>
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.section} *</span>
                        <input
                            value={form.sectionNo}
                            onChange={(event) => setField('sectionNo', event.target.value)}
                            disabled={saving}
                            required
                        />
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.capacity}</span>
                        <input
                            type="number"
                            min="0"
                            value={form.capacity}
                            onChange={(event) => setField('capacity', event.target.value)}
                            placeholder={labels.unlimited}
                            disabled={saving}
                        />
                    </label>
                </div>
                <div className="free-elective-modal-actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </button>
                    <button
                        type="submit"
                        className="free-elective-button free-elective-button--primary"
                        disabled={saving || !courses.length}
                    >
                        {saving ? labels.loading : labels.create}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}
