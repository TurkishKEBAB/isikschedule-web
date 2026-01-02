'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    // Check if already logged in
    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            if (user.role === 'admin') {
                router.replace('/admin');
            } else {
                router.replace('/scheduler');
            }
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

            // Redirect based on role
            if (data.user.role === 'admin') {
                router.replace('/admin');
            } else {
                router.replace('/scheduler');
            }
        } catch (err: any) {
            setError(err.message || 'Giriş başarısız');
            setIsLoading(false);
        }
    };

    // Show loading while checking auth
    if (isChecking) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">⏳ Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="text-4xl font-bold text-white">
                        🎓 IşıkSchedule
                    </Link>
                    <p className="text-slate-400 mt-2">Ders Programı Oluşturucu</p>
                </div>

                {/* Login Form */}
                <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 border border-slate-700 shadow-2xl">
                    <h1 className="text-2xl font-bold text-white mb-6 text-center">Giriş Yap</h1>

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
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                                required
                                suppressHydrationWarning
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                                required
                                suppressHydrationWarning
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '⏳ Giriş yapılıyor...' : '🚀 Giriş Yap'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-slate-400">
                        Hesabınız yok mu?{' '}
                        <Link href="/register" className="text-blue-400 hover:text-blue-300">
                            Kayıt Ol
                        </Link>
                    </div>
                </div>

                {/* Info */}
                <p className="text-center text-slate-500 text-sm mt-6">
                    Sadece @isik.edu.tr ve @isikun.edu.tr e-postaları kabul edilir
                </p>
            </div>
        </div>
    );
}
