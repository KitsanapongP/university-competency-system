import {
    Brain, Monitor, Crown, Scale, MessageCircle,
    Users, Lightbulb, Wrench
} from 'lucide-react';

export const COMPETENCIES = [
    { id: 'critical', name: 'Critical Thinking', icon: Brain, color: '#3b82f6' },
    { id: 'digital', name: 'Digital Literacy', icon: Monitor, color: '#8b5cf6' },
    { id: 'leadership', name: 'Leadership', icon: Crown, color: '#f59e0b' },
    { id: 'ethics', name: 'Ethical Awareness', icon: Scale, color: '#10b981' },
    { id: 'communication', name: 'Communication', icon: MessageCircle, color: '#ec4899' },
    { id: 'collaboration', name: 'Collaboration', icon: Users, color: '#06b6d4' },
    { id: 'innovation', name: 'Innovation', icon: Lightbulb, color: '#f97316' },
    { id: 'problem', name: 'Problem Solving', icon: Wrench, color: '#6366f1' }
];

export const YEARS = ['2567', '2566', '2565', '2564'];

export const MONTHS = [
    { id: 'jan', label: 'มกราคม', short: 'ม.ค.' },
    { id: 'feb', label: 'กุมภาพันธ์', short: 'ก.พ.' },
    { id: 'mar', label: 'มีนาคม', short: 'มี.ค.' },
    { id: 'apr', label: 'เมษายน', short: 'เม.ย.' },
    { id: 'may', label: 'พฤษภาคม', short: 'พ.ค.' },
    { id: 'jun', label: 'มิถุนายน', short: 'มิ.ย.' },
    { id: 'jul', label: 'กรกฎาคม', short: 'ก.ค.' },
    { id: 'aug', label: 'สิงหาคม', short: 'ส.ค.' },
    { id: 'sep', label: 'กันยายน', short: 'ก.ย.' },
    { id: 'oct', label: 'ตุลาคม', short: 'ต.ค.' },
    { id: 'nov', label: 'พฤศจิกายน', short: 'พ.ย.' },
    { id: 'dec', label: 'ธันวาคม', short: 'ธ.ค.' }
];

export const CURRICULUM_REQUIREMENTS = {
    critical: 80, digital: 75, leadership: 85, ethics: 70,
    communication: 80, collaboration: 75, innovation: 75, problem: 80
};

