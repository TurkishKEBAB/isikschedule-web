import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');

const failures = [];

function read(relativePath) {
    const absolutePath = path.join(frontendRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        failures.push(`Missing ${relativePath}`);
        return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
}

function expectIncludes(relativePath, content, value) {
    if (!content.includes(value)) {
        failures.push(`${relativePath} must include ${value}`);
    }
}

function expectExcludes(relativePath, content, value) {
    if (content.includes(value)) {
        failures.push(`${relativePath} must not include ${value}`);
    }
}

const brandAsset = path.join(frontendRoot, 'public', 'brand', 'app-icon-calendar-flame.png');
if (!fs.existsSync(brandAsset)) {
    failures.push('Missing public/brand/app-icon-calendar-flame.png');
}

const brandLogo = read('app/components/BrandLogo.tsx');
expectIncludes('app/components/BrandLogo.tsx', brandLogo, '/brand/app-icon-calendar-flame.png');
expectIncludes('app/components/BrandLogo.tsx', brandLogo, 'IşıkSchedule');

for (const relativePath of [
    'app/page.tsx',
    'app/components/Navbar.tsx',
    'app/login/page.tsx',
    'app/register/page.tsx',
    'app/scheduler/page.tsx',
    'app/components/GeneratedSchedulesView.tsx',
]) {
    const content = read(relativePath);
    expectIncludes(relativePath, content, 'BrandLogo');
}

for (const relativePath of [
    'app/page.tsx',
    'app/components/Navbar.tsx',
    'app/login/page.tsx',
    'app/register/page.tsx',
    'app/scheduler/page.tsx',
]) {
    const content = read(relativePath);
    expectExcludes(relativePath, content, 'GraduationCap');
}

const globals = read('app/globals.css');
expectIncludes('app/globals.css', globals, '@media print');
expectIncludes('app/globals.css', globals, '@media (prefers-reduced-motion: reduce)');
expectIncludes('app/globals.css', globals, '.no-print');
expectIncludes('app/globals.css', globals, '.print-area');
expectIncludes('app/globals.css', globals, '.scheduler-window-thumb');
expectIncludes('app/globals.css', globals, '.scheduler-grid-card');

const buildPanel = read('app/components/scheduler/BuildPanel.tsx');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'EctsBudgetMeter');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'ClassWindowControl');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'PreferenceInfo');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'isOpen');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'schedulerEctsRemaining');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'schedulerConflictHelp');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'schedulerGapHelp');
expectIncludes('app/components/scheduler/BuildPanel.tsx', buildPanel, 'schedulerShowBuild');

const scheduler = read('app/scheduler/page.tsx');
expectIncludes('app/scheduler/page.tsx', scheduler, 'leftPanelOpen');
expectIncludes('app/scheduler/page.tsx', scheduler, 'rightPanelOpen');
expectIncludes('app/scheduler/page.tsx', scheduler, 'BlockedSlotsPanel');
expectIncludes('app/scheduler/page.tsx', scheduler, 'scheduler-grid-card');
expectIncludes('app/scheduler/page.tsx', scheduler, 'grid-slot-courses');
expectIncludes('app/scheduler/page.tsx', scheduler, 'schedulerShowCourses');

const healthBar = read('app/components/scheduler/ScheduleHealthBar.tsx');
expectIncludes('app/components/scheduler/ScheduleHealthBar.tsx', healthBar, 'justify-center');

if (failures.length > 0) {
    console.error('Design parity contract failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log('Design parity contract passed.');
