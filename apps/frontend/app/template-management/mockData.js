// ============================================================
// mockData.js — ลบออกเมื่อต่อ API จริง
// ============================================================

export const MOCK_TEMPLATES = [
    { id: 1, name: 'หลักสูตรวิทยาการคอมพิวเตอร์ 2568', year: 2568, courseCount: 42 },
    { id: 2, name: 'หลักสูตรวิศวกรรมซอฟต์แวร์ 2568',   year: 2568, courseCount: 38 },
];

export const MOCK_COMPETENCIES = [
    { id: 1, code: 'tst_comm',  name: 'การสื่อสาร',       color: '#ec4899' },
    { id: 2, code: 'tst_ct',    name: 'คิดเชิงวิพากษ์',   color: '#3b82f6' },
    { id: 3, code: 'tst_team',  name: 'ทำงานเป็นทีม',     color: '#06b6d4' },
    { id: 4, code: 'tst_lead',  name: 'ภาวะผู้นำ',        color: '#f59e0b' },
    { id: 5, code: 'tst_ethic', name: 'คุณธรรมจริยธรรม',  color: '#10b981' },
    { id: 6, code: 'tst_digi',  name: 'ทักษะดิจิทัล',     color: '#8b5cf6' },
];

export const MOCK_CATEGORIES = [
    {
        id: 1, code: '1', name: 'หมวดวิชาศึกษาทั่วไป', requiredCredits: 30,
        children: [
            { id: 11, code: '1.1', name: 'กลุ่มวิชาภาษา', requiredCredits: 9, children: [] },
            { id: 12, code: '1.2', name: 'กลุ่มวิชามนุษยศาสตร์และสังคมศาสตร์', requiredCredits: 9, children: [] },
            { id: 13, code: '1.3', name: 'กลุ่มวิชาคณิตศาสตร์และวิทยาศาสตร์', requiredCredits: 12, children: [] },
        ],
    },
    {
        id: 2, code: '2', name: 'หมวดวิชาเฉพาะ', requiredCredits: 96,
        children: [
            {
                id: 21, code: '2.1', name: 'หมวดวิชาพื้นฐานหรือวิชาแกน', requiredCredits: 36,
                children: [
                    { id: 211, code: '2.1.1', name: 'กลุ่มวิชาบังคับพื้นฐานวิชาชีพ', requiredCredits: 30, children: [] },
                    { id: 212, code: '2.1.2', name: 'กลุ่มวิชาบังคับสัมมนาและฝึกงาน', requiredCredits: 6,  children: [] },
                ],
            },
            {
                id: 22, code: '2.2', name: 'หมวดวิชาเฉพาะด้าน', requiredCredits: 42,
                children: [
                    { id: 221, code: '2.2.1', name: 'กลุ่มวิชาประเด็นด้านองค์การและระบบสารสนเทศ',    requiredCredits: 9, children: [] },
                    { id: 222, code: '2.2.2', name: 'กลุ่มวิชาเทคโนโลยีเพื่องานประยุกต์',            requiredCredits: 9, children: [] },
                    { id: 223, code: '2.2.3', name: 'กลุ่มวิชาเทคโนโลยีและวิธีการทางซอฟต์แวร์',      requiredCredits: 9, children: [] },
                ],
            },
            {
                id: 23, code: '2.3', name: 'หมวดวิชาเลือกสาขา', requiredCredits: 18,
                children: [
                    {
                        id: 231, code: '2.3.1', name: 'กลุ่มวิชาทางวิทยาการคอมพิวเตอร์', requiredCredits: 12,
                        children: [
                            { id: 2311, code: '2.3.1.1', name: 'กลุ่มย่อย ปัญญาประดิษฐ์และวิทยาการข้อมูล',    requiredCredits: 4, children: [] },
                            { id: 2312, code: '2.3.1.2', name: 'กลุ่มย่อย การพัฒนาสื่อผสมและโปรแกรมประยุกต์', requiredCredits: 4, children: [] },
                            { id: 2313, code: '2.3.1.3', name: 'กลุ่มย่อย ระบบและเครือข่ายอัจฉริยะ',         requiredCredits: 4, children: [] },
                        ],
                    },
                    { id: 232, code: '2.3.2', name: 'กลุ่มวิชาสังคมศาสตร์และการจัดการ', requiredCredits: 6, children: [] },
                ],
            },
        ],
    },
    { id: 3, code: '3', name: 'หมวดวิชาเลือกเสรี', requiredCredits: 6, children: [] },
];