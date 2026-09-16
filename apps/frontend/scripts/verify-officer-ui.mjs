import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');

const requiredPages = [
    'app/(officer)/free-elective-management/page.jsx',
    'app/(officer)/free-elective-management/groups/page.jsx',
    'app/(officer)/free-elective-management/groups/[cohortId]/page.jsx',
    'app/(officer)/free-elective-management/offerings/[offeringId]/page.jsx',
    'app/(officer)/free-elective-management/students/[enrollmentId]/page.jsx',
    'app/(officer)/student-management/page.jsx',
    'app/(officer)/student-management/[cohortId]/page.jsx',
    'app/(officer)/activity-management/page.jsx',
    'app/(officer)/activity-management/[activityId]/sessions/page.jsx',
    'app/(officer)/activity-sessions/[sessionId]/page.jsx',
    'app/(officer)/major-management/page.jsx',
    'app/(officer)/competency-management/page.jsx',
    'app/(officer)/template-assignments/page.jsx',
];

const sharedStylesPath = path.join(frontendDirectory, 'app/(officer)/OfficerDesign.css');
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
    if (!content.includes('officer-page__header')) {
        failures.push(`${relativePath}: missing officer-page__header class`);
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