// Activities data - extended for each competency
// status: 'completed' = ทำแล้วได้คะแนน, 'available' = สามารถไปทำได้
// year: ปีการศึกษาที่ทำกิจกรรม, month: เดือน (1-12)
export const ACTIVITIES_BY_COMPETENCY = {
    critical: [
        // 2567
        { id: 1, title: 'การประกวดนวัตกรรมเพื่อสังคม', date: '15 มี.ค. 2567', score: 25, type: 'Project', status: 'completed', year: '2567', month: 3 },
        { id: 2, title: 'Workshop Design Thinking', date: '20 ก.พ. 2567', score: 30, type: 'Workshop', status: 'completed', year: '2567', month: 2 },
        { id: 3, title: 'กิจกรรมวิเคราะห์ปัญหาสังคม', date: '5 ม.ค. 2567', score: 30, type: 'Activity', status: 'completed', year: '2567', month: 1 },
        { id: 18, title: 'อบรม Critical Thinking Skills', date: '15 เม.ย. 2567', score: 25, type: 'Training', status: 'available', year: '2567', month: 4 },
        // 2566
        { id: 28, title: 'อบรมการคิดเชิงวิพากษ์', date: '10 ก.พ. 2566', score: 40, type: 'Training', status: 'completed', year: '2566', month: 2 },
        { id: 29, title: 'แข่งขันตอบปัญหา', date: '5 มี.ค. 2566', score: 35, type: 'Competition', status: 'completed', year: '2566', month: 3 },
        // 2565
        { id: 30, title: 'ค่าย Creative Thinking', date: '20 ต.ค. 2565', score: 35, type: 'Camp', status: 'completed', year: '2565', month: 10 },
        { id: 31, title: 'Workshop วิเคราะห์ข้อมูล', date: '15 ม.ค. 2565', score: 30, type: 'Workshop', status: 'completed', year: '2565', month: 1 },
        // 2564
        { id: 32, title: 'กิจกรรมปฐมนิเทศ', date: '1 ส.ค. 2564', score: 30, type: 'Activity', status: 'completed', year: '2564', month: 8 },
        { id: 33, title: 'อบรมพื้นฐานการคิด', date: '10 ก.ย. 2564', score: 25, type: 'Training', status: 'completed', year: '2564', month: 9 }
    ],
    digital: [
        { id: 4, title: 'อบรม AI for Productivity', date: '10 มี.ค. 2567', score: 35, type: 'Training', status: 'completed', year: '2567', month: 3 },
        { id: 20, title: 'Workshop Python Programming', date: '20 เม.ย. 2567', score: 30, type: 'Workshop', status: 'available', year: '2567', month: 4 },
        { id: 5, title: 'สอบวัดระดับความรู้ดิจิทัล', date: '5 ธ.ค. 2566', score: 37, type: 'Exam', status: 'completed', year: '2566', month: 12 },
        { id: 34, title: 'อบรม Excel Advanced', date: '15 ก.พ. 2566', score: 31, type: 'Training', status: 'completed', year: '2566', month: 2 },
        { id: 35, title: 'Workshop Web Development', date: '10 มี.ค. 2565', score: 30, type: 'Workshop', status: 'completed', year: '2565', month: 3 },
        { id: 36, title: 'เรียนรู้ Computer Basics', date: '5 ก.ย. 2564', score: 28, type: 'Training', status: 'completed', year: '2564', month: 9 },
        { id: 37, title: 'อบรม MS Office', date: '20 ต.ค. 2564', score: 24, type: 'Training', status: 'completed', year: '2564', month: 10 }
    ],
    leadership: [
        { id: 6, title: 'ประธานชมรมอาสาพัฒนา', date: 'ตลอดปี 2567', score: 50, type: 'Role', status: 'completed', year: '2567', month: 1 },
        { id: 22, title: 'อบรม Leadership Development', date: '25 เม.ย. 2567', score: 30, type: 'Training', status: 'available', year: '2567', month: 4 },
        { id: 7, title: 'ค่ายผู้นำรุ่นเยาว์', date: '12 ต.ค. 2566', score: 40, type: 'Camp', status: 'completed', year: '2566', month: 10 },
        { id: 38, title: 'รองประธานชมรม', date: 'ตลอดปี 2566', score: 42, type: 'Role', status: 'completed', year: '2566', month: 1 },
        { id: 39, title: 'อบรมผู้นำนักศึกษา', date: '5 ก.พ. 2565', score: 35, type: 'Training', status: 'completed', year: '2565', month: 2 },
        { id: 40, title: 'กิจกรรมรับน้อง', date: '10 ส.ค. 2564', score: 30, type: 'Activity', status: 'completed', year: '2564', month: 8 }
    ],
    ethics: [
        { id: 8, title: 'อบรมจริยธรรมในการวิจัย', date: '8 ก.พ. 2567', score: 35, type: 'Training', status: 'completed', year: '2567', month: 2 },
        { id: 9, title: 'กิจกรรมจิตอาสา', date: '20 ม.ค. 2567', score: 30, type: 'Volunteer', status: 'completed', year: '2567', month: 1 },
        { id: 23, title: 'ค่ายอาสาพัฒนาชุมชน', date: '5 พ.ค. 2567', score: 40, type: 'Volunteer', status: 'available', year: '2567', month: 5 },
        { id: 41, title: 'บำเพ็ญประโยชน์', date: '15 มี.ค. 2566', score: 30, type: 'Volunteer', status: 'completed', year: '2566', month: 3 },
        { id: 42, title: 'อบรมจรรยาบรรณวิชาชีพ', date: '10 ก.พ. 2565', score: 28, type: 'Training', status: 'completed', year: '2565', month: 2 },
        { id: 43, title: 'จิตอาสาช่วยน้ำท่วม', date: '5 พ.ย. 2564', score: 25, type: 'Volunteer', status: 'completed', year: '2564', month: 11 }
    ],
    communication: [
        { id: 10, title: 'การนำเสนอโครงงาน', date: '25 มี.ค. 2567', score: 40, type: 'Presentation', status: 'completed', year: '2567', month: 3 },
        { id: 11, title: 'ประกวดสุนทรพจน์', date: '15 ก.พ. 2567', score: 40, type: 'Contest', status: 'completed', year: '2567', month: 2 },
        { id: 24, title: 'Workshop Public Speaking', date: '15 เม.ย. 2567', score: 25, type: 'Workshop', status: 'available', year: '2567', month: 4 },
        { id: 44, title: 'นำเสนอรายงานกลุ่ม', date: '20 มี.ค. 2566', score: 36, type: 'Presentation', status: 'completed', year: '2566', month: 3 },
        { id: 45, title: 'อบรมการพูดในที่สาธารณะ', date: '10 ก.พ. 2565', score: 33, type: 'Training', status: 'completed', year: '2565', month: 2 },
        { id: 46, title: 'นำเสนอตัวเอง', date: '15 ส.ค. 2564', score: 30, type: 'Presentation', status: 'completed', year: '2564', month: 8 }
    ],
    collaboration: [
        { id: 12, title: 'โปรเจกต์กลุ่มวิชาเอก', date: '1 มี.ค. 2567', score: 45, type: 'Project', status: 'completed', year: '2567', month: 3 },
        { id: 13, title: 'กีฬาสีคณะ', date: '10 ม.ค. 2567', score: 30, type: 'Sports', status: 'completed', year: '2567', month: 1 },
        { id: 25, title: 'ค่าย Team Building', date: '1 พ.ค. 2567', score: 35, type: 'Camp', status: 'available', year: '2567', month: 5 },
        { id: 47, title: 'โปรเจกต์ข้ามสาขา', date: '15 มี.ค. 2566', score: 38, type: 'Project', status: 'completed', year: '2566', month: 3 },
        { id: 48, title: 'กีฬาสี 2566', date: '20 ม.ค. 2566', score: 32, type: 'Sports', status: 'completed', year: '2566', month: 1 },
        { id: 49, title: 'ค่ายรับน้อง', date: '10 ส.ค. 2565', score: 30, type: 'Camp', status: 'completed', year: '2565', month: 8 },
        { id: 50, title: 'กิจกรรมกลุ่มสัมพันธ์', date: '5 ก.ย. 2564', score: 28, type: 'Activity', status: 'completed', year: '2564', month: 9 },
        { id: 51, title: 'กีฬาน้องใหม่', date: '20 ก.ย. 2564', score: 27, type: 'Sports', status: 'completed', year: '2564', month: 9 }
    ],
    innovation: [
        { id: 14, title: 'Hackathon 2567', date: '20 มี.ค. 2567', score: 40, type: 'Competition', status: 'completed', year: '2567', month: 3 },
        { id: 15, title: 'Startup Weekend', date: '5 ก.พ. 2567', score: 38, type: 'Event', status: 'completed', year: '2567', month: 2 },
        { id: 26, title: 'Smart Life Innovation Camp', date: '15 พ.ค. 2567', score: 50, type: 'Camp', status: 'available', year: '2567', month: 5 },
        { id: 52, title: 'Idea Contest 2566', date: '10 มี.ค. 2566', score: 35, type: 'Competition', status: 'completed', year: '2566', month: 3 },
        { id: 53, title: 'Workshop สร้างนวัตกรรม', date: '15 ก.พ. 2565', score: 33, type: 'Workshop', status: 'completed', year: '2565', month: 2 },
        { id: 54, title: 'อบรมความคิดสร้างสรรค์', date: '10 ต.ค. 2564', score: 30, type: 'Training', status: 'completed', year: '2564', month: 10 }
    ],
    problem: [
        { id: 16, title: 'แข่งขันแก้ปัญหา Case Study', date: '18 มี.ค. 2567', score: 42, type: 'Competition', status: 'completed', year: '2567', month: 3 },
        { id: 17, title: 'โปรเจกต์ปัญหาพิเศษ', date: 'ตลอดเทอม 2567', score: 40, type: 'Project', status: 'completed', year: '2567', month: 1 },
        { id: 27, title: 'Workshop Problem Solving', date: '20 เม.ย. 2567', score: 30, type: 'Workshop', status: 'available', year: '2567', month: 4 },
        { id: 55, title: 'แข่งขัน Business Case', date: '15 มี.ค. 2566', score: 38, type: 'Competition', status: 'completed', year: '2566', month: 3 },
        { id: 56, title: 'อบรมแก้ปัญหาเชิงระบบ', date: '10 ก.พ. 2565', score: 35, type: 'Training', status: 'completed', year: '2565', month: 2 },
        { id: 57, title: 'Workshop คิดเชิงวิเคราะห์', date: '20 ต.ค. 2564', score: 32, type: 'Workshop', status: 'completed', year: '2564', month: 10 }
    ]
};

