'use client';

import { useState } from 'react';
import Link from 'next/link';
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

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalı');
            return;
        }

        // Validate email domain
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="text-4xl font-bold text-white">
                        🎓 IşıkSchedule
                    </Link>
                    <p className="text-slate-400 mt-2">Hesap Oluştur</p>
                </div>

                {/* Register Form */}
                <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 border border-slate-700 shadow-2xl">
                    <h1 className="text-2xl font-bold text-white mb-6 text-center">Kayıt Ol</h1>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">E-posta</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@isik.edu.tr"
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                @isik.edu.tr veya @isikun.edu.tr
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                                required
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Şifre Tekrar</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '⏳ Kayıt yapılıyor...' : '✨ Kayıt Ol'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-slate-400">
                        Zaten hesabınız var mı?{' '}
                        <Link href="/login" className="text-purple-400 hover:text-purple-300">
                            Giriş Yap
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
