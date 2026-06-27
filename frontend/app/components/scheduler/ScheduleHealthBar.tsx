'use client';

import { AlertTriangle, CalendarOff, Clock, Coffee, GraduationCap, Layers } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { ScheduleStats } from '../../lib/scheduleExport';

interface ScheduleHealthBarProps {
    stats: ScheduleStats;
    conflicts: number;
    totalEcts: number;
    selectedCount: number;
    days: string[];
    dayAbbr: Record<string, string>;
    periodTimes: string[];
    /** Whether any courses are on the draft yet. */
    active: boolean;
}

function Metric({ icon, label, value, tone = 'neutral' }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
    const valueClass =
        tone === 'danger' ? 'text-red-300'
            : tone === 'warn' ? 'text-amber-300'
                : tone === 'ok' ? 'text-emerald-300'
                    : 'text-white';
    return (
        <div className="flex items-center gap-2 px-3">
            <span className="text-slate-500">{icon}</span>
            <span className="flex flex-col leading-tight">
                <span className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</span>
                <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
            </span>
        </div>
    );
}

/**
 * Persistent "schedule health" strip shown under the weekly grid — surfaces the
 * stats that used to live in a hidden popover so they are glanceable while building.
 */
export function ScheduleHealthBar({
    stats, conflicts, totalEcts, selectedCount, days, dayAbbr, periodTimes, active,
}: ScheduleHealthBarProps) {
    const { t } = useLanguage();

    return (
        <div className="no-print shrink-0 border-t border-white/5 bg-surface-800/70 backdrop-blur-xl">
            <div className="flex min-w-max items-center justify-center gap-1 overflow-x-auto px-3 py-2 divide-x divide-white/5">
                <Metric
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label={t.conflictsLabel}
                    value={conflicts}
                    tone={conflicts > 0 ? 'danger' : 'ok'}
                />
                <Metric
                    icon={<GraduationCap className="h-4 w-4" />}
                    label={t.courses}
                    value={`${selectedCount} · ${totalEcts} ${t.ects}`}
                />
                <Metric
                    icon={<Layers className="h-4 w-4" />}
                    label={t.statsTotalHours}
                    value={`${stats.totalHours}h`}
                />
                <Metric
                    icon={<Coffee className="h-4 w-4" />}
                    label={t.statsGaps}
                    value={`${stats.totalGaps}h`}
                    tone={stats.totalGaps > 0 ? 'warn' : 'ok'}
                />
                <Metric
                    icon={<Clock className="h-4 w-4" />}
                    label={t.statsFirstClass}
                    value={active && stats.earliestPeriod ? periodTimes[stats.earliestPeriod - 1] : '—'}
                />
                <Metric
                    icon={<Clock className="h-4 w-4" />}
                    label={t.statsLastClass}
                    value={active && stats.latestPeriod ? periodTimes[stats.latestPeriod - 1] : '—'}
                />
                <div className="flex items-center gap-2 px-3">
                    <span className="text-slate-500"><CalendarOff className="h-4 w-4" /></span>
                    <span className="flex flex-col leading-tight">
                        <span className="flex items-center gap-1">
                            {days.map((day) => {
                                const isFree = stats.freeDays.includes(day);
                                return (
                                    <span
                                        key={day}
                                        className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                                            isFree
                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                : 'bg-white/[0.04] text-slate-500'
                                        }`}
                                    >
                                        {dayAbbr[day]}
                                    </span>
                                );
                            })}
                        </span>
                        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">
                            {t.statsFreeDays} ({stats.freeDays.length})
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
}
