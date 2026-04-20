'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Mail, Lock, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
    const { register } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) { setError('Şifreler eşleşmiyor'); return; }
        if (password.length < 6) { setError('Şifre en az 6 karakter olmalı'); return; }

        const domain = email.split('@')[1]?.toLowerCase();
        if (domain !== 'isik.edu.tr' && domain !== 'isikun.edu.tr') {
            setError('E-posta @isik.edu.tr veya @isikun.edu.tr olmalı');
            return;
        }

        setIsLoading(true);
        try {
            await register(email, password);
        } catch (err: any) {
            setError(err.message || 'Kayıt başarısız');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-purple-500/10 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 shadow-xl shadow-purple-500/20 mb-4">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">IşıkSchedule</h1>
                    <p className="text-sm text-slate-500 mt-1">Hesap Oluştur</p>
                </div>

                {/* Form */}
                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white text-center mb-6">Kayıt Ol</h2>

                    {error && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
                            <span className="flex-shrink-0 mt-0.5">!</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">E-posta</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ornek@isik.edu.tr" className="input-field !pl-10" required
                                />
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1 pl-1">@isik.edu.tr veya @isikun.edu.tr</p>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">Şifre</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" className="input-field !pl-10" required minLength={6}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">Şifre Tekrar</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••" className="input-field !pl-10" required
                                />
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading}
                            className="btn w-full !py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:from-purple-700 hover:to-pink-600 shadow-lg shadow-purple-500/20">
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Kayıt yapılıyor...</>
                            ) : (
                                <><Sparkles className="w-4 h-4" />Kayıt Ol</>
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm text-slate-500">
                        Zaten hesabınız var mı?{' '}
                        <Link href="/login" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
                            Giriş Yap
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
