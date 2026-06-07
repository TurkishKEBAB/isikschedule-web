'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, GraduationCap, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';
import { LanguageSwitcher, useLanguage } from '../../context/LanguageContext';
import TeacherLink from '../../components/TeacherLink';

interface SharedCourse {
    code: string;
    main_code?: string;
    name: string;
    ects?: number;
    type?: string;
    teacher?: string;
    schedule?: [string, number][];
}

interface SharedSchedule {
    name?: string;
    courses: SharedCourse[];
}

type Grid = Record<string, Record<number, SharedCourse[]>>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PERIOD_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];

const TYPE_STYLES: Record<string, { bg: string; border: string }> = {
    lecture: { bg: 'bg-blue-500/90', border: 'border-blue-500/30' },
    lab: { bg: 'bg-purple-500/90', border: 'border-purple-500/30' },
    ps: { bg: 'bg-emerald-500/90', border: 'border-emerald-500/30' },
};

function buildGrid(courses: SharedCourse[]) {
    const grid: Grid = {};
    DAYS.forEach((day) => { grid[day] = {}; });

    courses.forEach((course) => {
        (course.schedule || []).forEach(([day, period]) => {
            if (!grid[day]) return;
            if (!grid[day][period]) grid[day][period] = [];
            grid[day][period].push(course);
        });
    });

    return grid;
}

function parseSharedCourses(value: unknown): SharedCourse[] {
    if (typeof value !== 'string') return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
}

export default function SharedSchedulePage() {
    const params = useParams();
    const rawShareId = params.id;
    const shareId = Array.isArray(rawShareId) ? rawShareId[0] : rawShareId;
    const { t } = useLanguage();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [schedule, setSchedule] = useState<SharedSchedule | null>(null);
    const [activeDay, setActiveDay] = useState(DAYS[0]);

    const DAY_ABBR: Record<string, string> = {
        Monday: t.mon,
        Tuesday: t.tue,
        Wednesday: t.wed,
        Thursday: t.thu,
        Friday: t.fri,
    };

    useEffect(() => {
        const fetchSchedule = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/api/shared/${shareId}`);
                if (!response.ok) throw new Error(t.sharedNotFoundTitle);

                const data = await response.json();
                const parsedCourses = parseSharedCourses(data.schedule?.courses_json);
                setSchedule({ ...data.schedule, courses: parsedCourses });
            } catch {
                setError(t.sharedNotFoundTitle);
            } finally {
                setIsLoading(false);
            }
        };

        if (shareId) fetchSchedule();
    }, [shareId, t.sharedNotFoundTitle]);

    const grid = useMemo(() => buildGrid(schedule?.courses || []), [schedule]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-isik-blue-lighter" />
                    <p className="text-sm text-slate-400">{t.sharedLoading}</p>
                </div>
            </div>
        );
    }

    if (error || !schedule) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
                <div className="text-center max-w-md w-full glass-panel p-8">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-red-400">×</span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">{error || t.sharedNotFoundTitle}</h2>
                    <p className="text-slate-400 mb-6 font-light">{t.sharedNotFoundDescription}</p>
                    <Link href="/" className="btn-primary inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        {t.sharedReturnHome}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-900 flex flex-col text-white">
            <header className="bg-surface-800/80 backdrop-blur-xl border-b border-white/5 py-4 px-4 sm:px-6 flex-shrink-0">
                <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-3">
                    <Link href="/" className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center shadow-lg shrink-0">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-tight truncate">IşıkSchedule</h1>
                            <span className="text-[11px] text-slate-400 block uppercase tracking-wider">{t.sharedSchedule}</span>
                        </div>
                    </Link>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <LanguageSwitcher />
                        <Link href="/scheduler" className="btn-primary !px-3 sm:!px-4 !py-2 !text-xs sm:!text-sm">
                            {t.sharedMakeOwn}
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-3 md:p-8 overflow-auto">
                <div className="max-w-6xl mx-auto glass-panel overflow-hidden shadow-2xl">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {schedule.name || t.sharedSchedule}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {schedule.courses.length} {t.sharedCourseCount}
                            </p>
                        </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto print-area">
                        <table className="w-full border-collapse min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="p-3 text-left text-xs font-semibold tracking-wider text-slate-400 w-24 border-b border-white/5">
                                        {t.time}
                                    </th>
                                    {DAYS.map((day) => (
                                        <th key={day} className="p-3 text-center text-xs font-semibold tracking-wider text-slate-300 border-b border-white/5">
                                            {DAY_ABBR[day]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {PERIODS.map((period, index) => (
                                    <tr key={period} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                                        <td className="p-2 text-xs text-slate-400 tabular-nums border-r border-white/5 font-medium whitespace-nowrap">
                                            {PERIOD_TIMES[index]}
                                        </td>
                                        {DAYS.map((day) => {
                                            const courses = grid[day]?.[period] || [];
                                            const hasConflict = courses.length > 1;

                                            return (
                                                <td key={`${day}-${period}`} className="p-1 border-r border-white/[0.03] relative" style={{ height: '60px' }}>
                                                    {courses.map((course) => {
                                                        const style = TYPE_STYLES[course.type?.toLowerCase() || 'lecture'] || TYPE_STYLES.lecture;
                                                        return (
                                                            <div
                                                                key={course.code}
                                                                className={`p-1.5 rounded-md text-[11px] mb-1 leading-tight shadow-sm border ${hasConflict ? 'border-red-500/50' : style.border} ${style.bg}`}
                                                            >
                                                                <div className="font-bold text-white truncate" title={course.code}>{course.code}</div>
                                                                {course.teacher && (
                                                                    <div className="text-[9px] text-white/80 truncate">
                                                                        <TeacherLink teacher={course.teacher} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden p-3 space-y-3">
                        <div className="grid grid-cols-5 gap-1 rounded-lg bg-surface-900/60 border border-white/5 p-1">
                            {DAYS.map((day) => (
                                <button
                                    type="button"
                                    key={day}
                                    onClick={() => setActiveDay(day)}
                                    className={`h-10 rounded-md text-xs font-semibold transition-colors ${
                                        activeDay === day
                                            ? 'bg-isik-blue-lighter/20 text-isik-blue-lighter'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                    {DAY_ABBR[day]}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm font-semibold text-white">{t.sharedMobileTitle}</h3>
                            <span className="text-xs text-slate-400">{DAY_ABBR[activeDay]}</span>
                        </div>

                        <div className="space-y-2">
                            {PERIODS.map((period, index) => {
                                const courses = grid[activeDay]?.[period] || [];

                                return (
                                    <div key={period} className="min-h-[72px] rounded-lg border border-white/5 bg-surface-900/35 p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-14 shrink-0 text-xs tabular-nums text-slate-400 pt-1">
                                                {PERIOD_TIMES[index]}
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-2">
                                                {courses.length > 0 ? (
                                                    courses.map((course) => {
                                                        const style = TYPE_STYLES[course.type?.toLowerCase() || 'lecture'] || TYPE_STYLES.lecture;
                                                        return (
                                                            <div key={course.code} className={`rounded-md border ${style.border} ${style.bg} p-2`}>
                                                                <div className="text-sm font-semibold text-white truncate">{course.code}</div>
                                                                <div className="text-[11px] text-white/80 truncate">{course.name}</div>
                                                                {course.teacher && (
                                                                    <div className="text-[10px] text-white/75 truncate mt-1">
                                                                        <TeacherLink teacher={course.teacher} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-xs text-slate-400">{t.schedulerEmptySlot}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
