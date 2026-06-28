'use client';

import {
    ChevronLeft,
    ChevronRight,
    Info,
    Loader2,
    Rocket,
    SlidersHorizontal,
    X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export interface SelectedCourseItem {
    mainCode: string;
    ects: number;
}

export type GapPreference = 'compact' | 'balanced' | 'spread';

export interface SchedulerPreferences {
    earliestPeriod: number;
    latestPeriod: number;
    daysOff: string[];
    gapPreference: GapPreference;
}

interface BuildPanelProps {
    selectedItems: SelectedCourseItem[];
    onRemove: (mainCode: string) => void;
    selectedCount: number;
    totalEcts: number;
    maxEcts: number;
    setMaxEcts: (value: number) => void;
    maxConflicts: number;
    setMaxConflicts: (value: number) => void;
    preferences: SchedulerPreferences;
    onPreferencesChange: (patch: Partial<SchedulerPreferences>) => void;
    periodTimes: string[];
    dayOptions: { key: string; label: string }[];
    onGenerate: () => void;
    isGenerating: boolean;
    canGenerate: boolean;
    isOpen: boolean;
    onToggleOpen: () => void;
}

function PreferenceInfo({ label, text }: { label: string; text: string }) {
    return (
        <span className="group relative inline-flex">
            <button
                type="button"
                aria-label={label}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-slate-400 transition hover:border-white/30 hover:text-slate-200 focus-visible:text-slate-200"
            >
                <Info className="h-2.5 w-2.5" />
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-[#141B30]/95 px-3 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-slate-200 opacity-0 shadow-2xl shadow-black/50 backdrop-blur-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {text}
            </span>
        </span>
    );
}

function EctsBudgetMeter({ used, max }: { used: number; max: number }) {
    const { t } = useLanguage();
    const percentage = max > 0 ? Math.min(100, (used / max) * 100) : 100;
    const remaining = max - used;
    const meterClass = used > max
        ? 'bg-red-500'
        : used >= max * 0.85
            ? 'bg-isik-gold'
            : 'bg-isik-blue-lighter';

    return (
        <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t.schedulerEctsBudget}
                </span>
                <span className="font-mono text-xs text-slate-500">
                    <strong className={used > max ? 'text-red-300' : 'text-white'}>{used}</strong> / {max}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                    className={`h-full rounded-full transition-[width,background-color] duration-300 ${meterClass}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <p className={`mt-2 text-[11px] ${used > max ? 'text-red-300' : 'text-slate-500'}`}>
                {remaining < 0
                    ? `${Math.abs(remaining)} ${t.schedulerEctsOver}`
                    : remaining === 0
                        ? t.schedulerEctsFull
                        : `${remaining} ${t.schedulerEctsRemaining}`}
            </p>
        </div>
    );
}

function ClassWindowControl({
    earliest,
    latest,
    periodTimes,
    onChange,
}: {
    earliest: number;
    latest: number;
    periodTimes: string[];
    onChange: (earliest: number, latest: number) => void;
}) {
    const { t } = useLanguage();
    const min = 1;
    const max = periodTimes.length;
    const span = Math.max(1, max - min);
    const left = ((earliest - min) / span) * 100;
    const right = 100 - ((latest - min) / span) * 100;

    return (
        <div>
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t.schedulerClassWindow}
                </span>
                <span className="font-mono text-xs text-white">
                    {periodTimes[earliest - 1]}-{periodTimes[latest - 1]}
                </span>
            </div>
            <div className="relative flex h-7 items-center">
                <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
                <div
                    className="absolute h-1.5 rounded-full bg-gradient-to-r from-isik-blue-lighter to-lab"
                    style={{ left: `${left}%`, right: `${right}%` }}
                />
                <input
                    aria-label={t.schedulerEarliest}
                    type="range"
                    min={min}
                    max={max}
                    value={earliest}
                    onChange={(event) => onChange(Math.min(+event.target.value, latest), latest)}
                    className="scheduler-window-thumb absolute inset-0 h-7 w-full"
                />
                <input
                    aria-label={t.schedulerLatest}
                    type="range"
                    min={min}
                    max={max}
                    value={latest}
                    onChange={(event) => onChange(earliest, Math.max(+event.target.value, earliest))}
                    className="scheduler-window-thumb absolute inset-0 h-7 w-full"
                />
            </div>
        </div>
    );
}

function SelectedCoursesTray({
    items,
    onRemove,
    totalEcts,
    maxEcts,
}: {
    items: SelectedCourseItem[];
    onRemove: (mainCode: string) => void;
    totalEcts: number;
    maxEcts: number;
}) {
    const { t } = useLanguage();
    return (
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t.schedulerSelectedTitle}
                </p>
                <span className="font-mono text-[11px] text-slate-500">
                    {items.length} {t.courses}
                </span>
            </div>
            {items.length === 0 ? (
                <p className="mb-4 rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                    {t.schedulerNoSelectionHint}
                </p>
            ) : (
                <div className="mb-4 flex flex-wrap gap-1.5">
                    {items.map((item) => (
                        <span
                            key={item.mainCode}
                            className="group inline-flex items-center gap-1.5 rounded-lg border border-isik-blue-lighter/25 bg-isik-blue-lighter/10 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-isik-blue-lighter transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200"
                        >
                            {item.mainCode}
                            {item.ects > 0 && <span className="text-[10px] font-normal text-slate-400">{item.ects}</span>}
                            <button
                                type="button"
                                onClick={() => onRemove(item.mainCode)}
                                aria-label={`${t.removeCourse}: ${item.mainCode}`}
                                title={t.removeCourse}
                                className="flex h-4 w-4 items-center justify-center rounded text-slate-400 transition hover:bg-red-500/20 hover:text-red-200"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <EctsBudgetMeter used={totalEcts} max={maxEcts} />
        </div>
    );
}

function PreferencesPanel({
    maxEcts, setMaxEcts, maxConflicts, setMaxConflicts,
    preferences, onPreferencesChange, periodTimes, dayOptions,
}: {
    maxEcts: number; setMaxEcts: (v: number) => void;
    maxConflicts: number; setMaxConflicts: (v: number) => void;
    preferences: SchedulerPreferences;
    onPreferencesChange: (patch: Partial<SchedulerPreferences>) => void;
    periodTimes: string[];
    dayOptions: { key: string; label: string }[];
}) {
    const { t } = useLanguage();
    const gapOptions: { key: GapPreference; label: string }[] = [
        { key: 'compact', label: t.schedulerGapCompact },
        { key: 'balanced', label: t.schedulerGapBalanced },
        { key: 'spread', label: t.schedulerGapSpread },
    ];
    const toggleDayOff = (key: string) => {
        const next = preferences.daysOff.includes(key)
            ? preferences.daysOff.filter((day) => day !== key)
            : [...preferences.daysOff, key];
        onPreferencesChange({ daysOff: next });
    };

    return (
        <div className="rounded-2xl border border-white/5 bg-surface-800/50 p-4">
            <p className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t.schedulerPreferences}
            </p>
            <div className="space-y-5">
                <div>
                    <label htmlFor="build-max-ects" className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <span>{t.maxEcts}</span>
                        <span className="font-mono text-xs tracking-normal text-white">{maxEcts}</span>
                    </label>
                    <input
                        id="build-max-ects"
                        name="maxEcts"
                        type="range"
                        min="0"
                        max="60"
                        value={maxEcts}
                        onChange={(event) => setMaxEcts(+event.target.value)}
                        className="h-1.5 w-full rounded-full accent-isik-blue-lighter"
                    />
                </div>
                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {t.conflictTolerance}
                            <PreferenceInfo label={t.conflictTolerance} text={t.schedulerConflictHelp} />
                        </span>
                        <span className="font-mono text-xs text-isik-gold">{maxConflicts}</span>
                    </div>
                    <input
                        id="build-conflict-tolerance"
                        name="maxConflicts"
                        type="range"
                        min="0"
                        max="5"
                        value={maxConflicts}
                        onChange={(event) => setMaxConflicts(+event.target.value)}
                        className="h-1.5 w-full rounded-full accent-isik-gold"
                    />
                </div>
                <ClassWindowControl
                    earliest={preferences.earliestPeriod}
                    latest={preferences.latestPeriod}
                    periodTimes={periodTimes}
                    onChange={(earliestPeriod, latestPeriod) => onPreferencesChange({ earliestPeriod, latestPeriod })}
                />
                <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {t.schedulerDaysOff}
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                        {dayOptions.map((day) => {
                            const active = preferences.daysOff.includes(day.key);
                            return (
                                <button
                                    key={day.key}
                                    type="button"
                                    onClick={() => toggleDayOff(day.key)}
                                    aria-pressed={active}
                                    className={`rounded-lg border py-1.5 text-[11px] font-medium transition ${
                                        active
                                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {day.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {t.schedulerGapPref}
                        <PreferenceInfo label={t.schedulerGapPref} text={t.schedulerGapHelp} />
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {gapOptions.map((option) => {
                            const active = preferences.gapPreference === option.key;
                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => onPreferencesChange({ gapPreference: option.key })}
                                    aria-pressed={active}
                                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                                        active
                                            ? 'border-isik-blue-lighter/40 bg-isik-blue-lighter/15 text-isik-blue-lighter'
                                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function BuildPanel({
    selectedItems, onRemove, selectedCount, totalEcts,
    maxEcts, setMaxEcts, maxConflicts, setMaxConflicts,
    preferences, onPreferencesChange, periodTimes, dayOptions,
    onGenerate, isGenerating, canGenerate, isOpen, onToggleOpen,
}: BuildPanelProps) {
    const { t } = useLanguage();

    if (!isOpen) {
        return (
            <aside className="no-print hidden w-[50px] shrink-0 flex-col items-center gap-4 border-l border-white/5 bg-[#0E1428]/65 py-3 backdrop-blur-xl xl:flex">
                <button
                    type="button"
                    onClick={onToggleOpen}
                    aria-label={t.schedulerShowBuild}
                    title={t.schedulerShowBuild}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <span className="[writing-mode:vertical-rl] text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t.schedulerBuildTitle}
                </span>
            </aside>
        );
    }

    return (
        <aside className="no-print hidden w-[332px] shrink-0 flex-col border-l border-white/5 bg-[#0E1428]/65 backdrop-blur-xl xl:flex">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t.schedulerBuildTitle}
                </span>
                <button
                    type="button"
                    onClick={onToggleOpen}
                    aria-label={t.schedulerHideBuild}
                    title={t.schedulerHideBuild}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
                <SelectedCoursesTray
                    items={selectedItems}
                    onRemove={onRemove}
                    totalEcts={totalEcts}
                    maxEcts={maxEcts}
                />
                <PreferencesPanel
                    maxEcts={maxEcts}
                    setMaxEcts={setMaxEcts}
                    maxConflicts={maxConflicts}
                    setMaxConflicts={setMaxConflicts}
                    preferences={preferences}
                    onPreferencesChange={onPreferencesChange}
                    periodTimes={periodTimes}
                    dayOptions={dayOptions}
                />
            </div>

            <div className="shrink-0 border-t border-white/5 bg-surface-900/60 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                    <span><span className="font-bold text-white">{selectedCount}</span> {t.courses}</span>
                    <span><span className="font-bold text-white">{totalEcts}</span> {t.ects}</span>
                </div>
                <button
                    type="button"
                    onClick={onGenerate}
                    disabled={isGenerating || !canGenerate}
                    className="btn-primary magnetic w-full !py-2.5"
                >
                    {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />{t.creating}</>
                    ) : (
                        <><Rocket className="h-4 w-4" />{t.createSchedule}</>
                    )}
                </button>
            </div>
        </aside>
    );
}
