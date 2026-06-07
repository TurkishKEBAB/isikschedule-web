'use client';

import { ReactNode, useEffect, useCallback } from 'react';
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
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
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
                className={`relative ${maxWidth} w-full glass-panel p-6 shadow-2xl shadow-black/40 animate-fade-in`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title || closeLabel}
            >
                {title && (
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
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
