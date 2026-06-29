'use client';

import {
    CSSProperties, ReactNode, useCallback, useEffect, useId, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** ms the pointer must hover before the tooltip "locks" (Victoria 3 style). */
const LOCK_DELAY = 3000;
/** ms before an unlocked tooltip appears on hover. */
const OPEN_DELAY = 120;
/** gap between trigger and tooltip in px. */
const GAP = 10;
/** lock-ring geometry — must match the <circle> below. */
const RING_R = 9;
const RING_C = 2 * Math.PI * RING_R;

interface Coords { top: number; left: number; }

function reducedMotion(): boolean {
    return typeof window !== 'undefined'
        && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Place a popover of (w,h) near `rect`: below if it fits, otherwise above; clamped to the viewport. */
function place(rect: DOMRect, w: number, h: number): Coords {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + GAP;
    if (top + h > vh - 8 && rect.top - GAP - h > 8) top = rect.top - GAP - h;
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    return { top, left };
}

interface LockingTooltipProps {
    /** Tooltip body (mounted only while open). May contain <InfoTerm> for nested tips. */
    content: ReactNode;
    /** The trigger element(s). */
    children: ReactNode;
    label?: string;
    holdHint?: string;
    lockedHint?: string;
    closeLabel?: string;
    /** className for the (inline) trigger wrapper. */
    className?: string;
}

/**
 * Victoria 3 style tooltip. Hovering the trigger opens it; holding the pointer for
 * {LOCK_DELAY}ms fills a corner ring and "locks" the tooltip so the pointer can move
 * inside and read nested {@link InfoTerm} tips. Keyboard focus opens it locked at once.
 * Esc / outside-click closes a locked tooltip. Renders through a portal so card overflow
 * and transforms never clip it.
 */
export function LockingTooltip({
    content, children, label, holdHint, lockedHint, closeLabel, className,
}: LockingTooltipProps) {
    const [open, setOpen] = useState(false);
    const [locked, setLocked] = useState(false);
    const [coords, setCoords] = useState<Coords | null>(null);

    const triggerRef = useRef<HTMLSpanElement | null>(null);
    const tipRef = useRef<HTMLDivElement | null>(null);
    const openTimer = useRef<number | undefined>(undefined);
    const closeTimer = useRef<number | undefined>(undefined);
    const overTrigger = useRef(false);
    const overTip = useRef(false);
    const tipId = useId();

    const reposition = useCallback(() => {
        const trg = triggerRef.current;
        if (!trg) return;
        const w = tipRef.current?.offsetWidth ?? 320;
        const h = tipRef.current?.offsetHeight ?? 240;
        setCoords(place(trg.getBoundingClientRect(), w, h));
    }, []);

    const close = useCallback(() => {
        window.clearTimeout(openTimer.current);
        window.clearTimeout(closeTimer.current);
        setOpen(false);
        setLocked(false);
    }, []);

    const openTooltip = useCallback((lockNow: boolean) => {
        const trg = triggerRef.current;
        if (trg) setCoords(place(trg.getBoundingClientRect(), 320, 240));
        setOpen(true);
        if (lockNow || reducedMotion()) setLocked(true);
        requestAnimationFrame(reposition);
    }, [reposition]);

    const handleEnter = useCallback(() => {
        overTrigger.current = true;
        window.clearTimeout(closeTimer.current);
        if (open) return;
        openTimer.current = window.setTimeout(() => openTooltip(false), OPEN_DELAY);
    }, [open, openTooltip]);

    const handleLeave = useCallback(() => {
        overTrigger.current = false;
        window.clearTimeout(openTimer.current);
        if (!locked) { close(); return; }
        // Locked: allow the pointer to bridge the gap into the tooltip before closing.
        closeTimer.current = window.setTimeout(() => {
            if (!overTrigger.current && !overTip.current) close();
        }, 140);
    }, [locked, close]);

    const handleFocus = useCallback(() => {
        overTrigger.current = true;
        if (!open) openTooltip(true);
    }, [open, openTooltip]);

    const handleBlur = useCallback((e: React.FocusEvent) => {
        const next = e.relatedTarget as Node | null;
        if (next && (triggerRef.current?.contains(next) || tipRef.current?.contains(next))) return;
        overTrigger.current = false;
        close();
    }, [close]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (open) close(); else openTooltip(true);
        }
    }, [open, close, openTooltip]);

    // While open: keep position synced, and wire Esc + outside-click to close.
    useEffect(() => {
        if (!open) return;
        const onReposition = () => reposition();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); triggerRef.current?.blur(); }
        };
        const onDown = (e: PointerEvent) => {
            if (!locked) return;
            const n = e.target as Node;
            if (triggerRef.current?.contains(n) || tipRef.current?.contains(n)) return;
            close();
        };
        window.addEventListener('scroll', onReposition, true);
        window.addEventListener('resize', onReposition);
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('pointerdown', onDown, true);
        return () => {
            window.removeEventListener('scroll', onReposition, true);
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('pointerdown', onDown, true);
        };
    }, [open, locked, reposition, close]);

    useEffect(() => () => {
        window.clearTimeout(openTimer.current);
        window.clearTimeout(closeTimer.current);
    }, []);

    return (
        <>
            <span
                ref={triggerRef}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-expanded={open}
                aria-describedby={open ? tipId : undefined}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={className}
            >
                {children}
            </span>

            {open && coords && typeof document !== 'undefined' && createPortal(
                <div
                    ref={tipRef}
                    id={tipId}
                    role="tooltip"
                    onMouseEnter={() => { overTip.current = true; window.clearTimeout(closeTimer.current); }}
                    onMouseLeave={() => { overTip.current = false; handleLeave(); }}
                    style={{ top: coords.top, left: coords.left }}
                    className={`fixed z-[100] w-80 max-w-[calc(100vw-16px)] animate-fade-in rounded-2xl border border-white/10 bg-[#0E1428]/95 p-4 text-left shadow-2xl shadow-black/50 ring-1 ring-black/40 backdrop-blur-xl motion-reduce:animate-none ${locked ? 'pointer-events-auto' : 'pointer-events-none'}`}
                >
                    <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center">
                        {locked ? (
                            <button
                                type="button"
                                onClick={close}
                                aria-label={closeLabel}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : (
                            <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24" aria-hidden>
                                <circle cx="12" cy="12" r={RING_R} fill="none" strokeWidth="2"
                                    style={{ stroke: 'rgba(255,255,255,0.12)' }} />
                                <circle cx="12" cy="12" r={RING_R} fill="none" strokeWidth="2" strokeLinecap="round"
                                    style={{
                                        stroke: '#3B82F6',
                                        strokeDasharray: RING_C,
                                        strokeDashoffset: RING_C,
                                        animation: `tip-lock-ring ${LOCK_DELAY}ms linear forwards`,
                                        '--tip-ring-c': `${RING_C}`,
                                    } as CSSProperties}
                                    onAnimationEnd={() => setLocked(true)}
                                />
                            </svg>
                        )}
                    </span>

                    {content}

                    {(holdHint || lockedHint) && (
                        <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            {locked ? lockedHint : holdHint}
                        </p>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}

interface InfoTermProps {
    children: ReactNode;
    tip: ReactNode;
}

/**
 * A single underlined term inside a locked {@link LockingTooltip} that reveals a small,
 * read-only definition popover on hover/focus (the nested tooltip layer).
 */
export function InfoTerm({ children, tip }: InfoTermProps) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<Coords | null>(null);
    const ref = useRef<HTMLButtonElement | null>(null);
    const tipRef = useRef<HTMLDivElement | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const tipId = useId();

    const reposition = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const w = tipRef.current?.offsetWidth ?? 240;
        const h = tipRef.current?.offsetHeight ?? 120;
        setCoords(place(el.getBoundingClientRect(), w, h));
    }, []);

    const show = useCallback(() => {
        window.clearTimeout(timer.current);
        const el = ref.current;
        if (el) setCoords(place(el.getBoundingClientRect(), 240, 120));
        timer.current = window.setTimeout(() => { setOpen(true); requestAnimationFrame(reposition); }, 160);
    }, [reposition]);

    const hide = useCallback(() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(false), 80);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onRe = () => reposition();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
        window.addEventListener('scroll', onRe, true);
        window.addEventListener('resize', onRe);
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('scroll', onRe, true);
            window.removeEventListener('resize', onRe);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [open, reposition]);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return (
        <>
            <button
                ref={ref}
                type="button"
                aria-describedby={open ? tipId : undefined}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                className="cursor-help font-semibold text-slate-100 underline decoration-dotted decoration-isik-blue-lighter/60 underline-offset-2 outline-none transition hover:text-white focus-visible:text-white"
            >
                {children}
            </button>

            {open && coords && typeof document !== 'undefined' && createPortal(
                <div
                    ref={tipRef}
                    id={tipId}
                    role="tooltip"
                    style={{ top: coords.top, left: coords.left }}
                    className="pointer-events-none fixed z-[110] w-60 max-w-[calc(100vw-16px)] animate-fade-in rounded-xl border border-white/10 bg-[#0B1020]/[0.97] p-3 text-xs leading-relaxed text-slate-300 shadow-2xl shadow-black/60 backdrop-blur-xl motion-reduce:animate-none"
                >
                    {tip}
                </div>,
                document.body,
            )}
        </>
    );
}
