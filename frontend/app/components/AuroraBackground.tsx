/**
 * AuroraBackground — drifting, brand-coloured aurora blobs behind a dark surface.
 * Pure CSS animation (see `.aurora-blob-*` in globals.css); paused for
 * `prefers-reduced-motion`. Shared by Landing / Results / Scheduler.
 */
interface AuroraBackgroundProps {
    /** `fixed` (default) covers the viewport; `absolute` scopes it to a positioned parent. */
    variant?: 'fixed' | 'absolute';
    /** Dark center-top vignette that focuses a hero; turn off for tool surfaces
     *  so the ambient glow reads through glass panels. */
    vignette?: boolean;
    className?: string;
}

export function AuroraBackground({ variant = 'fixed', vignette = true, className = '' }: AuroraBackgroundProps) {
    const position = variant === 'fixed' ? 'fixed' : 'absolute';
    return (
        <div aria-hidden="true" className={`pointer-events-none ${position} inset-0 -z-10 overflow-hidden ${className}`}>
            <div
                className="aurora-blob-1 absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle at center, rgba(30,64,175,0.40), transparent 65%)' }}
            />
            <div
                className="aurora-blob-2 absolute top-1/4 -right-40 h-[40rem] w-[40rem] rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle at center, rgba(79,70,229,0.34), transparent 65%)' }}
            />
            <div
                className="aurora-blob-3 absolute bottom-0 left-1/4 h-[38rem] w-[38rem] rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle at center, rgba(139,92,246,0.30), transparent 65%)' }}
            />
            <div
                className="aurora-blob-4 absolute top-1/2 left-1/3 h-[34rem] w-[34rem] rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle at center, rgba(245,158,11,0.22), transparent 65%)' }}
            />
            {vignette && (
                <div
                    className="absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(11,16,32,0.6) 100%)' }}
                />
            )}
        </div>
    );
}
