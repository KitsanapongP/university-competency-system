import { Filter } from 'lucide-react';
import { freeElectiveText } from '../free-elective-labels';

const STATUS_OPTIONS = ['draft', 'active', 'finalized', 'cancelled'];

export default function FreeElectiveFilters({
    language,
    faculties,
    isAdmin,
    values,
    onChange,
}) {
    const label = (key) => freeElectiveText(language, key);

    return (
        <section className="free-elective-panel free-elective-filters" aria-labelledby="free-elective-filter-title">
            <div className="free-elective-panel__heading">
                <div>
                    <p
                        id="free-elective-filter-title"
                        className="free-elective-eyebrow"
                    >
                        <Filter size={15} aria-hidden="true" />
                        {label('filterTitle')}
                    </p>
                </div>
            </div>
            <div className="free-elective-filter-grid">
                {isAdmin && (
                    <label className="free-elective-field">
                        <span>{label('faculty')}</span>
                        <select
                            value={values.facultyId}
                            onChange={(event) => onChange('facultyId', event.target.value)}
                        >
                            <option value="">{label('allFaculties')}</option>
                            {faculties.map((faculty) => (
                                <option key={faculty.facultyId} value={faculty.facultyId}>
                                    {language === 'en' ? faculty.nameEn || faculty.nameTh : faculty.nameTh}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <label className="free-elective-field">
                    <span>{label('academicYear')}</span>
                    <select
                        value={values.academicYearBE}
                        onChange={(event) => onChange('academicYearBE', event.target.value)}
                    >
                        <option value="">{label('allYears')}</option>
                        {values.availableYears.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="free-elective-field">
                    <span>{label('semester')}</span>
                    <select
                        value={values.semester}
                        onChange={(event) => onChange('semester', event.target.value)}
                    >
                        <option value="">{label('allSemesters')}</option>
                        <option value="1">{label('semesterOne')}</option>
                        <option value="2">{label('semesterTwo')}</option>
                        <option value="3">{label('semesterThree')}</option>
                    </select>
                </label>
                <label className="free-elective-field">
                    <span>{label('status')}</span>
                    <select
                        value={values.status}
                        onChange={(event) => onChange('status', event.target.value)}
                    >
                        <option value="">{label('allStatuses')}</option>
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                {freeElectiveText(language, status)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </section>
    );
}
