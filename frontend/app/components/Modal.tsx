'use client';

import { ReactNode, useEffect, useCallback, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    maxWidth?: string;
    closeLabel?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md', closeLabel = 'Close dialog' }: ModalProps) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
            // Move focus into the dialog so keyboard/screen-reader users don't
            // stay behind the overlay. (Full focus trap + restore is TODO 2.5.)
            panelRef.current?.focus();
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Panel */}
            <div
                ref={panelRef}
                tabIndex={-1}
                className={`relative ${maxWidth} w-full glass-panel p-6 shadow-2xl shadow-black/40 animate-fade-in outline-none`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : closeLabel}
            >
                {title && (
                    <div className="flex items-center justify-between mb-5">
                        <h2 id={titleId} className="text-lg font-semibold text-white">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label={closeLabel}
                            title={closeLabel}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
