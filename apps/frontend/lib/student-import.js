import * as XLSX from 'xlsx';

const COLUMN_ALIASES = {
    studentCode: ['student_code', 'student code', 'รหัสนักศึกษา'],
    prefixTh: ['prefix_th', 'prefix', 'คำนำหน้า'],
    firstNameTh: ['first_name_th', 'first name th', 'ชื่อภาษาไทย', 'ชื่อ'],
    lastNameTh: ['last_name_th', 'last name th', 'นามสกุลภาษาไทย', 'นามสกุล'],
    firstNameEn: ['first_name_en', 'first name en', 'ชื่อภาษาอังกฤษ'],
    lastNameEn: ['last_name_en', 'last name en', 'นามสกุลภาษาอังกฤษ'],
    email: ['email', 'อีเมล'],
    phone: ['phone', 'โทรศัพท์', 'เบอร์โทร'],
    enrollmentStatus: ['enrollment_status', 'status', 'สถานะ'],
};

function normalizeHeader(value) { return String(value ?? '').trim().toLowerCase(); }

function valueFor(row, aliases) {
    const source = Object.entries(row || {}).find(([key]) => aliases.includes(normalizeHeader(key)));
    return source ? String(source[1] ?? '').trim() : '';
}

export async function parseStudentImportFile(file) {
    if (!file) throw new Error('กรุณาเลือกไฟล์');
    if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension)) throw new Error('รองรับเฉพาะไฟล์ CSV, XLSX หรือ XLS');

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    if (!rawRows.length) throw new Error('ไม่พบข้อมูลใน Sheet 1');
    if (rawRows.length > 1000) throw new Error('นำเข้าได้ไม่เกิน 1,000 รายการต่อครั้ง');

    return rawRows.map((row, index) => ({
        rowNumber: index + 2,
        studentCode: valueFor(row, COLUMN_ALIASES.studentCode),
        prefixTh: valueFor(row, COLUMN_ALIASES.prefixTh),
        firstNameTh: valueFor(row, COLUMN_ALIASES.firstNameTh),
        lastNameTh: valueFor(row, COLUMN_ALIASES.lastNameTh),
        firstNameEn: valueFor(row, COLUMN_ALIASES.firstNameEn),
        lastNameEn: valueFor(row, COLUMN_ALIASES.lastNameEn),
        email: valueFor(row, COLUMN_ALIASES.email),
        phone: valueFor(row, COLUMN_ALIASES.phone),
        enrollmentStatus: valueFor(row, COLUMN_ALIASES.enrollmentStatus) || 'student',
        applyUpdate: false,
    }));
}

export function downloadStudentImportTemplate() {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([{
        student_code: '663040000-1', prefix_th: 'นาย', first_name_th: 'ตัวอย่าง', last_name_th: 'นักศึกษา',
        first_name_en: 'Example', last_name_en: 'Student', email: 'example@kku.ac.th', phone: '0810000000', enrollment_status: 'student',
    }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'student-roster-import-template.xlsx');
}
