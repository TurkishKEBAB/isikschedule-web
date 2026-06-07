'use client';

import Link from 'next/link';
import { GraduationCap, Zap, Target, Download, ArrowRight, Calendar, ChevronRight } from 'lucide-react';
import { LanguageSwitcher, useLanguage } from './context/LanguageContext';

export default function Home() {
    const { t } = useLanguage();

    return (
        <main className="min-h-screen bg-surface-900">
            <header className="sticky top-0 z-50 bg-surface-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-16">
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-isik-blue to-isik-blue-lighter flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-white tracking-tight">IşıkSchedule</span>
                        </Link>
                        <nav className="flex items-center gap-2">
                            <LanguageSwitcher />
                            <Link href="/login" className="btn-ghost !text-xs">{t.homeLogin}</Link>
                            <Link href="/scheduler" className="btn-primary !text-xs !py-2">
                                <Calendar className="w-3.5 h-3.5" />
                                {t.homeStart}
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            <section className="relative overflow-hidden border-b border-white/5">
                <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-isik-blue-lighter/10 border border-isik-blue-lighter/20 text-isik-blue-lighter text-sm font-medium mb-8">
                        <Zap className="w-3.5 h-3.5" />
                        {t.homeBadge}
                    </div>

                    <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
                        {t.homeTitleLine1}
                        <br />
                        <span className="bg-gradient-to-r from-isik-blue-lighter to-isik-gold bg-clip-text text-transparent">
                            {t.homeTitleLine2}
                        </span>
                    </h1>

                    <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        {t.homeDescription}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href="/scheduler" className="btn-primary !px-8 !py-3.5 !text-base !shadow-xl !shadow-blue-500/25">
                            {t.homePrimaryCta}
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link href="/upload" className="btn-secondary !px-8 !py-3.5 !text-base">
                            {t.homeSecondaryCta}
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            <section className="relative py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-isik-blue-lighter mb-3">{t.homeFeaturesEyebrow}</p>
                        <h2 className="text-3xl font-bold text-white">{t.homeFeaturesTitle}</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Zap className="w-6 h-6" />}
                            iconBg="from-amber-500/20 to-orange-500/20"
                            iconColor="text-amber-400"
                            title={t.homeFeatureFastTitle}
                            description={t.homeFeatureFastDescription}
                        />
                        <FeatureCard
                            icon={<Target className="w-6 h-6" />}
                            iconBg="from-blue-500/20 to-indigo-500/20"
                            iconColor="text-blue-400"
                            title={t.homeFeatureOptimizeTitle}
                            description={t.homeFeatureOptimizeDescription}
                        />
                        <FeatureCard
                            icon={<Download className="w-6 h-6" />}
                            iconBg="from-emerald-500/20 to-teal-500/20"
                            iconColor="text-emerald-400"
                            title={t.homeFeatureExportTitle}
                            description={t.homeFeatureExportDescription}
                        />
                    </div>
                </div>
            </section>

            <section className="py-24 px-4 sm:px-6 border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-isik-blue-lighter mb-3">{t.homeStepsEyebrow}</p>
                        <h2 className="text-3xl font-bold text-white">{t.homeStepsTitle}</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <StepCard step="01" title={t.homeStepUploadTitle} description={t.homeStepUploadDescription} />
                        <StepCard step="02" title={t.homeStepSelectTitle} description={t.homeStepSelectDescription} />
                        <StepCard step="03" title={t.homeStepGenerateTitle} description={t.homeStepGenerateDescription} />
                    </div>
                </div>
            </section>

            <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <GraduationCap className="w-4 h-4" />
                        <span>© 2026 IşıkSchedule</span>
                    </div>
                    <p className="text-slate-400 text-sm">
                        {t.homeFooterText}
                    </p>
                </div>
            </footer>
        </main>
    );
}

function FeatureCard({ icon, iconBg, iconColor, title, description }: {
    icon: React.ReactNode; iconBg: string; iconColor: string; title: string; description: string;
}) {
    return (
        <div className="group glass-panel p-6 hover:border-white/10 transition-all duration-300">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center ${iconColor} mb-4`}>
                {icon}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
    );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
    return (
        <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-800 border border-white/5 text-isik-blue-lighter font-bold text-lg mb-4">
                {step}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
    );
}
