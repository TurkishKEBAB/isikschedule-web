import Image from 'next/image';
import type { ReactNode } from 'react';

interface BrandLogoProps {
    size?: 'sm' | 'md' | 'lg';
    showWordmark?: boolean;
    subtitle?: ReactNode;
    className?: string;
    wordmarkClassName?: string;
    priority?: boolean;
}

const SIZE_CLASSES = {
    sm: {
        icon: 'h-7 w-7 rounded-lg',
        title: 'text-sm',
        subtitle: 'max-w-32 text-[10px]',
        gap: 'gap-2',
    },
    md: {
        icon: 'h-9 w-9 rounded-xl',
        title: 'text-lg',
        subtitle: 'max-w-40 text-[11px]',
        gap: 'gap-2.5',
    },
    lg: {
        icon: 'h-14 w-14 rounded-2xl',
        title: 'text-2xl',
        subtitle: 'max-w-64 text-sm',
        gap: 'gap-3',
    },
} as const;

export function BrandLogo({
    size = 'md',
    showWordmark = true,
    subtitle,
    className = '',
    wordmarkClassName = '',
    priority = false,
}: BrandLogoProps) {
    const styles = SIZE_CLASSES[size];

    return (
        <span className={`inline-flex min-w-0 items-center ${styles.gap} ${className}`}>
            <span
                className={`relative shrink-0 overflow-hidden bg-[#07142f] shadow-lg shadow-blue-500/25 ring-1 ring-inset ring-white/10 ${styles.icon}`}
            >
                <Image
                    src="/brand/app-icon-calendar-flame.png"
                    alt=""
                    fill
                    priority={priority}
                    sizes={size === 'lg' ? '56px' : size === 'md' ? '36px' : '28px'}
                    className="object-cover"
                />
            </span>

            {showWordmark && (
                <span className={`min-w-0 ${wordmarkClassName}`}>
                    <span className={`block truncate font-extrabold tracking-tight text-white ${styles.title}`}>
                        IşıkSchedule
                    </span>
                    {subtitle && (
                        <span className={`block truncate text-slate-400 ${styles.subtitle}`}>
                            {subtitle}
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}
