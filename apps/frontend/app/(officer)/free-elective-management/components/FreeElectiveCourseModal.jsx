import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import BaseModal from '../../../../components/ui/BaseModal';
import { FREE_ELECTIVE_GRADE_SCHEMES } from '../../../../lib/free-elective';

function createInitialForm(course, defaultFacultyId) {
    return {
        facultyId: course?.facultyId || defaultFacultyId || '',
        code: course?.code || '',
        nameTh: course?.nameTh || '',
        nameEn: course?.nameEn || '',
        description: course?.description || '',
        credits: course?.credits || 3,
        gradeScheme: course?.gradeScheme || '',
        isActive: course?.isActive ?? true,
    };
}

export default function FreeElectiveCourseModal({
    open,
    course,
    faculties,
    defaultFacultyId,
    language,
    labels,
    saving,
    onClose,
    onSubmit,
}) {
    const [form, setForm] = useState(createInitialForm(course, defaultFacultyId));

    const setField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        await onSubmit(form);
    };

    const isEdit = Boolean(course);

    return (
        <BaseModal
            open={open}
            title={isEdit ? labels.courseEditTitle : labels.courseFormTitle}
            icon={<BookOpen size={18} />}
            size="lg"
            onClose={onClose}
            closeDisabled={saving}
        >
            <form className="free-elective-form" onSubmit={handleSubmit}>
                <div className="free-elective-form-grid">
                    <label className="free-elective-field">
                        <span>{labels.faculty} *</span>
                        <select
                            value={form.facultyId}
                            onChange={(event) => setField('facultyId', event.target.value)}
                            disabled={!faculties.length || saving}
                            required
                        >
                            <option value="">{labels.selectFaculty}</option>
                            {faculties.map((faculty) => (
                                <option key={faculty.facultyId} value={faculty.facultyId}>
                                    {language === 'en' ? faculty.nameEn || faculty.nameTh : faculty.nameTh}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.code} *</span>
                        <input
                            value={form.code}
                            onChange={(event) => setField('code', event.target.value)}
                            placeholder={labels.codePlaceholder}
                            disabled={saving}
                            required
                        />
                    </label>
                    <label className="free-elective-field">
                        <span>
                            {labels.courseName} ({labels.thaiLanguage}) *
                        </span>
                        <input
                            value={form.nameTh}
                            onChange={(event) => setField('nameTh', event.target.value)}
                            disabled={saving}
                            required
                        />
                    </label>
                    <label className="free-elective-field">
                        <span>
                            {labels.courseName} ({labels.englishLanguage})
                        </span>
                        <input
                            value={form.nameEn}
                            onChange={(event) => setField('nameEn', event.target.value)}
                            disabled={saving}
                        />
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.credits} *</span>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={form.credits}
                            onChange={(event) => setField('credits', event.target.value)}
                            disabled={saving}
                            required
                        />
                    </label>
                    <label className="free-elective-field">
                        <span>{labels.gradeScheme} *</span>
                        <select
                            value={form.gradeScheme}
                            onChange={(event) => setField('gradeScheme', event.target.value)}
                            disabled={saving}
                            required
                        >
                            <option value="">{labels.selectGradeScheme}</option>
                            {FREE_ELECTIVE_GRADE_SCHEMES.map((scheme) => (
                                <option key={scheme.value} value={scheme.value}>
                                    {language === 'en' ? scheme.labelEn : scheme.labelTh}
                                </option>
                            ))}
                        </select>
                        <small className="free-elective-field__hint">
                            {labels.gradeSchemeHint}: {form.gradeScheme === 'satisfactory'
                                ? labels.satisfactoryGradesHint
                                : labels.letterGradesHint}
                        </small>
                    </label>
                </div>
                <label className="free-elective-field">
                    <span>{labels.description}</span>
                    <textarea
                        value={form.description}
                        onChange={(event) => setField('description', event.target.value)}
                        rows="3"
                        disabled={saving}
                    />
                </label>
                <label className="free-elective-checkbox">
                    <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) => setField('isActive', event.target.checked)}
                        disabled={saving}
                    />
                    <span>{form.isActive ? labels.activeCourse : labels.inactiveCourse}</span>
                </label>
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
                        disabled={saving}
                    >
                        {saving ? labels.loading : isEdit ? labels.update : labels.create}
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}
