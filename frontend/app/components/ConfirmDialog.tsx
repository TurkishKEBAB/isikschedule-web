'use client';

import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel: string;
    cancelLabel: string;
    tone?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
    onCancel: () => void;
    children?: ReactNode;
}

export default function ConfirmDialog({
    isOpen,
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone = 'warning',
    onConfirm,
    onCancel,
    children,
}: ConfirmDialogProps) {
    const confirmClass =
        tone === 'danger'
            ? 'btn-danger'
            : tone === 'primary'
                ? 'btn-primary'
                : 'btn-secondary !bg-amber-500/20 !text-amber-300 !border-amber-500/30 hover:!bg-amber-500/30';

    return (
        <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="max-w-md">
            <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-300" />
                    </div>
                    {description && (
                        <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
                    )}
                </div>
                {children}
                <div className="flex items-center justify-end gap-2 pt-2">
                    <button onClick={onCancel} className="btn-ghost !text-xs">
                        {cancelLabel}
                    </button>
                    <button onClick={onConfirm} className={`${confirmClass} !text-xs`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
