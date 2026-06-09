'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, Calendar, Check, Copy, Crown, GitCompareArrows, Heart, Info,
    Printer, Share2, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { computeScheduleStats, type ScheduleStats } from '../lib/scheduleExport';
import { AuroraBackground } from './AuroraBackground';
import { CountUp } from './CountUp';
import { LockingTooltip } from './LockingTooltip';
import { ScoreExplanation } from './ScoreExplanation';

interface ResultCourse {
    code: string;
    main_code?: string;
    name: string;
    type: string;
    teacher?: string;
    ects?: number;
    schedule: [string, number][];
}

export interface ResultSchedule {
    id: string;
    score: number;
    total_ects: number;
    conflict_count: number;
    course_count: number;
    courses: ResultCourse[];
    /** Section/teacher alternatives that share this exact weekly layout (≤5; total in variant_count). */
    variants?: ResultCourse[][];
    variant_count?: number;
}

export interface DiagnosisReason {
    code: string;
    data?: Record<string, unknown>;
}

export interface Diagnosis {
    status: string;
    result_count: number;
    reasons: DiagnosisReason[];
}

interface GeneratedSchedulesViewProps {
    schedules: ResultSchedule[];
    currentIdx: number;
    lockedSlots: Set<string>;
    sourceLabel: string | null;
    shareUrl: string | null;
    isSharing?: boolean;
    /** Structural reasons for an empty result (backend diagnosis), localized in the view. */
    diagnosis?: Diagnosis | null;
    /** False when the search hit its budget before exploring every layout. */
    searchComplete?: boolean;
    /** Number of layouts considered by the diversity selector. */
    candidatePoolSize?: number;
    onSelect: (idx: number, variantIndex?: number) => void;
    onClose: () => void;
    onExportIcs: () => void;
    onPrint: () => void;
    onShare: () => void;
    onCopyLink: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_INDEX: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 };
const MINI_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const FULL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PERIOD_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30'];
const TYPE_BG: Record<string, string> = { lecture: 'bg-lecture', lab: 'bg-lab', ps: 'bg-ps' };
const TYPE_BORDER: Record<string, string> = { lecture: 'border-lecture', lab: 'border-lab', ps: 'border-ps' };
const TYPE_BADGE: Record<string, string> = { lecture: 'badge-blue', lab: 'badge-purple', ps: 'badge-green' };
const COLS = 3;

interface Cell {
    code: string;
    type: string;
}

function buildOccupancy(courses: ResultCourse[]): Map<string, Cell> {
    const map = new Map<string, Cell>();
    courses.forEach((course) => {
        (course.schedule || []).forEach(([day, period]) => {
            const di = DAY_INDEX[day];
            if (di === undefined) return;
            map.set(`${di}-${period}`, { code: course.code, type: course.type });
        });
    });
    return map;
}

function MiniGrid({ occupancy }: { occupancy: Map<string, Cell> }) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#0B1020]/60 p-2">
            <div className="grid grid-cols-5 gap-1">
                {MINI_PERIODS.map((period) =>
                    DAYS.map((_, di) => {
                        const cell = occupancy.get(`${di}-${period}`);
                        return (
                            <div
                                key={`${di}-${period}`}
                                className={`h-3 rounded-sm ${cell ? `${TYPE_BG[cell.type] || TYPE_BG.lecture}/85` : 'bg-white/[0.04]'}`}
                            />
                        );
                    }),
                )}
            </div>
        </div>
    );
}

function periodTime(period: number | null): string {
    if (period === null || period < 1) return '—';
    const hour = 8 + period - 1;
    return `${String(hour).padStart(2, '0')}:30`;
}

function busiestDays(stats: ScheduleStats, dayLabels: string[]): string {
    const maximum = Math.max(...Object.values(stats.dayHourCounts), 0);
    if (maximum === 0) return '—';

    return DAYS
        .filter((day) => stats.dayHourCounts[day] === maximum)
        .map((day) => dayLabels[DAY_INDEX[day]])
        .join(' / ');
}

