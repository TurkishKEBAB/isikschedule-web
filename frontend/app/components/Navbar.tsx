'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, Calendar, Upload, LogIn, LogOut, Shield, User } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { useEffect, useState } from 'react';

interface NavUser {
    email: string;
    role: string;
}

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [user, setUser] = useState<NavUser | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        router.replace('/');
    };

    const isActive = (path: string) => pathname === path;

    return (
        <header className="sticky top-0 z-50 bg-surface-900/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2.5 group">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">
                            IşıkSchedule
                        </span>
                    </Link>

                    <nav className="hidden sm:flex items-center gap-1">
                        <NavLink href="/scheduler" active={isActive('/scheduler')} icon={<Calendar className="w-4 h-4" />} label={t.navScheduler} />
                        <NavLink href="/upload" active={isActive('/upload')} icon={<Upload className="w-4 h-4" />} label={t.navUpload} />
                        {user?.role === 'admin' && (
                            <NavLink href="/admin" active={isActive('/admin')} icon={<Shield className="w-4 h-4" />} label={t.navAdmin} />
                        )}
                    </nav>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />

                        {user ? (
                            <div className="flex items-center gap-2">
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-700/50 text-sm">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-slate-300 max-w-[120px] truncate">{user.email}</span>
                                </div>
                                <button type="button" onClick={handleLogout} className="btn-ghost !p-2" title={t.navLogout} aria-label={t.navLogout}>
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <Link href="/login" className="btn-secondary !py-2 !text-xs">
                                <LogIn className="w-3.5 h-3.5" />
                                <span>{t.navLogin}</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

function NavLink({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${active
                    ? 'bg-isik-blue-lighter/15 text-isik-blue-lighter'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
        >
            {icon}
            {label}
        </Link>
    );
}
