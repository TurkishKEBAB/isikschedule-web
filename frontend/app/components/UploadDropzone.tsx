'use client';

import { type ChangeEvent, type DragEvent, useState } from 'react';
import { FileCheck, FileSpreadsheet, Loader2, X } from 'lucide-react';

interface UploadDropzoneProps {
    inputId: string;
    title: string;
    helperText: string;
    selectLabel: string;
    invalidFileMessage: string;
    onFileSelect: (file: File) => void | Promise<void>;
    onInvalidFile?: () => void;
    selectedFile?: File | null;
    onRemove?: () => void;
    removeLabel?: string;
    disabled?: boolean;
    isLoading?: boolean;
    loadingLabel?: string;
    variant?: 'default' | 'compact';
    className?: string;
}

export function UploadDropzone({
    inputId,
    title,
    helperText,
    selectLabel,
    invalidFileMessage,
    onFileSelect,
    onInvalidFile,
    selectedFile = null,
    onRemove,
    removeLabel,
    disabled = false,
    isLoading = false,
    loadingLabel,
    variant = 'default',
    className = '',
}: UploadDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [hasValidationError, setHasValidationError] = useState(false);
    const helperId = `${inputId}-help`;
    const errorId = `${inputId}-error`;
    const isCompact = variant === 'compact';
    const isDisabled = disabled || isLoading;

    const acceptFile = (file?: File) => {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            setHasValidationError(true);
            onInvalidFile?.();
            return;
        }

        setHasValidationError(false);
        void onFileSelect(file);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        acceptFile(event.target.files?.[0]);
        event.target.value = '';
    };

    const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        if (isDisabled) return;
        event.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (isDisabled) return;
        acceptFile(event.dataTransfer.files[0]);
    };

    return (
        <div className={className}>
            <input
                id={inputId}
                type="file"
                accept=".xlsx"
                disabled={isDisabled}
                onChange={handleChange}
                aria-label={selectLabel}
                aria-describedby={`${helperId}${hasValidationError ? ` ${errorId}` : ''}`}
                aria-invalid={hasValidationError}
                className="peer sr-only"
            />
            <label
                htmlFor={inputId}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`block border-2 border-dashed rounded-lg text-center transition-all
                    peer-focus-visible:outline-none peer-focus-visible:ring-2
                    peer-focus-visible:ring-isik-blue-lighter/60 peer-focus-visible:ring-offset-2
                    peer-focus-visible:ring-offset-surface-900
                    ${isCompact ? 'px-5 py-4' : 'p-10'}
                    ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-white/20 hover:bg-white/[0.02]'}
                    ${isDragging ? '!border-isik-blue-lighter !bg-isik-blue-lighter/5' : 'border-white/10'}
                    ${selectedFile ? '!border-emerald-500/30 !bg-emerald-500/5' : ''}`}
            >
                {isLoading ? (
                    <div className="flex flex-col items-center">
                        <Loader2 className={`${isCompact ? 'w-7 h-7' : 'w-10 h-10'} text-isik-blue-lighter animate-spin mb-3`} />
                        <p className="text-sm font-medium text-slate-200">{loadingLabel}</p>
                    </div>
                ) : selectedFile ? (
                    <div>
                        <FileCheck className={`${isCompact ? 'w-8 h-8' : 'w-12 h-12'} text-emerald-400 mx-auto mb-3`} />
                        <p className="text-sm font-medium text-white break-all">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        <span className="btn-secondary !py-2 mt-4">{selectLabel}</span>
                    </div>
                ) : (
                    <div>
                        <FileSpreadsheet className={`${isCompact ? 'w-8 h-8' : 'w-12 h-12'} text-slate-400 mx-auto mb-3`} />
                        <p className={`${isCompact ? 'text-sm' : 'text-base'} font-medium text-slate-200 mb-1`}>{title}</p>
                        <span className="btn-primary !py-2 mt-3">{selectLabel}</span>
                    </div>
                )}
                <p id={helperId} className="text-xs text-slate-400 mt-3">{helperText}</p>
            </label>

            {selectedFile && onRemove && removeLabel && !isLoading && (
                <button
                    type="button"
                    onClick={() => {
                        setHasValidationError(false);
                        onRemove();
                    }}
                    className="mt-3 text-red-400 hover:text-red-300 text-sm flex items-center gap-1 mx-auto transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                    {removeLabel}
                </button>
            )}

            {hasValidationError && (
                <p id={errorId} role="alert" className="mt-2 text-xs text-red-300">
                    {invalidFileMessage}
                </p>
            )}
        </div>
    );
}