export function GeneratedSchedulesView({
    schedules, currentIdx, lockedSlots, sourceLabel, shareUrl, isSharing,
    diagnosis, searchComplete, candidatePoolSize, onSelect, onClose, onExportIcs, onPrint, onShare, onCopyLink,
}: GeneratedSchedulesViewProps) {
    const { t } = useLanguage();
    const typeLabel = (type: string) => (type === 'lab' ? t.lab : type === 'ps' ? t.problemSession : t.lecture);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [focusIdx, setFocusIdx] = useState(currentIdx);
    const [compareOpen, setCompareOpen] = useState(false);

    const perStats = useMemo(
        () => schedules.map((s) => computeScheduleStats(s.courses, lockedSlots)),
        [schedules, lockedSlots],
    );
    const occupancies = useMemo(() => schedules.map((s) => buildOccupancy(s.courses)), [schedules]);
    const selected = schedules[currentIdx];
    const single = schedules.length === 1;
    const empty = schedules.length === 0;
    const dayLabels = [t.mon, t.tue, t.wed, t.thu, t.fri];

    // Section/teacher variants that share the selected schedule's exact weekly layout.
    const [variantIdx, setVariantIdx] = useState(0);
    useEffect(() => { setVariantIdx(0); }, [currentIdx]);
    const selectedVariants: ResultCourse[][] =
        selected?.variants && selected.variants.length > 0
            ? selected.variants
            : selected ? [selected.courses] : [];
    const safeVariantIdx = Math.min(variantIdx, Math.max(selectedVariants.length - 1, 0));
    const activeVariantCourses = selectedVariants[safeVariantIdx] ?? selected?.courses ?? [];
    const variantKey = (course: ResultCourse) => `${course.main_code ?? course.code}:${course.type}`;
    const varyingVariantKeys = (() => {
        const keys = new Set<string>();
        if (selectedVariants.length > 1) {
            const byKey = new Map<string, Set<string>>();
            selectedVariants.forEach((variant) => variant.forEach((course) => {
                const set = byKey.get(variantKey(course)) ?? new Set<string>();
                set.add(course.code);
                byKey.set(variantKey(course), set);
            }));
            byKey.forEach((codes, key) => { if (codes.size > 1) keys.add(key); });
        }
        return keys;
    })();
    const variantLabel = (i: number) => {
        const parts = Array.from(new Set(
            (selectedVariants[i] || [])
                .filter((course) => varyingVariantKeys.has(variantKey(course)))
                .map((course) => {
                    const teacher = course.teacher?.trim();
                    return teacher ? `${course.code} · ${teacher}` : course.code;
                }),
        ));
        return parts.join(' / ') || `${i + 1}`;
    };

    const toggleFavorite = (id: string) =>
        setFavorites((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleCompare = (id: string) =>
        setCompareIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= 3) return prev;
            return [...prev, id];
        });

    useEffect(() => {
        const scheduleIds = new Set(schedules.map((schedule) => schedule.id));
        setCompareIds((prev) => prev.filter((id) => scheduleIds.has(id)).slice(0, 3));
    }, [schedules]);

    useEffect(() => {
        if (compareOpen && compareIds.length < 2) setCompareOpen(false);
    }, [compareIds.length, compareOpen]);

    // Keyboard navigation (b): arrows move focus, Enter selects, Esc closes.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (compareOpen) {
                if (e.key === 'Escape') { e.preventDefault(); setCompareOpen(false); }
                return;
            }
            if (schedules.length === 0) {
                if (e.key === 'Escape') { e.preventDefault(); onClose(); }
                return;
            }
            const last = schedules.length - 1;
            if (e.key === 'ArrowRight') { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, last)); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => Math.min(i + COLS, last)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => Math.max(i - COLS, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); onSelect(focusIdx); }
            else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [schedules.length, focusIdx, compareOpen, onSelect, onClose]);

    const conflictLabel = (n: number) => (n === 0 ? t.resultsNoConflict : `${n} ${t.conflictsLabel}`);

    const reasonText = (reason: DiagnosisReason): string => {
        const data = reason.data || {};
        const course = String(data.course ?? '');
        switch (reason.code) {
            case 'missing_course':
                return t.diagMissingCourse.replace('{course}', course);
            case 'missing_required_component': {
                const raw = String(data.type ?? '');
                const typeLabel = raw === 'lab' ? t.lab : raw === 'ps' ? t.problemSession : t.lecture;
                return t.diagMissingComponent.replace('{course}', course).replace('{type}', typeLabel);
            }
            case 'locked_blocks_course':
                return t.diagLockedBlocks.replace('{course}', course);
            case 'ects_exceeded':
                return t.diagEctsExceeded
                    .replace('{limit}', String(data.limit ?? ''))
                    .replace('{min}', String(data.min_possible ?? ''));
            case 'conflict_limit_exceeded':
                return t.diagConflictExceeded.replace('{limit}', String(data.limit ?? ''));
            default:
                return '';
        }
    };
    const emptyReasons = (diagnosis?.reasons ?? [])
        .map((reason) => reasonText(reason))
        .filter((text) => text.length > 0);
    const compareSchedules = compareIds.map((id) => schedules.find((s) => s.id === id)).filter(Boolean) as ResultSchedule[];
    const selectedStats = perStats[currentIdx];
    const selectedReasons = selected && selectedStats
        ? [
            t.resultsWhyCourses.replace('{count}', String(selected.course_count)),
            selected.conflict_count === 0
                ? t.resultsWhyNoConflict
                : t.resultsWhyHasConflicts.replace('{count}', String(selected.conflict_count)),
            selectedStats.freeDays.length > 0
                ? t.resultsWhyFreeDays.replace(
                    '{days}',
                    selectedStats.freeDays.map((day) => dayLabels[DAY_INDEX[day]]).join(', '),
                )
                : t.resultsWhyNoFreeDays,
            t.resultsWhyGaps.replace('{count}', String(selectedStats.totalGaps)),
            t.resultsWhyHours
                .replace('{count}', String(selectedStats.totalHours))
                .replace('{first}', periodTime(selectedStats.earliestPeriod))
                .replace('{last}', periodTime(selectedStats.latestPeriod)),
        ]
        : [];

    const comparisonRows = [
        {
            label: t.resultsCompareScore,
            values: compareSchedules.map((schedule) => ({ display: String(schedule.score), numeric: schedule.score })),
            preference: 'max',
        },
        {
            label: t.resultsCompareConflicts,
            values: compareSchedules.map((schedule) => ({
                display: conflictLabel(schedule.conflict_count),
                numeric: schedule.conflict_count,
            })),
            preference: 'min',
        },
        {
            label: t.resultsCompareFreeDays,
            values: compareSchedules.map((schedule) => {
                const stats = perStats[schedules.indexOf(schedule)];
                return { display: String(stats.freeDays.length), numeric: stats.freeDays.length };
            }),
            preference: 'max',
        },
        {
            label: t.resultsCompareGaps,
            values: compareSchedules.map((schedule) => {
                const stats = perStats[schedules.indexOf(schedule)];
                return {
                    display: `${stats.totalGaps} ${t.resultsCompareHoursUnit}`,
                    numeric: stats.totalGaps,
                };
            }),
            preference: 'min',
        },
        {
            label: t.resultsCompareFirstClass,
            values: compareSchedules.map((schedule) => {
                const stats = perStats[schedules.indexOf(schedule)];
                return { display: periodTime(stats.earliestPeriod), numeric: null };
            }),
            preference: null,
        },
        {
            label: t.resultsCompareLastClass,
            values: compareSchedules.map((schedule) => {
                const stats = perStats[schedules.indexOf(schedule)];
                return { display: periodTime(stats.latestPeriod), numeric: null };
            }),
            preference: null,
        },
        {
            label: t.resultsCompareBusiestDay,
            values: compareSchedules.map((schedule) => {
                const stats = perStats[schedules.indexOf(schedule)];
                return { display: busiestDays(stats, dayLabels), numeric: null };
            }),
            preference: null,
        },
        {
            label: t.resultsCompareClassHours,
            values: compareSchedules.map((schedule) => {
                const stats = perStats[schedules.indexOf(schedule)];
                return {
                    display: `${stats.totalHours} ${t.resultsCompareHoursUnit}`,
                    numeric: stats.totalHours,
                };
            }),
            preference: null,
        },
        {
            label: t.ects,
            values: compareSchedules.map((schedule) => ({
                display: String(schedule.total_ects),
                numeric: schedule.total_ects,
            })),
            preference: null,
        },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1020] text-slate-100 no-print">
            <AuroraBackground variant="absolute" vignette={false} className="opacity-70" />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B1020]/85 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-isik-blue to-isik-blue-lighter shadow-lg shadow-blue-500/30">
                            <Crown className="h-5 w-5 text-white" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="truncate text-lg font-bold text-white">{t.resultsHeading}</h1>
                            <p className="truncate text-xs text-slate-400">
                                {schedules.length} {t.resultsAlternatives}
                                {sourceLabel ? ` · ${sourceLabel}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="magnetic inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            {t.resultsBackToScheduler}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            <main className="relative z-10 mx-auto max-w-7xl px-4 pb-40 pt-10 sm:px-6">
                {empty ? (
                    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                            <X className="h-8 w-8" />
                        </span>
                        <h2 className="max-w-md text-2xl font-bold text-white sm:text-3xl">{t.resultsEmptyTitle}</h2>
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">{t.resultsEmptySubtitle}</p>
                        {emptyReasons.length > 0 && (
                            <div className="mt-5 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t.diagReasonsTitle}</p>
                                <ul className="space-y-1.5">
                                    {emptyReasons.map((text, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                                            <span className="mt-0.5 text-red-400">•</span>
                                            <span>{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button type="button" onClick={onClose} className="btn-primary magnetic mt-7">
                            <ArrowLeft className="h-4 w-4" />
                            {t.resultsEmptyAction}
                        </button>
                    </div>
                ) : (
                <>
                {/* Hero */}
                <div className="mb-10 max-w-2xl">
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-isik-blue-lighter/25 bg-isik-blue-lighter/10 px-4 py-1.5 text-sm font-medium text-isik-blue-lighter">
                        <Crown className="h-3.5 w-3.5" />
                        {single ? t.resultsSingleEyebrow : <>{t.resultsEyebrowPre}{schedules.length}{t.resultsEyebrowPost}</>}
                    </p>
                    <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                        {single ? t.resultsSinglePre : t.resultsTitlePre}
                        <span className="grad-text">{single ? t.resultsSingleHighlight : t.resultsTitleHighlight}</span>
                        {single ? t.resultsSinglePost : t.resultsTitlePost}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-400">{single ? t.resultsSingleSubtitle : t.resultsSubtitle}</p>
                </div>

                {/* Cards */}
                <div className={single ? 'mx-auto max-w-md' : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'}>
                    {schedules.map((schedule, idx) => {
                        const stats = perStats[idx];
                        const isSelected = idx === currentIdx;
                        const isFocused = idx === focusIdx;
                        const isBest = idx === 0 && !single;
                        const inCompare = compareIds.includes(schedule.id);
                        return (
                            <div
                                key={schedule.id}
                                className={`lift relative rounded-[28px] bg-gradient-to-br p-[1.5px] shadow-xl shadow-black/30 transition-all ${
                                    isBest
                                        ? 'from-isik-gold/60 via-isik-blue-lighter/40 to-lab/40'
                                        : 'from-white/10 via-isik-blue-lighter/15 to-isik-gold/10'
                                } ${isFocused ? 'ring-2 ring-isik-blue-lighter/70 ring-offset-2 ring-offset-[#0B1020]' : ''}`}
                            >
                                {isBest && (
                                    <span className="absolute -top-3 left-6 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-isik-gold to-amber-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#3b2700] shadow-lg shadow-amber-500/30">
                                        <Crown className="h-3 w-3" />
                                        {t.resultsBestMatch}
                                    </span>
                                )}
                                <div className="h-full rounded-[27px] bg-[#0E1428]/92 p-5 backdrop-blur-xl">
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-white/[0.06] px-1.5 text-xs font-bold text-slate-300">
                                                #{idx + 1}
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{t.program} #{idx + 1}</p>
                                                <p className={`text-[11px] ${schedule.conflict_count === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {conflictLabel(schedule.conflict_count)}
                                                </p>
                                                {(schedule.variant_count ?? 1) > 1 && (
                                                    <p className="mt-0.5 text-[10px] text-slate-500">↔ {schedule.variant_count} {t.resultsVariantsShort}</p>
                                                )}
                                            </div>
                                        </div>
                                        <LockingTooltip
                                            className="group/score inline-flex cursor-help flex-col items-end rounded-lg px-1 text-right outline-none transition focus-visible:ring-2 focus-visible:ring-isik-blue-lighter/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1428]"
                                            label={t.scoreInfoTitle}
                                            holdHint={t.scoreInfoHoldHint}
                                            lockedHint={t.scoreInfoLockedHint}
                                            closeLabel={t.scoreInfoClose}
                                            content={<ScoreExplanation s={schedule} />}
                                        >
                                            <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500 transition group-hover/score:text-slate-300">
                                                {t.homeStatScore}
                                                <Info className="h-3 w-3 opacity-60" />
                                            </span>
                                            <CountUp to={schedule.score} className="grad-text text-2xl font-black leading-none" />
                                        </LockingTooltip>
                                    </div>

                                    <MiniGrid occupancy={occupancies[idx]} />

                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                        <Stat value={schedule.total_ects} label={t.ects} />
                                        <Stat value={schedule.conflict_count} label={t.conflictsLabel} tone={schedule.conflict_count > 0 ? 'warn' : 'ok'} />
                                        <Stat value={stats.freeDays.length} label={t.resultsFreeDaysLabel} />
                                    </div>

                                    <div className="mt-4 flex items-center gap-2">
                                        {!single && (
                                        <>
                                        <button
                                            type="button"
                                            onClick={() => toggleFavorite(schedule.id)}
                                            aria-pressed={favorites.has(schedule.id)}
                                            title={t.resultsFavorite}
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all ${
                                                favorites.has(schedule.id)
                                                    ? 'border-red-500/40 bg-red-500/15 text-red-400'
                                                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <Heart className={`h-4 w-4 ${favorites.has(schedule.id) ? 'fill-current' : ''}`} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleCompare(schedule.id)}
                                            aria-pressed={inCompare}
                                            disabled={!inCompare && compareIds.length >= 3}
                                            title={!inCompare && compareIds.length >= 3 ? t.resultsCompareLimit : undefined}
                                            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all ${
                                                inCompare
                                                    ? 'border-isik-blue-lighter/40 bg-isik-blue-lighter/15 text-isik-blue-lighter'
                                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                                            }`}
                                        >
                                            <GitCompareArrows className="h-3.5 w-3.5" />
                                            {t.resultsCompare}
                                        </button>
                                        </>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onSelect(idx)}
                                            className={`magnetic ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition-all ${
                                                isSelected
                                                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-500/40'
                                                    : 'bg-gradient-to-r from-isik-blue to-isik-blue-lighter text-white shadow-lg shadow-blue-500/25'
                                            }`}
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                            {isSelected ? t.resultsSelected : t.resultsSelect}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Persistent explanation */}
                {selected && selectedStats && (
                    <section className="mt-10 rounded-[28px] border border-white/10 bg-[#0E1428]/80 p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
                        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-isik-blue-lighter">
                                    {t.resultsWhyTitle}
                                </p>
                                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                                    {t.resultsWhySubtitle}
                                </p>
                                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                                    {selectedReasons.map((reason) => (
                                        <li
                                            key={reason}
                                            className="flex gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-sm leading-relaxed text-slate-300"
                                        >
                                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                                                <Check className="h-2.5 w-2.5" />
                                            </span>
                                            <span>{reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/70 p-4">
                                <ScoreExplanation s={selected} />
                            </div>
                        </div>
                        {searchComplete === false && (
                            <p className="mt-4 flex items-start gap-2 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-slate-500">
                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                    {t.resultsSearchIncomplete.replace(
                                        '{count}',
                                        String(candidatePoolSize ?? schedules.length),
                                    )}
                                </span>
                            </p>
                        )}
                    </section>
                )}

                {/* Shareable card */}
                {selected && (
                    <section className="mt-16">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-isik-blue-lighter">{t.resultsShareableEyebrow}</p>
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-2xl font-bold text-white">{t.resultsShareableTitle}</h3>
                            <span className={`badge ${selected.conflict_count === 0 ? 'badge-green' : 'badge-red'} !text-xs`}>
                                {conflictLabel(selected.conflict_count)}
                            </span>
                        </div>

                        <div className="rounded-[28px] bg-gradient-to-br from-isik-blue-lighter/25 via-lab/15 to-isik-gold/20 p-[1.5px] shadow-2xl shadow-black/40">
                            <div className="rounded-[27px] bg-[#0E1428]/92 p-5 backdrop-blur-xl sm:p-7">
                                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                                    {/* Full grid */}
                                    <div>
                                        <div className="mb-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-isik-blue to-isik-blue-lighter">
                                                    <Crown className="h-4 w-4 text-white" />
                                                </span>
                                                <div>
                                                    <p className="text-sm font-bold text-white">IşıkSchedule</p>
                                                    <p className="text-[11px] text-slate-400">{t.weeklySchedule} · #{currentIdx + 1}</p>
                                                </div>
                                            </div>
                                            <div className="hidden items-center gap-3 sm:flex">
                                                <LockingTooltip
                                                    className="inline-block cursor-help rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-isik-blue-lighter/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1428]"
                                                    label={t.scoreInfoTitle}
                                                    holdHint={t.scoreInfoHoldHint}
                                                    lockedHint={t.scoreInfoLockedHint}
                                                    closeLabel={t.scoreInfoClose}
                                                    content={<ScoreExplanation s={selected} />}
                                                >
                                                    <ScoreBadge label={t.resultsTotalScore} value={selected.score} highlight info />
                                                </LockingTooltip>
                                                <ScoreBadge label={t.homeStatEcts} value={selected.total_ects} />
                                            </div>
                                        </div>
                                        <FullGrid occupancy={occupancies[currentIdx]} dayLabels={dayLabels} />
                                    </div>

                                    {/* Course list + QR + actions */}
                                    <div className="flex flex-col">
                                        {selectedVariants.length > 1 && (
                                            <div className="mb-3">
                                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                    {t.resultsVariantsTitle} · {selected.variant_count ?? selectedVariants.length}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedVariants.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => { setVariantIdx(i); onSelect(currentIdx, i); }}
                                                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
                                                                i === safeVariantIdx
                                                                    ? 'border-isik-blue-lighter/40 bg-isik-blue-lighter/15 text-isik-blue-lighter'
                                                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'
                                                            }`}
                                                        >
                                                            {variantLabel(i)}
                                                        </button>
                                                    ))}
                                                </div>
                                                {(selected.variant_count ?? 0) > selectedVariants.length && (
                                                    <p className="mt-1.5 text-[10px] text-slate-500">
                                                        {t.resultsVariantsShownNote
                                                            .replace('{shown}', String(selectedVariants.length))
                                                            .replace('{total}', String(selected.variant_count ?? selectedVariants.length))}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {activeVariantCourses.map((course) => (
                                                <div
                                                    key={course.code}
                                                    className={`flex items-center gap-3 rounded-xl border-l-2 bg-white/[0.03] px-3 py-2 ${TYPE_BORDER[course.type] || TYPE_BORDER.lecture}`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex items-center gap-2 text-sm font-bold text-white">
                                                            <span className="truncate">{course.code}</span>
                                                            <span className={`badge ${TYPE_BADGE[course.type] || TYPE_BADGE.lecture} shrink-0`}>{typeLabel(course.type)}</span>
                                                        </p>
                                                        <p className="truncate text-xs text-slate-400">{course.name}</p>
                                                    </div>
                                                    {course.teacher && <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{course.teacher}</span>}
                                                    {course.ects != null && <span className="badge bg-white/[0.06] text-slate-300 shrink-0">{course.ects} {t.ects}</span>}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <div className="rounded-lg bg-white p-1.5">
                                                <QRCodeSVG value={shareUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://isikschedule')} size={72} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white">{t.resultsPhoneTitle}</p>
                                                <p className="text-xs leading-relaxed text-slate-400">{t.resultsPhoneDesc}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                                            <ActionButton icon={<Calendar className="h-4 w-4" />} label={t.resultsExportIcs} onClick={onExportIcs} />
                                            <ActionButton icon={<Printer className="h-4 w-4" />} label={t.resultsPrintPdf} onClick={onPrint} />
                                            <ActionButton icon={<Share2 className="h-4 w-4" />} label={t.resultsShare} onClick={onShare} loading={isSharing} primary />
                                            <ActionButton icon={<Copy className="h-4 w-4" />} label={t.resultsCopy} onClick={onCopyLink} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
                </>
                )}
            </main>

            {/* Compare bar */}
            {compareIds.length > 0 && !compareOpen && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0E1428]/90 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-isik-blue-lighter">
                            <GitCompareArrows className="h-4 w-4" />
                            {t.resultsCompare} {compareIds.length}/3
                        </span>
                        {compareSchedules.map((s) => {
                            const idx = schedules.indexOf(s);
                            return (
                                <span key={s.id} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
                                    <span className="font-semibold text-white">{t.program} #{idx + 1}</span>
                                    <span className="text-slate-400">{t.homeStatScore} {s.score} · {s.total_ects} {t.ects}</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleCompare(s.id)}
                                        className="text-slate-400 hover:text-white"
                                        aria-label={t.scoreInfoClose}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            );
                        })}
                        {compareIds.length < 2 && <span className="text-xs text-slate-500">{t.resultsCompareHint}</span>}
                        <button
                            type="button"
                            disabled={compareSchedules.length < 2}
                            onClick={() => setCompareOpen(true)}
                            className="magnetic ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-isik-blue to-isik-blue-lighter px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 disabled:opacity-40"
                        >
                            <GitCompareArrows className="h-3.5 w-3.5" />
                            {t.resultsCompare}
                        </button>
                    </div>
                </div>
            )}

            {/* Comparison matrix */}
            {compareOpen && compareSchedules.length >= 2 && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="schedule-comparison-title"
                >
                    <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0E1428] shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
                            <div>
                                <h3 id="schedule-comparison-title" className="text-lg font-bold text-white">
                                    {t.resultsCompareView}
                                </h3>
                                <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.resultsCompareSubtitle}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCompareOpen(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-white/[0.05] hover:text-white"
                                aria-label={t.scoreInfoClose}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="overflow-auto p-4 sm:p-6">
                            <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-2xl border border-white/10">
                                <thead>
                                    <tr className="bg-white/[0.035]">
                                        <th className="w-40 border-b border-r border-white/10 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                            {t.resultsCompareSchedule}
                                        </th>
                                        {compareSchedules.map((schedule) => {
                                            const idx = schedules.indexOf(schedule);
                                            return (
                                                <th key={schedule.id} className="border-b border-r border-white/10 p-3 last:border-r-0">
                                                    <div className="mb-2 flex items-center justify-between gap-2">
                                                        <span className="text-sm font-bold text-white">{t.program} #{idx + 1}</span>
                                                        {idx === currentIdx && (
                                                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                                                                {t.resultsSelected}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <MiniGrid occupancy={occupancies[idx]} />
                                                    <button
                                                        type="button"
                                                        onClick={() => { onSelect(idx); setCompareOpen(false); }}
                                                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-isik-blue to-isik-blue-lighter px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        {idx === currentIdx ? t.resultsSelected : t.resultsSelect}
                                                    </button>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonRows.map((row, rowIndex) => {
                                        const numericValues = row.values
                                            .map((value) => value.numeric)
                                            .filter((value): value is number => value !== null);
                                        const preferred = row.preference === 'max'
                                            ? Math.max(...numericValues)
                                            : row.preference === 'min'
                                                ? Math.min(...numericValues)
                                                : null;

                                        return (
                                            <tr key={row.label} className={rowIndex % 2 === 0 ? 'bg-white/[0.015]' : undefined}>
                                                <th className="border-b border-r border-white/[0.08] px-4 py-3 text-left text-xs font-medium text-slate-400">
                                                    {row.label}
                                                </th>
                                                {row.values.map((value, valueIndex) => {
                                                    const isPreferred = preferred !== null && value.numeric === preferred;
                                                    return (
                                                        <td
                                                            key={compareSchedules[valueIndex].id}
                                                            className={`border-b border-r border-white/[0.08] px-4 py-3 text-center text-sm font-semibold last:border-r-0 ${
                                                                isPreferred ? 'bg-emerald-500/[0.07] text-emerald-300' : 'text-slate-200'
                                                            }`}
                                                        >
                                                            {value.display}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'ok' | 'warn' }) {
    const valueClass = tone === 'warn' && value > 0 ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-white';
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2.5 text-center">
            <p className={`text-lg font-black leading-none ${valueClass}`}>{value}</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
        </div>
    );
}

function ScoreBadge({ label, value, highlight, info }: { label: string; value: number; highlight?: boolean; info?: boolean }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-right">
            <p className="flex items-center justify-end gap-1 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                {label}
                {info && <Info className="h-3 w-3 opacity-60" />}
            </p>
            <CountUp to={value} className={`text-2xl font-black leading-none ${highlight ? 'grad-text' : 'text-white'}`} />
        </div>
    );
}

function ActionButton({ icon, label, onClick, primary, loading }: {
    icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean; loading?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className={`magnetic inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                primary
                    ? 'bg-gradient-to-r from-isik-blue to-isik-blue-lighter text-white shadow-lg shadow-blue-500/25'
                    : 'border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

function FullGrid({ occupancy, dayLabels }: { occupancy: Map<string, Cell>; dayLabels: string[] }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]/60">
            <div className="grid grid-cols-[40px_repeat(5,1fr)] border-b border-white/10 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <div className="py-2" />
                {dayLabels.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="divide-y divide-white/[0.05]">
                {FULL_PERIODS.map((period, rowIdx) => (
                    <div key={period} className="grid grid-cols-[40px_repeat(5,1fr)]">
                        <div className="flex items-center justify-center border-r border-white/[0.05] py-1 text-[9px] tabular-nums text-slate-500">
                            {PERIOD_TIMES[rowIdx]}
                        </div>
                        {DAYS.map((_, di) => {
                            const cell = occupancy.get(`${di}-${period}`);
                            return (
                                <div key={di} className="p-0.5">
                                    {cell && (
                                        <div className={`rounded-md px-1 py-1 text-center text-[9px] font-semibold text-white ${TYPE_BG[cell.type] || TYPE_BG.lecture}/85`}>
                                            {cell.code}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
