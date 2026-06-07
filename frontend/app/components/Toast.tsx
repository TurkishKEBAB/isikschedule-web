'use client';

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType, duration?: number) => void;
    toastSuccess: (message: string) => void;
    toastError: (message: string) => void;
    toastWarning: (message: string) => void;
    toastInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
};

const BORDER_COLORS: Record<ToastType, string> = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/30',
    warning: 'border-amber-500/30',
    info: 'border-blue-500/30',
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const { t } = useLanguage();
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toastSuccess = useCallback((message: string) => {
        addToast(message, 'success');
    }, [addToast]);

    const toastError = useCallback((message: string) => {
        addToast(message, 'error');
    }, [addToast]);

    const toastWarning = useCallback((message: string) => {
        addToast(message, 'warning');
    }, [addToast]);

    const toastInfo = useCallback((message: string) => {
        addToast(message, 'info');
    }, [addToast]);

    const value = useMemo<ToastContextType>(() => ({
        toast: addToast,
        toastSuccess,
        toastError,
        toastWarning,
        toastInfo,
    }), [addToast, toastSuccess, toastError, toastWarning, toastInfo]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            {/* Toast Container */}
            <div
                aria-live="polite"
                aria-atomic="false"
                className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
            >
                {toasts.map((toastItem) => (
                    <div
                        key={toastItem.id}
                        role={toastItem.type === 'error' ? 'alert' : undefined}
                        className={`pointer-events-auto animate-slide-in flex items-start gap-3 px-4 py-3 
                            bg-surface-800/95 backdrop-blur-lg border ${BORDER_COLORS[toastItem.type]} 
                            rounded-xl shadow-2xl shadow-black/30 max-w-sm`}
                    >
                        {ICONS[toastItem.type]}
                        <p className="text-sm text-slate-200 leading-relaxed flex-1">{toastItem.message}</p>
                        <button
                            type="button"
                            onClick={() => removeToast(toastItem.id)}
                            aria-label={t.close}
                            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
