import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');

const requiredPages = [
    'app/(officer)/curriculum-management/page.jsx',
    'app/(officer)/curriculum-management/create/page.jsx',
    'app/(officer)/free-elective-management/page.jsx',
    'app/(officer)/free-elective-management/groups/page.jsx',
    'app/(officer)/free-elective-management/groups/[cohortId]/page.jsx',
    'app/(officer)/free-elective-management/rounds/[roundId]/courses/[roundCourseId]/page.jsx',
    'app/(officer)/free-elective-management/students/[enrollmentId]/page.jsx',
    'app/(officer)/student-management/page.jsx',
    'app/(officer)/student-management/[cohortId]/page.jsx',
    'app/(officer)/activity-management/page.jsx',
    'app/(officer)/activity-management/[activityId]/sessions/page.jsx',
    'app/(officer)/activity-sessions/[sessionId]/page.jsx',
    'app/(officer)/major-management/page.jsx',
    'app/(officer)/competency-management/page.jsx',
    'app/(officer)/template-assignments/page.jsx',
    'app/(officer)/template-management/page.jsx',
    'app/(officer)/my-activity-sessions/page.jsx',
];

const pagesWithStandardHeader = requiredPages.filter(
    relativePath => !relativePath.endsWith('curriculum-management/create/page.jsx'),
);

const sharedStylesPath = path.join(frontendDirectory, 'app/(officer)/OfficerDesign.css');
const tokenStylesPath = path.join(frontendDirectory, 'styles/UiTokens.css');
const primitiveStylesPath = path.join(frontendDirectory, 'app/(officer)/UiPrimitives.css');
const labelsPath = path.join(frontendDirectory, 'app/(officer)/officer-labels.js');
const failures = [];

function readFile(relativePath) {
    const absolutePath = path.join(frontendDirectory, relativePath);
    if (!fs.existsSync(absolutePath)) {
        failures.push(`${relativePath}: file does not exist`);
        return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
}

requiredPages.forEach(relativePath => {
    const content = readFile(relativePath);
    if (!content) return;
    if (!content.includes('officer-page')) {
        failures.push(`${relativePath}: missing officer-page root class`);
    }
    if (!content.includes('ui-page')) {
        failures.push(`${relativePath}: missing ui-page root class`);
    }
});

pagesWithStandardHeader.forEach(relativePath => {
    const content = readFile(relativePath);
    if (!content) return;
    if (!content.includes('officer-page__header')) {
        failures.push(`${relativePath}: missing officer-page__header class`);
    }
    if (!content.includes('ui-page__header')) {
        failures.push(`${relativePath}: missing ui-page__header class`);
    }
});

const sharedStyles = fs.existsSync(sharedStylesPath)
    ? fs.readFileSync(sharedStylesPath, 'utf8')
    : '';
if (!sharedStyles) {
    failures.push('app/(officer)/OfficerDesign.css: shared stylesheet does not exist');
} else {
    ['--officer-font', '--officer-primary', '--officer-surface', '@media'].forEach(token => {
        if (!sharedStyles.includes(token)) {
            failures.push(`OfficerDesign.css: missing ${token}`);
        }
    });
}

const tokenStyles = fs.existsSync(tokenStylesPath)
    ? fs.readFileSync(tokenStylesPath, 'utf8')
    : '';
if (!tokenStyles) {
    failures.push('styles/UiTokens.css: semantic token stylesheet does not exist');
} else {
    ['--ui-font', '--ui-page-bg', '--ui-primary', ':root:not(.dark)'].forEach(token => {
        if (!tokenStyles.includes(token)) {
            failures.push(`UiTokens.css: missing ${token}`);
        }
    });
}

const primitiveStyles = fs.existsSync(primitiveStylesPath)
    ? fs.readFileSync(primitiveStylesPath, 'utf8')
    : '';
if (!primitiveStyles) {
    failures.push('app/(officer)/UiPrimitives.css: shared primitive stylesheet does not exist');
} else {
    ['.ui-page', '.ui-panel', '.ui-table'].forEach(selector => {
        if (!primitiveStyles.includes(selector)) {
            failures.push(`UiPrimitives.css: missing ${selector}`);
        }
    });
}

const labels = fs.existsSync(labelsPath) ? fs.readFileSync(labelsPath, 'utf8') : '';
if (!labels.includes('export function officerText')) {
    failures.push('officer-labels.js: missing shared bilingual label helper');
}

if (failures.length > 0) {
    console.error('Officer UI contract failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Officer UI contract passed for ${requiredPages.length} operational pages.`);
}
