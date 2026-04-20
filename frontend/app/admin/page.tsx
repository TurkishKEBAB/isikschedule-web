'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    GraduationCap, Users, Calendar, BookOpen, Clock,
    Upload, FileSpreadsheet, CheckCircle, Shield, LogOut, Loader2
} from 'lucide-react';
import { useAuth, RequireAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

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
    const { toastSuccess, toastError } = useToast();
    const [stats, setStats] = useState<Stats | null>(null);
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [semesterName, setSemesterName] = useState('2024-2025-Guz');

    const API_URL = 'http://localhost:8000';

    useEffect(() => { fetchStats(); fetchSemesters(); }, [token]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setStats(await res.json());
        } catch { /* ignore */ }
    };

    const fetchSemesters = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/semesters`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setSemesters(await res.json());
        } catch { /* ignore */ }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            toastError('Sadece Excel dosyaları (.xlsx) yüklenebilir');
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_URL}/api/admin/upload-semester?semester=${encodeURIComponent(semesterName)}`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                toastSuccess(`${data.course_count} ders yüklendi!`);
                fetchStats(); fetchSemesters();
            } else {
                toastError(data.detail || 'Yükleme hatası');
            }
        } catch (err: any) {
            toastError(`Hata: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const activateSemester = async (semesterId: number) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/semesters/${semesterId}/activate`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) { fetchStats(); fetchSemesters(); toastSuccess('Dönem aktif edildi'); }
        } catch { /* ignore */ }
    };

    const statCards = [
        { icon: <Users className="w-5 h-5" />, value: stats?.total_users || 0, label: 'Kullanıcı', color: 'text-blue-400' },
        { icon: <Calendar className="w-5 h-5" />, value: stats?.total_schedules || 0, label: 'Kayıtlı Program', color: 'text-purple-400' },
        { icon: <BookOpen className="w-5 h-5" />, value: stats?.total_courses || 0, label: 'Ders', color: 'text-emerald-400' },
        { icon: <Clock className="w-5 h-5" />, value: stats?.active_semester || 'Yok', label: 'Aktif Dönem', color: 'text-amber-400' },
    ];

    return (
        <div className="min-h-screen bg-surface-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-surface-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <Link href="/" className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-lg font-bold text-white">IşıkSchedule</span>
                            </Link>
                            <span className="badge bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> ADMIN
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400 hidden sm:inline">{user?.email}</span>
                            <Link href="/scheduler" className="btn-ghost !py-1.5 !text-xs">
                                <Calendar className="w-3.5 h-3.5" /> Scheduler
                            </Link>
                            <button onClick={logout} className="btn-ghost !py-1.5 !text-xs">
                                <LogOut className="w-3.5 h-3.5" /> Çıkış
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-8">
                <h1 className="text-2xl font-bold text-white">Admin Paneli</h1>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((card, i) => (
                        <div key={i} className="glass-panel p-5">
                            <div className={`${card.color} mb-3`}>{card.icon}</div>
                            <div className="text-2xl font-bold text-white">{card.value}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Upload */}
                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white mb-1">Yeni Dönem Yükle</h2>
                    <p className="text-sm text-slate-500 mb-5">Excel dosyasını yükleyerek tüm kullanıcılara sunun.</p>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">Dönem Adı</label>
                            <input type="text" value={semesterName} onChange={(e) => setSemesterName(e.target.value)}
                                className="input-field !w-auto" placeholder="2024-2025-Guz" />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">Excel Dosyası</label>
                            <label className="cursor-pointer">
                                <span className={`btn-primary ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />Yükleniyor...</> : <><Upload className="w-4 h-4" />Excel Seç</>}
                                </span>
                                <input type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={isUploading} className="hidden" />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Semesters */}
                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Yüklenen Dönemler</h2>
                    {semesters.length === 0 ? (
                        <p className="text-sm text-slate-500">Henüz dönem yüklenmedi.</p>
                    ) : (
                        <div className="space-y-2">
                            {semesters.map((sem) => (
                                <div
                                    key={sem.id}
                                    className={`flex items-center justify-between p-4 rounded-xl transition-all
                                        ${sem.is_active
                                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                                            : 'bg-surface-700/30 border border-transparent hover:border-white/5'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <FileSpreadsheet className={`w-5 h-5 ${sem.is_active ? 'text-emerald-400' : 'text-slate-500'}`} />
                                        <div>
                                            <div className="font-medium text-white flex items-center gap-2">
                                                {sem.semester}
                                                {sem.is_active && (
                                                    <span className="badge badge-green flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> AKTİF
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {sem.course_count} ders · {new Date(sem.uploaded_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                    </div>
                                    {!sem.is_active && (
                                        <button onClick={() => activateSemester(sem.id)} className="btn-success !py-1.5 !text-xs">
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
