// ============================================================
// mockData.js — ลบออกเมื่อต่อ API จริง
// ============================================================

export const MOCK_TEMPLATES = [
    { id: 1, name: 'หลักสูตรวิทยาการคอมพิวเตอร์ 2568', year: 2568, courseCount: 42 },
    { id: 2, name: 'หลักสูตรวิศวกรรมซอฟต์แวร์ 2568',   year: 2568, courseCount: 38 },
];

export const MOCK_COMPETENCIES = [
    { id: 1, code: 'tst_comm',  name: 'การสื่อสาร',       color: '#ec4899', fromMaster: true },
    { id: 2, code: 'tst_ct',    name: 'คิดเชิงวิพากษ์',   color: '#3b82f6', fromMaster: true },
    { id: 3, code: 'tst_team',  name: 'ทำงานเป็นทีม',     color: '#06b6d4', fromMaster: true },
    { id: 4, code: 'tst_lead',  name: 'ภาวะผู้นำ',        color: '#f59e0b', fromMaster: true },
    { id: 5, code: 'tst_ethic', name: 'คุณธรรมจริยธรรม',  color: '#10b981', fromMaster: true },
    { id: 6, code: 'tst_digi',  name: 'ทักษะดิจิทัล',     color: '#8b5cf6', fromMaster: true },
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
                    { id: 224, code: '2.2.4', name: 'กลุ่มวิชาโครงสร้างพื้นฐานระบบ',                 requiredCredits: 18, children: [] },
                    { id: 225, code: '2.2.5', name: 'กลุ่มวิชาฮาร์ดแวร์และสถาปัตยกรรมคอมพิวเตอร์',   requiredCredits: 3, children: [] },
                    { id: 226, code: '2.2.6', name: 'กลุ่มวิชาโครงงานหรือสหกิจศึกษา',                 requiredCredits: 6, children: [] },
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

// ============================================================
// MOCK_COURSE_MASTERS — หลักสูตรต้นแบบ (Course Master)
// ============================================================
export const MOCK_COURSE_MASTERS = [
    {
        id: 'cm_cs_2565',
        name: 'วิทยาการคอมพิวเตอร์',
        year: 2565,
        faculty: 'คณะวิทยาศาสตร์',
        categories: [
            {
                id: 'cm1', code: '1', name: 'หมวดวิชาศึกษาทั่วไป', requiredCredits: 30,
                children: [
                    {
                        id: 'cm11', code: '1.1', name: 'กลุ่มวิชาภาษา', requiredCredits: 9, children: [],
                        courses: [
                            { id: 'c001', code: 'LI101001', nameTh: 'ภาษาอังกฤษ 1', nameEn: 'ENGLISH I', credits: 3, fromMaster: true , isCoreCourse: true },
                            { id: 'c002', code: 'LI101002', nameTh: 'ภาษาอังกฤษ 2', nameEn: 'ENGLISH II', credits: 3, fromMaster: true , isCoreCourse: true },
                            { id: 'c003', code: 'LI102003', nameTh: 'ภาษาอังกฤษ 3', nameEn: 'ENGLISH III', credits: 3, fromMaster: true , isCoreCourse: true },
                            { id: 'c004', code: 'LI102004', nameTh: 'ภาษาอังกฤษ 4', nameEn: 'ENGLISH IV', credits: 3, fromMaster: true , isCoreCourse: true },
                        ],
                    },
                    {
                        id: 'cm12', code: '1.2', name: 'กลุ่มวิชามนุษยศาสตร์และสังคมศาสตร์', requiredCredits: 9, children: [],
                        courses: [
                            { id: 'c005', code: 'GE142145', nameTh: 'ภาวะผู้นำและการจัดการ', nameEn: 'LEADERSHIP AND MANAGEMENT', credits: 3, fromMaster: true , isCoreCourse: true},
                        ],
                    },
                    {
                        id: 'cm13', code: '1.3', name: 'กลุ่มวิชาคณิตศาสตร์และวิทยาศาสตร์', requiredCredits: 12, children: [],
                        courses: [
                            { id: 'c006', code: 'CP001001', nameTh: 'ABCD สำหรับทุกวิชาชีพ', nameEn: 'ABCD for All Professions', credits: 2, fromMaster: true , isCoreCourse: true},
                            { id: 'c007', code: 'GE321415', nameTh: 'ทักษะการเรียนรู้', nameEn: 'LEARNING SKILLS', credits: 2, fromMaster: true , isCoreCourse: true},
                            { id: 'c008', code: 'GE341511', nameTh: 'การคิดเชิงคำนวณและสถิติ', nameEn: 'Computational & Statistical Thinking', credits: 3, fromMaster: true , isCoreCourse: true},
                            { id: 'c009', code: 'GE362785', nameTh: 'การคิดสร้างสรรค์และแก้ปัญหา', nameEn: 'CREATIVE THINKING AND PROBLEM SOLVING', credits: 3, fromMaster: true , isCoreCourse: true},
                            { id: 'c010', code: 'GE363789', nameTh: 'ผู้ประกอบการสร้างสรรค์', nameEn: 'CREATIVE ENTREPRENEURS', credits: 2, fromMaster: true , isCoreCourse: true},
                        ],
                    },
                ],
            },
            {
                id: 'cm2', code: '2', name: 'หมวดวิชาเฉพาะ', requiredCredits: 96,
                children: [
                    {
                        id: 'cm21', code: '2.1', name: 'หมวดวิชาพื้นฐานหรือวิชาแกน', requiredCredits: 36,
                        children: [
                            {
                                id: 'cm211', code: '2.1.1', name: 'กลุ่มวิชาบังคับพื้นฐานวิชาชีพ', requiredCredits: 30, children: [],
                                courses: [
                                    { id: 'c011', code: 'SC002104', nameTh: 'วิทยาศาสตร์กายภาพ', nameEn: 'PHYSICAL SCIENCE', credits: 3, fromMaster: true , isCoreCourse: true},
                                    { id: 'c012', code: 'SC401201', nameTh: 'แคลคูลัส 1', nameEn: 'CALCULUS FOR PHYSICAL SCIENCE I', credits: 3, fromMaster: true , isCoreCourse: true},
                                    { id: 'c013', code: 'SC401202', nameTh: 'แคลคูลัส 2', nameEn: 'CALCULUS FOR PHYSICAL SCIENCE II', credits: 3, fromMaster: true , isCoreCourse: true},
                                    { id: 'c014', code: 'SC402101', nameTh: 'พีชคณิตเชิงเส้น', nameEn: 'LINEAR ALGEBRA I', credits: 3, fromMaster: true , isCoreCourse: true},
                                    { id: 'c015', code: 'SC402401', nameTh: 'คณิตศาสตร์ไม่ต่อเนื่อง', nameEn: 'DISCRETE MATHEMATICS AND APPLICATIONS', credits: 3, fromMaster: true , isCoreCourse: true},
                                    { id: 'c016', code: 'SC403602', nameTh: 'วิธีเชิงตัวเลข', nameEn: 'NUMERICAL METHODS FOR COMPUTER SCIENCE', credits: 3, fromMaster: true , isCoreCourse: true},
                                    { id: 'c017', code: 'SC602005', nameTh: 'ความน่าจะเป็นและสถิติ', nameEn: 'PROBABILITY AND STATISTICS', credits: 3, fromMaster: true , isCoreCourse: true},
                                ],
                            },
                            {
                                id: 'cm212', code: '2.1.2', name: 'กลุ่มวิชาบังคับสัมมนาและฝึกงาน', requiredCredits: 6, children: [],
                                courses: [
                                    { id: 'c018', code: 'CP353761', nameTh: 'สัมมนาวิทยาการคอมพิวเตอร์', nameEn: 'Seminar in Computer Science', credits: 1, fromMaster: true , isCoreCourse: true},
                                    { id: 'c019', code: 'CP353764', nameTh: 'ระเบียบวิธีวิจัย', nameEn: 'Research Methodology', credits: 2, fromMaster: true , isCoreCourse: true},
                                    { id: 'c020', code: 'CP353796', nameTh: 'การฝึกงาน', nameEn: 'Internship in Computer Science', credits: 3, fromMaster: true , isCoreCourse: true},
                                ],
                            },
                        ],
                    },
                    {
                        id: 'cm22', code: '2.2', name: 'หมวดวิชาเฉพาะด้าน', requiredCredits: 49,
                        children: [
                            {
                                id: 'cm221', code: '2.2.1', name: 'กลุ่มวิชาประเด็นด้านองค์การและระบบสารสนเทศ', requiredCredits: 6, children: [],
                                courses: [
                                    { id: 'c021', code: 'CP352003', nameTh: 'ระบบจัดการฐานข้อมูล', nameEn: 'Database Management System and Design', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c022', code: 'CP352004', nameTh: 'ปฏิบัติการระบบจัดการฐานข้อมูล', nameEn: 'Database Management System Lab', credits: 1, fromMaster: true, isCoreCourse: true },
                                ],
                            },
                            {
                                id: 'cm222', code: '2.2.2', name: 'กลุ่มวิชาเทคโนโลยีเพื่องานประยุกต์', requiredCredits: 6, children: [],
                                courses: [
                                    { id: 'c023', code: 'CP352002', nameTh: 'การออกแบบประสบการณ์ผู้ใช้', nameEn: 'User Experience Design', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c024', code: 'CP352005', nameTh: 'เครือข่ายคอมพิวเตอร์', nameEn: 'Computer Networks', credits: 3, fromMaster: true, isCoreCourse: true },
                                ],
                            },
                            {
                                id: 'cm223', code: '2.2.3', name: 'กลุ่มวิชาเทคโนโลยีและวิธีการทางซอฟต์แวร์', requiredCredits: 12, children: [],
                                courses: [
                                    { id: 'c025', code: 'CP351002', nameTh: 'ภาษาโปรแกรมเชิงโครงสร้าง', nameEn: 'Structure Programming Languages', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c026', code: 'CP351003', nameTh: 'การโปรแกรมเชิงวัตถุ', nameEn: 'Object Oriented Programming', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c027', code: 'CP353002', nameTh: 'หลักการออกแบบซอฟต์แวร์', nameEn: 'Principles of Software Design', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c028', code: 'CP353004', nameTh: 'วิศวกรรมซอฟต์แวร์', nameEn: 'Software Engineering', credits: 3, fromMaster: true, isCoreCourse: true },
                                ],
                            },
                            {
                                id: 'cm224', code: '2.2.4', name: 'กลุ่มวิชาโครงสร้างพื้นฐานระบบ', requiredCredits: 18, children: [],
                                courses: [
                                    { id: 'c029', code: 'CP351001', nameTh: 'พื้นฐานวิทยาการคอมพิวเตอร์', nameEn: 'Fundamental Computer Science', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c030', code: 'CP352001', nameTh: 'โครงสร้างข้อมูล', nameEn: 'Data Structure', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c031', code: 'CP352006', nameTh: 'การวิเคราะห์อัลกอริทึม', nameEn: 'Analysis of Algorithms', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c032', code: 'CP353001', nameTh: 'ระบบปฏิบัติการ', nameEn: 'Operating Systems', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c033', code: 'CP353003', nameTh: 'ปัญญาประดิษฐ์', nameEn: 'Artificial Intelligence', credits: 3, fromMaster: true, isCoreCourse: true },
                                    { id: 'c034', code: 'CP353005', nameTh: 'ทฤษฎีการคำนวณ', nameEn: 'Theory of Computation', credits: 3, fromMaster: true, isCoreCourse: true },
                                ],
                            },
                            {
                                id: 'cm225', code: '2.2.5', name: 'กลุ่มวิชาฮาร์ดแวร์และสถาปัตยกรรม', requiredCredits: 3, children: [],
                                courses: [
                                    { id: 'c035', code: 'CP351004', nameTh: 'สถาปัตยกรรมคอมพิวเตอร์', nameEn: 'Computer Architecture', credits: 3, fromMaster: true, isCoreCourse: true },
                                ],
                            },
                            {
                                id: 'cm226', code: '2.2.6', name: 'กลุ่มวิชาโครงงานหรือสหกิจศึกษา', requiredCredits: 6, children: [],
                                courses: [
                                    { id: 'c036', code: 'CP002001', nameTh: 'ปฐมนิเทศสหกิจ', nameEn: 'Orientation to Co-Operative Education', credits: 0, fromMaster: true ,isCoreCourse: false},
                                    { id: 'c037', code: 'CP354771', nameTh: 'โครงงานวิทยาการคอมพิวเตอร์ 1', nameEn: 'Computer Science Project I', credits: 2, fromMaster: true, isCoreCourse: false },
                                    { id: 'c038', code: 'CP354772', nameTh: 'โครงงานวิทยาการคอมพิวเตอร์ 2', nameEn: 'Computer Science Project II', credits: 2, fromMaster: true, isCoreCourse: false },
                                    { id: 'c039', code: 'CP354785', nameTh: 'สหกิจศึกษา', nameEn: 'Co-Operative Education', credits: 6, fromMaster: true, isCoreCourse: false },
                                ],
                            },
                        ],
                    },
                    {
                        id: 'cm23', code: '2.3', name: 'หมวดวิชาเลือกสาขา', requiredCredits: 12,
                        children: [
                            {
                                id: 'cm231', code: '2.3.1', name: 'กลุ่มวิชาทางวิทยาการคอมพิวเตอร์', requiredCredits: 12,
                                children: [
                                    {
                                        id: 'cm2311', code: '2.3.1.1', name: 'กลุ่มย่อย ปัญญาประดิษฐ์และวิทยาการข้อมูล', requiredCredits: 4, children: [],
                                        courses: [
                                            { id: 'c040', code: 'CP351101', nameTh: 'วิทยาศาสตร์เชิงคำนวณ', nameEn: 'Computational Science', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c041', code: 'CP352101', nameTh: 'วิทยาการข้อมูลเบื้องต้น', nameEn: 'Introduction to Data Science', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c042', code: 'CP352102', nameTh: 'การประมวลผลภาพ', nameEn: 'Digital Image Processing', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c043', code: 'CP353101', nameTh: 'วิศวกรรมข้อมูล', nameEn: 'Data Engineering', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c044', code: 'CP353102', nameTh: 'การเรียนรู้ของเครื่อง', nameEn: 'Introduction to Machine Learning', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c045', code: 'CP353108', nameTh: 'โครงข่ายประสาทและการเรียนรู้เชิงลึก', nameEn: 'Neural Network and Deep Learning', credits: 3, fromMaster: true , isCoreCourse: false },
                                        ],
                                    },
                                    {
                                        id: 'cm2312', code: '2.3.1.2', name: 'กลุ่มย่อย การพัฒนาสื่อผสมและโปรแกรมประยุกต์', requiredCredits: 4, children: [],
                                        courses: [
                                            { id: 'c046', code: 'CP351202', nameTh: 'การพัฒนาแอปมือถือเบื้องต้น', nameEn: 'Elements of Mobile Application Development', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c047', code: 'CP352201', nameTh: 'เทคโนโลยีการออกแบบเว็บ', nameEn: 'Web Design Technologies', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c048', code: 'CP352202', nameTh: 'การโปรแกรมสำหรับมือถือ', nameEn: 'Programming for Mobile Application', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c049', code: 'CP353204', nameTh: 'การพัฒนาเว็บแอปพลิเคชัน', nameEn: 'Web Application Development', credits: 3, fromMaster: true , isCoreCourse: false },
                                        ],
                                    },
                                    {
                                        id: 'cm2313', code: '2.3.1.3', name: 'กลุ่มย่อย ระบบและเครือข่ายอัจฉริยะ', requiredCredits: 4, children: [],
                                        courses: [
                                            { id: 'c050', code: 'CP352301', nameTh: 'การเขียนโปรแกรมสคริปต์', nameEn: 'Script Programming', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c051', code: 'CP353301', nameTh: 'อินเทอร์เน็ตเวิร์กกิง', nameEn: 'Internetworking', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c052', code: 'CP353302', nameTh: 'ความมั่นคงสารสนเทศ', nameEn: 'Information and Cyber Security', credits: 3, fromMaster: true , isCoreCourse: false },
                                            { id: 'c053', code: 'CP353305', nameTh: 'อินเทอร์เน็ตของสรรพสิ่ง', nameEn: 'Internet of Things', credits: 3, fromMaster: true , isCoreCourse: false },
                                        ],
                                    },
                                ],
                            },
                            {
                                id: 'cm232', code: '2.3.2', name: 'กลุ่มวิชาสังคมศาสตร์และการจัดการ', requiredCredits: 6, children: [],
                                courses: [
                                    { id: 'c054', code: 'BS952261', nameTh: 'หลักการจัดการ', nameEn: 'PRINCIPLES OF MANAGEMENT', credits: 3, fromMaster: true , isCoreCourse: false },
                                    { id: 'c055', code: 'LW011105', nameTh: 'ความรู้เบื้องต้นเกี่ยวกับกฎหมาย', nameEn: 'INTRODUCTION TO LAW', credits: 3, fromMaster: true , isCoreCourse: false },
                                    { id: 'c056', code: 'BS931111', nameTh: 'หลักการตลาด', nameEn: 'PRINCIPLE OF MARKETING', credits: 3, fromMaster: true , isCoreCourse: false },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                id: 'cm3', code: '3', name: 'หมวดวิชาเลือกเสรี', requiredCredits: 6,
                children: [],
                courses: [],
            },
        ],
    },
];