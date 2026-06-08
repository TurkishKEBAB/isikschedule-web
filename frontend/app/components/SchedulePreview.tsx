'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

type CellType = 'lecture' | 'lab' | 'ps';
interface Cell {
    code: string;
    type: CellType;
}

const TYPE_CLASS: Record<CellType, string> = {
    lecture: 'border-lecture/40 bg-lecture/85',
    lab: 'border-lab/40 bg-lab/85',
    ps: 'border-ps/40 bg-ps/85',
};

// Illustrative sample data for the marketing "living" preview only.
const ROWS: { time: string; cells: (Cell | null)[] }[] = [
    { time: '08:30', cells: [{ code: 'MAT101', type: 'lecture' }, null, { code: 'ENG101', type: 'lecture' }, null, { code: 'CS100 PS', type: 'ps' }] },
    { time: '09:30', cells: [null, { code: 'PHY102 Lab', type: 'lab' }, null, { code: 'MAT101', type: 'lecture' }, null] },
    { time: '10:30', cells: [{ code: 'CS201', type: 'lecture' }, null, { code: 'CS201 Lab', type: 'lab' }, null, null] },
    { time: '11:30', cells: [null, null, { code: 'ENG101', type: 'lecture' }, null, { code: 'MAT101 PS', type: 'ps' }] },
    { time: '12:30', cells: [{ code: 'PHY102 Lab', type: 'lab' }, null, null, { code: 'CS201', type: 'lecture' }, null] },
    { time: '13:30', cells: [null, { code: 'ENG101', type: 'lecture' }, null, null, null] },
];

/**
 * SchedulePreview — the landing hero's "living" weekly grid. Course cells
 * pop in with a staggered spring once the grid scrolls into view (CSS-driven;
 * see `.preview-grid` / `.course-cell-anim` in globals.css).
 */
export function SchedulePreview() {
    const { t } = useLanguage();
    const ref = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.4 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const days = [t.mon, t.tue, t.wed, t.thu, t.fri];
    let cellOrder = 0;

    return (
        <div className="relative rounded-[32px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-inset ring-white/10">
            <div className="mb-4 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-isik-blue-lighter" />
                    <span className="text-sm font-semibold text-white">{t.weeklySchedule}</span>
                </div>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{t.homePreviewLive}</span>
            </div>

            <div
                ref={ref}
                className={`preview-grid overflow-hidden rounded-2xl border border-white/10 bg-[#0E1428]/70 ${visible ? 'is-visible' : ''}`}
            >
                <div className="grid grid-cols-[44px_repeat(5,1fr)] border-b border-white/10 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <div className="py-2" />
                    {days.map((day) => (
                        <div key={day} className="py-2">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="divide-y divide-white/[0.05]">
                    {ROWS.map((row) => (
                        <div key={row.time} className="grid grid-cols-[44px_repeat(5,1fr)]">
                            <div className="flex items-center justify-center border-r border-white/[0.05] py-1 text-[10px] tabular-nums text-slate-500">
                                {row.time}
                            </div>
                            {row.cells.map((cell, dayIdx) => (
                                <div key={dayIdx} className="p-1">
                                    {cell && (
                                        <div
                                            className={`course-cell-anim rounded-md border px-1.5 py-1 text-[9px] font-semibold text-white ${TYPE_CLASS[cell.type]}`}
                                            style={{ animationDelay: `${(cellOrder++) * 80}ms` }}
                                        >
                                            {cell.code}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
