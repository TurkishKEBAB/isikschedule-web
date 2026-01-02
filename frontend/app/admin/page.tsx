'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, RequireAuth } from '../context/AuthContext';

interface Stats {
    total_users: number;
    total_schedules: number;
    active_semester: string | null;
    total_courses: number;
}

interface Semester {
    id: number;
    semester: string;
    course_count: number;
    uploaded_at: string;
    is_active: boolean;
}

function AdminDashboard() {
    const { user, token, logout } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState('');
    const [semesterName, setSemesterName] = useState('2024-2025-Guz');

    const API_URL = 'http://localhost:8000';

    // Fetch stats and semesters on load
    useEffect(() => {
        fetchStats();
        fetchSemesters();
    }, [token]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const fetchSemesters = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/semesters`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setSemesters(data);
            }
        } catch (err) {
            console.error('Error fetching semesters:', err);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setUploadMessage('❌ Sadece Excel dosyaları (.xlsx) yüklenebilir');
            return;
        }

        setIsUploading(true);
        setUploadMessage('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API_URL}/api/admin/upload-semester?semester=${encodeURIComponent(semesterName)}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await res.json();

            if (res.ok) {
                setUploadMessage(`✅ ${data.course_count} ders yüklendi!`);
                fetchStats();
                fetchSemesters();
            } else {
                setUploadMessage(`❌ ${data.detail || 'Yükleme hatası'}`);
            }
        } catch (err: any) {
            setUploadMessage(`❌ Hata: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const activateSemester = async (semesterId: number) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/semesters/${semesterId}/activate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                fetchStats();
                fetchSemesters();
            }
        } catch (err) {
            console.error('Error activating semester:', err);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 py-4 px-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-2xl font-bold">🎓 IşıkSchedule</Link>
                        <span className="bg-red-600 text-xs px-2 py-1 rounded">ADMIN</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400">{user?.email}</span>
                        <Link href="/scheduler" className="text-blue-400 hover:text-blue-300">
                            📅 Scheduler
                        </Link>
                        <button
                            onClick={logout}
                            className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600"
                        >
                            Çıkış
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                <h1 className="text-3xl font-bold mb-8">📊 Admin Paneli</h1>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <div className="text-4xl mb-2">👥</div>
                        <div className="text-3xl font-bold">{stats?.total_users || 0}</div>
                        <div className="text-slate-400">Kullanıcı</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <div className="text-4xl mb-2">📅</div>
                        <div className="text-3xl font-bold">{stats?.total_schedules || 0}</div>
                        <div className="text-slate-400">Kayıtlı Program</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <div className="text-4xl mb-2">📚</div>
                        <div className="text-3xl font-bold">{stats?.total_courses || 0}</div>
                        <div className="text-slate-400">Ders</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                        <div className="text-4xl mb-2">🗓️</div>
                        <div className="text-lg font-bold truncate">{stats?.active_semester || 'Yok'}</div>
                        <div className="text-slate-400">Aktif Dönem</div>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
                    <h2 className="text-xl font-bold mb-4">📤 Yeni Dönem Yükle</h2>
                    <p className="text-slate-400 mb-4">
                        Excel dosyasını yükleyerek tüm kullanıcılara otomatik olarak sunun.
                    </p>

                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Dönem Adı</label>
                            <input
                                type="text"
                                value={semesterName}
                                onChange={(e) => setSemesterName(e.target.value)}
                                className="p-2 bg-slate-700 border border-slate-600 rounded text-white"
                                placeholder="2024-2025-Guz"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Excel Dosyası</label>
                            <label className="cursor-pointer">
                                <span className={`inline-block px-4 py-2 rounded font-bold ${isUploading ? 'bg-slate-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                    {isUploading ? '⏳ Yükleniyor...' : '📁 Excel Seç'}
                                </span>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleUpload}
                                    disabled={isUploading}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    {uploadMessage && (
                        <div className={`mt-4 p-3 rounded ${uploadMessage.startsWith('✅') ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                            {uploadMessage}
                        </div>
                    )}
                </div>

                {/* Semesters List */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h2 className="text-xl font-bold mb-4">📋 Yüklenen Dönemler</h2>

                    {semesters.length === 0 ? (
                        <p className="text-slate-400">Henüz dönem yüklenmedi.</p>
                    ) : (
                        <div className="space-y-3">
                            {semesters.map((sem) => (
                                <div
                                    key={sem.id}
                                    className={`flex items-center justify-between p-4 rounded-lg ${sem.is_active ? 'bg-green-600/20 border border-green-500' : 'bg-slate-700'
                                        }`}
                                >
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            {sem.semester}
                                            {sem.is_active && <span className="text-xs bg-green-600 px-2 py-0.5 rounded">AKTİF</span>}
                                        </div>
                                        <div className="text-sm text-slate-400">
                                            {sem.course_count} ders • {new Date(sem.uploaded_at).toLocaleDateString('tr-TR')}
                                        </div>
                                    </div>
                                    {!sem.is_active && (
                                        <button
                                            onClick={() => activateSemester(sem.id)}
                                            className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                                        >
                                            Aktif Yap
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function AdminPage() {
    return (
        <RequireAuth adminOnly>
            <AdminDashboard />
        </RequireAuth>
    );
}
