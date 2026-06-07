export interface ExportCourse {
    code: string;
    name: string;
    type: string;
    teacher?: string;
    ects?: number;
    schedule: [string, number][];
}

const DAY_INDEX: Record<string, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
};

const PERIOD_START_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function pad(value: number) {
    return value.toString().padStart(2, '0');
}

function formatICSDate(date: Date, allDay = false) {
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());

    if (allDay) return `${year}${month}${day}`;

    return `${year}${month}${day}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function formatLocal(date: Date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}${month}${day}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function nextWeekdayOnOrAfter(base: Date, targetWeekday: number) {
    const result = new Date(base.getTime());
    const baseWeekday = result.getDay() === 0 ? 7 : result.getDay();
    const diff = (targetWeekday - baseWeekday + 7) % 7;
    result.setDate(result.getDate() + diff);
    return result;
}

function escapeICSValue(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export function buildScheduleICS(
    courses: ExportCourse[],
    options: {
        termLabel?: string;
        weeks?: number;
        startDate?: Date;
    } = {}
) {
    const now = new Date();
    const weeks = options.weeks ?? 14;
    const seedDate = options.startDate ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const termLabel = options.termLabel ?? 'IşıkSchedule';

    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//IşıkSchedule//Course Export//TR',
        'CALSCALE:GREGORIAN',
        `X-WR-CALNAME:${escapeICSValue(termLabel)}`,
    ];

    courses.forEach((course) => {
        (course.schedule || []).forEach(([day, period], slotIndex) => {
            const weekdayIndex = DAY_INDEX[day];
            const hourIndex = period - 1;

            if (!weekdayIndex || hourIndex < 0 || hourIndex >= PERIOD_START_HOURS.length) return;

            const firstOccurrence = nextWeekdayOnOrAfter(seedDate, weekdayIndex);
            const startHour = PERIOD_START_HOURS[hourIndex];
            const eventStart = new Date(firstOccurrence);
            eventStart.setHours(startHour, 30, 0, 0);
            const eventEnd = new Date(eventStart);
            eventEnd.setHours(startHour + 1, 20, 0, 0);

            const uid = `${course.code}-${day}-${period}-${slotIndex}@isikschedule`;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${formatICSDate(now)}`);
            lines.push(`DTSTART:${formatLocal(eventStart)}`);
            lines.push(`DTEND:${formatLocal(eventEnd)}`);
            lines.push(`SUMMARY:${escapeICSValue(`${course.code} — ${course.name}`)}`);

            const description = [
                course.teacher ? `Instructor: ${course.teacher}` : null,
                course.type ? `Type: ${course.type}` : null,
                course.ects ? `ECTS: ${course.ects}` : null,
            ].filter(Boolean).join('\\n');

            if (description) lines.push(`DESCRIPTION:${description}`);
            lines.push(`RRULE:FREQ=WEEKLY;COUNT=${weeks}`);
            lines.push('END:VEVENT');
        });
    });

    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
}

export function downloadICS(content: string, filename = 'isikschedule.ics') {
    if (typeof window === 'undefined') return;

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export interface ScheduleStats {
    totalHours: number;
    freeDays: string[];
    busyDays: string[];
    gapsByDay: Record<string, number>;
    totalGaps: number;
    earliestPeriod: number | null;
    latestPeriod: number | null;
    dayHourCounts: Record<string, number>;
}

const DAYS: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function computeScheduleStats(
    courses: ExportCourse[],
    lockedSlots: Set<string> = new Set()
): ScheduleStats {
    const dayPeriods: Record<string, Set<number>> = {};
    DAYS.forEach((day) => { dayPeriods[day] = new Set(); });

    courses.forEach((course) => {
        (course.schedule || []).forEach(([day, period]) => {
            if (!dayPeriods[day]) return;
            if (lockedSlots.has(`${day}-${period}`)) return;
            dayPeriods[day].add(period);
        });
    });

    const freeDays: string[] = [];
    const busyDays: string[] = [];
    const gapsByDay: Record<string, number> = {};
    const dayHourCounts: Record<string, number> = {};
    let totalHours = 0;
    let totalGaps = 0;
    let earliestPeriod: number | null = null;
    let latestPeriod: number | null = null;

    DAYS.forEach((day) => {
        const periods = Array.from(dayPeriods[day]).sort((a, b) => a - b);
        dayHourCounts[day] = periods.length;
        totalHours += periods.length;

        if (periods.length === 0) {
            freeDays.push(day);
            gapsByDay[day] = 0;
            return;
        }

        busyDays.push(day);

        const min = periods[0];
        const max = periods[periods.length - 1];
        if (earliestPeriod === null || min < earliestPeriod) earliestPeriod = min;
        if (latestPeriod === null || max > latestPeriod) latestPeriod = max;

        const span = max - min + 1;
        const gaps = span - periods.length;
        gapsByDay[day] = gaps;
        totalGaps += gaps;
    });

    return {
        totalHours,
        freeDays,
        busyDays,
        gapsByDay,
        totalGaps,
        earliestPeriod,
        latestPeriod,
        dayHourCounts,
    };
}
