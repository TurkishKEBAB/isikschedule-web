'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Upload, LogIn, LogOut, Menu, Shield, User, UserCircle, X } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface NavUser {
    email: string;
    role: string;
}

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [user, setUser] = useState<NavUser | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const headerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!mobileOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (headerRef.current?.contains(event.target as Node)) return;
            setMobileOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMobileOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [mobileOpen]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        router.replace('/');
    };

    const isActive = (path: string) => pathname === path;

    return (
        <header ref={headerRef} className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
            <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-surface-900/80 px-4 shadow-2xl shadow-black/40 backdrop-blur-xl ring-1 ring-inset ring-white/10 sm:px-5">
                <div className="flex h-16 items-center justify-between">
                    <Link href="/" aria-label="IşıkSchedule" className="flex items-center gap-2.5 group">
                        <BrandLogo size="md" wordmarkClassName="hidden md:block" />
                    </Link>

                    <nav className="hidden sm:flex items-center gap-1">
                        <NavLink href="/scheduler" active={isActive('/scheduler')} icon={<Calendar className="w-4 h-4" />} label={t.navScheduler} />
                        <NavLink href="/upload" active={isActive('/upload')} icon={<Upload className="w-4 h-4" />} label={t.navUpload} />
                        {user && (
                            <NavLink href="/account" active={isActive('/account')} icon={<UserCircle className="w-4 h-4" />} label={t.navAccount} />
                        )}
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
                            <Link href="/login" className="btn-secondary !p-2 sm:!px-4 sm:!py-2 !text-xs" aria-label={t.navLogin}>
                                <LogIn className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.navLogin}</span>
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() => setMobileOpen((prev) => !prev)}
                            className="btn-ghost !p-2 sm:hidden"
                            aria-label={mobileOpen ? t.close : t.openNavigation}
                            aria-expanded={mobileOpen}
                            aria-controls="mobile-navigation"
                        >
                            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {mobileOpen && (
                    <nav
                        id="mobile-navigation"
                        className="grid grid-cols-2 gap-2 border-t border-white/5 pb-3 pt-3 sm:hidden"
                    >
                        <NavLink
                            href="/scheduler"
                            active={isActive('/scheduler')}
                            icon={<Calendar className="w-4 h-4" />}
                            label={t.navScheduler}
                            onClick={() => setMobileOpen(false)}
                        />
                        <NavLink
                            href="/upload"
                            active={isActive('/upload')}
                            icon={<Upload className="w-4 h-4" />}
                            label={t.navUpload}
                            onClick={() => setMobileOpen(false)}
                        />
                        {user && (
                            <NavLink
                                href="/account"
                                active={isActive('/account')}
                                icon={<UserCircle className="w-4 h-4" />}
                                label={t.navAccount}
                                onClick={() => setMobileOpen(false)}
                            />
                        )}
                        {user?.role === 'admin' && (
                            <NavLink
                                href="/admin"
                                active={isActive('/admin')}
                                icon={<Shield className="w-4 h-4" />}
                                label={t.navAdmin}
                                onClick={() => setMobileOpen(false)}
                            />
                        )}
                    </nav>
                )}
            </div>
        </header>
    );
}

function NavLink({
    href,
    active,
    icon,
    label,
    onClick,
}: {
    href: string;
    active: boolean;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
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
