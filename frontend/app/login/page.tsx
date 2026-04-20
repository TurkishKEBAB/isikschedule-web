'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            router.replace(user.role === 'admin' ? '/admin' : '/scheduler');
        } else {
            setIsChecking(false);
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Giriş başarısız');
            }

            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            router.replace(data.user.role === 'admin' ? '/admin' : '/scheduler');
        } catch (err: any) {
            setError(err.message || 'Giriş başarısız');
            setIsLoading(false);
        }
    };

    if (isChecking) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-isik-blue-lighter animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-isik-blue/15 to-transparent rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-isik-blue to-isik-blue-lighter shadow-xl shadow-blue-500/20 mb-4">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">IşıkSchedule</h1>
                    <p className="text-sm text-slate-500 mt-1">Ders Programı Oluşturucu</p>
                </div>

                {/* Form */}
                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white text-center mb-6">Giriş Yap</h2>

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
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ornek@isik.edu.tr"
                                    className="input-field !pl-10"
                                    required
                                    suppressHydrationWarning
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">Şifre</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-field !pl-10"
                                    required
                                    suppressHydrationWarning
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full !py-3"
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Giriş yapılıyor...</>
                            ) : (
                                <>Giriş Yap <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm text-slate-500">
                        Hesabınız yok mu?{' '}
                        <Link href="/register" className="text-isik-blue-lighter hover:text-blue-300 transition-colors font-medium">
                            Kayıt Ol
                        </Link>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Sadece @isik.edu.tr ve @isikun.edu.tr e-postaları kabul edilir
                </p>
            </div>
        </div>
    );
}
