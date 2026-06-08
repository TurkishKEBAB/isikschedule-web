'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, FileCheck, Loader2, ArrowRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { UploadDropzone } from '../components/UploadDropzone';
import { API_BASE_URL } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

export default function UploadPage() {
    const { t } = useLanguage();
    const { toastError } = useToast();
    const [file, setFile] = useState<File | null>(null);
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

                <UploadDropzone
                    inputId="course-file"
                    title={t.uploadDropTitle}
                    helperText={t.uploadSubtitle}
                    selectLabel={t.selectFile}
                    invalidFileMessage={t.uploadInvalidFile}
                    selectedFile={file}
                    onFileSelect={setFile}
                    onInvalidFile={() => toastError(t.uploadInvalidFile)}
                    onRemove={() => setFile(null)}
                    removeLabel={t.uploadRemoveFile}
                    disabled={isRedirecting}
                    isLoading={isUploading}
                    loadingLabel={t.uploading}
                />

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
