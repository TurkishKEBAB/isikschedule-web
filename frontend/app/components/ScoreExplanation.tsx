'use client';

import { useLanguage } from '../context/LanguageContext';
import { InfoTerm } from './LockingTooltip';

/**
 * Score weights — mirror of the backend formula in
 * `backend/app/scheduling/solver.py` (`_materialize_schedule`):
 *   score = (10 - conflict_count) * 50 + course_count * 20 + total_ects
 * Keep these in sync if the backend scoring ever changes.
 */
const CONFLICT_FREE_BASE = 10;
const CONFLICT_WEIGHT = 50;
const COVERAGE_WEIGHT = 20;

export interface ScoreInputs {
    score: number;
    conflict_count: number;
    course_count: number;
    total_ects: number;
}

function Row({ label, formula, points }: { label: React.ReactNode; formula: string; points: number }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
            <span className="text-xs text-slate-200">{label}</span>
            <span className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] text-slate-500">{formula}</span>
                <span className="w-12 text-right font-mono text-sm font-bold tabular-nums text-isik-blue-lighter">
                    {points >= 0 ? '+' : ''}{points}
                </span>
            </span>
        </div>
    );
}

/** Detailed, term-by-term breakdown of how a schedule's score is computed. */
export function ScoreExplanation({ s }: { s: ScoreInputs }) {
    const { t } = useLanguage();

    const conflictPts = (CONFLICT_FREE_BASE - s.conflict_count) * CONFLICT_WEIGHT;
    const coveragePts = s.course_count * COVERAGE_WEIGHT;
    const ectsPts = s.total_ects;

    return (
        <div>
            <p className="pr-7 text-sm font-bold text-white">{t.scoreInfoTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.scoreInfoIntro}</p>

            <div className="mt-3 space-y-1.5">
                <Row
                    label={<InfoTerm tip={t.scoreInfoConflictTip}>{t.scoreInfoConflictLabel}</InfoTerm>}
                    formula={`(10 − ${s.conflict_count}) × 50`}
                    points={conflictPts}
                />
                <Row
                    label={<InfoTerm tip={t.scoreInfoCoverageTip}>{t.scoreInfoCoverageLabel}</InfoTerm>}
                    formula={`${s.course_count} × 20`}
                    points={coveragePts}
                />
                <Row
                    label={<InfoTerm tip={t.scoreInfoEctsTip}>{t.scoreInfoEctsLabel}</InfoTerm>}
                    formula={`${s.total_ects} × 1`}
                    points={ectsPts}
                />
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.scoreInfoTotal}</span>
                <span className="grad-text font-mono text-lg font-black tabular-nums">{s.score}</span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t.scoreInfoFootnote}</p>
        </div>
    );
}
