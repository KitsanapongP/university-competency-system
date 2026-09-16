import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import BaseModal from '../../../../components/ui/BaseModal';
import { getFreeElectiveGradeOptions } from '../../../../lib/free-elective';

function readImportRows(file) {
    return file.arrayBuffer().then((buffer) => {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        return records.map((record, index) => ({
            rowNumber: index + 2,
            studentCode: record.student_code ?? record.studentCode ?? '',
            grade: record.grade ?? '',
        }));
    });
}

function ImportCount({ label, count, tone = '' }) {
    return (
        <div className={`free-elective-import-count ${tone}`}>
            <span>{label}</span>
            <strong>{count}</strong>
        </div>
    );
}

export default function FreeElectiveGradeImportModal({
    open,
    gradeScheme,
    labels,
    saving,
    preview,
    onPreview,
    onCommit,
    onClearPreview = () => {},
    onClose,
}) {
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState([]);
    const [replaceExisting, setReplaceExisting] = useState(false);
    const gradeOptions = getFreeElectiveGradeOptions(gradeScheme);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const nextRows = await readImportRows(file);
            setFileName(file.name);
            setRows(nextRows);
            onClearPreview();
        } catch {
            setRows([]);
            setFileName('');
            onClearPreview();
        }
    };

    const handlePreview = () => {
        if (rows.length) {
            onPreview(rows, replaceExisting);
        }
    };

    const handleCommit = () => {
        const canReplaceExisting = preview?.existingRows.length === 0 || replaceExisting;
        if (
            rows.length
            && preview
            && preview.invalidRows.length === 0
            && preview.duplicateRows.length === 0
            && canReplaceExisting
        ) {
            onCommit(rows, replaceExisting);
        }
    };

    const reset = () => {
        setFileName('');
        setRows([]);
        setReplaceExisting(false);
    };

    const close = () => {
        if (!saving) {
            reset();
            onClose();
        }
    };

    return (
        <BaseModal
            open={open}
            title={labels.importTitle}
            icon={<FileSpreadsheet size={18} />}
            size="lg"
            onClose={close}
            closeDisabled={saving}
        >
            <div className="free-elective-import">
                <p className="free-elective-import__instruction">{labels.importInstruction}</p>
                <div className="free-elective-import__file-row">
                    <label className="free-elective-file-input">
                        <Upload size={16} aria-hidden="true" />
                        <span>{labels.chooseFile}</span>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFile}
                            disabled={saving}
                        />
                    </label>
                    <span className="free-elective-file-name">{fileName || labels.importNoFile}</span>
                </div>
                <div className="free-elective-import__scheme">
                    {labels.gradeScheme}:{' '}
                    <strong>
                        {gradeScheme === 'satisfactory'
                            ? labels.satisfactoryGrades
                            : labels.letterGrades}
                    </strong>
                    <span>{gradeOptions.join(', ')}</span>
                </div>
                <label className="free-elective-checkbox">
                    <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(event) => {
                            setReplaceExisting(event.target.checked);
                            onClearPreview();
                        }}
                        disabled={saving}
                    />
                    <span>{labels.replaceExisting}</span>
                </label>
                {preview && (
                    <div className="free-elective-import-summary">
                        <ImportCount
                            label={labels.importValid}
                            count={preview.validRows.length}
                            tone="free-elective-import-count--good"
                        />
                        <ImportCount
                            label={labels.importExisting}
                            count={preview.existingRows.length}
                            tone="free-elective-import-count--attention"
                        />
                        <ImportCount
                            label={labels.importInvalid}
                            count={preview.invalidRows.length}
                            tone="free-elective-import-count--bad"
                        />
                        <ImportCount
                            label={labels.importDuplicate}
                            count={preview.duplicateRows.length}
                            tone="free-elective-import-count--bad"
                        />
                    </div>
                )}
                {preview && (preview.invalidRows.length > 0 || preview.duplicateRows.length > 0) && (
                    <div className="free-elective-import-errors">
                        {[...preview.invalidRows, ...preview.duplicateRows].map((issue) => (
                            <p key={`${issue.rowNumber}-${issue.studentCode}-${issue.message}`}>
                                {labels.importRow} {issue.rowNumber}: {issue.studentCode || '-'} · {issue.message}
                            </p>
                        ))}
                    </div>
                )}
                {preview?.existingRows.length > 0 && !replaceExisting && (
                    <p className="free-elective-import__warning" role="alert">
                        {labels.importReplaceRequired}
                    </p>
                )}
                <div className="free-elective-modal-actions">
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={close}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--secondary"
                        onClick={handlePreview}
                        disabled={saving || !rows.length}
                    >
                        {labels.previewImport}
                    </button>
                    <button
                        type="button"
                        className="free-elective-button free-elective-button--primary"
                        onClick={handleCommit}
                        disabled={
                            saving
                            || !preview
                            || preview.invalidRows.length > 0
                            || preview.duplicateRows.length > 0
                            || (!preview.validRows.length && !preview.existingRows.length)
                            || (preview.existingRows.length > 0 && !replaceExisting)
                        }
                    >
                        {saving ? labels.loading : labels.commitImport}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
