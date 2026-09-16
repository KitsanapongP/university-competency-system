import { AlertCircle, CheckCircle2, ClipboardCheck } from 'lucide-react';

function ReadinessRow({ ready, title, detail, labels }) {
    return (
        <div className="free-elective-readiness-row">
            <span
                className={`free-elective-readiness-icon ${ready
                    ? 'free-elective-readiness-icon--ready'
                    : 'free-elective-readiness-icon--waiting'}`}
            >
                {ready ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                ) : (
                    <AlertCircle size={16} aria-hidden="true" />
                )}
            </span>
            <div>
                <strong>{title}</strong>
                <small>{detail}</small>
            </div>
            <span
                className={ready
                    ? 'free-elective-readiness-state--ready'
                    : 'free-elective-readiness-state--waiting'}
            >
                {ready ? labels.ready : labels.notReady}
            </span>
        </div>
    );
}

export default function FreeElectiveReadinessPanel({ readiness, language, labels }) {
    const messages = language === 'en' ? readiness.messagesEn : readiness.messagesTh;

    return (
        <section className="free-elective-panel">
            <div className="free-elective-panel__heading">
                <div>
                    <p className="free-elective-eyebrow">
                        <ClipboardCheck size={15} aria-hidden="true" />
                        {labels.readiness}
                    </p>
                    <p>{labels.readinessMessage}</p>
                </div>
                <span
                    className={`free-elective-readiness-badge ${readiness.ready
                        ? 'free-elective-readiness-badge--ready'
                        : 'free-elective-readiness-badge--waiting'}`}
                >
                    {readiness.ready ? labels.ready : labels.notReady}
                </span>
            </div>
            <div className="free-elective-readiness-list">
                <ReadinessRow
                    ready={readiness.competencyMapped}
                    title={readiness.competencyMapped ? labels.mapped : labels.notMapped}
                    detail={labels.competencyMapping}
                    labels={labels}
                />
                <ReadinessRow
                    ready={readiness.weightsValid}
                    title={readiness.weightsValid ? labels.validWeights : labels.invalidWeights}
                    detail={labels.mappingWeight}
                    labels={labels}
                />
                <ReadinessRow
                    ready={readiness.studentsAdded}
                    title={readiness.studentsAdded ? labels.studentsAdded : labels.noEnrolledLearners}
                    detail={labels.learnerList}
                    labels={labels}
                />
                <ReadinessRow
                    ready={readiness.gradesComplete}
                    title={readiness.gradesComplete ? labels.gradesComplete : labels.noGradesForFinalize}
                    detail={labels.grade}
                    labels={labels}
                />
            </div>
            {messages.length > 0 && (
                <ul className="free-elective-readiness-messages">
                    {messages.map((message) => (
                        <li key={message}>
                            {message}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