// Calculate scores from actual activities (simple year filter - for backward compatibility)
export function getScoresByYear(year) {
    const scores = {};
    Object.keys(ACTIVITIES_BY_COMPETENCY).forEach(compId => {
        const activities = ACTIVITIES_BY_COMPETENCY[compId] || [];
        const yearActivities = activities.filter(a => a.status === 'completed' && a.year === year);
        scores[compId] = yearActivities.reduce((sum, a) => sum + a.score, 0);
    });
    return scores;
}

// Calculate scores with date range support (cumulative across years)
// Supports ranges like: Oct 2566 to Feb 2567
export function getScoresByDateRange(startYear, startMonth, endYear, endMonth) {
    const scores = {};

    // Convert to comparable numbers (year * 100 + month)
    const startValue = parseInt(startYear) * 100 + startMonth;
    const endValue = parseInt(endYear) * 100 + endMonth;

    Object.keys(ACTIVITIES_BY_COMPETENCY).forEach(compId => {
        const activities = ACTIVITIES_BY_COMPETENCY[compId] || [];
        const filtered = activities.filter(a => {
            if (a.status !== 'completed') return false;
            const actValue = parseInt(a.year) * 100 + a.month;
            return actValue >= startValue && actValue <= endValue;
        });
        scores[compId] = filtered.reduce((sum, a) => sum + a.score, 0);
    });
    return scores;
}
