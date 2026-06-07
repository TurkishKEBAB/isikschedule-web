'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    GraduationCap, Users, Calendar, BookOpen, Clock,
    Upload, FileSpreadsheet, CheckCircle, Shield, LogOut, Loader2
} from 'lucide-react';
import { useAuth, RequireAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../lib/api';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';

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
    const { t } = useLanguage();
    const [stats, setStats] = useState<Stats | null>(null);
    const [semesters, setSemesters] = useState<Semester[]>([]);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [isSemestersLoading, setIsSemestersLoading] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [semestersError, setSemestersError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [semesterName, setSemesterName] = useState('2026-2027-Guz');

    const fetchStats = useCallback(async () => {
        setIsStatsLoading(true);
        setStatsError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(t.adminFetchError);
            setStats(await res.json());
        } catch {
            setStatsError(t.adminFetchError);
            toastError(t.adminFetchError);
        } finally {
            setIsStatsLoading(false);
        }
    }, [t.adminFetchError, toastError, token]);

    const fetchSemesters = useCallback(async () => {
        setIsSemestersLoading(true);
        setSemestersError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/semesters`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(t.adminFetchError);
            setSemesters(await res.json());
        } catch {
            setSemestersError(t.adminFetchError);
            toastError(t.adminFetchError);
        } finally {
            setIsSemestersLoading(false);
        }
    }, [t.adminFetchError, toastError, token]);

    useEffect(() => {
        fetchStats();
        fetchSemesters();
    }, [fetchStats, fetchSemesters]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toastError(t.adminUploadInvalid);
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_BASE_URL}/api/admin/upload-semester?semester=${encodeURIComponent(semesterName)}`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
            });
            const data = await res.json();
            if (res.ok) {
                toastSuccess(`${data.course_count} ${t.adminUploadSuccess}`);
                fetchStats();
                fetchSemesters();
            } else {
                toastError(data.detail || t.adminUploadError);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : t.adminUploadError;
            toastError(message);
        } finally {
            setIsUploading(false);
        }
    };

    const activateSemester = async (semesterId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/semesters/${semesterId}/activate`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(t.adminActivateError);
            fetchStats();
            fetchSemesters();
            toastSuccess(t.adminActivateSuccess);
        } catch {
            toastError(t.adminActivateError);
        }
    };

    const statCards = [
        { icon: <Users className="w-5 h-5" />, value: stats?.total_users || 0, label: t.adminUsers, color: 'text-blue-400' },
        { icon: <Calendar className="w-5 h-5" />, value: stats?.total_schedules || 0, label: t.adminSavedSchedules, color: 'text-isik-blue-lighter' },
        { icon: <BookOpen className="w-5 h-5" />, value: stats?.total_courses || 0, label: t.adminCourses, color: 'text-emerald-400' },
        { icon: <Clock className="w-5 h-5" />, value: stats?.active_semester || t.adminNone, label: t.adminActiveSemester, color: 'text-amber-400' },
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
                                <Shield className="w-3 h-3" /> {t.adminRole}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-400 hidden sm:inline">{user?.email}</span>
                            <LanguageSwitcher />
                            <Link href="/scheduler" className="btn-ghost !py-1.5 !text-xs">
                                <Calendar className="w-3.5 h-3.5" /> {t.navScheduler}
                            </Link>
                            <button type="button" onClick={logout} className="btn-ghost !py-1.5 !text-xs" aria-label={t.navLogout}>
                                <LogOut className="w-3.5 h-3.5" /> {t.navLogout}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-8">
                <h1 className="text-2xl font-bold text-white">{t.adminPanel}</h1>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {isStatsLoading ? (
                        <div className="glass-panel p-5 sm:col-span-2 lg:col-span-4 flex items-center gap-3 text-sm text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-isik-blue-lighter" />
                            {t.adminStatsLoading}
                        </div>
                    ) : statsError ? (
                        <div className="glass-panel p-5 sm:col-span-2 lg:col-span-4 text-sm text-red-300">
                            {statsError}
                        </div>
                    ) : (
                        statCards.map((card) => (
                            <div key={card.label} className="glass-panel p-5">
                                <div className={`${card.color} mb-3`}>{card.icon}</div>
                                <div className="text-2xl font-bold text-white">{card.value}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{card.label}</div>
                            </div>
                        ))
                    )}
                </div>

                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white mb-1">{t.adminNewSemester}</h2>
                    <p className="text-sm text-slate-400 mb-5">{t.adminNewSemesterDesc}</p>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label htmlFor="admin-semester-name" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.adminSemesterName}</label>
                            <input id="admin-semester-name" name="semesterName" type="text" value={semesterName} onChange={(e) => setSemesterName(e.target.value)}
                                className="input-field !w-auto" placeholder="2026-2027-Guz" />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.adminExcelFile}</label>
                            <label className="cursor-pointer">
                                <span className={`btn-primary ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />{t.adminUploading}</> : <><Upload className="w-4 h-4" />{t.adminChooseExcel}</>}
                                </span>
                                <input type="file" accept=".xlsx" onChange={handleUpload} disabled={isUploading} className="hidden" />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">{t.adminSemesters}</h2>
                    {isSemestersLoading ? (
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin text-isik-blue-lighter" />
                            {t.adminSemestersLoading}
                        </div>
                    ) : semestersError ? (
                        <p className="text-sm text-red-300">{semestersError}</p>
                    ) : semesters.length === 0 ? (
                        <p className="text-sm text-slate-400">{t.adminNoSemesters}</p>
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
                                                        <CheckCircle className="w-3 h-3" /> {t.adminActive}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {sem.course_count} {t.courses} · {new Date(sem.uploaded_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        </div>
                                    </div>
                                    {!sem.is_active && (
                                        <button type="button" onClick={() => activateSemester(sem.id)} className="btn-success !py-1.5 !text-xs">
                                            {t.adminActivate}
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
