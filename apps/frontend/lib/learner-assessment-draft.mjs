const descriptions = {
    malformed_json: ['ข้อมูล JSON ไม่สมบูรณ์หรืออ่านไม่ได้', 'The JSON is incomplete or unreadable.'],
    invalid_json_structure: ['โครงสร้างผลลัพธ์ไม่ตรงกับรูปแบบที่กำหนด', 'The output structure does not match the required format.'],
    unknown_field: ['มีช่องข้อมูลที่ระบบไม่อนุญาต', 'The output includes an unsupported field.'],
    paragraphs_missing: ['ขาดหมวดความเรียงที่กำหนด', 'A required narrative section is missing.'],
    paragraph_count_exceeded: ['จำนวนย่อหน้าเกินที่กำหนด', 'The paragraph limit was exceeded.'],
    sentence_count_invalid: ['จำนวนประโยคไม่อยู่ในช่วงที่กำหนด', 'The sentence count is outside the permitted range.'],
    observation_unknown: ['อ้างอิงข้อสังเกตที่ไม่มีในหลักฐาน', 'The referenced observation is not in the evidence.'],
    observation_section_mismatch: ['ใช้หลักฐานไม่ตรงกับหมวดความเรียง', 'The evidence does not support this narrative section.'],
    bilingual_text_missing: ['ข้อความภาษาไทยหรือภาษาอังกฤษไม่ครบ', 'Thai or English text is missing.'],
    text_too_long: ['ข้อความยาวเกินขีดจำกัด', 'The text exceeds the length limit.'],
    pii_detected: ['พบข้อมูลส่วนบุคคล จึงไม่แสดงเนื้อหาร่าง', 'Personal data was detected; the draft content is hidden.'],
    duplicate_sentence: ['มีประโยคซ้ำในผลลัพธ์', 'A sentence is repeated in the output.'],
    unsupported_claim: ['มีข้อความที่ผิดข้อกำหนดของรายงาน', 'A statement violates the report requirements.'],
    readiness_contradiction: ['ข้อความขัดกับผลตรวจความพร้อมจากระบบ', 'The text contradicts the system readiness result.'],
    advice_not_suggestion: ['คำแนะนำไม่ได้เขียนในรูปแบบข้อเสนอแนะ', 'The advice is not phrased as a suggestion.'],
    advice_missing: ['หมวดแนวทางพัฒนาขาดคำแนะนำ', 'The development section has no advice.'],
    unknown_section: ['มีหมวดความเรียงที่ไม่รองรับ', 'The narrative section is unsupported.'],
    invalid_intent: ['ประเภทประโยคไม่ถูกต้อง', 'The sentence intent is invalid.'],
    output_empty: ['ไม่มีผลลัพธ์จากโมเดล', 'The model returned no output.'],
    output_too_large: ['ผลลัพธ์มีขนาดเกินที่กำหนด', 'The output exceeds the size limit.'],
};

const rules = {
    numeric_literal: ['มีตัวเลขในความเรียง ซึ่งระบบแสดงค่าจริงแยกไว้แล้ว', 'The prose contains digits; exact values are shown separately.'],
    grade_literal: ['มีตัวอักษรเกรดในความเรียง ซึ่งระบบแสดงเกรดแยกไว้แล้ว', 'The prose contains literal grades; grades are shown separately.'],
    placement_approval: ['มีข้อความอนุมัติสิทธิ์ ซึ่งไม่ใช่หน้าที่ของรายงานนี้', 'The prose implies placement approval, outside the report scope.'],
    career_content: ['มีคำแนะนำสายงาน ซึ่งไม่อยู่ในขอบเขตรายงานรุ่นนี้', 'Career recommendations are outside this report version.'],
    prose_markup: ['มีรูปแบบ Markdown หรือ HTML ที่ไม่อนุญาต', 'The prose includes disallowed Markdown or HTML.'],
};

export function assessmentDraftReason(violation, language) {
    const index = language === 'en' ? 1 : 0;
    return (rules[violation?.rule] || descriptions[violation?.reason]
        || ['ผลลัพธ์ไม่ผ่านการตรวจสอบ โปรดดูรหัสเหตุผลด้านล่าง', 'Validation failed; see the reason code below.'])[index];
}

export function assessmentDraftPreview(draft) {
    if (!draft || draft.is_stale || draft.violation?.reason === 'pii_detected') return '';
    return typeof draft.preview === 'string' ? Array.from(draft.preview).slice(0, 8000).join('') : '';
}
