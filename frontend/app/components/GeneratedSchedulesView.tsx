'use client';

import { Fragment, useEffect, useId, useMemo, useState } from 'react';
import {
    AlertTriangle, ArrowLeft, BookOpen, Calendar, CalendarDays, CalendarOff,
    Check, CheckCircle2, Clock, Coffee, Copy, Crown, FlaskConical,
    GitCompareArrows, Heart, Info, Layers, PenLine, Printer, Share2, Target, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { computeScheduleStats, type ScheduleStats } from '../lib/scheduleExport';
import { AuroraBackground } from './AuroraBackground';
import { CountUp } from './CountUp';
import { InfoTerm, LockingTooltip } from './LockingTooltip';
import { ScoreExplanation } from './ScoreExplanation';
import { BrandLogo } from './BrandLogo';

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
    /** Authoritative per-term score breakdown from the backend. */
    score_breakdown?: { key: string; points: number }[];
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
const TYPE_BADGE: Record<string, string> = { lecture: 'badge-blue', lab: 'badge-purple', ps: 'badge-green' };
const COLS = 3;

// Redesign (handoff Direction A) presentational tokens.
const TYPE_TEXT: Record<string, string> = { lecture: 'text-lecture', lab: 'text-lab', ps: 'text-ps' };
const TYPE_CELL_BG: Record<string, string> = { lecture: 'bg-lecture/[0.18]', lab: 'bg-lab/[0.18]', ps: 'bg-ps/[0.18]' };
const TYPE_EDGE: Record<string, string> = {
    lecture: 'shadow-[inset_3px_0_0_#3B82F6]',
    lab: 'shadow-[inset_3px_0_0_#8B5CF6]',
    ps: 'shadow-[inset_3px_0_0_#10B981]',
};
const STAT_TONE: Record<string, string> = {
    blue: 'bg-isik-blue-lighter/[0.14] text-isik-blue-lighter',
    green: 'bg-emerald-500/[0.14] text-emerald-300',
    gold: 'bg-isik-gold/[0.14] text-isik-gold',
    violet: 'bg-violet-500/[0.14] text-violet-300',
    none: 'bg-white/[0.05] text-slate-400',
};

type ArchetypeKind = 'best' | 'compact' | 'freeDays' | 'lateStart' | 'light';
const ARCHETYPE_META: Record<ArchetypeKind, { icon: typeof Crown; chip: string }> = {
    best: { icon: Crown, chip: 'bg-isik-gold/[0.14] text-isik-gold ring-isik-gold/30' },
    freeDays: { icon: CalendarOff, chip: 'bg-emerald-500/[0.14] text-emerald-300 ring-emerald-500/30' },
    compact: { icon: Layers, chip: 'bg-isik-blue-lighter/[0.14] text-isik-blue-lighter ring-isik-blue-lighter/30' },
    lateStart: { icon: Clock, chip: 'bg-isik-blue-lighter/[0.14] text-isik-blue-lighter ring-isik-blue-lighter/30' },
    light: { icon: Target, chip: 'bg-violet-500/[0.14] text-violet-300 ring-violet-500/30' },
};

const SECTION_CARD = 'rounded-[20px] border border-white/[0.06] bg-[#0E1428]/70 p-5 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6';

function typeIcon(type: string, size = 11) {
    if (type === 'lab') return <FlaskConical size={size} />;
    if (type === 'ps') return <PenLine size={size} />;
    return <BookOpen size={size} />;
}

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
    // The shareable timetable must reflect the chosen variant's section codes, not just the list below it.
    const activeOccupancy = buildOccupancy(activeVariantCourses);
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
    const selectedReasons: { icon: typeof Crown; tone: 'good' | 'warn' | 'neutral'; text: string }[] =
        selected && selectedStats
            ? [
                { icon: Check, tone: 'neutral', text: t.resultsWhyCourses.replace('{count}', String(selected.course_count)) },
                selected.conflict_count === 0
                    ? { icon: CheckCircle2, tone: 'good', text: t.resultsWhyNoConflict }
                    : { icon: AlertTriangle, tone: 'warn', text: t.resultsWhyHasConflicts.replace('{count}', String(selected.conflict_count)) },
                selectedStats.freeDays.length > 0
                    ? {
                        icon: CalendarOff, tone: 'neutral',
                        text: t.resultsWhyFreeDays.replace(
                            '{days}',
                            selectedStats.freeDays.map((day) => dayLabels[DAY_INDEX[day]]).join(', '),
                        ),
                    }
                    : { icon: Calendar, tone: 'neutral', text: t.resultsWhyNoFreeDays },
                { icon: Coffee, tone: 'neutral', text: t.resultsWhyGaps.replace('{count}', String(selectedStats.totalGaps)) },
                {
                    icon: Clock, tone: 'neutral',
                    text: t.resultsWhyHours
                        .replace('{count}', String(selectedStats.totalHours))
                        .replace('{first}', periodTime(selectedStats.earliestPeriod))
                        .replace('{last}', periodTime(selectedStats.latestPeriod)),
                },
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

    // Honest archetype labels: each badge is assigned to the single best alternative for
    // that metric (codex's MMR diversity makes these genuinely distinct schedules).
    const archetypeByIdx = useMemo<Record<number, ArchetypeKind>>(() => {
        if (schedules.length <= 1) return {};
        const kinds: Record<number, ArchetypeKind> = { 0: 'best' };
        const used = new Set<number>([0]);
        const assign = (kind: ArchetypeKind, metric: (i: number) => number, prefersHigher: boolean) => {
            // Honest: only label the single, uniquely-best schedule for this metric, and only
            // when there is real variation. Avoids "most free days" on cards that all have zero.
            const values = schedules.map((_, i) => metric(i));
            const best = prefersHigher ? Math.max(...values) : Math.min(...values);
            const worst = prefersHigher ? Math.min(...values) : Math.max(...values);
            if (best === worst) return;
            const winners = values.flatMap((value, i) => (value === best ? [i] : []));
            if (winners.length !== 1 || used.has(winners[0])) return;
            kinds[winners[0]] = kind;
            used.add(winners[0]);
        };
        assign('compact', (i) => perStats[i].totalGaps, false);
        assign('freeDays', (i) => perStats[i].freeDays.length, true);
        assign('lateStart', (i) => perStats[i].earliestPeriod ?? 0, true);
        assign('light', (i) => perStats[i].totalHours, false);
        return kinds;
    }, [schedules, perStats]);

    const archetypeLabel = (kind: ArchetypeKind): string => ({
        best: t.resultsBestMatch,
        compact: t.resultsArchetypeCompact,
        freeDays: t.resultsArchetypeFreeDays,
        lateStart: t.resultsArchetypeLateStart,
        light: t.resultsArchetypeLight,
    }[kind]);
    const selectedKind = archetypeByIdx[currentIdx];

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B1020] text-slate-100 no-print">
            <AuroraBackground variant="absolute" vignette={false} className="opacity-70" />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B1020]/85 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <BrandLogo size="md" showWordmark={false} />
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
                {/* Calm intro — the heading lives in the sticky header; keep a single, low-key context cue. */}
                <div className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-isik-blue-lighter/25 bg-isik-blue-lighter/10 px-3.5 py-1.5 text-[13px] font-medium text-isik-blue-lighter">
                        <Crown className="h-3.5 w-3.5" />
                        {single ? t.resultsSingleEyebrow : <>{t.resultsEyebrowPre}{schedules.length}{t.resultsEyebrowPost}</>}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-400">{single ? t.resultsSingleSubtitle : t.resultsSubtitle}</p>
                </div>

                {/* Workspace: alternatives rail (left) + selected detail (right) */}
                <div className={single ? '' : 'grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start'}>
                <div className={single ? 'mx-auto max-w-md' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:content-start'}>
                    {schedules.map((schedule, idx) => {
                        const stats = perStats[idx];
                        const isSelected = idx === currentIdx;
                        const isFocused = idx === focusIdx;
                        const isBest = idx === 0 && !single;
                        const inCompare = compareIds.includes(schedule.id);
                        const kind = archetypeByIdx[idx];
                        return (
                            <div
                                key={schedule.id}
                                className={`lift relative rounded-2xl border p-3.5 transition-all ${
                                    isSelected
                                        ? 'border-isik-blue-lighter/45 bg-isik-blue-lighter/[0.08]'
                                        : isBest
                                            ? 'border-isik-gold/35 bg-white/[0.02] hover:bg-white/[0.035]'
                                            : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.035]'
                                } ${isFocused ? 'ring-2 ring-isik-blue-lighter/70 ring-offset-2 ring-offset-[#0B1020]' : ''}`}
                            >
                                <div className="mb-3 flex items-center gap-2.5">
                                    <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-lg bg-white/[0.06] px-1 font-mono text-[11px] font-bold text-slate-300">
                                        {idx + 1}
                                    </span>
                                    {kind ? (
                                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] font-bold ring-1 ring-inset ${ARCHETYPE_META[kind].chip}`}>
                                            <ArchetypeIcon kind={kind} className="h-3 w-3" />
                                            {archetypeLabel(kind)}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-semibold text-slate-300">{t.program} #{idx + 1}</span>
                                    )}
                                    <LockingTooltip
                                        className="group/score ml-auto inline-flex cursor-help items-center gap-1.5 rounded-lg px-1 outline-none transition focus-visible:ring-2 focus-visible:ring-isik-blue-lighter/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1428]"
                                        label={t.scoreInfoTitle}
                                        holdHint={t.scoreInfoHoldHint}
                                        lockedHint={t.scoreInfoLockedHint}
                                        closeLabel={t.scoreInfoClose}
                                        content={<ScoreExplanation s={schedule} />}
                                    >
                                        <Info className="h-3 w-3 text-slate-500 opacity-60 transition group-hover/score:text-slate-300" />
                                        <CountUp to={schedule.score} className="font-mono text-lg font-extrabold leading-none text-white" />
                                    </LockingTooltip>
                                </div>

                                <MiniGrid occupancy={occupancies[idx]} />

                                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                                    <span className={`inline-flex items-center gap-1.5 ${schedule.conflict_count === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {schedule.conflict_count === 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                        {conflictLabel(schedule.conflict_count)}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarOff className="h-3 w-3" />
                                        {stats.freeDays.length} {t.resultsFreeDaysLabel}
                                    </span>
                                    <span className="ml-auto font-mono text-slate-500">{schedule.total_ects} {t.ects}</span>
                                </div>

                                {(schedule.variant_count ?? 1) > 1 && (
                                    <p className="mt-2 text-[10px] text-slate-500">↔ {schedule.variant_count} {t.resultsVariantsShort}</p>
                                )}

                                <div className="mt-3 flex items-center gap-2">
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
                        );
                    })}
                </div>

                <div className="min-w-0">
                {selected && selectedStats && (
                    <div className="flex flex-col gap-[18px]">
                        {/* Score header strip */}
                        <section className={SECTION_CARD}>
                            <div className="flex flex-wrap items-center gap-5">
                                <LockingTooltip
                                    className="shrink-0 cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-isik-blue-lighter/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1428]"
                                    label={t.scoreInfoTitle}
                                    holdHint={t.scoreInfoHoldHint}
                                    lockedHint={t.scoreInfoLockedHint}
                                    closeLabel={t.scoreInfoClose}
                                    content={<ScoreExplanation s={selected} />}
                                >
                                    <ScoreDonut value={selected.score} />
                                </LockingTooltip>
                                <div className="min-w-[200px] flex-1">
                                    {selectedKind && (
                                        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ring-1 ring-inset ${ARCHETYPE_META[selectedKind].chip}`}>
                                            <ArchetypeIcon kind={selectedKind} className="h-3.5 w-3.5" />
                                            {archetypeLabel(selectedKind)}
                                        </span>
                                    )}
                                    <h2 className="mt-2.5 text-[22px] font-extrabold leading-tight text-white">{t.program} #{currentIdx + 1}</h2>
                                    <p className="mt-1 text-[13px] text-slate-400">
                                        {conflictLabel(selected.conflict_count)} · {selectedStats.freeDays.length} {t.resultsFreeDaysLabel} · {selected.total_ects} {t.ects}
                                        {(selected.variant_count ?? 1) > 1 ? ` · ${selected.variant_count} ${t.resultsVariantsShort}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                <StatTile icon={Layers} value={selected.course_count} label={t.resultsStatCourses} tone="blue" />
                                <StatTile icon={CalendarOff} value={selectedStats.freeDays.length} label={t.resultsFreeDaysLabel} tone="green" />
                                <StatTile icon={Coffee} value={`${selectedStats.totalGaps}h`} label={t.resultsCompareGaps} tone="gold" />
                                <StatTile icon={Clock} value={periodTime(selectedStats.earliestPeriod)} label={t.resultsCompareFirstClass} />
                            </div>
                        </section>

                        {/* Weekly grid */}
                        <section className={SECTION_CARD}>
                            <div className="mb-3.5 flex flex-wrap items-center gap-3">
                                <h3 className="text-sm font-bold text-white">{t.weeklySchedule}</h3>
                                <div className="ml-auto flex items-center gap-3">
                                    {(['lecture', 'lab', 'ps'] as const).map((ty) => (
                                        <span key={ty} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                                            <span className={`h-2.5 w-2.5 rounded-[3px] ${TYPE_BG[ty]}`} />
                                            {typeLabel(ty)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <FullGrid occupancy={activeOccupancy} courses={activeVariantCourses} dayLabels={dayLabels} timeLabel={t.resultsTimeColumn} />
                        </section>

                        {/* Why + score breakdown */}
                        <section className={SECTION_CARD}>
                            <div className="grid gap-6 lg:grid-cols-2">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-isik-blue-lighter">{t.resultsWhyTitle}</p>
                                    <div className="mt-3.5 flex flex-col gap-2.5">
                                        {selectedReasons.map((reason, i) => {
                                            const ReasonIcon = reason.icon;
                                            return (
                                                <div key={i} className="flex items-center gap-2.5 text-[13px] text-slate-200">
                                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                                                        reason.tone === 'warn'
                                                            ? 'bg-isik-gold/[0.14] text-isik-gold'
                                                            : reason.tone === 'good'
                                                                ? 'bg-emerald-500/[0.14] text-emerald-300'
                                                                : 'bg-white/[0.05] text-slate-400'
                                                    }`}>
                                                        <ReasonIcon className="h-3.5 w-3.5" />
                                                    </span>
                                                    <span>{reason.text}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="lg:border-l lg:border-white/[0.06] lg:pl-6">
                                    <div className="mb-3.5 flex items-baseline justify-between">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-isik-blue-lighter">{t.resultsScoreBreakdown}</p>
                                        <span className="font-mono text-[13px] text-slate-300">{selected.score}<span className="text-slate-600">/100</span></span>
                                    </div>
                                    <ScoreBreakdownBars s={selected} />
                                </div>
                            </div>
                            {searchComplete === false && (
                                <p className="mt-4 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-slate-500">
                                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        {t.resultsSearchIncomplete.replace('{count}', String(candidatePoolSize ?? schedules.length))}
                                    </span>
                                </p>
                            )}
                        </section>

                        {/* Course list */}
                        <section className={SECTION_CARD}>
                            <div className="mb-3.5 flex flex-wrap items-center gap-2">
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                    {t.resultsStatCourses} · {activeVariantCourses.length}
                                </p>
                            </div>
                            {selectedVariants.length > 1 && (
                                <div className="mb-4">
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
                            <div className="grid gap-2.5 sm:grid-cols-2">
                                {activeVariantCourses.map((course) => (
                                    <div
                                        key={course.code}
                                        className={`flex items-center gap-2.5 rounded-xl bg-white/[0.022] px-3 py-2.5 ${TYPE_EDGE[course.type] || TYPE_EDGE.lecture}`}
                                    >
                                        <span className={`flex shrink-0 ${TYPE_TEXT[course.type] || TYPE_TEXT.lecture}`}>{typeIcon(course.type, 15)}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 text-[13px] font-bold text-white">
                                                <span className="truncate">{course.main_code || course.code}</span>
                                                <span className={`badge ${TYPE_BADGE[course.type] || TYPE_BADGE.lecture} shrink-0`}>{typeLabel(course.type)}</span>
                                            </p>
                                            <p className="truncate text-[11.5px] text-slate-400">{course.name}</p>
                                        </div>
                                        {course.ects != null && course.ects > 0 && (
                                            <span className="shrink-0 font-mono text-[11px] text-slate-500">{course.ects} {t.ects}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Share & export */}
                        <section className="rounded-[20px] border border-isik-blue-lighter/20 bg-gradient-to-br from-isik-blue-lighter/[0.06] to-lab/[0.04] p-5 sm:p-6">
                            <div className="flex flex-wrap items-center gap-5">
                                <div className="shrink-0 rounded-xl bg-white p-2">
                                    <QRCodeSVG value={shareUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://isikschedule')} size={64} />
                                </div>
                                <div className="min-w-[180px] flex-1">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-isik-blue-lighter">{t.resultsShareableEyebrow}</p>
                                    <p className="mt-1 text-[15px] font-bold text-white">{t.resultsPhoneTitle}</p>
                                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-400">{t.resultsPhoneDesc}</p>
                                </div>
                                <div className="grid min-w-[280px] flex-1 grid-cols-2 gap-2.5">
                                    <ActionButton icon={<Share2 className="h-4 w-4" />} label={t.resultsShare} onClick={onShare} loading={isSharing} primary />
                                    <ActionButton icon={<CalendarDays className="h-4 w-4" />} label={t.resultsExportIcs} onClick={onExportIcs} />
                                    <ActionButton icon={<Printer className="h-4 w-4" />} label={t.resultsPrintPdf} onClick={onPrint} />
                                    <ActionButton icon={<Copy className="h-4 w-4" />} label={t.resultsCopy} onClick={onCopyLink} />
                                </div>
                            </div>
                        </section>
                    </div>
                )}
                </div>
                </div>
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

function ArchetypeIcon({ kind, className }: { kind: ArchetypeKind; className?: string }) {
    const Icon = ARCHETYPE_META[kind].icon;
    return <Icon className={className} />;
}

function StatTile({ icon: Icon, value, label, tone = 'none' }: {
    icon: typeof Crown; value: React.ReactNode; label: string; tone?: keyof typeof STAT_TONE;
}) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${STAT_TONE[tone]}`}>
                <Icon className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 leading-tight">
                <p className="truncate font-mono text-[15px] font-extrabold text-white">{value}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
            </div>
        </div>
    );
}

function ScoreDonut({ value, size = 92, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
    const gradientId = `donut-${useId().replace(/:/g, '')}`;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.max(0, Math.min(value, 100)) / 100);
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${gradientId})`}
                    strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                />
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="55%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="font-mono font-extrabold text-white" style={{ fontSize: size * 0.3 }}>{value}</span>
                <span className="mt-0.5 text-[8.5px] font-semibold tracking-[0.14em] text-slate-500">/ 100</span>
            </div>
        </div>
    );
}

function ScoreBreakdownBars({ s }: { s: ResultSchedule }) {
    const { t } = useLanguage();
    const termText = (key: string): { label: string; tip: string } => {
        switch (key) {
            case 'conflict': return { label: t.scoreInfoConflictLabel, tip: t.scoreInfoConflictTip };
            case 'coverage': return { label: t.scoreInfoCoverageLabel, tip: t.scoreInfoCoverageTip };
            case 'ects': return { label: t.scoreInfoEctsLabel, tip: t.scoreInfoEctsTip };
            case 'free_days': return { label: t.scoreInfoFreeDaysTermLabel, tip: t.scoreInfoFreeDaysTip };
            case 'gaps': return { label: t.scoreInfoGapsLabel, tip: t.scoreInfoGapsTip };
            default: return { label: key, tip: '' };
        }
    };
    // Authoritative terms from the backend; fall back to the legacy 3-term formula if absent.
    const rows = s.score_breakdown && s.score_breakdown.length > 0
        ? s.score_breakdown
        : [
            { key: 'conflict', points: (10 - s.conflict_count) * 50 },
            { key: 'coverage', points: s.course_count * 20 },
            { key: 'ects', points: s.total_ects },
        ];
    // Bars read as each term's share of the positive contribution; penalties show as 0-width and dimmed.
    const positiveTotal = rows.reduce((sum, row) => sum + Math.max(0, row.points), 0) || 1;
    return (
        <div className="flex flex-col gap-3">
            {rows.map((row, i) => {
                const { label, tip } = termText(row.key);
                const dim = row.points <= 0;
                const pct = dim ? 0 : Math.round((row.points / positiveTotal) * 100);
                return (
                    <div key={i}>
                        <div className="mb-1 flex items-baseline justify-between gap-3">
                            <span className={`text-xs ${dim ? 'text-slate-500' : 'text-slate-200'}`}>
                                {tip ? <InfoTerm tip={tip}>{label}</InfoTerm> : label}
                            </span>
                            <span className={`font-mono text-[11px] ${dim ? 'text-slate-600' : 'text-slate-400'}`}>
                                {row.points >= 0 ? '+' : ''}{row.points}
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                                className={`h-full rounded-full ${dim ? 'bg-slate-500/30' : 'bg-gradient-to-r from-isik-blue-lighter via-lab to-isik-gold'}`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
            <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.scoreInfoTotal}</span>
                <span className="grad-text font-mono text-base font-black tabular-nums">{s.score}</span>
            </div>
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

function FullGrid({ occupancy, courses, dayLabels, timeLabel, compact = false }: {
    occupancy: Map<string, Cell>; courses: ResultCourse[]; dayLabels: string[]; timeLabel: string; compact?: boolean;
}) {
    const byCode: Record<string, ResultCourse> = {};
    (courses || []).forEach((course) => { byCode[course.main_code || course.code] = course; });
    const rowMin = compact ? 38 : 46;
    const hairline = '1px solid rgba(255,255,255,0.03)';
    return (
        <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0B1020]/60">
            <div className="grid" style={{ gridTemplateColumns: '52px repeat(5, 1fr)' }}>
                <div className="border-b border-white/[0.05] py-2.5 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {timeLabel}
                </div>
                {dayLabels.map((day) => (
                    <div key={day} className="border-b border-l border-white/[0.05] py-2.5 text-center text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-300">
                        {day}
                    </div>
                ))}
                {FULL_PERIODS.map((period, rowIdx) => (
                    <Fragment key={period}>
                        <div
                            className="flex items-start justify-center pt-1.5 font-mono text-[10px] text-slate-500"
                            style={{ minHeight: rowMin, borderBottom: rowIdx < 9 ? hairline : 'none' }}
                        >
                            {PERIOD_TIMES[rowIdx]}
                        </div>
                        {DAYS.map((_, di) => {
                            const cell = occupancy.get(`${di}-${period}`);
                            const course = cell ? byCode[cell.code] : undefined;
                            return (
                                <div
                                    key={di}
                                    className="border-l border-white/[0.05] p-0.5"
                                    style={{ minHeight: rowMin, borderBottom: rowIdx < 9 ? hairline : 'none' }}
                                >
                                    {cell && (
                                        <div
                                            className={`flex h-full flex-col justify-center rounded-md px-1.5 py-1 ${TYPE_CELL_BG[cell.type] || TYPE_CELL_BG.lecture} ${TYPE_EDGE[cell.type] || TYPE_EDGE.lecture}`}
                                            style={{ minHeight: rowMin - 4 }}
                                        >
                                            <span className="flex items-center gap-1 truncate text-[11px] font-bold text-white">
                                                <span className={`flex shrink-0 ${TYPE_TEXT[cell.type] || TYPE_TEXT.lecture}`}>{typeIcon(cell.type, 10)}</span>
                                                <span className="truncate">{cell.code}</span>
                                            </span>
                                            {!compact && course?.teacher && (
                                                <span className="truncate text-[9.5px] text-slate-400">
                                                    {course.teacher.replace(/^(Dr\.|Prof\.|Ar\. Gör\.) /, '')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
