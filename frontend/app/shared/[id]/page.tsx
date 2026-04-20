'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GraduationCap, Loader2, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';
import { useLanguage, LanguageSwitcher } from '../../context/LanguageContext';
import TeacherLink from '../../components/TeacherLink';

export default function SharedSchedulePage() {
    const params = useParams();
    const shareId = params.id as string;
    const { t, lang } = useLanguage();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [schedule, setSchedule] = useState<any>(null);

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const PERIOD_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];
    const DAY_ABBR: Record<string, string> = {
        Monday: t.mon || 'Mon',
        Tuesday: t.tue || 'Tue',
        Wednesday: t.wed || 'Wed',
        Thursday: t.thu || 'Thu',
        Friday: t.fri || 'Fri'
    };

    const TYPE_STYLES: Record<string, { bg: string; border: string }> = {
        lecture: { bg: 'bg-blue-500/90', border: 'border-blue-500/30' },
        lab: { bg: 'bg-purple-500/90', border: 'border-purple-500/30' },
        ps: { bg: 'bg-green-500/90', border: 'border-green-500/30' },
    };

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/shared/${shareId}`);
                if (!response.ok) {
                    throw new Error('Schedule not found or expired.');
                }
                const data = await response.json();
                const parsedCourses = JSON.parse(data.schedule.courses_json);
                setSchedule({ ...data.schedule, courses: parsedCourses });
            } catch (err: any) {
                setError(err.message || 'An error occurred.');
            } finally {
                setIsLoading(false);
            }
        };

        if (shareId) {
            fetchSchedule();
        }
    }, [shareId]);

    const buildGrid = (courses: any[]) => {
        const grid: Record<string, Record<number, any[]>> = {};
        DAYS.forEach((day) => { grid[day] = {}; });

        courses.forEach((course) => {
            (course.schedule || []).forEach(([day, period]: [string, number]) => {
                if (!grid[day]) return;
                if (!grid[day][period]) grid[day][period] = [];
                grid[day][period].push(course);
            });
        });

        return grid;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-isik-blue-lighter" />
                    <p className="text-sm text-slate-400">Loading shared schedule...</p>
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
                    <h2 className="text-xl font-bold text-white mb-2">{error || 'Schedule Not Found'}</h2>
                    <p className="text-slate-400 mb-6 font-light">
                        {lang === 'tr' 
                            ? "Bu paylaşılan program bulunamadı veya silinmiş olabilir."
                            : "This shared schedule could not be found or may have been deleted."}
                    </p>
                    <Link href="/" className="btn-primary inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        {lang === 'tr' ? 'Anasayfaya Dön' : 'Return Home'}
                    </Link>
                </div>
            </div>
        );
    }

    const grid = buildGrid(schedule.courses);

    return (
        <div className="min-h-screen bg-surface-900 flex flex-col text-white">
            <header className="bg-surface-800/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 flex-shrink-0">
                <div className="max-w-[1800px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center shadow-lg">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">IşıkSchedule</h1>
                            <span className="text-[11px] text-slate-500 block uppercase tracking-wider">{lang === 'tr' ? 'Paylaşılan Program' : 'Shared Schedule'}</span>
                        </div>
                    </Link>
                    
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
                        <Link href="/scheduler" className="btn-primary !px-4 !py-2 !text-sm">
                            {lang === 'tr' ? 'Kendi Programını Yap' : 'Make Your Own'}
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 overflow-auto">
                <div className="max-w-6xl mx-auto glass-panel p-4 overflow-hidden shadow-2xl">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {schedule.name || (lang === 'tr' ? 'Paylaşılan Program' : 'Shared Schedule')}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {schedule.courses.length} {lang === 'tr' ? 'Ders' : 'Courses'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto print-area">
                        <table className="w-full border-collapse min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="p-3 text-left text-xs font-semibold tracking-wider text-slate-400 w-24 border-b border-white/5">
                                        {t.time || 'Time'}
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
                                        <td className="p-2 text-xs text-slate-500 tabular-nums border-r border-white/5 font-medium whitespace-nowrap">
                                            {PERIOD_TIMES[index]}
                                        </td>
                                        {DAYS.map((day) => {
                                            const courses = grid[day]?.[period] || [];
                                            const hasConflict = courses.length > 1;

                                            return (
                                                <td
                                                    key={`${day}-${period}`}
                                                    className="p-1 border-r border-white/[0.03] relative"
                                                    style={{ height: '60px' }}
                                                >
                                                    {courses.map((course: any) => {
                                                        const style = TYPE_STYLES[course.type?.toLowerCase()] || TYPE_STYLES.lecture;
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
                </div>
            </main>
        </div>
    );
}