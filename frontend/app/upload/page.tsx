'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Upload, FileCheck, Loader2, X, ArrowRight, FileSpreadsheet } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../lib/api';

export default function UploadPage() {
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

        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            setFile(droppedFile);
            return;
        }

        toastError('Lutfen bir Excel dosyasi (.xlsx veya .xls) yukleyin.');
    }, [toastError]);

    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) setFile(selectedFile);
    }, []);

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Yukleme basarisiz.');

            const result = await response.json();
            setUploadResult(result);
            setIsRedirecting(true);
        } catch {
            toastError('Dosya yuklenirken bir hata olustu. Backend calisiyor mu?');
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
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-isik-blue/20 to-purple-500/20 border border-white/5 mb-4">
                        <Upload className="w-7 h-7 text-isik-blue-lighter" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Ders programi yukle</h1>
                    <p className="text-sm text-slate-500">Excel dosyanizi surukleyip birakin veya secin.</p>
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
                            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                            <button onClick={() => setFile(null)} className="mt-3 text-red-400 hover:text-red-300 text-sm flex items-center gap-1 mx-auto transition-colors">
                                <X className="w-3.5 h-3.5" /> Dosyayi kaldir
                            </button>
                        </div>
                    ) : (
                        <div>
                            <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-base font-medium text-slate-300 mb-1">Excel dosyanizi buraya surukleyin</p>
                            <p className="text-xs text-slate-600 mb-4">veya</p>
                            <label className="cursor-pointer">
                                <span className="btn-primary">Dosya sec</span>
                                <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                            </label>
                        </div>
                    )}
                </div>

                {file && !uploadResult && (
                    <button onClick={handleUpload} disabled={isUploading} className="btn-primary w-full !py-3.5 mt-6 !text-base">
                        {isUploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />Yukleniyor...</>
                        ) : (
                            <>Yukle ve scheduler'a gec <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                )}

                {uploadResult && (
                    <div className="glass-panel p-6 mt-8">
                        <div className="flex items-center gap-3 mb-4">
                            <FileCheck className="w-6 h-6 text-emerald-400" />
                            <h2 className="text-lg font-semibold text-white">Yukleme basarili</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Dosya</p>
                                <p className="text-sm font-medium text-white mt-1 truncate">{uploadResult.filename}</p>
                            </div>
                            <div className="bg-surface-700/30 rounded-xl p-3">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Ders sayisi</p>
                                <p className="text-sm font-medium text-white mt-1">{uploadResult.course_count}</p>
                            </div>
                        </div>
                        {isRedirecting && (
                            <div className="flex items-center justify-center gap-2 text-sm text-isik-blue-lighter mb-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Scheduler'a yonlendiriliyor...</span>
                            </div>
                        )}
                        <Link
                            href={`/scheduler?file_id=${uploadResult.file_id}&source=${encodeURIComponent(uploadResult.filename)}`}
                            className="btn-primary w-full !py-3"
                        >
                            Scheduler'a gec <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
