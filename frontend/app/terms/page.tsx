'use client';

import Link from 'next/link';
import { ArrowLeft, FileCheck2, Mail, ShieldCheck } from 'lucide-react';
import { AuroraBackground } from '../components/AuroraBackground';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageSwitcher, useLanguage } from '../context/LanguageContext';
import {
    CONTACT_EMAILS,
    LEGAL_LAST_UPDATED,
    termsContent,
} from '../legal/content';

export default function TermsPage() {
    const { lang, t } = useLanguage();
    const sections = termsContent[lang];

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#0B1020] text-slate-100">
            <AuroraBackground variant="absolute" vignette={false} className="opacity-60" />

            <div className="relative z-[1] mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
                <header className="mb-8 flex items-center justify-between gap-4">
                    <Link href="/" aria-label="IşıkSchedule" className="flex items-center gap-2.5">
                        <BrandLogo size="md" priority />
                    </Link>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <Link href="/" className="btn-ghost !px-3">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">{t.legalBack}</span>
                        </Link>
                    </div>
                </header>

                <section className="mb-8 border-b border-white/10 pb-8">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-isik-gold/25 bg-isik-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                        <FileCheck2 className="h-4 w-4" />
                        {lang === 'tr' ? 'Şartlar' : 'Terms'}
                    </div>
                    <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                        {lang === 'tr' ? 'Kullanım Şartları' : 'Terms of Use'}
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                        {lang === 'tr'
                            ? 'IşıkSchedule bağımsız bir öğrenci projesidir. Bu şartlar uygulamayı hangi çerçevede kullanabileceğinizi açıklar.'
                            : 'IşıkSchedule is an independent student project. These terms explain the conditions for using the app.'}
                    </p>
                </section>

                <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
                        <div className="mb-5 flex items-start gap-3">
                            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    {lang === 'tr' ? 'Bağımsız proje' : 'Independent project'}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-slate-200">
                                    {lang === 'tr'
                                        ? 'Resmi üniversite kayıt sistemi değildir.'
                                        : 'Not an official university registration system.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail className="mt-0.5 h-5 w-5 text-isik-blue-lighter" />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                    {lang === 'tr' ? 'İletişim' : 'Contact'}
                                </p>
                                <div className="mt-2 space-y-1">
                                    {CONTACT_EMAILS.map((email) => (
                                        <a
                                            key={email}
                                            href={`mailto:${email}`}
                                            className="block break-all text-sm text-isik-blue-lighter hover:text-blue-200"
                                        >
                                            {email}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 border-t border-white/10 pt-5 text-xs text-slate-400">
                            {t.legalLastUpdated}: {LEGAL_LAST_UPDATED}
                        </div>
                    </aside>

                    <article className="rounded-2xl border border-white/10 bg-[#0E1428]/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
                        <div className="space-y-8">
                            {sections.map((section) => (
                                <section key={section.heading} className="border-t border-white/10 pt-6 first:border-t-0 first:pt-0">
                                    <h2 className="text-xl font-bold text-white">{section.heading}</h2>
                                    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300 sm:text-base">
                                        {section.body.map((paragraph) => (
                                            <p key={paragraph}>{paragraph}</p>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </article>
                </div>
            </div>
        </main>
    );
}
