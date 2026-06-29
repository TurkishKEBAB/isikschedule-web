'use client';

import Link from 'next/link';
import {
    ArrowRight,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Download,
    Sparkles,
    Target,
    Zap,
} from 'lucide-react';
import { LanguageSwitcher, useLanguage } from './context/LanguageContext';
import { AuroraBackground } from './components/AuroraBackground';
import { Reveal } from './components/Reveal';
import { CountUp } from './components/CountUp';
import { SchedulePreview } from './components/SchedulePreview';
import { BrandLogo } from './components/BrandLogo';

export default function Home() {
    const { t } = useLanguage();

    return (
        <main className="relative min-h-screen overflow-x-hidden bg-[#0B1020] text-slate-100 antialiased">
            <AuroraBackground />

            <header className="sticky top-0 z-50">
                <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
                    <div className="flex h-16 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-4 shadow-2xl shadow-black/40 backdrop-blur-xl ring-1 ring-inset ring-white/10">
                        <Link href="/" aria-label="IşıkSchedule" className="flex items-center gap-2.5">
                            <BrandLogo size="md" priority wordmarkClassName="hidden sm:block" />
                        </Link>
                        <nav className="flex items-center gap-1 sm:gap-2">
                            <LanguageSwitcher />
                            <Link href="/login" className="btn-ghost !px-2 !text-xs sm:!px-4">{t.homeLogin}</Link>
                            <Link
                                href="/scheduler"
                                aria-label={t.homeStart}
                                className="btn-primary magnetic !p-2 !text-xs sm:!px-4 sm:!py-2"
                            >
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{t.homeStart}</span>
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            <section className="relative z-10 mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:pt-24">
                <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
                    <Reveal className="text-center lg:text-left">
                        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-isik-blue-lighter/25 bg-isik-blue-lighter/10 px-4 py-1.5 text-sm font-medium text-isik-blue-lighter backdrop-blur-md">
                            <Sparkles className="h-3.5 w-3.5" />
                            {t.homeBadge}
                        </div>

                        <h1 className="mb-6 text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
                            <span className="block">{t.homeTitleLine1}</span>
                            <span className="grad-text block">{t.homeTitleLine2}</span>
                        </h1>

                        <p className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-slate-400 lg:mx-0 lg:text-lg">
                            {t.homeDescription}
                        </p>

                        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                            <Link href="/scheduler" className="magnetic group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-isik-blue via-isik-blue-light to-isik-blue-lighter px-8 py-4 text-base font-semibold text-white shadow-xl shadow-blue-500/30">
                                {t.homePrimaryCta}
                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                            <Link href="/upload" className="magnetic inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.05] px-8 py-4 text-base font-semibold text-slate-100 backdrop-blur-md hover:bg-white/[0.08]">
                                {t.homeSecondaryCta}
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 lg:justify-start">
                            <span className="inline-flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                {t.homeFeatureFastTitle}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                {t.homeFeatureExportTitle}
                            </span>
                        </div>
                    </Reveal>

                    <Reveal delay={120} className="relative mx-auto w-full max-w-xl">
                        <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-isik-blue-lighter/20 via-lab/15 to-isik-gold/15 blur-2xl" />
                        <div className="relative">
                            <SchedulePreview />

                            <div className="absolute -bottom-6 -left-6 flex items-center gap-4 rounded-2xl border border-white/[0.12] bg-[#0E1428]/85 px-5 py-4 shadow-2xl shadow-black/50 backdrop-blur-xl ring-1 ring-inset ring-white/10">
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{t.homeStatScore}</p>
                                    <CountUp to={92} className="grad-text block text-3xl font-black leading-none" />
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">{t.homeStatEcts}</p>
                                    <CountUp to={28} className="block text-3xl font-black leading-none text-white" />
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            <section className="relative z-10 mx-auto max-w-6xl px-4 py-24 sm:px-6">
                <Reveal className="mb-16 text-center">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-isik-blue-lighter">{t.homeFeaturesEyebrow}</p>
                    <h2 className="text-4xl font-bold tracking-tight text-white">
                        {t.homeFeaturesTitle}
                    </h2>
                </Reveal>

                <div className="grid gap-6 md:grid-cols-3">
                    <FeatureCard
                        delay={0}
                        border="from-white/15 via-isik-gold/25 to-orange-500/25"
                        hoverShadow="hover:shadow-amber-500/20"
                        iconBg="from-amber-500/25 to-orange-500/20"
                        iconColor="text-amber-300"
                        icon={<Zap className="h-6 w-6" />}
                        title={t.homeFeatureFastTitle}
                        description={t.homeFeatureFastDescription}
                    />
                    <FeatureCard
                        delay={120}
                        border="from-white/15 via-lab/25 to-isik-blue-lighter/25"
                        hoverShadow="hover:shadow-violet-500/20"
                        iconBg="from-blue-500/25 to-indigo-500/20"
                        iconColor="text-blue-300"
                        icon={<Target className="h-6 w-6" />}
                        title={t.homeFeatureOptimizeTitle}
                        description={t.homeFeatureOptimizeDescription}
                    />
                    <FeatureCard
                        delay={240}
                        border="from-white/15 via-ps/25 to-isik-blue-lighter/25"
                        hoverShadow="hover:shadow-emerald-500/20"
                        iconBg="from-emerald-500/25 to-teal-500/20"
                        iconColor="text-emerald-300"
                        icon={<Download className="h-6 w-6" />}
                        title={t.homeFeatureExportTitle}
                        description={t.homeFeatureExportDescription}
                    />
                </div>
            </section>

            <section className="relative z-10 mx-auto max-w-5xl px-4 py-24 sm:px-6">
                <Reveal className="mb-16 text-center">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-isik-blue-lighter">{t.homeStepsEyebrow}</p>
                    <h2 className="text-4xl font-bold tracking-tight text-white">{t.homeStepsTitle}</h2>
                </Reveal>

                <div className="relative grid gap-10 md:grid-cols-3">
                    <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-lab/50 to-transparent md:block" />
                    <StepCard delay={0} step="01" stepColor="text-isik-blue-lighter" title={t.homeStepUploadTitle} description={t.homeStepUploadDescription} />
                    <StepCard delay={120} step="02" stepColor="text-violet-300" title={t.homeStepSelectTitle} description={t.homeStepSelectDescription} />
                    <StepCard delay={240} step="03" stepColor="text-amber-300" title={t.homeStepGenerateTitle} description={t.homeStepGenerateDescription} />
                </div>
            </section>

            <footer className="relative z-10 border-t border-white/10 px-4 py-10 sm:px-6">
                <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <BrandLogo size="sm" showWordmark={false} />
                        <span>© 2026 IşıkSchedule</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 sm:items-end">
                        <p className="text-center text-sm text-slate-400 sm:text-right">{t.homeFooterText}</p>
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <Link href="/privacy" className="hover:text-slate-300">{t.legalPrivacyLink}</Link>
                            <span aria-hidden="true">/</span>
                            <Link href="/terms" className="hover:text-slate-300">{t.legalTermsLink}</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}

function FeatureCard({ icon, iconBg, iconColor, border, hoverShadow, title, description, delay }: {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    border: string;
    hoverShadow: string;
    title: string;
    description: string;
    delay: number;
}) {
    return (
        <Reveal delay={delay} className="h-full">
            <div className={`lift group h-full rounded-[28px] bg-gradient-to-br ${border} p-[1.5px] shadow-xl shadow-black/30 ${hoverShadow}`}>
                <div className="h-full rounded-[27px] bg-[#0E1428]/90 p-7 backdrop-blur-xl">
                    <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBg} ${iconColor} ring-1 ring-inset ring-white/10`}>
                        {icon}
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm leading-relaxed text-slate-400">{description}</p>
                </div>
            </div>
        </Reveal>
    );
}

function StepCard({ step, stepColor, title, description, delay }: {
    step: string;
    stepColor: string;
    title: string;
    description: string;
    delay: number;
}) {
    return (
        <Reveal delay={delay} className="relative text-center">
            <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0E1428]/85 text-lg font-black ${stepColor} shadow-lg shadow-black/40 ring-1 ring-inset ring-white/10 backdrop-blur-xl`}>
                {step}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{description}</p>
        </Reveal>
    );
}
