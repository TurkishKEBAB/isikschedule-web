import Link from 'next/link';
import { GraduationCap, Zap, Target, Download, ArrowRight, Calendar, ChevronRight } from 'lucide-react';

export default function Home() {
    return (
        <main className="min-h-screen bg-surface-900">
            {/* Header */}
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
                            <Link href="/login" className="btn-ghost !text-xs">Giriş</Link>
                            <Link href="/scheduler" className="btn-primary !text-xs !py-2">
                                <Calendar className="w-3.5 h-3.5" />
                                Başla
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-isik-blue/20 via-isik-blue-lighter/10 to-transparent rounded-full blur-3xl" />
                    <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
                    {/* Pill badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-isik-blue-lighter/10 border border-isik-blue-lighter/20 text-isik-blue-lighter text-sm font-medium mb-8">
                        <Zap className="w-3.5 h-3.5" />
                        Işık Üniversitesi için özel olarak tasarlandı
                    </div>

                    <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
                        Mükemmel Ders Programını
                        <br />
                        <span className="bg-gradient-to-r from-isik-blue-lighter to-purple-400 bg-clip-text text-transparent">
                            Saniyeler İçinde Oluştur
                        </span>
                    </h1>

                    <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Ders listeni yükle, tercihlerini belirle ve yapay zeka destekli algoritmalarımız 
                        senin için en uygun programı oluştursun.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href="/scheduler" className="btn-primary !px-8 !py-3.5 !text-base !rounded-2xl !shadow-xl !shadow-blue-500/25">
                            Hemen Başla
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link href="/upload" className="btn-secondary !px-8 !py-3.5 !text-base !rounded-2xl">
                            Demo Dene
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="relative py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-isik-blue-lighter mb-3">Özellikler</p>
                        <h2 className="text-3xl font-bold text-white">Neden IşıkSchedule?</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Zap className="w-6 h-6" />}
                            iconBg="from-amber-500/20 to-orange-500/20"
                            iconColor="text-amber-400"
                            title="Işık Hızında"
                            description="Gelişmiş algoritmalar ile saniyeler içinde yüzlerce program kombinasyonu oluşturun."
                        />
                        <FeatureCard
                            icon={<Target className="w-6 h-6" />}
                            iconBg="from-blue-500/20 to-indigo-500/20"
                            iconColor="text-blue-400"
                            title="Akıllı Optimizasyon"
                            description="Boş gün, sabah dersleri, ECTS limiti gibi tercihlerinizi özelleştirin."
                        />
                        <FeatureCard
                            icon={<Download className="w-6 h-6" />}
                            iconBg="from-emerald-500/20 to-teal-500/20"
                            iconColor="text-emerald-400"
                            title="Kolay Dışa Aktarım"
                            description="Programınızı PDF veya iCal formatında dışa aktarın, link ile paylaşın."
                        />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-24 px-4 sm:px-6 border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-isik-blue-lighter mb-3">Adımlar</p>
                        <h2 className="text-3xl font-bold text-white">Nasıl Çalışır?</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <StepCard step="01" title="Yükle" description="Excel formatındaki ders listesini sürükle-bırak ile yükleyin." />
                        <StepCard step="02" title="Seç" description="Almak istediğiniz dersleri ve tercihlerinizi belirleyin." />
                        <StepCard step="03" title="Oluştur" description="Algoritma en uygun programları otomatik olarak oluştursun." />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <GraduationCap className="w-4 h-4" />
                        <span>© 2026 IşıkSchedule</span>
                    </div>
                    <p className="text-slate-600 text-sm">
                        Işık Üniversitesi öğrencileri için geliştirilmiştir.
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
