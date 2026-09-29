export function officerText(language, thai, english) {
    return language === 'en' ? english : thai;
}

const DEGREE_LABELS = {
    bachelor: ['ปริญญาตรี', "Bachelor's degree"],
    master: ['ปริญญาโท', "Master's degree"],
    phd: ['ปริญญาเอก', 'Doctoral degree'],
    other: ['อื่น ๆ', 'Other'],
};

const ACTIVITY_STATUS_LABELS = {
    draft: ['ฉบับร่าง', 'Draft'],
    published: ['เผยแพร่แล้ว', 'Published'],
    closed: ['ปิดแล้ว', 'Closed'],
    cancelled: ['ยกเลิกแล้ว', 'Cancelled'],
};

export function officerDegreeLabel(language, value) {
    const [thai, english] = DEGREE_LABELS[value] || [value || '-', value || '-'];
    return officerText(language, thai, english);
}

export function officerActivityStatusLabel(language, value) {
    const [thai, english] = ACTIVITY_STATUS_LABELS[value] || [value || '-', value || '-'];
    return officerText(language, thai, english);
}
