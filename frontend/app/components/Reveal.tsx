'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface RevealProps {
    children: ReactNode;
    className?: string;
    /** Stagger delay in ms applied to the reveal transition. */
    delay?: number;
    /** Fraction of the element that must be visible before revealing. */
    threshold?: number;
}

/**
 * Reveals its children with a fade/slide-up when scrolled into view.
 * IntersectionObserver-based, fires once. Honors `prefers-reduced-motion`
 * and degrades to instantly-visible when IO is unavailable (SSR/old browsers).
 */
export function Reveal({ children, className = '', delay = 0, threshold = 0.15 }: RevealProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const reduce =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        if (reduce || typeof IntersectionObserver === 'undefined') {
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
            { threshold, rootMargin: '0px 0px -10% 0px' },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return (
        <div
            ref={ref}
            className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
            style={delay ? { transitionDelay: `${delay}ms` } : undefined}
        >
            {children}
        </div>
    );
}
