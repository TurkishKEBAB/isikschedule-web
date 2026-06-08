'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
    /** Final value to count up to. */
    to: number;
    /** Animation duration in ms. */
    duration?: number;
    className?: string;
}

/**
 * Animates a number from 0 to `to` once it scrolls into view (ease-out).
 * Honors `prefers-reduced-motion` (jumps straight to the value).
 */
export function CountUp({ to, duration = 1600, className }: CountUpProps) {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [value, setValue] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const reduce =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        if (reduce || typeof IntersectionObserver === 'undefined') {
            setValue(to);
            return;
        }

        let raf = 0;
        let start = 0;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return;
                observer.disconnect();

                const step = (ts: number) => {
                    if (!start) start = ts;
                    const progress = Math.min((ts - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 2);
                    setValue(Math.round(to * eased));
                    if (progress < 1) raf = requestAnimationFrame(step);
                };
                raf = requestAnimationFrame(step);
            },
            { threshold: 0.6 },
        );

        observer.observe(el);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(raf);
        };
    }, [to, duration]);

    return (
        <span ref={ref} className={className}>
            {value}
        </span>
    );
}
