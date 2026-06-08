'use client';

import { Loader2, Rocket, SlidersHorizontal, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export interface SelectedCourseItem {
    mainCode: string;
    ects: number;
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
    onGenerate: () => void;
    isGenerating: boolean;
    canGenerate: boolean;
}

function SelectedCoursesTray({ items, onRemove }: { items: SelectedCourseItem[]; onRemove: (mainCode: string) => void }) {
    const { t } = useLanguage();
    return (
        <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t.schedulerSelectedTitle}
            </p>
            {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">
                    {t.schedulerNoSelectionHint}
                </p>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                        <span
                            key={item.mainCode}
                            className="group inline-flex items-center gap-1.5 rounded-lg border border-isik-blue-lighter/25 bg-isik-blue-lighter/10 py-1 pl-2.5 pr-1.5 text-xs font-semibold text-isik-blue-lighter"
                        >
                            {item.mainCode}
                            {item.ects > 0 && <span className="text-[10px] font-normal text-slate-400">{item.ects}</span>}
                            <button
                                type="button"
                                onClick={() => onRemove(item.mainCode)}
                                aria-label={`${item.mainCode} ${t.clearSelection}`}
                                className="flex h-4 w-4 items-center justify-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function PreferencesPanel({ maxEcts, setMaxEcts, maxConflicts, setMaxConflicts }: {
    maxEcts: number; setMaxEcts: (v: number) => void; maxConflicts: number; setMaxConflicts: (v: number) => void;
}) {
    const { t } = useLanguage();
    return (
        <div>
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t.schedulerPreferences}
            </p>
            <div className="space-y-4">
                <div>
                    <label htmlFor="build-max-ects" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {t.maxEcts}: <span className="text-white">{maxEcts}</span>
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
                    <label htmlFor="build-conflict-tolerance" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {t.conflictTolerance}: <span className="text-isik-gold">{maxConflicts}</span>
                    </label>
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
            </div>
        </div>
    );
}

/**
 * Right-rail "command center" build panel: selected-course tray, generation
 * preferences (lifted out of the old hidden Settings popover) and a sticky
 * Generate action. Reuses the page's existing state/handlers via props.
 */
export function BuildPanel({
    selectedItems, onRemove, selectedCount, totalEcts,
    maxEcts, setMaxEcts, maxConflicts, setMaxConflicts,
    onGenerate, isGenerating, canGenerate,
}: BuildPanelProps) {
    const { t } = useLanguage();

    return (
        <aside className="no-print hidden w-80 shrink-0 flex-col border-l border-white/5 bg-surface-800/50 xl:flex">
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
                <SelectedCoursesTray items={selectedItems} onRemove={onRemove} />
                <PreferencesPanel
                    maxEcts={maxEcts}
                    setMaxEcts={setMaxEcts}
                    maxConflicts={maxConflicts}
                    setMaxConflicts={setMaxConflicts}
                />
            </div>

            <div className="shrink-0 border-t border-white/5 p-4">
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
