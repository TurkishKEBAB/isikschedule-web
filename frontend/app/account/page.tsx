'use client';

import { useState } from 'react';
import { Download, Loader2, ShieldCheck, Trash2, UserCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import { RequireAuth, useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../lib/api';

async function readError(response: Response, fallback: string) {
    try {
        const body = await response.json();
        if (typeof body.detail === 'string') return body.detail;
        if (typeof body.message === 'string') return body.message;
    } catch {
        // Keep the caller-provided fallback when the backend body is not JSON.
    }
    return fallback;
}

function AccountDashboard() {
    const { user, token, logout } = useAuth();
    const { t } = useLanguage();
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmed, setDeleteConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        if (!token) return;

        setError(null);
        setIsExporting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me/export`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                throw new Error(await readError(response, t.accountExportFailed));
            }

            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `isikschedule-data-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t.accountExportFailed);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDelete = async () => {
        if (!token || !deleteConfirmed) return;

        setError(null);
        setIsDeleting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                throw new Error(await readError(response, t.accountDeleteFailed));
            }
            logout();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t.accountDeleteFailed);
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-900 text-slate-100">
            <Navbar />
            <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
                <section className="mb-6 border-b border-white/10 pb-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-isik-blue-lighter/20 bg-isik-blue-lighter/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-isik-blue-lighter">
                                <ShieldCheck className="h-4 w-4" />
                                {t.navAccount}
                            </div>
                            <h1 className="text-2xl font-bold text-white sm:text-3xl">{t.accountTitle}</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{t.accountSubtitle}</p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {t.accountSignedInAs}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-slate-400" />
                                <span className="max-w-[260px] truncate text-sm font-medium text-slate-100">
                                    {user?.email}
                                </span>
                                <span className="badge badge-blue">{user?.role}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {error && (
                    <div role="alert" className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                    <section className="glass-panel p-6">
                        <div className="mb-5 flex items-start gap-3">
                            <div className="rounded-lg bg-isik-blue-lighter/10 p-2 text-isik-blue-lighter">
                                <Download className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">{t.accountExportTitle}</h2>
                                <p className="mt-1 text-sm leading-6 text-slate-400">{t.accountExportDescription}</p>
                            </div>
                        </div>

                        <button type="button" onClick={handleExport} disabled={isExporting || !token} className="btn-primary">
                            {isExporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t.accountExporting}
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    {t.accountExportAction}
                                </>
                            )}
                        </button>
                    </section>

                    <section className="glass-panel border-red-500/20 bg-red-950/20 p-6">
                        <div className="mb-5 flex items-start gap-3">
                            <div className="rounded-lg bg-red-500/10 p-2 text-red-300">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">{t.accountDeleteTitle}</h2>
                                <p className="mt-1 text-sm leading-6 text-slate-400">{t.accountDeleteDescription}</p>
                            </div>
                        </div>

                        <label htmlFor="delete-confirm" className="mb-4 flex items-start gap-3 text-sm text-slate-300">
                            <input
                                id="delete-confirm"
                                type="checkbox"
                                checked={deleteConfirmed}
                                onChange={(event) => setDeleteConfirmed(event.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-white/20 bg-surface-700 text-red-400 focus:ring-red-400/50"
                            />
                            <span>{t.accountDeleteConfirmLabel}</span>
                        </label>

                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={!deleteConfirmed || isDeleting || !token}
                            className="btn-danger"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t.accountDeleting}
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    {t.accountDeleteAction}
                                </>
                            )}
                        </button>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default function AccountPage() {
    return (
        <RequireAuth>
            <AccountDashboard />
        </RequireAuth>
    );
}
