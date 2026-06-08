'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, Calendar, Check, Copy, Crown, GitCompareArrows, Heart, Info,
    Printer, Share2, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { computeScheduleStats } from '../lib/scheduleExport';
import { AuroraBackground } from './AuroraBackground';
import { CountUp } from './CountUp';
import { LockingTooltip } from './LockingTooltip';
import { ScoreExplanation } from './ScoreExplanation';

interface ResultCourse {
    code: string;
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
}

interface GeneratedSchedulesViewProps {
    schedules: ResultSchedule[];
    currentIdx: number;
    lockedSlots: Set<string>;
    sourceLabel: string | null;
    shareUrl: string | null;
    isSharing?: boolean;
    onSelect: (idx: number) => void;
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

export function GeneratedSchedulesView({
    schedules, currentIdx, lockedSlots, sourceLabel, shareUrl, isSharing,
    onSelect, onClose, onExportIcs, onPrint, onShare, onCopyLink,
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
    const dayLabels = [t.mon, t.tue, t.wed, t.thu, t.fri];

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
            if (prev.length >= 2) return [prev[1], id];
            return [...prev, id];
        });

    // Keyboard navigation (b): arrows move focus, Enter selects, Esc closes.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (compareOpen) {
                if (e.key === 'Escape') { e.preventDefault(); setCompareOpen(false); }
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
    const compareSchedules = compareIds.map((id) => schedules.find((s) => s.id === id)).filter(Boolean) as ResultSchedule[];

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
                {/* Hero */}
                <div className="mb-10 max-w-2xl">
                    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-isik-blue-lighter/25 bg-isik-blue-lighter/10 px-4 py-1.5 text-sm font-medium text-isik-blue-lighter">
                        <Crown className="h-3.5 w-3.5" />
                        {t.resultsEyebrowPre}{schedules.length}{t.resultsEyebrowPost}
                    </p>
                    <h2 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                        {t.resultsTitlePre}
                        <span className="grad-text">{t.resultsTitleHighlight}</span>
                        {t.resultsTitlePost}
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-400">{t.resultsSubtitle}</p>
                </div>

                {/* Cards */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {schedules.map((schedule, idx) => {
                        const stats = perStats[idx];
                        const isSelected = idx === currentIdx;
                        const isFocused = idx === focusIdx;
                        const isBest = idx === 0;
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
                                            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all ${
                                                inCompare
                                                    ? 'border-isik-blue-lighter/40 bg-isik-blue-lighter/15 text-isik-blue-lighter'
                                                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            <GitCompareArrows className="h-3.5 w-3.5" />
                                            {t.resultsCompare}
                                        </button>
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
                                        <div className="space-y-2">
                                            {selected.courses.map((course) => (
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
            </main>

            {/* Compare bar */}
            {compareIds.length > 0 && !compareOpen && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0E1428]/90 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-isik-blue-lighter">
                            <GitCompareArrows className="h-4 w-4" />
                            {t.resultsCompare}
                        </span>
                        {compareSchedules.map((s) => {
                            const idx = schedules.indexOf(s);
                            return (
                                <span key={s.id} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
                                    <span className="font-semibold text-white">{t.program} #{idx + 1}</span>
                                    <span className="text-slate-400">{t.homeStatScore} {s.score} · {s.total_ects} {t.ects}</span>
                                    <button type="button" onClick={() => toggleCompare(s.id)} className="text-slate-400 hover:text-white" aria-label="remove">
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
                            className="magnetic ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-isik-blue to-isik-blue-lighter px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 disabled:opacity-40"
                        >
                            <GitCompareArrows className="h-3.5 w-3.5" />
                            {t.resultsCompare}
                        </button>
                    </div>
                </div>
            )}

            {/* Compare view (c) */}
            {compareOpen && compareSchedules.length === 2 && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0E1428] p-6 shadow-2xl">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">{t.resultsCompareView}</h3>
                            <button type="button" onClick={() => setCompareOpen(false)} className="text-slate-400 hover:text-white" aria-label="close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                            {compareSchedules.map((s) => {
                                const idx = schedules.indexOf(s);
                                const stats = perStats[idx];
                                return (
                                    <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-sm font-bold text-white">{t.program} #{idx + 1}</p>
                                            <span className="grad-text text-xl font-black">{s.score}</span>
                                        </div>
                                        <MiniGrid occupancy={occupancies[idx]} />
                                        <div className="mt-3 grid grid-cols-3 gap-2">
                                            <Stat value={s.total_ects} label={t.ects} />
                                            <Stat value={s.conflict_count} label={t.conflictsLabel} tone={s.conflict_count > 0 ? 'warn' : 'ok'} />
                                            <Stat value={stats.freeDays.length} label={t.resultsFreeDaysLabel} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { onSelect(idx); setCompareOpen(false); }}
                                            className="magnetic mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-isik-blue to-isik-blue-lighter px-4 py-2 text-xs font-semibold text-white"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                            {t.resultsSelect}
                                        </button>
                                    </div>
                                );
                            })}
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
