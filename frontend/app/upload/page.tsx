'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Upload, FileCheck, Loader2, X, ArrowRight, FileSpreadsheet } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

export default function UploadPage() {
    const { t } = useLanguage();
    const { toastError } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);

    useEffect(() => {
        if (!uploadResult) return;

        const nextUrl = `/scheduler?file_id=${uploadResult.file_id}&source=${encodeURIComponent(uploadResult.filename)}`;
        const redirectTimer = window.setTimeout(() => {
            window.location.assign(nextUrl);
        }, 150);

        return () => window.clearTimeout(redirectTimer);
    }, [uploadResult]);

    const handleDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
        const droppedFile = event.dataTransfer.files[0];

        if (droppedFile && droppedFile.name.toLowerCase().endsWith('.xlsx')) {
            setFile(droppedFile);
            return;
        }

        toastError(t.uploadInvalidFile);
    }, [t.uploadInvalidFile, toastError]);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
            toastError(t.uploadInvalidFile);
            event.target.value = '';
            return;
        }

        setFile(selectedFile);
    }, [t.uploadInvalidFile, toastError]);

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(t.uploadFailed);

            const result = await response.json();
            setUploadResult(result);
            setIsRedirecting(true);
        } catch {
            toastError(t.uploadFailed);
            setIsRedirecting(false);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <main className="min-h-screen bg-surface-900">
            <Navbar />

            <div className="max-w-2xl mx-auto py-16 px-6">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-isik-blue/20 border border-isik-blue-lighter/20 mb-4">
                        <Upload className="w-7 h-7 text-isik-blue-lighter" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{t.uploadTitle}</h1>
                    <p className="text-sm text-slate-400">{t.uploadSubtitle}</p>
                </div>

                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`glass-panel p-10 text-center transition-all cursor-pointer
                        ${isDragging ? '!border-isik-blue-lighter !bg-isik-blue-lighter/5' : ''}
                        ${file ? '!border-emerald-500/30 !bg-emerald-500/5' : ''}`}
                >
                    {file ? (
                        <div>
                            <FileCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                            <p className="text-base font-medium text-white">{file.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            <button type="button" onClick={() => setFile(null)} className="mt-3 text-red-400 hover:text-red-300 text-sm flex items-center gap-1 mx-auto transition-colors">
                                <X className="w-3.5 h-3.5" /> {t.uploadRemoveFile}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            <p className="text-base font-medium text-slate-300 mb-1">{t.uploadDropTitle}</p>
                            <p className="text-xs text-slate-400 mb-4">{t.uploadDropOr}</p>
                            <label className="cursor-pointer">
                                <span className="btn-primary">{t.selectFile}</span>
                                <input type="file" accept=".xlsx" onChange={handleFileSelect} className="hidden" />
                            </label>
                        </div>
                    )}
                </div>

                {file && !uploadResult && (
                    <button type="button" onClick={handleUpload} disabled={isUploading} className="btn-primary w-full !py-3.5 mt-6 !text-base">
                        {isUploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />{t.uploading}</>
                        ) : (
                            <>{t.uploadSubmit} <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                )}

                {uploadResult && (
                    <div className="glass-panel p-6 mt-8">
                        <div className="flex items-center gap-3 mb-4">
                            <FileCheck className="w-6 h-6 text-emerald-400" />
                            <h2 className="text-lg font-semibold text-white">{t.uploadSuccessTitle}</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t.uploadFileLabel}</p>
                                <p className="text-sm font-medium text-white mt-1 truncate">{uploadResult.filename}</p>
                            </div>
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-400 uppercase tracking-wider">{t.uploadCourseCountLabel}</p>
                                <p className="text-sm font-medium text-white mt-1">{uploadResult.course_count}</p>
                            </div>
                        </div>
                        {isRedirecting && (
                            <div className="flex items-center justify-center gap-2 text-sm text-isik-blue-lighter mb-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t.uploadRedirecting}</span>
                            </div>
                        )}
                        <Link
                            href={`/scheduler?file_id=${uploadResult.file_id}&source=${encodeURIComponent(uploadResult.filename)}`}
                            className="btn-primary w-full !py-3"
                        >
                            {t.uploadContinueToScheduler} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
