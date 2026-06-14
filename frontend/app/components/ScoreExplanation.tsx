'use client';

import { useLanguage } from '../context/LanguageContext';
import { InfoTerm } from './LockingTooltip';

export interface ScoreTerm {
    key: string;
    points: number;
}

export interface ScoreInputs {
    score: number;
    conflict_count: number;
    course_count: number;
    total_ects: number;
    /** Authoritative per-term breakdown from the backend (solver `_materialize_schedule`). */
    score_breakdown?: ScoreTerm[];
}

/**
 * Renders the backend `score_breakdown` so the explanation always matches the displayed
 * score. Falls back to the legacy 3-term formula only if a schedule has no breakdown.
 */
export function ScoreExplanation({ s }: { s: ScoreInputs }) {
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

    const rows: ScoreTerm[] = s.score_breakdown && s.score_breakdown.length > 0
        ? s.score_breakdown
        : [
            { key: 'conflict', points: (10 - s.conflict_count) * 50 },
            { key: 'coverage', points: s.course_count * 20 },
            { key: 'ects', points: s.total_ects },
        ];

    return (
        <div>
            <p className="pr-7 text-sm font-bold text-white">{t.scoreInfoTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.scoreInfoIntro}</p>

            <div className="mt-3 space-y-1.5">
                {rows.map((row, index) => {
                    const { label, tip } = termText(row.key);
                    return (
                        <div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                            <span className="text-xs text-slate-200">
                                {tip ? <InfoTerm tip={tip}>{label}</InfoTerm> : label}
                            </span>
                            <span className="w-12 text-right font-mono text-sm font-bold tabular-nums text-isik-blue-lighter">
                                {row.points >= 0 ? '+' : ''}{row.points}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.scoreInfoTotal}</span>
                <span className="grad-text font-mono text-lg font-black tabular-nums">{s.score}</span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t.scoreInfoFootnote}</p>
        </div>
    );
}
