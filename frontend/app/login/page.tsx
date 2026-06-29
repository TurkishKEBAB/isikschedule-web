'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { AuroraBackground } from '../components/AuroraBackground';
import { BrandLogo } from '../components/BrandLogo';

export default function LoginPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || t.loginFailed);
            }

            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            router.replace(data.user.role === 'admin' ? '/admin' : '/scheduler');
        } catch (err: any) {
            setError(err.message || t.loginFailed);
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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-900 p-4">
            <AuroraBackground variant="absolute" vignette={false} className="opacity-80" />
            <div className="absolute right-4 top-4 z-10">
                <LanguageSwitcher />
            </div>

            <div className="relative z-[1] w-full max-w-sm">
                <div className="mb-8 flex justify-center text-center">
                    <BrandLogo size="lg" priority subtitle={t.loginProductSubtitle} />
                </div>

                <div className="glass-panel border-white/10 bg-surface-800/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <h2 className="text-lg font-semibold text-white text-center mb-6">{t.loginTitle}</h2>

                    {error && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
                            <span className="flex-shrink-0 mt-0.5">!</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="login-email" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.loginEmailLabel}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="login-email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="ornek@isik.edu.tr"
                                    className="input-field !pl-10"
                                    required
                                    suppressHydrationWarning
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="login-password" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.loginPasswordLabel}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="login-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="••••••••"
                                    className="input-field !pl-10 !pr-10"
                                    required
                                    suppressHydrationWarning
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                                    title={showPassword ? t.hidePassword : t.showPassword}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full !py-3"
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />{t.loginSubmitting}</>
                            ) : (
                                <>{t.loginSubmit} <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm text-slate-400">
                        {t.loginNoAccount}{' '}
                        <Link href="/register" className="text-isik-blue-lighter hover:text-blue-300 transition-colors font-medium">
                            {t.loginRegisterLink}
                        </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <Link href="/privacy" className="hover:text-slate-300">{t.legalPrivacyLink}</Link>
                        <span aria-hidden="true">/</span>
                        <Link href="/terms" className="hover:text-slate-300">{t.legalTermsLink}</Link>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    {t.loginDomainNote}
                </p>
            </div>
        </div>
    );
}
