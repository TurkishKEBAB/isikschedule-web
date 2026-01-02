'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            setFile(droppedFile);
            setError(null);
        } else {
            setError('Lütfen bir Excel dosyası (.xlsx veya .xls) yükleyin');
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
        }
    }, []);

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('http://localhost:8000/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Yükleme başarısız');
            }

            const result = await response.json();
            setUploadResult(result);
        } catch (err) {
            setError('Dosya yüklenirken bir hata oluştu. Backend çalışıyor mu?');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-isik-blue text-white py-4 px-6 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="text-2xl font-bold">🎓 IşıkSchedule</Link>
                    <nav className="flex gap-6">
                        <Link href="/upload" className="text-isik-gold font-bold">Upload</Link>
                        <Link href="/about" className="hover:text-isik-gold transition">About</Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto py-12 px-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">📤 Ders Programı Yükle</h1>
                <p className="text-gray-600 mb-8">
                    Excel dosyanızı sürükleyip bırakın veya seçin
                </p>

                {/* Drop Zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
            ${isDragging
                            ? 'border-isik-blue bg-blue-50'
                            : 'border-gray-300 hover:border-isik-blue hover:bg-gray-50'
                        }
            ${file ? 'bg-green-50 border-green-500' : ''}
          `}
                >
                    {file ? (
                        <div>
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-lg font-medium text-gray-800">{file.name}</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>
                            <button
                                onClick={() => setFile(null)}
                                className="mt-4 text-red-500 hover:text-red-700 text-sm"
                            >
                                Dosyayı kaldır
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="text-5xl mb-4">📁</div>
                            <p className="text-lg font-medium text-gray-700">
                                Excel dosyanızı buraya sürükleyin
                            </p>
                            <p className="text-sm text-gray-500 mt-2">veya</p>
                            <label className="mt-4 inline-block cursor-pointer">
                                <span className="bg-isik-blue text-white px-6 py-2 rounded-lg hover:bg-isik-blue-dark transition">
                                    Dosya Seç
                                </span>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        ⚠️ {error}
                    </div>
                )}

                {/* Upload Button */}
                {file && !uploadResult && (
                    <button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className={`
              mt-6 w-full py-4 rounded-lg text-lg font-bold transition
              ${isUploading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-isik-blue text-white hover:bg-isik-blue-dark'
                            }
            `}
                    >
                        {isUploading ? '⏳ Yükleniyor...' : '🚀 Yükle ve Devam Et'}
                    </button>
                )}

                {/* Upload Result */}
                {uploadResult && (
                    <div className="mt-8 p-6 bg-white rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">
                            ✅ Yükleme Başarılı!
                        </h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-gray-500">Dosya</p>
                                <p className="font-medium">{uploadResult.filename}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-gray-500">Ders Sayısı</p>
                                <p className="font-medium">{uploadResult.course_count}</p>
                            </div>
                        </div>
                        <Link
                            href={`/results?file_id=${uploadResult.file_id}`}
                            className="mt-6 block w-full text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition"
                        >
                            🎯 Programa Geç
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
