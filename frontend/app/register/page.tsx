'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GraduationCap, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';

export default function RegisterPage() {
    const { register } = useAuth();
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');

        if (password !== confirmPassword) { setError(t.registerPasswordMismatch); return; }
        if (password.length < 6) { setError(t.registerPasswordTooShort); return; }

        const domain = email.split('@')[1]?.toLowerCase();
        if (domain !== 'isik.edu.tr' && domain !== 'isikun.edu.tr') {
            setError(t.registerInvalidDomain);
            return;
        }

        setIsLoading(true);
        try {
            await register(email, password);
        } catch (err: any) {
            setError(err.message || t.registerFailed);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute right-4 top-4 z-10">
                <LanguageSwitcher />
            </div>

            <div className="relative w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-isik-blue to-isik-blue-lighter shadow-xl shadow-blue-500/20 mb-4">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">IşıkSchedule</h1>
                    <p className="text-sm text-slate-400 mt-1">{t.registerProductSubtitle}</p>
                </div>

                <div className="glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white text-center mb-6">{t.registerTitle}</h2>

                    {error && (
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
                            <span className="flex-shrink-0 mt-0.5">!</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="register-email" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.registerEmailLabel}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="register-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}
                                    placeholder="ornek@isik.edu.tr" className="input-field !pl-10" required
                                    suppressHydrationWarning
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 pl-1">{t.registerEmailHint}</p>
                        </div>

                        <div>
                            <label htmlFor="register-password" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.registerPasswordLabel}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="register-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)}
                                    placeholder="••••••••" className="input-field !pl-10 !pr-10" required minLength={6}
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

                        <div>
                            <label htmlFor="register-confirm-password" className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block mb-1.5">{t.registerConfirmLabel}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="register-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                                    placeholder="••••••••" className="input-field !pl-10 !pr-10" required
                                    suppressHydrationWarning
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    aria-label={showConfirmPassword ? t.hidePassword : t.showPassword}
                                    title={showConfirmPassword ? t.hidePassword : t.showPassword}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading}
                            className="btn-primary w-full !py-3">
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />{t.registerSubmitting}</>
                            ) : (
                                <>{t.registerSubmit}<ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-sm text-slate-400">
                        {t.registerHaveAccount}{' '}
                        <Link href="/login" className="text-isik-blue-lighter hover:text-blue-300 transition-colors font-medium">
                            {t.registerLoginLink}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
